import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import * as Font from 'expo-font';
import { useEffect, useState } from 'react';

import FloatingChatButton from '@/components/FloatingChatButton';
import { initAppSession } from '@/services/app-storage.service';
import { setupNotificationListeners } from '@/services/notification.service';

export const unstable_settings = {
  initialRouteName: 'index',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const cleanup = setupNotificationListeners();

    return cleanup;
  }, []);

  useEffect(() => {
    async function prepareApp() {
      try {
        await initAppSession();

        await Font.loadAsync({
          Roboto: require('@/assets/fonts/Roboto-Regular.ttf'),
          RobotoLight: require('@/assets/fonts/Roboto-Light.ttf'),
          RobotoMedium: require('@/assets/fonts/Roboto-Medium.ttf'),
          RobotoBold: require('@/assets/fonts/Roboto-Bold.ttf'),
          RobotoSemiBold: require('@/assets/fonts/Roboto-SemiBold.ttf'),
        });
      } catch (error) {
        console.log('[ROOT_LAYOUT_PREPARE_ERROR]', error);
      } finally {
        setLoaded(true);

        try {
          await SplashScreen.hideAsync();
        } catch (error) {
          console.log('[ROOT_LAYOUT_HIDE_SPLASH_ERROR]', error);
        }
      }
    }

    prepareApp();
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="verify-phone" options={{ headerShown: false }} />
        <Stack.Screen name="select-branch" options={{ headerShown: false }} />
        <Stack.Screen name="branch-detail" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="profile-edit" options={{ headerShown: false }} />
        <Stack.Screen name="change-password" options={{ headerShown: false }} />

        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        <Stack.Screen
          name="news/[documentId]"
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="modal"
          options={{
            presentation: 'modal',
            title: 'Modal',
          }}
        />

        <Stack.Screen name="category-detail" options={{ headerShown: false }} />
        <Stack.Screen name="product-detail" options={{ headerShown: false }} />
        <Stack.Screen name="search" options={{ headerShown: false }} />

        <Stack.Screen
          name="admin/adminmessage"
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="admin/customers"
          options={{
            headerShown: false,
          }}
        />
      </Stack>

      <FloatingChatButton />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}