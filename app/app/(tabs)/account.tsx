import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  clearAppSession,
  getAppConfig,
  getUserInfo,
  saveAppSession,
  type SelectedBranchConfig,
  type UserInfo,
} from '@/services/app-storage.service';

import {
  cancelDeleteAccount,
  getCurrentProfile,
  getUserAvatarUrl,
  requestDeleteAccount,
} from '@/services/profile.service';

import {
  Colors,
  Fonts,
  FontSizes,
  FontWeights,
  Layout,
  LineHeights,
  Radius,
  Spacing,
} from '@/constants/theme';

const theme = Colors.light;

function getStringValue(value: unknown) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}

function getDisplayName(
  user: UserInfo | null
) {
  if (!user) {
    return 'Khách';
  }

  const fullName = getStringValue(
    (user as any).fullName
  );

  if (fullName) {
    return fullName;
  }

  const lastName =
    getStringValue(
      (user as any).LastName
    ) ||
    getStringValue(
      (user as any).lastName
    );

  const firstName =
    getStringValue(
      (user as any).FirstName
    ) ||
    getStringValue(
      (user as any).firstName
    );

  const name = [lastName, firstName]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (name) {
    return name;
  }

  return (
    getStringValue(user.username) ||
    getStringValue(user.email) ||
    'Khách'
  );
}

function getJoinText(
  user: UserInfo | null
) {
  const rawDate =
    getStringValue(
      (user as any)?.createdAt
    ) ||
    getStringValue(
      (user as any)?.created_at
    ) ||
    getStringValue(
      (user as any)?.joinedAt
    ) ||
    getStringValue(
      (user as any)?.joined_at
    );

  const date = rawDate
    ? new Date(rawDate)
    : new Date();

  if (
    Number.isNaN(date.getTime())
  ) {
    return 'Tham gia';
  }

  const month = `${date.getMonth() + 1}`.padStart(
    2,
    '0'
  );

  const year =
    date.getFullYear();

  return `Tham gia ${month}/${year}`;
}

function getEmail(
  user: UserInfo | null
) {
  return (
    getStringValue(user?.email) ||
    'Chưa có email'
  );
}

function getDeleteInfo(user: UserInfo | null) {
  const isMarkDelete = Boolean(
    (user as any)?.MarkDelete
  );

  const rawDate = getStringValue(
    (user as any)?.MarkDeleteDate
  );

  const markDeleteDate = rawDate
    ? new Date(rawDate)
    : null;

  const isValidDate =
    markDeleteDate &&
    !Number.isNaN(markDeleteDate.getTime());

  return {
    isMarkDelete,
    markDeleteDate: isValidDate ? markDeleteDate : null,
  };
}

function formatRemainTime(ms: number) {
  const safeMs = Math.max(0, ms);

  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [
    `${hours}`.padStart(2, '0'),
    `${minutes}`.padStart(2, '0'),
    `${seconds}`.padStart(2, '0'),
  ].join(':');
}

function normalizeWishlistProductIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(item => String(item).trim())
        .filter(Boolean)
    )
  );
}

function getUserBranch(user: UserInfo | null) {
  if (!user) {
    return null;
  }

  return (
    (user as any).Branch ||
    (user as any).branch ||
    (user as any).selected_branch ||
    (user as any).selectedBranch ||
    null
  );
}

function mapUserBranchToSelectedBranch(
  branch: any
): SelectedBranchConfig | null {
  if (!branch?.id) {
    return null;
  }

  return {
    id: branch.id,
    documentId: branch.documentId || '',
    name: branch.Name || branch.name || '',
    slug: branch.Slug || branch.slug || '',
    area: branch.Area || branch.area || '',
    address: branch.Address || branch.address || '',
    phone: branch.Phone ?? branch.phone ?? null,
    zalo: branch.Zalo ?? branch.zalo ?? null,
    messenger: branch.Messenger ?? branch.messenger ?? null,
    messenger_web:
      branch.MessengerWeb ??
      branch.messenger_web ??
      branch.messengerWeb ??
      null,
  };
}

function getBranchNameFromUserOrConfig(
  user: UserInfo | null,
  selectedBranch?: SelectedBranchConfig | null
) {
  const userBranch = getUserBranch(user);

  return (
    getStringValue(userBranch?.Name) ||
    getStringValue(userBranch?.name) ||
    getStringValue(selectedBranch?.name) ||
    getStringValue(selectedBranch?.slug) ||
    'Chưa chọn chi nhánh'
  );
}

