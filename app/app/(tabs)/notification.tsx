import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import * as Notifications from 'expo-notifications';
import { router, useLocalSearchParams } from 'expo-router';
import RenderHTML from 'react-native-render-html';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  Colors,
  Fonts,
  FontSizes,
  Layout,
  LineHeights,
  Radius,
  Spacing,
} from '@/constants/theme';

import {
  AppNotificationItem,
  getNotificationDetail,
  getNotifications,
} from '@/services/notification-list.service';

import {
  syncNotificationTokenAfterLogin,
} from '@/services/notification.service';

import {
  getUserInfo,
} from '@/services/app-storage.service';

const theme = Colors.light;

const PAGE_SIZE = 20;

const htmlTagsStyles = {
  p: {
    marginTop: 0,
    marginBottom: 10,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    lineHeight: 24,
    color: theme.text,
  },

  h1: {
    marginTop: 12,
    marginBottom: 12,
    fontFamily: Fonts.bold,
    fontSize: 28,
    lineHeight: 34,
    color: theme.text,
  },

  h2: {
    marginTop: 12,
    marginBottom: 10,
    fontFamily: Fonts.bold,
    fontSize: 24,
    lineHeight: 30,
    color: theme.text,
  },

  h3: {
    marginTop: 10,
    marginBottom: 8,
    fontFamily: Fonts.bold,
    fontSize: 21,
    lineHeight: 28,
    color: theme.text,
  },

  h4: {
    marginTop: 8,
    marginBottom: 8,
    fontFamily: Fonts.bold,
    fontSize: 18,
    lineHeight: 26,
    color: theme.text,
  },

  h5: {
    marginTop: 8,
    marginBottom: 6,
    fontFamily: Fonts.bold,
    fontSize: 16,
    lineHeight: 24,
    color: theme.text,
  },

  h6: {
    marginTop: 6,
    marginBottom: 6,
    fontFamily: Fonts.bold,
    fontSize: 14,
    lineHeight: 22,
    color: theme.textSecondary,
  },

  strong: {
    fontFamily: Fonts.bold,
    color: theme.text,
  },

  b: {
    fontFamily: Fonts.bold,
    color: theme.text,
  },

  em: {
    fontFamily: Fonts.regular,
    fontStyle: 'italic' as const,
    color: theme.text,
  },

  i: {
    fontFamily: Fonts.regular,
    fontStyle: 'italic' as const,
    color: theme.text,
  },

  u: {
    textDecorationLine: 'underline' as const,
  },

  ul: {
    marginTop: 0,
    marginBottom: 10,
    paddingLeft: 18,
  },

  ol: {
    marginTop: 0,
    marginBottom: 10,
    paddingLeft: 18,
  },

  li: {
    marginBottom: 6,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    lineHeight: 24,
    color: theme.text,
  },

  a: {
    fontFamily: Fonts.bold,
    color: theme.primary,
    textDecorationLine: 'underline' as const,
  },

  blockquote: {
    marginTop: 8,
    marginBottom: 12,
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: theme.primary,
    color: theme.textSecondary,
  },

  code: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    backgroundColor: theme.surface,
    color: theme.danger,
  },

  pre: {
    marginTop: 8,
    marginBottom: 12,
    padding: 12,
    borderRadius: Radius.sm,
    backgroundColor: theme.surface,
  },

  table: {
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },

  th: {
    borderWidth: 1,
    borderColor: theme.border,
    padding: 8,
    fontFamily: Fonts.bold,
    color: theme.text,
  },

  td: {
    borderWidth: 1,
    borderColor: theme.border,
    padding: 8,
    fontFamily: Fonts.regular,
    color: theme.text,
  },

  img: {
    marginTop: 8,
    marginBottom: 12,
  },
};

