import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

import {
  getUserInfo,
} from '@/services/app-storage.service';

import {
  useWindowDimensions,
} from 'react-native';

export default function TabLayout() {
  const colorScheme = 'light';
  const theme = Colors[colorScheme];

  const { width } = useWindowDimensions();

  /**
   * iPhone Pro / Pro Max thường có width logic >= 393.
   * iPhone thường / màn nhỏ thì ẩn bớt tab Bài Thi.
   */
  const canShowFiveTabs = width >= 393;

  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function prepareTabs() {
      try {
        /**
         * Chỉ preload user nếu có.
         *
         * Không redirect ở đây.
         * Guest vẫn được phép xem Home / AI Talk / Lesson.
         */
        await getUserInfo();
      } catch (error) {
        console.log('[TAB_PREPARE_ERROR]', error);
      } finally {
        if (mounted) {
          setAuthChecked(true);
        }
      }
    }

    prepareTabs();

    return () => {
      mounted = false;
    };
  }, []);

  if (!authChecked) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          height: 72,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: theme.surface,
          borderTopWidth: 1,
          borderTopColor: theme.border,
        },
        tabBarLabelStyle: {
          fontSize: canShowFiveTabs ? 11 : 12,
          fontWeight: '600',
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="ai-talk"
        options={{
          title: 'AI Talk',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={
                focused
                  ? 'chatbubble-ellipses'
                  : 'chatbubble-ellipses-outline'
              }
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="lesson"
        options={{
          title: 'Lesson',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'book' : 'book-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="exam"
        options={{
          title: 'Bài Thi',
          href: canShowFiveTabs ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'school' : 'school-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="notification"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="news"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="category"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="favorite"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}