async function saveFreshProfileToSession(user: UserInfo) {
  const currentConfig = await getAppConfig();

  const hasWishlistProductIds = Array.isArray(
    (user as any)?.wishlist_product_ids
  );

  const wishlistProductIds = hasWishlistProductIds
    ? normalizeWishlistProductIds(
      (user as any).wishlist_product_ids
    )
    : currentConfig.wishlist_product_ids;

  const selectedBranchFromUser =
    mapUserBranchToSelectedBranch(
      getUserBranch(user)
    );

  await saveAppSession({
    user_info: user,
    config: {
      ...currentConfig,
      wishlist_product_ids: wishlistProductIds,
      selected_branch:
        selectedBranchFromUser ||
        currentConfig.selected_branch ||
        null,
    },
  });
}

export default function AccountScreen() {
  const [userInfo, setUserInfo] =
    useState<UserInfo | null>(null);

  const [selectedBranch, setSelectedBranch] =
    useState<SelectedBranchConfig | null>(null);

  const [authChecked, setAuthChecked] =
    useState(false);

  const [isLoggedIn, setIsLoggedIn] =
    useState(false);

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const [deleteActionLoading, setDeleteActionLoading] =
    useState(false);

  const [nowMs, setNowMs] =
    useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const displayName = useMemo(() => {
    return getDisplayName(userInfo);
  }, [userInfo]);

  const joinText = useMemo(() => {
    return getJoinText(userInfo);
  }, [userInfo]);

  const avatarUrl = useMemo(() => {
    return getUserAvatarUrl(
      userInfo
    );
  }, [userInfo]);

  const branchName = useMemo(() => {
    return getBranchNameFromUserOrConfig(
      userInfo,
      selectedBranch
    );
  }, [
    userInfo,
    selectedBranch,
  ]);

  const deleteInfo = useMemo(() => {
    return getDeleteInfo(userInfo);
  }, [userInfo]);

  const deleteRemainMs = useMemo(() => {
    if (!deleteInfo.markDeleteDate) {
      return 0;
    }

    return Math.max(
      0,
      deleteInfo.markDeleteDate.getTime() - nowMs
    );
  }, [
    deleteInfo.markDeleteDate,
    nowMs,
  ]);

  const deleteAccountTitle = deleteInfo.isMarkDelete
    ? 'Hủy yêu cầu'
    : 'Xóa tài khoản';

  const deleteAccountSubtitle = deleteInfo.isMarkDelete
    ? `Tài khoản đang chờ xóa. Thời gian còn lại: ${formatRemainTime(deleteRemainMs)}`
    : 'Tài khoản sẽ được xóa sau 24h kể từ khi yêu cầu.';

  const isBranchAdmin =
    (userInfo as any)?.role
      ?.type ===
    'admin_branch';

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const loadUser =
        async () => {
          try {
            const [
              localUser,
              localConfig,
            ] = await Promise.all([
              getUserInfo(),
              getAppConfig(),
            ]);

            if (!mounted) {
              return;
            }

            setSelectedBranch(
              localConfig.selected_branch || null
            );

            /**
             * Guest mode:
             * Không redirect về welcome.
             * Không gọi profile API khi chưa đăng nhập.
             * Chỉ hiển thị màn yêu cầu đăng nhập.
             */
            if (!localUser?.id) {
              setUserInfo(null);
              setIsLoggedIn(false);
              setAuthChecked(true);
              return;
            }

            setUserInfo(localUser);
            setIsLoggedIn(true);
            setAuthChecked(true);

            /**
             * Refresh latest profile silently cho user đã đăng nhập.
             */
            setIsRefreshing(true);

            const freshUser =
              await getCurrentProfile();

            if (
              !mounted ||
              !freshUser
            ) {
              return;
            }

            const selectedBranchFromFreshUser =
              mapUserBranchToSelectedBranch(
                getUserBranch(freshUser)
              );

            await saveFreshProfileToSession(
              freshUser
            );

            setUserInfo(
              freshUser
            );

            if (selectedBranchFromFreshUser) {
              setSelectedBranch(
                selectedBranchFromFreshUser
              );
            }
          } catch (error) {
            console.error(
              'Fetch current profile failed:',
              error
            );

            /**
             * Nếu lỗi trong lúc chưa có user local thì vẫn hiển thị guest screen.
             * Không redirect về welcome để giữ flow guest trong Tabs.
             */
            if (mounted) {
              setUserInfo(null);
              setIsLoggedIn(false);
              setAuthChecked(true);
            }
          } finally {
            if (mounted) {
              setIsRefreshing(false);
            }
          }
        };

      loadUser();

      return () => {
        mounted = false;
      };
    }, [])
  );

  const refreshProfileAfterDeleteAction = async () => {
    const freshUser = await getCurrentProfile();

    if (!freshUser) {
      return;
    }

    await saveFreshProfileToSession(
      freshUser
    );

    setUserInfo(
      freshUser
    );

    const selectedBranchFromFreshUser =
      mapUserBranchToSelectedBranch(
        getUserBranch(freshUser)
      );

    if (selectedBranchFromFreshUser) {
      setSelectedBranch(
        selectedBranchFromFreshUser
      );
    }
  };

  const doRequestDeleteAccount = async () => {
    if (deleteActionLoading) {
      return;
    }

    try {
      setDeleteActionLoading(true);

      await requestDeleteAccount();

      await refreshProfileAfterDeleteAction();

      Alert.alert(
        'Đã gửi yêu cầu',
        'Tài khoản sẽ được xóa sau 24h kể từ khi yêu cầu. Bạn có thể hủy trong thời gian chờ.'
      );
    } catch (error) {
      console.error(
        'Request delete account failed:',
        error
      );

      Alert.alert(
        'Không thể gửi yêu cầu',
        error instanceof Error
          ? error.message
          : 'Vui lòng thử lại sau.'
      );
    } finally {
      setDeleteActionLoading(false);
    }
  };

  const doCancelDeleteAccount = async () => {
    if (deleteActionLoading) {
      return;
    }

    try {
      setDeleteActionLoading(true);

      await cancelDeleteAccount();

      await refreshProfileAfterDeleteAction();

      Alert.alert(
        'Đã hủy yêu cầu',
        'Yêu cầu xóa tài khoản đã được hủy.'
      );
    } catch (error) {
      console.error(
        'Cancel delete account failed:',
        error
      );

      Alert.alert(
        'Không thể hủy yêu cầu',
        error instanceof Error
          ? error.message
          : 'Vui lòng thử lại sau.'
      );
    } finally {
      setDeleteActionLoading(false);
    }
  };

  const handleDeleteAccountAction = () => {
    if (deleteActionLoading) {
      return;
    }

    if (deleteInfo.isMarkDelete) {
      if (
        Platform.OS === 'web'
      ) {
        const confirmed =
          window.confirm(
            'Với lựa chọn này, bạn sẽ không còn nhận được các khuyến mại đến từ Vikof Mobile nữa. Bạn có chắc chắn muốn hủy yêu cầu xóa tài khoản?'
          );

        if (confirmed) {
          doCancelDeleteAccount();
        }

        return;
      }

      Alert.alert(
        'Hủy yêu cầu xóa tài khoản',
        'Bạn có chắc chắn muốn hủy yêu cầu xóa tài khoản?',
        [
          {
            text: 'Không',
            style: 'cancel',
          },
          {
            text: 'Hủy yêu cầu',
            onPress: doCancelDeleteAccount,
          },
        ]
      );

      return;
    }

    if (
      Platform.OS === 'web'
    ) {
      const confirmed =
        window.confirm(
          'Tài khoản sẽ được xóa sau 24h kể từ khi yêu cầu. Bạn có chắc chắn muốn tiếp tục?'
        );

      if (confirmed) {
        doRequestDeleteAccount();
      }

      return;
    }

    Alert.alert(
      'Xóa tài khoản',
      'Tài khoản sẽ được xóa sau 24h kể từ khi yêu cầu. Bạn có thể hủy trong thời gian chờ. Bạn có chắc chắn muốn tiếp tục?',
      [
        {
          text: 'Huỷ',
          style: 'cancel',
        },
        {
          text: 'Xóa tài khoản',
          style: 'destructive',
          onPress: doRequestDeleteAccount,
        },
      ]
    );
  };

  const logout = async () => {
    if (isLoggingOut) {
      return;
    }

    try {
      setIsLoggingOut(true);

      await clearAppSession();

      router.replace(
        '/login'
      );
    } catch (error) {
      console.error(
        'Logout failed:',
        error
      );

      Alert.alert(
        'Không đăng xuất được',
        'Vui lòng thử lại sau.'
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleLogout = () => {
    if (
      Platform.OS === 'web'
    ) {
      const confirmed =
        window.confirm(
          'Bạn có chắc chắn muốn đăng xuất?'
        );

      if (confirmed) {
        logout();
      }

      return;
    }

    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất?',
      [
        {
          text: 'Huỷ',
          style: 'cancel',
        },
        {
          text: 'Đăng xuất',
          style:
            'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const handleGoLogin =
    () => {
      router.push(
        '/login'
      );
    };

  const handleGoEditProfile =
    () => {
      router.push(
        '/profile-edit'
      );
    };

  const handleGoChangePassword =
    () => {
      router.push(
        '/change-password'
      );
    };

  const handleGoSelectBranch =
    () => {
      const branchId =
        selectedBranch?.documentId ||
        selectedBranch?.slug ||
        String(selectedBranch?.id || '');

      if (!branchId) {
        router.push('/select-branch');
        return;
      }

      router.push({
        pathname: '/branch-detail',
        params: {
          id: branchId,
        },
      });
    };

  const handleGoAdminCustomers =
    () => {
      router.push(
        '/admin/customers'
      );
    };

  const handleGoAdminNotifications =
    () => {
      router.push(
        '/admin/adminmessage'
      );
    };

  if (!authChecked) {
    return (
      <SafeAreaView
        edges={['top']}
        style={styles.safe}
      >
        <View style={styles.loadingBox}>
          <ActivityIndicator
            size="large"
            color={theme.primary}
          />

          <Text style={styles.loadingText}>
            Đang tải tài khoản...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isLoggedIn) {
    return (
      <SafeAreaView
        edges={['top']}
        style={styles.safe}
      >
        <View style={styles.guestContainer}>
          <View style={styles.guestIconBox}>
            <Ionicons
              name="person-circle-outline"
              size={76}
              color={theme.primary}
            />
          </View>

          <Text style={styles.guestTitle}>
            Tài khoản
          </Text>

          <Text style={styles.guestMessage}>
            Tính năng yêu cầu đăng nhập
          </Text>

          <Text style={styles.guestDescription}>
            Đăng nhập để không bỏ lỡ tin tức hấp dẫn.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleGoLogin}
          >
            <Text style={styles.loginButtonText}>
              Đăng nhập ngay
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={styles.safe}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.profileHeader
          }
        >
          <View
            style={
              styles.avatarCircle
            }
          >
            {avatarUrl ? (
              <Image
                source={{
                  uri: avatarUrl,
                }}
                style={
                  styles.avatarImage
                }
                resizeMode="cover"
              />
            ) : (
              <Ionicons
                name="person-circle"
                size={68}
                color={
                  theme.textMuted
                }
              />
            )}
          </View>

          <View
            style={
              styles.profileInfo
            }
          >
            <View
              style={
                styles.nameRow
              }
            >
              <Text
                style={
                  styles.profileName
                }
                numberOfLines={1}
              >
                {displayName}
              </Text>

              {isRefreshing && (
                <ActivityIndicator
                  size="small"
                  color={
                    theme.textMuted
                  }
                  style={
                    styles.refreshLoader
                  }
                />
              )}
            </View>

            <Text
              style={
                styles.profileJoinText
              }
            >
              {joinText}
            </Text>
          </View>

          <Pressable
            style={({
              pressed,
            }) => [
                styles.editButton,
                pressed &&
                styles.buttonPressed,
              ]}
            onPress={
              handleGoEditProfile
            }
          >
            <Ionicons
              name="create-outline"
              size={34}
              color={
                theme.textSecondary
              }
            />
          </Pressable>
        </View>

        <Section title="Thông tin ứng dụng">
          <MenuItem
            icon="mail-outline"
            title="Email"
            subtitle={getEmail(
              userInfo
            )}
            onPress={
              handleGoEditProfile
            }
          />

          <Divider />

          <MenuItem
            icon="storefront-outline"
            title="Chi nhánh"
            subtitle={branchName}
            onPress={
              handleGoSelectBranch
            }
          />

          <Divider />

          <MenuItem
            icon="lock-closed-outline"
            title="Đổi mật khẩu"
            onPress={
              handleGoChangePassword
            }
          />

          <Divider />

          <MenuItem
            icon={
              deleteInfo.isMarkDelete
                ? 'reload-circle-outline'
                : 'trash-outline'
            }
            title={
              deleteActionLoading
                ? 'Đang xử lý...'
                : deleteAccountTitle
            }
            subtitle={deleteAccountSubtitle}
            disabled={deleteActionLoading}
            danger={!deleteInfo.isMarkDelete}
            onPress={
              handleDeleteAccountAction
            }
          />

          <Divider />

          <MenuItem
            icon="information-circle-outline"
            title="Thông tin ứng dụng"
            subtitle="Phiên bản 1.0.0"
            onPress={() => { }}
          />
        </Section>

        {isBranchAdmin && (
          <Section title="Quản trị chi nhánh">
            <MenuItem
              icon="people-outline"
              title="Danh sách khách hàng"
              subtitle="Quản lý khách hàng của chi nhánh"
              onPress={
                handleGoAdminCustomers
              }
            />

            <Divider />
          </Section>
        )}

        <Pressable
          disabled={
            isLoggingOut
          }
          style={({
            pressed,
          }) => [
              styles.dangerCard,
              pressed &&
              styles.buttonPressed,
              isLoggingOut &&
              styles.disabledCard,
            ]}
          onPress={handleLogout}
        >
          <Ionicons
            name="log-out-outline"
            size={36}
            color={theme.danger}
          />

          <Text
            style={
              styles.dangerText
            }
          >
            {isLoggingOut
              ? 'Đang đăng xuất...'
              : 'Đăng xuất'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text
        style={
          styles.sectionTitle
        }
      >
        {title}
      </Text>

      <View
        style={
          styles.sectionCard
        }
      >
        {children}
      </View>
    </View>
  );
}

function Divider() {
  return (
    <View
      style={styles.divider}
    />
  );
}

function MenuItem({
  icon,
  title,
  subtitle,
  onPress,
  disabled = false,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;

  title: string;

  subtitle?: string;

  onPress: () => void;

  disabled?: boolean;

  danger?: boolean;
}) {
  const iconColor = danger
    ? theme.danger
    : theme.text;

  const titleColor = danger
    ? theme.danger
    : theme.text;

  return (
    <Pressable
      disabled={disabled}
      style={({
        pressed,
      }) => [
          styles.menuItem,
          pressed &&
          styles.buttonPressed,
          disabled &&
          styles.disabledCard,
        ]}
      onPress={onPress}
    >
      <View
        style={
          styles.menuIconBox
        }
      >
        <Ionicons
          name={icon}
          size={32}
          color={iconColor}
        />
      </View>

      <View
        style={
          styles.menuTextBox
        }
      >
        <Text
          style={[
            styles.menuTitle,
            {
              color: titleColor,
            },
          ]}
        >
          {title}
        </Text>

        {!!subtitle && (
          <Text
            style={
              styles.menuSubtitle
            }
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        )}
      </View>

      <Ionicons
        name="chevron-forward"
        size={30}
        color={theme.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor:
      theme.background,
  },

  container: {
    flex: 1,
    backgroundColor:
      theme.background,
  },

  content: {
    paddingHorizontal:
      Layout.screenHorizontalPadding,

    paddingTop:
      Spacing.xl,

    paddingBottom: 120,
  },

  loadingBox: {
    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal:
      Layout.screenHorizontalPadding,
  },

  loadingText: {
    marginTop:
      Spacing.md,

    fontFamily:
      Fonts.regular,

    fontSize:
      FontSizes.md,

    lineHeight:
      LineHeights.md,

    color:
      theme.textSecondary,

    textAlign: 'center',
  },

  guestContainer: {
    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal:
      Layout.screenHorizontalPadding,

    paddingBottom: 80,
  },

  guestIconBox: {
    width: 104,

    height: 104,

    borderRadius: 52,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor:
      theme.surface,

    marginBottom:
      Spacing.lg,
  },

  guestTitle: {
    fontFamily:
      Fonts.bold,

    fontWeight:
      FontWeights.bold,

    fontSize:
      FontSizes.headingSm,

    lineHeight:
      LineHeights.headingSm,

    color:
      theme.text,

    textAlign: 'center',
  },

  guestMessage: {
    marginTop:
      Spacing.md,

    fontFamily:
      Fonts.bold,

    fontWeight:
      FontWeights.bold,

    fontSize:
      FontSizes.xl,

    lineHeight:
      LineHeights.xl,

    color:
      theme.text,

    textAlign: 'center',
  },

  guestDescription: {
    marginTop:
      Spacing.sm,

    fontFamily:
      Fonts.regular,

    fontSize:
      FontSizes.md,

    lineHeight:
      LineHeights.md,

    color:
      theme.textSecondary,

    textAlign: 'center',
  },

  loginButton: {
    marginTop:
      Spacing.xl,

    minHeight: 46,

    paddingHorizontal:
      Spacing.xl,

    borderRadius:
      Radius.md,

    backgroundColor:
      theme.primary,

    alignItems: 'center',

    justifyContent: 'center',
  },

  loginButtonText: {
    fontFamily:
      Fonts.bold,

    fontWeight:
      FontWeights.bold,

    fontSize:
      FontSizes.md,

    lineHeight:
      LineHeights.md,

    color: '#FFFFFF',
  },

  profileHeader: {
    flexDirection: 'row',

    alignItems: 'center',

    marginBottom:
      Spacing.xxl,
  },

  avatarCircle: {
    width: 78,
    height: 78,

    borderRadius: 39,

    alignItems: 'center',

    justifyContent:
      'center',

    marginRight: 16,

    overflow: 'hidden',

    backgroundColor:
      theme.surface,
  },

  avatarImage: {
    width: '100%',
    height: '100%',

    borderRadius: 39,
  },

  profileInfo: {
    flex: 1,
  },

  nameRow: {
    flexDirection: 'row',

    alignItems: 'center',
  },

  profileName: {
    flexShrink: 1,

    fontFamily: Fonts.bold,

    fontWeight:
      FontWeights.bold,

    fontSize:
      FontSizes.headingSm,

    lineHeight:
      LineHeights.headingSm,

    color: theme.text,
  },

  refreshLoader: {
    marginLeft: 8,

    transform: [
      {
        scale: 0.75,
      },
    ],
  },

  profileJoinText: {
    marginTop: 2,

    fontFamily:
      Fonts.regular,

    fontSize:
      FontSizes.lg,

    lineHeight:
      LineHeights.lg,

    color:
      theme.textSecondary,
  },

  editButton: {
    width: 56,
    height: 56,

    alignItems: 'center',

    justifyContent:
      'center',
  },

  section: {
    marginBottom:
      Spacing.xxl,
  },

  sectionTitle: {
    fontFamily: Fonts.bold,

    fontWeight:
      FontWeights.bold,

    fontSize:
      FontSizes.xl,

    lineHeight:
      LineHeights.xl,

    color:
      theme.textSecondary,

    marginBottom:
      Spacing.md,
  },

  sectionCard: {
    borderRadius: 18,

    backgroundColor:
      theme.surface,

    overflow: 'hidden',
  },

  menuItem: {
    minHeight: 92,

    paddingHorizontal: 18,

    flexDirection: 'row',

    alignItems: 'center',
  },

  menuIconBox: {
    width: 46,

    alignItems:
      'flex-start',

    justifyContent:
      'center',

    marginRight: 18,
  },

  menuTextBox: {
    flex: 1,
  },

  menuTitle: {
    fontFamily: Fonts.bold,

    fontWeight:
      FontWeights.bold,

    fontSize:
      FontSizes.xl,

    lineHeight:
      LineHeights.xl,

    color: theme.text,
  },

  menuSubtitle: {
    marginTop: 2,

    fontFamily:
      Fonts.regular,

    fontSize:
      FontSizes.md,

    lineHeight:
      LineHeights.md,

    color:
      theme.textSecondary,
  },

  divider: {
    height: 1,

    backgroundColor:
      theme.border,

    marginLeft: 82,
  },

  dangerCard: {
    minHeight: 84,

    borderRadius: 18,

    backgroundColor:
      theme.surface,

    paddingHorizontal: 24,

    flexDirection: 'row',

    alignItems: 'center',

    gap: 18,
  },

  disabledCard: {
    opacity: 0.55,
  },

  dangerText: {
    fontFamily: Fonts.bold,

    fontWeight:
      FontWeights.bold,

    fontSize:
      FontSizes.xxl,

    lineHeight:
      LineHeights.xxl,

    color: theme.danger,
  },

  buttonPressed: {
    opacity: 0.72,
  },
});