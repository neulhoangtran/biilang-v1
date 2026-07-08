import { router } from 'expo-router';

import { getAuthToken } from './app-storage.service';

export async function goBackOrDefault() {
  try {
    if (router.canGoBack()) {
      router.back();
      return;
    }
  } catch (error) {
    console.log('[SAFE_BACK_CAN_GO_BACK_FAILED]', error);
  }

  try {
    const token = await getAuthToken();

    router.replace(token ? '/(tabs)' : '/welcome');
  } catch (error) {
    console.log('[SAFE_BACK_FALLBACK_FAILED]', error);
    router.replace('/welcome');
  }
}
