import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import {
  appEvents,
  APP_EVENTS,
} from './app-events.service';

const AUTH_TOKEN_KEY = 'auth_token';
const APP_SESSION_KEY = 'app_session';

export type UserInfo = {
  id?: string | number;
  documentId?: string;

  username?: string;
  email?: string;

  phone?: string;
  phoneNumber?: string;
  PhoneNumber?: string;

  fullName?: string;
  FirstName?: string;
  LastName?: string;
  CustomName?: string;

  DateOfBirth?: string | null;
  Sex?: string | null;

  confirmed?: boolean;
  blocked?: boolean;

  MarkDelete?: boolean;
  MarkDeleteDate?: string | null;

  IsFirstRegister?: boolean;
  ExpiredFirstRegisterVoucher?: string | null;

  wishlist_product_ids?: string[];

  Branch?: unknown;
  branch?: unknown;
  selected_branch?: unknown;
  selectedBranch?: unknown;

  Avatar?: unknown;
  role?: unknown;

  [key: string]: unknown;
};

export type SelectedBranchConfig = {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  area: string;
  address: string;
  phone?: string | null;
  zalo?: string | null;
  messenger?: string | null;
  messenger_web?: string | null;
};

export type AppConfig = {
  search_terms: string[];
  wishlist_product_ids: string[];
  selected_branch?: SelectedBranchConfig | null;
  language?: string;
  [key: string]: unknown;
};

export type AppSession = {
  token: string;
  user_info: UserInfo | null;
  config: AppConfig;
};

type StoredAppSession = {
  user_info: UserInfo | null;
  config: AppConfig;
};

const defaultConfig: AppConfig = {
  search_terms: [],
  wishlist_product_ids: [],
};

function getDefaultConfig(): AppConfig {
  return {
    ...defaultConfig,
    search_terms: [...defaultConfig.search_terms],
    wishlist_product_ids: [...defaultConfig.wishlist_product_ids],
  };
}

function getDefaultStoredSession(): StoredAppSession {
  return {
    user_info: null,
    config: getDefaultConfig(),
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => String(item).trim())
    .filter(Boolean);
}

function normalizeWishlistIds(value: unknown): string[] {
  return Array.from(
    new Set(
      normalizeStringArray(value)
    )
  );
}

function isSameStringArray(a: string[], b: string[]) {
  if (a.length !== b.length) return false;

  return a.every((item, index) => item === b[index]);
}

function emitWishlistUpdatedIfChanged(
  oldConfig: AppConfig,
  newConfig: AppConfig
) {
  const oldIds = normalizeWishlistIds(
    oldConfig.wishlist_product_ids
  );

  const newIds = normalizeWishlistIds(
    newConfig.wishlist_product_ids
  );

  if (!isSameStringArray(oldIds, newIds)) {
    appEvents.emit(
      APP_EVENTS.WISHLIST_UPDATED,
      newIds
    );
  }
}

async function setStorageItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }

    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function getStorageItem(key: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(key);
    }

    return null;
  }

  return SecureStore.getItemAsync(key);
}

async function deleteStorageItem(key: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }

    return;
  }

  await SecureStore.deleteItemAsync(key);
}

async function setToken(token: string) {
  await setStorageItem(AUTH_TOKEN_KEY, token);
}

async function getToken() {
  return getStorageItem(AUTH_TOKEN_KEY);
}

async function deleteToken() {
  await deleteStorageItem(AUTH_TOKEN_KEY);
}

function normalizeStoredSession(
  rawSession: Partial<StoredAppSession>
): StoredAppSession {
  const rawConfig: Partial<AppConfig> =
    rawSession.config ?? {};

  return {
    user_info: rawSession.user_info ?? null,

    config: {
      ...getDefaultConfig(),
      ...rawConfig,

      search_terms: normalizeStringArray(
        rawConfig.search_terms
      ),

      wishlist_product_ids: normalizeWishlistIds(
        rawConfig.wishlist_product_ids
      ),
    },
  };
}

export async function initAppSession() {
  const currentSession = await getStorageItem(APP_SESSION_KEY);

  if (!currentSession) {
    await setStorageItem(
      APP_SESSION_KEY,
      JSON.stringify(getDefaultStoredSession())
    );
  }
}

export async function saveAppSession(session: Partial<AppSession>) {
  const currentSession = await getAppSession();

  if (typeof session.token === 'string' && session.token) {
    await setToken(session.token);
  }

  const nextStoredSession = normalizeStoredSession({
    user_info:
      session.user_info !== undefined
        ? session.user_info
        : currentSession.user_info,

    config: {
      ...getDefaultConfig(),
      ...currentSession.config,
      ...(session.config ?? {}),
    },
  });

  await setStorageItem(
    APP_SESSION_KEY,
    JSON.stringify(nextStoredSession)
  );

  emitWishlistUpdatedIfChanged(
    currentSession.config,
    nextStoredSession.config
  );
}

export async function getAppSession(): Promise<AppSession> {
  const token = (await getToken()) ?? '';
  const rawSession = await getStorageItem(APP_SESSION_KEY);

  if (!rawSession) {
    await initAppSession();

    return {
      token,
      user_info: null,
      config: getDefaultConfig(),
    };
  }

  try {
    const parsedSession = JSON.parse(rawSession) as Partial<StoredAppSession>;
    const storedSession = normalizeStoredSession(parsedSession);

    return {
      token,
      user_info: storedSession.user_info,
      config: storedSession.config,
    };
  } catch {
    await setStorageItem(
      APP_SESSION_KEY,
      JSON.stringify(getDefaultStoredSession())
    );

    return {
      token,
      user_info: null,
      config: getDefaultConfig(),
    };
  }
}

export async function getAuthToken() {
  return getToken();
}

export async function getUserInfo() {
  const session = await getAppSession();

  return session.user_info;
}

export async function getAppConfig() {
  const session = await getAppSession();

  return session.config;
}

export async function updateAppConfig(nextConfig: Partial<AppConfig>) {
  const currentSession = await getAppSession();

  const nextStoredSession = normalizeStoredSession({
    user_info: currentSession.user_info,

    config: {
      ...getDefaultConfig(),
      ...currentSession.config,
      ...nextConfig,
    },
  });

  await setStorageItem(
    APP_SESSION_KEY,
    JSON.stringify(nextStoredSession)
  );

  emitWishlistUpdatedIfChanged(
    currentSession.config,
    nextStoredSession.config
  );

  return nextStoredSession.config;
}

export async function updateUserInfo(userInfo: UserInfo | null) {
  const currentSession = await getAppSession();

  const nextStoredSession = normalizeStoredSession({
    user_info: userInfo,

    config: {
      ...getDefaultConfig(),
      ...currentSession.config,
    },
  });

  await setStorageItem(
    APP_SESSION_KEY,
    JSON.stringify(nextStoredSession)
  );

  return nextStoredSession.user_info;
}

export async function clearAppSession() {
  const currentSession = await getAppSession();
  const defaultSession = getDefaultStoredSession();

  await deleteToken();

  await setStorageItem(
    APP_SESSION_KEY,
    JSON.stringify(defaultSession)
  );

  emitWishlistUpdatedIfChanged(
    currentSession.config,
    defaultSession.config
  );
}