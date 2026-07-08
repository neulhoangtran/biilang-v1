import {
  apiRequest,
  API_BASE_URL,
} from '@/services/api';

import {
  updateUserInfo,
  type UserInfo,
} from '@/services/app-storage.service';

export type UpdateProfilePayload = {
  lastName: string;
  firstName: string;
  email: string;
  dateOfBirth: string | null;
  sex: string | null;
  avatarUri?: string;
};

type MediaValue = {
  id?: number | string;
  url?: string;
  formats?: Record<string, any>;
  [key: string]: any;
};

type UpdateProfileResponse = {
  user_info?: UserInfo;
  user?: UserInfo;
  file?: MediaValue;
  files?: MediaValue[];
  [key: string]: any;
};

type DeleteAccountResponse = {
  success?: boolean;
  user_info?: UserInfo;
  user?: UserInfo;
  MarkDelete?: boolean;
  MarkDeleteDate?: string | null;
  message?: string;
  [key: string]: any;
};

function getStringValue(value: unknown) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}

function normalizeMediaUrl(url: string) {
  const value = getStringValue(url);

  if (!value) {
    return '';
  }

  if (
    value.startsWith('http://') ||
    value.startsWith('https://')
  ) {
    return value;
  }

  if (!API_BASE_URL) {
    return value;
  }

  const baseUrl = API_BASE_URL.replace(/\/+$/, '');
  const mediaPath = value.startsWith('/')
    ? value
    : `/${value}`;

  return `${baseUrl}${mediaPath}`;
}

function isRemoteUrl(uri?: string) {
  if (!uri) {
    return false;
  }

  return (
    uri.startsWith('http://') ||
    uri.startsWith('https://')
  );
}

function isUploadableUri(uri?: string) {
  if (!uri || isRemoteUrl(uri)) {
    return false;
  }

  return (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('ph://') ||
    uri.startsWith('blob:') ||
    uri.startsWith('data:')
  );
}

function getFileNameFromUri(uri: string) {
  const cleanUri = uri.split('?')[0];
  const fileName = cleanUri.split('/').pop();

  if (fileName?.includes('.')) {
    return fileName;
  }

  return `avatar-${Date.now()}.jpg`;
}

function getMimeTypeFromUri(uri: string) {
  if (uri.startsWith('data:')) {
    const match = uri.match(/^data:(.*?);/);

    if (match?.[1]) {
      return match[1];
    }
  }

  const extension = uri
    .split('?')[0]
    .split('.')
    .pop()
    ?.toLowerCase();

  switch (extension) {
    case 'png':
      return 'image/png';

    case 'webp':
      return 'image/webp';

    case 'heic':
      return 'image/heic';

    case 'heif':
      return 'image/heif';

    default:
      return 'image/jpeg';
  }
}

async function buildAvatarFormData(uri: string) {
  const formData = new FormData();
  const fileName = getFileNameFromUri(uri);
  const mimeType = getMimeTypeFromUri(uri);

  if (
    uri.startsWith('blob:') ||
    uri.startsWith('data:')
  ) {
    const response = await fetch(uri);
    const blob = await response.blob();

    formData.append('files', blob, fileName);

    return formData;
  }

  formData.append(
    'files',
    {
      uri,
      name: fileName,
      type: mimeType,
    } as any
  );

  return formData;
}

function extractUserFromResponse(
  data:
    | UpdateProfileResponse
    | DeleteAccountResponse
    | null
    | undefined
) {
  return data?.user_info || data?.user || null;
}

async function uploadProfileAvatar(avatarUri?: string) {
  if (!isUploadableUri(avatarUri)) {
    return null;
  }

  const formData = await buildAvatarFormData(avatarUri);

  const data = await apiRequest<UpdateProfileResponse>(
    '/api/vikof/profile/avatar',
    {
      method: 'POST',
      authMode: 'user',
      body: formData,
    }
  );

  const file =
    data?.file ||
    data?.files?.[0] ||
    data?.[0];

  return file?.id ?? null;
}

export async function updateProfile(
  payload: UpdateProfilePayload
) {
  const avatarId = await uploadProfileAvatar(
    payload.avatarUri
  );

  const body: Record<string, unknown> = {
    LastName: payload.lastName.trim(),
    FirstName: payload.firstName.trim(),
    email: payload.email.trim().toLowerCase(),
    DateOfBirth: payload.dateOfBirth,
    Sex: payload.sex,
  };

  if (avatarId !== null) {
    body.Avatar = avatarId;
  }

  const data =
    await apiRequest<UpdateProfileResponse>(
      '/api/vikof/profile',
      {
        method: 'PUT',
        authMode: 'user',
        body,
      }
    );

  const updatedUser = extractUserFromResponse(data);

  if (!updatedUser) {
    throw new Error(
      'API không trả về thông tin người dùng.'
    );
  }

  await updateUserInfo(updatedUser);

  return updatedUser;
}

export async function getCurrentProfile() {
  const data =
    await apiRequest<UpdateProfileResponse>(
      '/api/vikof/profile',
      {
        method: 'GET',
        authMode: 'user',
      }
    );

  const user = extractUserFromResponse(data);

  if (!user) {
    throw new Error(
      'API không trả về thông tin người dùng.'
    );
  }

  await updateUserInfo(user);

  return user;
}

export async function requestDeleteAccount() {
  const data =
    await apiRequest<DeleteAccountResponse>(
      '/api/vikof/auth/request-delete-account',
      {
        method: 'POST',
        authMode: 'user',
      }
    );

  const user = extractUserFromResponse(data);

  if (user) {
    await updateUserInfo(user);
  }

  return data;
}

export async function cancelDeleteAccount() {
  const data =
    await apiRequest<DeleteAccountResponse>(
      '/api/vikof/auth/cancel-delete-account',
      {
        method: 'POST',
        authMode: 'user',
      }
    );

  const user = extractUserFromResponse(data);

  if (user) {
    await updateUserInfo(user);
  }

  return data;
}

export function getUserDisplayPhone(
  user: UserInfo | null
) {
  return (
    getStringValue(user?.PhoneNumber) ||
    getStringValue(user?.phoneNumber) ||
    getStringValue(user?.phone) ||
    getStringValue(user?.username)
  );
}

export function getUserAvatarUrl(
  user: UserInfo | null
) {
  const avatar =
    user?.Avatar as
      | MediaValue
      | string
      | null
      | undefined;

  if (typeof avatar === 'string') {
    return normalizeMediaUrl(avatar);
  }

  let url = '';

  if (avatar && typeof avatar === 'object') {
    url =
      getStringValue(avatar.url) ||
      getStringValue(
        avatar.formats?.thumbnail?.url
      ) ||
      getStringValue(
        avatar.formats?.small?.url
      ) ||
      getStringValue(
        avatar.formats?.medium?.url
      );
  }

  if (!url) {
    url =
      getStringValue(user?.avatarUri) ||
      getStringValue(user?.avatarUrl) ||
      getStringValue(user?.avatar);
  }

  return normalizeMediaUrl(url);
}