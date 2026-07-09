import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

export type AppVersionConfig = {
  latestVersion: string;
  requiredUpgrade: boolean;
  title: string;
  message: string;
  androidUrl?: string;
  iosUrl?: string;
};

export type AppVersionCheckResult = {
  currentVersion: string;
  latestVersion: string;
  requiredUpgrade: boolean;
  needUpgrade: boolean;
  title: string;
  message: string;
  storeUrl: string;
};

function normalizeVersion(version: string) {
  return String(version || '0.0.0')
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map(item => {
      const numberValue = Number(item.replace(/[^\d]/g, ''));
      return Number.isFinite(numberValue) ? numberValue : 0;
    });
}

export function compareVersion(
  currentVersion: string,
  latestVersion: string
) {
  const currentParts = normalizeVersion(currentVersion);
  const latestParts = normalizeVersion(latestVersion);

  const maxLength = Math.max(
    currentParts.length,
    latestParts.length
  );

  for (let index = 0; index < maxLength; index += 1) {
    const current = currentParts[index] || 0;
    const latest = latestParts[index] || 0;

    if (current < latest) {
      return -1;
    }

    if (current > latest) {
      return 1;
    }
  }

  return 0;
}

export function getCurrentAppVersion() {
  return (
    Constants.expoConfig?.version ||
    Constants.manifest2?.extra?.expoClient?.version ||
    '1.0.0'
  );
}

/**
 * TODO:
 * Sau này đổi function này sang gọi Strapi.
 *
 * Ví dụ:
 * GET /api/app/version
 */
export async function fetchLatestAppVersionConfig(): Promise<AppVersionConfig> {
  return {
    latestVersion: '1.0.0',
    requiredUpgrade: true,
    title: 'Cần cập nhật phiên bản mới',
    message:
      'Phiên bản hiện tại của bạn đã cũ. Vui lòng cập nhật app để tiếp tục sử dụng Billang.',
    androidUrl:
      'https://play.google.com/store/apps/details?id=com.hoangneul.biilang',
    iosUrl: 'https://apps.apple.com/app/id0000000000',
  };
}

export async function checkAppVersion(): Promise<AppVersionCheckResult> {
  const currentVersion = getCurrentAppVersion();
  const config = await fetchLatestAppVersionConfig();

  const isLowerVersion =
    compareVersion(currentVersion, config.latestVersion) < 0;

  const storeUrl =
    Platform.OS === 'ios'
      ? config.iosUrl || ''
      : config.androidUrl || '';

  return {
    currentVersion,
    latestVersion: config.latestVersion,
    requiredUpgrade: config.requiredUpgrade,
    needUpgrade: isLowerVersion && config.requiredUpgrade,
    title: config.title,
    message: config.message,
    storeUrl,
  };
}

export async function openAppStore(storeUrl: string) {
  if (!storeUrl) {
    return false;
  }

  const canOpen = await Linking.canOpenURL(storeUrl);

  if (!canOpen) {
    return false;
  }

  await Linking.openURL(storeUrl);

  return true;
}