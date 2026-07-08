import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';

import { apiRequest } from './api';

type SyncPushTokenPayload = {
  token: string;
  platform: string;
};

type NotificationData = {
  type?: unknown;
  documentId?: unknown;
  newsDocumentId?: unknown;
  messageDocumentId?: unknown;
  [key: string]: unknown;
};

type NotificationRouteTarget =
  | '/(tabs)'
  | {
      pathname: '/admin/adminmessage';
    }
  | {
      pathname: '/(tabs)/notification';
      params: {
        documentId: string;
      };
    }
  | {
      pathname: '/news/[documentId]';
      params: {
        documentId: string;
      };
    };

const handledNotificationKeys = new Set<string>();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function syncDevicePushToken(
  payload: SyncPushTokenPayload
) {
  if (!payload.token) {
    return null;
  }

  return apiRequest('/api/vikof/device-token', {
    method: 'POST',
    authMode: 'user',
    body: {
      token: payload.token,
      platform: payload.platform,
    },
  });
}

function getStringValue(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function normalizeNotificationType(value: unknown) {
  return getStringValue(value).toLowerCase();
}

function getNotificationDocumentId(data: NotificationData) {
  return (
    getStringValue(data.documentId) ||
    getStringValue(data.newsDocumentId) ||
    getStringValue(data.messageDocumentId)
  );
}

function getNotificationKey(
  response: Notifications.NotificationResponse
) {
  const data = response.notification.request.content
    .data as NotificationData;

  return [
    response.notification.request.identifier,
    normalizeNotificationType(data.type),
    getNotificationDocumentId(data),
  ]
    .filter(Boolean)
    .join(':');
}

function markNotificationHandled(
  response: Notifications.NotificationResponse
) {
  const key = getNotificationKey(response);

  if (key && handledNotificationKeys.has(key)) {
    return false;
  }

  if (key) {
    handledNotificationKeys.add(key);
  }

  return true;
}

function getNotificationRouteTarget(
  data: NotificationData
): NotificationRouteTarget {
  const type = normalizeNotificationType(data.type);
  const documentId = getNotificationDocumentId(data);

  if (type === 'message' && documentId) {
    return {
      pathname: '/admin/adminmessage',
    };
  }

  if (type === 'notification' && documentId) {
    return {
      pathname: '/(tabs)/notification',
      params: {
        documentId,
      },
    };
  }

  if (type === 'news' && documentId) {
    return {
      pathname: '/news/[documentId]',
      params: {
        documentId,
      },
    };
  }

  return '/(tabs)';
}

function navigateFromNotificationData(data: NotificationData) {
  router.push(getNotificationRouteTarget(data) as any);
}

function handleNotificationResponse(
  response: Notifications.NotificationResponse
) {
  if (!markNotificationHandled(response)) {
    return;
  }

  const data = response.notification.request.content
    .data as NotificationData;

  console.log('[NOTIFICATION_PRESSED]', data);

  navigateFromNotificationData(data);
}

export async function getInitialNotificationRouteTarget() {
  try {
    const response =
      await Notifications.getLastNotificationResponseAsync();

    if (!response) {
      return null;
    }

    if (!markNotificationHandled(response)) {
      return null;
    }

    const data = response.notification.request.content
      .data as NotificationData;

    console.log('[NOTIFICATION_INITIAL_OPEN]', data);

    return getNotificationRouteTarget(data);
  } catch (error) {
    console.log(
      '[NOTIFICATION_INITIAL_OPEN_FAILED]',
      error
    );

    return null;
  }
}

export async function getExpoPushToken() {
  if (Platform.OS === 'web') {
    console.log(
      '[NOTIFICATION_TOKEN_SKIP]',
      'Web không dùng push token theo luồng mobile'
    );

    return null;
  }

  if (!Device.isDevice) {
    console.log(
      '[NOTIFICATION_TOKEN_SKIP]',
      'Push notification nên test trên thiết bị thật'
    );

    return null;
  }

  const existingPermission =
    await Notifications.getPermissionsAsync();

  let finalStatus = existingPermission.status;

  if (finalStatus !== 'granted') {
    const requestPermission =
      await Notifications.requestPermissionsAsync();

    finalStatus = requestPermission.status;
  }

  if (finalStatus !== 'granted') {
    console.log('[NOTIFICATION_PERMISSION_DENIED]');

    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(
      'default',
      {
        name: 'Default',
        importance:
          Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      }
    );
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.log('[NOTIFICATION_PROJECT_ID_MISSING]');

    return null;
  }

  const token =
    await Notifications.getExpoPushTokenAsync({
      projectId,
    });

  return token.data;
}

export async function syncNotificationTokenAfterLogin() {
  try {
    const token = await getExpoPushToken();

    if (!token) {
      return null;
    }

    await syncDevicePushToken({
      token,
      platform: Platform.OS,
    });

    console.log('[NOTIFICATION_TOKEN_SYNCED]', token);

    return token;
  } catch (error) {
    console.log(
      '[NOTIFICATION_TOKEN_SYNC_FAILED]',
      error
    );

    return null;
  }
}

export function setupNotificationListeners() {
  const receivedSubscription =
    Notifications.addNotificationReceivedListener(
      notification => {
        console.log(
          '[NOTIFICATION_RECEIVED]',
          notification
        );
      }
    );

  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener(
      response => {
        handleNotificationResponse(response);
      }
    );

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