export default function NotificationScreen() {
  const params = useLocalSearchParams<{
    documentId?: string;
  }>();

  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
  const [selectedNotification, setSelectedNotification] =
    useState<AppNotificationItem | null>(null);

  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);

  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState('');

  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [checkingNotification, setCheckingNotification] = useState(true);
  const [enablingNotification, setEnablingNotification] = useState(false);

  const isLoadingRef = useRef(false);
  const openedParamRef = useRef('');

  const closeModal = () => {
    setSelectedNotification(null);
  };

  const resetNotificationState = () => {
    setNotifications([]);
    setSelectedNotification(null);
    setPage(1);
    setPageCount(1);
    setErrorText('');
    setNotificationEnabled(false);
  };

  const checkLoginState = useCallback(async () => {
    try {
      const user = await getUserInfo();

      const nextIsLoggedIn = Boolean(user?.id);

      setIsLoggedIn(nextIsLoggedIn);
      setAuthChecked(true);

      return nextIsLoggedIn;
    } catch (error) {
      console.log('[NOTIFICATION_CHECK_LOGIN_FAILED]', error);

      setIsLoggedIn(false);
      setAuthChecked(true);

      return false;
    }
  }, []);

  const checkNotificationPermission = useCallback(async () => {
    try {
      setCheckingNotification(true);

      const permission = await Notifications.getPermissionsAsync();

      setNotificationEnabled(permission.status === 'granted');
    } catch (error) {
      console.log('[CHECK_NOTIFICATION_PERMISSION_FAILED]', error);
      setNotificationEnabled(false);
    } finally {
      setCheckingNotification(false);
    }
  }, []);

  const handleGoLogin = () => {
    router.push('/login');
  };

  const handleEnableNotification = async () => {
    if (enablingNotification) {
      return;
    }

    try {
      setEnablingNotification(true);

      const nextIsLoggedIn = await checkLoginState();

      if (!nextIsLoggedIn) {
        Alert.alert(
          'Yêu cầu đăng nhập',
          'Tính năng yêu cầu đăng nhập, đăng nhập để không bỏ lỡ tin tức hấp dẫn.',
          [
            {
              text: 'Để sau',
              style: 'cancel',
            },
            {
              text: 'Đăng nhập',
              onPress: () => router.push('/login'),
            },
          ]
        );

        return;
      }

      const token = await syncNotificationTokenAfterLogin();

      await checkNotificationPermission();

      if (!token) {
        Alert.alert(
          'Chưa bật được thông báo',
          'Bạn cần cho phép quyền thông báo để nhận tin mới từ Vikof.'
        );
      }
    } catch (error) {
      console.log('[ENABLE_NOTIFICATION_FAILED]', error);

      Alert.alert(
        'Không bật được thông báo',
        'Vui lòng thử lại sau.'
      );
    } finally {
      setEnablingNotification(false);
    }
  };

  const loadNotifications = useCallback(
    async ({
      nextPage = 1,
      refresh = false,
    }: {
      nextPage?: number;
      refresh?: boolean;
    } = {}) => {
      if (isLoadingRef.current) {
        return;
      }

      try {
        isLoadingRef.current = true;

        if (refresh) {
          setRefreshing(true);
        } else if (nextPage === 1) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        setErrorText('');

        const nextIsLoggedIn = await checkLoginState();

        /**
         * Guest mode:
         * Không gọi API thông báo khi chưa đăng nhập.
         * Chỉ hiển thị màn yêu cầu đăng nhập.
         */
        if (!nextIsLoggedIn) {
          resetNotificationState();
          return;
        }

        const result = await getNotifications({
          page: nextPage,
          pageSize: PAGE_SIZE,
        });

        setPage(result.page);
        setPageCount(result.pageCount);

        setNotifications(prev => {
          if (nextPage === 1) {
            return result.items;
          }

          const existingIds = new Set(
            prev.map(item => item.documentId || item.id)
          );

          const nextItems = result.items.filter(item => {
            const key = item.documentId || item.id;
            return !existingIds.has(key);
          });

          return [
            ...prev,
            ...nextItems,
          ];
        });
      } catch (error) {
        console.error('Fetch notifications failed:', error);

        setErrorText(
          error instanceof Error
            ? error.message
            : 'Không tải được danh sách thông báo.'
        );
      } finally {
        isLoadingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [
      checkLoginState,
    ]
  );

  useEffect(() => {
    let mounted = true;

    async function bootstrapNotification() {
      try {
        const nextIsLoggedIn = await checkLoginState();

        if (!mounted) {
          return;
        }

        if (!nextIsLoggedIn) {
          resetNotificationState();
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
          setCheckingNotification(false);
          return;
        }

        await Promise.all([
          loadNotifications({
            nextPage: 1,
          }),
          checkNotificationPermission(),
        ]);
      } catch (error) {
        console.log('[NOTIFICATION_BOOTSTRAP_FAILED]', error);

        if (mounted) {
          setLoading(false);
          setCheckingNotification(false);
        }
      }
    }

    bootstrapNotification();

    return () => {
      mounted = false;
    };
  }, [
    checkLoginState,
    loadNotifications,
    checkNotificationPermission,
  ]);

  useEffect(() => {
    const targetDocumentId =
      typeof params.documentId === 'string'
        ? params.documentId
        : '';

    if (!isLoggedIn) {
      return;
    }

    if (!targetDocumentId) {
      return;
    }

    if (openedParamRef.current === targetDocumentId) {
      return;
    }

    const openTargetNotification = async () => {
      const fromList = notifications.find(
        item => item.documentId === targetDocumentId
      );

      if (fromList) {
        openedParamRef.current = targetDocumentId;
        setSelectedNotification(fromList);
        return;
      }

      try {
        const detail = await getNotificationDetail(targetDocumentId);

        if (detail) {
          openedParamRef.current = targetDocumentId;
          setSelectedNotification(detail);
        }
      } catch (error) {
        console.log('[OPEN_NOTIFICATION_DETAIL_FROM_PARAM_FAILED]', error);
      }
    };

    openTargetNotification();
  }, [
    params.documentId,
    notifications,
    isLoggedIn,
  ]);

  const onRefresh = () => {
    loadNotifications({
      nextPage: 1,
      refresh: true,
    });

    if (isLoggedIn) {
      checkNotificationPermission();
    }
  };

  const onEndReached = () => {
    if (!isLoggedIn) {
      return;
    }

    if (
      loading ||
      loadingMore ||
      refreshing ||
      page >= pageCount
    ) {
      return;
    }

    loadNotifications({
      nextPage: page + 1,
    });
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: AppNotificationItem;
    index: number;
  }) => {
    return (
      <NotificationCard
        item={item}
        isLast={index === notifications.length - 1}
        onPress={() => setSelectedNotification(item)}
      />
    );
  };

  const renderGuestBox = () => {
    return (
      <View style={styles.guestBox}>
        <Ionicons
          name="notifications-off-outline"
          size={56}
          color={theme.textMuted}
        />

        <Text style={styles.guestTitle}>
          Tính năng yêu cầu đăng nhập
        </Text>

        <Text style={styles.guestText}>
          Đăng nhập để không bỏ lỡ tin tức hấp dẫn.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.loginButton,
            pressed && styles.cardPressed,
          ]}
          onPress={handleGoLogin}
        >
          <Text style={styles.loginButtonText}>
            Đăng nhập ngay
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={isLoggedIn ? notifications : []}
        keyExtractor={item => item.documentId || item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <>
            <Text style={styles.pageTitle}>Thông báo</Text>

            {isLoggedIn ? (
              <Pressable
                style={({ pressed }) => [
                  styles.tabButton,
                  !notificationEnabled && styles.enableNotificationButton,
                  pressed &&
                    !notificationEnabled &&
                    !checkingNotification &&
                    !enablingNotification &&
                    styles.cardPressed,
                ]}
                disabled={
                  checkingNotification ||
                  notificationEnabled ||
                  enablingNotification
                }
                onPress={handleEnableNotification}
              >
                {enablingNotification ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons
                    name={
                      notificationEnabled
                        ? 'notifications-outline'
                        : 'notifications-off-outline'
                    }
                    size={20}
                    color="#FFFFFF"
                  />
                )}

                <Text style={styles.tabButtonText}>
                  {checkingNotification
                    ? 'Đang kiểm tra...'
                    : notificationEnabled
                      ? 'Thông báo chung'
                      : 'Bật thông báo'}
                </Text>
              </Pressable>
            ) : null}

            {!authChecked || loading ? (
              <View style={styles.stateBox}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={styles.stateText}>Đang tải thông báo...</Text>
              </View>
            ) : !isLoggedIn ? (
              renderGuestBox()
            ) : errorText ? (
              <View style={styles.stateBox}>
                <Text style={styles.errorText}>{errorText}</Text>

                <Pressable
                  style={styles.retryButton}
                  onPress={() => loadNotifications({ nextPage: 1 })}
                >
                  <Text style={styles.retryButtonText}>Tải lại</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          authChecked &&
          isLoggedIn &&
          !loading &&
          !errorText ? (
            <View style={styles.stateBox}>
              <Ionicons
                name="notifications-outline"
                size={42}
                color={theme.textMuted}
              />

              <Text style={styles.stateText}>
                Chưa có thông báo nào.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={styles.footerLoaderText}>Đang tải thêm...</Text>
            </View>
          ) : notifications.length > 0 ? (
            <View style={styles.footerSpace} />
          ) : null
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.35}
      />

      <NotificationDetailModal
        item={selectedNotification}
        visible={!!selectedNotification}
        onClose={closeModal}
      />
    </SafeAreaView>
  );
}

