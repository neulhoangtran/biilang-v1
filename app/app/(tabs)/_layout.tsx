import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

import {
    getAppConfig,
    getUserInfo,
} from '@/services/app-storage.service';

import {
    View,
    Text,
    StyleSheet,
} from 'react-native';

import {
    appEvents,
    APP_EVENTS,
} from '@/services/app-events.service';

export default function TabLayout() {
    const colorScheme = 'light';
    const theme = Colors[colorScheme];

    const [authChecked, setAuthChecked] = useState(false);
    const [wishlistCount, setWishlistCount] = useState(0);

    const loadWishlistCount = async () => {
        try {
            const config = await getAppConfig();

            const count = Array.isArray(config?.wishlist_product_ids)
                ? config.wishlist_product_ids.length
                : 0;

            setWishlistCount(count);
        } catch (error) {
            console.log('[TAB_LOAD_WISHLIST_COUNT_ERROR]', error);
        }
    };

    useEffect(() => {
        let mounted = true;

        async function prepareTabs() {
            try {
                /**
                 * Chỉ preload user nếu có.
                 *
                 * Tuyệt đối không redirect về /welcome ở đây.
                 * Lý do:
                 * - Guest được phép xem Home / Category / Product / Search / News.
                 * - Khi reload đang ở page nào thì giữ nguyên page đó.
                 * - Logic mở app lần đầu nằm ở app/index.tsx.
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

    useEffect(() => {
        if (!authChecked) {
            return;
        }

        loadWishlistCount();

        const handleWishlistUpdated = (productIds: string[]) => {
            setWishlistCount(productIds.length);
        };

        appEvents.on(
            APP_EVENTS.WISHLIST_UPDATED,
            handleWishlistUpdated
        );

        return () => {
            appEvents.off(
                APP_EVENTS.WISHLIST_UPDATED,
                handleWishlistUpdated
            );
        };
    }, [authChecked]);

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
                    fontSize: 12,
                    fontWeight: '600',
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Trang chủ',
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
                name="category"
                options={{
                    title: 'Danh mục',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons
                            name={focused ? 'grid' : 'grid-outline'}
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />

            <Tabs.Screen
                name="favorite"
                options={{
                    title: 'Yêu thích',
                    tabBarIcon: ({ color, focused }) => (
                        <View style={styles.favoriteTabIcon}>
                            <Ionicons
                                name={focused ? 'heart' : 'heart-outline'}
                                size={24}
                                color={color}
                            />

                            {wishlistCount > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>
                                        {wishlistCount > 99 ? '99+' : wishlistCount}
                                    </Text>
                                </View>
                            )}
                        </View>
                    ),
                }}
            />

            <Tabs.Screen
                name="account"
                options={{
                    title: 'Tài khoản',
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
        </Tabs>
    );
}

const styles = StyleSheet.create({
    favoriteTabIcon: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },

    badge: {
        position: 'absolute',
        top: -4,
        right: -10,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 4,
        borderRadius: 9,
        backgroundColor: '#FF3B30',
        alignItems: 'center',
        justifyContent: 'center',
    },

    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
    },
});