function NotificationCard({
  item,
  isLast,
  onPress,
}: {
  item: AppNotificationItem;
  isLast: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.notificationCard,
        !isLast && styles.notificationBorder,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.iconBox}>
        <Image
          source={require('@/assets/images/logo-v1.png')}
          style={styles.iconImage}
          resizeMode="contain"
        />
      </View>

      <View style={styles.notificationBody}>
        <Text style={styles.notificationTitle} numberOfLines={2}>
          {item.title}
        </Text>

        {!!item.shortDescription && (
          <Text style={styles.notificationShortDescription} numberOfLines={3}>
            {item.shortDescription}
          </Text>
        )}

        {!!item.time && (
          <Text style={styles.notificationTime} numberOfLines={1}>
            {item.time}
          </Text>
        )}
      </View>

      <Ionicons
        name="chevron-forward"
        size={22}
        color={theme.textSecondary}
        style={styles.notificationArrow}
      />
    </Pressable>
  );
}

function NotificationDetailModal({
  item,
  visible,
  onClose,
}: {
  item: AppNotificationItem | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(visible);

  const { width } = useWindowDimensions();

  const htmlContentWidth =
    width - Layout.screenHorizontalPadding * 2;

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(460)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);

      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      return;
    }

    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 460,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMounted(false);
    });
  }, [visible, overlayOpacity, sheetTranslateY]);

  const handleClose = () => {
    onClose();
  };

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.modalBackdrop,
            {
              opacity: overlayOpacity,
            },
          ]}
        />

        <Pressable
          style={styles.modalBackdropPressable}
          onPress={handleClose}
        />

        <Animated.View
          style={[
            styles.detailSheet,
            {
              transform: [
                {
                  translateY: sheetTranslateY,
                },
              ],
            },
          ]}
        >
          <View style={styles.sheetHandle} />

          <View style={styles.detailHeader}>
            <View style={styles.detailLogoBox}>
              <Image
                source={require('@/assets/images/logo-v1.png')}
                style={styles.detailLogo}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.detailHeaderTitle}>Chi tiết thông báo</Text>

            <Pressable style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={26} color={theme.text} />
            </Pressable>
          </View>

          {item ? (
            <FlatList
              style={styles.detailScroll}
              contentContainerStyle={styles.detailContent}
              showsVerticalScrollIndicator={false}
              data={[item]}
              keyExtractor={detailItem => detailItem.documentId || detailItem.id}
              renderItem={({ item: detailItem }) => (
                <>
                  <Text style={styles.detailTitle}>
                    {detailItem.title}
                  </Text>

                  {!!detailItem.time && (
                    <Text style={styles.detailTime}>
                      {detailItem.time}
                    </Text>
                  )}

                  <RenderHTML
                    contentWidth={htmlContentWidth}
                    source={{
                      html: detailItem.content || '',
                    }}
                    baseStyle={styles.htmlBaseText}
                    tagsStyles={htmlTagsStyles}
                  />
                </>
              )}
            />
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.background,
  },

  container: {
    flex: 1,
    backgroundColor: theme.background,
  },

  content: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Spacing.md,
    paddingBottom: 120,
  },

  pageTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.headingSm,
    lineHeight: LineHeights.headingSm,
    color: theme.textSecondary,
    marginBottom: Spacing.lg,
  },

  tabButton: {
    height: 44,
    borderRadius: 8,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    flexDirection: 'row',
    gap: 8,
  },

  enableNotificationButton: {
    backgroundColor: theme.danger,
  },

  tabButtonText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    color: '#FFFFFF',
  },

  notificationCard: {
    minHeight: 136,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: theme.surface,
  },

  notificationBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },

  cardPressed: {
    opacity: 0.76,
  },

  iconBox: {
    width: 46,
    height: 46,
    borderRadius: Radius.sm,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    marginTop: 2,
    overflow: 'hidden',
  },

  iconImage: {
    width: 40,
    height: 40,
  },

  notificationBody: {
    flex: 1,
    paddingRight: Spacing.sm,
  },

  notificationTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    lineHeight: 22,
    color: theme.text,
    textTransform: 'uppercase',
  },

  notificationShortDescription: {
    marginTop: 6,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 20,
    color: theme.textSecondary,
  },

  notificationTime: {
    marginTop: 6,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    color: theme.textSecondary,
  },

  notificationArrow: {
    marginTop: 12,
  },

  stateBox: {
    minHeight: 160,
    borderRadius: Radius.md,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },

  stateText: {
    marginTop: Spacing.sm,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    color: theme.textSecondary,
    textAlign: 'center',
  },

  guestBox: {
    minHeight: 260,
    borderRadius: Radius.md,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },

  guestTitle: {
    marginTop: Spacing.md,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    lineHeight: LineHeights.xl,
    color: theme.text,
    textAlign: 'center',
  },

  guestText: {
    marginTop: Spacing.sm,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    lineHeight: 22,
    color: theme.textSecondary,
    textAlign: 'center',
  },

  loginButton: {
    marginTop: Spacing.xl,
    minHeight: 44,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loginButtonText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    color: '#FFFFFF',
  },

  errorText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    color: theme.danger,
    textAlign: 'center',
  },

  retryButton: {
    marginTop: Spacing.md,
    height: 38,
    paddingHorizontal: 18,
    borderRadius: Radius.sm,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  retryButtonText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    color: '#FFFFFF',
  },

  footerLoader: {
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  footerLoaderText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    color: theme.textSecondary,
  },

  footerSpace: {
    height: 24,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
  },

  modalBackdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },

  detailSheet: {
    height: '68%',
    backgroundColor: theme.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },

  sheetHandle: {
    width: 46,
    height: 5,
    borderRadius: Radius.pill,
    backgroundColor: theme.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },

  detailHeader: {
    minHeight: 58,
    paddingHorizontal: Layout.screenHorizontalPadding,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },

  detailLogoBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },

  detailLogo: {
    width: 34,
    height: 34,
  },

  detailHeaderTitle: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    color: theme.text,
  },

  closeButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },

  detailScroll: {
    flex: 1,
  },

  detailContent: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Spacing.xl,
    paddingBottom: 40,
  },

  detailTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    lineHeight: 30,
    color: theme.text,
    marginBottom: Spacing.md,
  },

  detailTime: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    color: theme.textSecondary,
    marginBottom: Spacing.xl,
  },

  htmlBaseText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    lineHeight: 24,
    color: theme.text,
  },
});