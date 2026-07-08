import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import HomeHeader from '@/components/HomeHeader';
import FeatureCategorySection from '@/components/FeatureCategorySection';
import CategoryGrid, { CategoryGridItem } from '@/components/CategoryGrid';
import BannerSlider from '@/components/BannerSlider';
import SingleImage from '@/components/SingleImage';

import {
  Colors,
  Fonts,
  FontSizes,
  Layout,
  Radius,
  Spacing,
} from '@/constants/theme';

import {
  getLandingPage,
  HomePageBlock,
} from '@/services/home.service';

import {
  getUserInfo,
} from '@/services/app-storage.service';

import { API_BASE_URL } from '@/services/api';

const theme = Colors.light;

export default function HomeScreen() {
  const [blocks, setBlocks] = useState<HomePageBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [homeError, setHomeError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);

  const fetchHome = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setHomeError('');

      const data = await getLandingPage();

      setBlocks(data.blocks);
    } catch (error) {
      console.error('Fetch home failed:', error);
      setHomeError('Không tải được dữ liệu trang chủ');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const loadUserFromStorage = async () => {
    try {
      const user = await getUserInfo();

      /**
       * Home là màn public.
       * Không redirect về /welcome nếu không có user.
       *
       * Guest vẫn được phép xem:
       * - Home
       * - Banner
       * - Category
       * - Product section
       * - News
       */
      setUserInfo(user?.id ? user : null);

      return user?.id ? user : null;
    } catch (error) {
      console.log('[HOME_LOAD_USER_ERROR]', error);

      setUserInfo(null);

      return null;
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();

    if (hour < 12) {
      return {
        text: 'Chào buổi sáng',
        icon: '☀️',
      };
    }

    if (hour < 14) {
      return {
        text: 'Chào buổi trưa',
        icon: '🌤️',
      };
    }

    if (hour < 18) {
      return {
        text: 'Chào buổi chiều',
        icon: '🌇',
      };
    }

    return {
      text: 'Chào buổi tối',
      icon: '🌙',
    };
  };

  const normalizePhoneNumber = (value?: string | number) => {
    const raw = String(value || '').trim();

    if (!raw) {
      return '';
    }

    const cleaned = raw.replace(/[^\d+]/g, '');

    if (!cleaned) {
      return '';
    }

    return cleaned.startsWith('+')
      ? `+${cleaned.slice(1).replace(/\+/g, '')}`
      : cleaned.replace(/\+/g, '');
  };

  const getBranchPhone = (user: any) => {
    const branch =
      user?.Branch ||
      user?.branch ||
      user?.SelectedBranch ||
      user?.selectedBranch ||
      user?.selected_branch ||
      user?.Branches?.[0] ||
      user?.branches?.[0];

    return normalizePhoneNumber(
      branch?.PhoneNumber ||
        branch?.phoneNumber ||
        branch?.Phone ||
        branch?.phone ||
        branch?.Tel ||
        branch?.tel ||
        branch?.TEL ||
        branch?.Mobile ||
        branch?.mobile ||
        branch?.Contact ||
        branch?.contact
    );
  };

  const handlePromotionPress = () => {
    Alert.alert('Thông báo', 'Coming soon');
  };

  const handleBuyPress = async () => {
    try {
      const latestUser = await getUserInfo();
      const phoneNumber = getBranchPhone(latestUser || userInfo);

      if (!phoneNumber) {
        Alert.alert(
          'Thông báo',
          'Chưa có số điện thoại của chi nhánh. Vui lòng chọn cửa hàng trước.'
        );
        return;
      }

      const phoneUrl = `tel:${phoneNumber}`;
      const canCall = await Linking.canOpenURL(phoneUrl);

      if (!canCall) {
        Alert.alert('Thông báo', `Không thể gọi số ${phoneNumber}`);
        return;
      }

      await Linking.openURL(phoneUrl);
    } catch (error) {
      console.log('[HOME_BUY_CALL_ERROR]', error);
      Alert.alert('Thông báo', 'Không thể thực hiện cuộc gọi');
    }
  };

  const handleAccountPress = () => {
    if (!userInfo?.id) {
      router.push('/login');
      return;
    }

    router.push('/profile-edit');
  };

  useEffect(() => {
    let mounted = true;

    async function bootstrapHome() {
      try {
        await loadUserFromStorage();

        if (!mounted) {
          return;
        }

        setAuthReady(true);

        /**
         * Home là public nên luôn load dữ liệu,
         * kể cả khi chưa đăng nhập.
         */
        await fetchHome();
      } catch (error) {
        console.log('[HOME_BOOTSTRAP_ERROR]', error);

        if (mounted) {
          setHomeError('Không tải được dữ liệu trang chủ');
          setLoading(false);
          setAuthReady(true);
        }
      }
    }

    bootstrapHome();

    return () => {
      mounted = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!authReady) {
        return;
      }

      loadUserFromStorage();
    }, [authReady])
  );

  const onRefresh = async () => {
    await fetchHome(true);
  };

  const avatarUrl =
    userInfo?.Avatar?.url
      ? userInfo.Avatar.url.startsWith('http')
        ? userInfo.Avatar.url
        : `${API_BASE_URL}${userInfo.Avatar.url}`
      : '';

  const greeting = getGreeting();

  const greetingText =
    `${greeting.text} ${greeting.icon}`;

  const accountSubtitle = userInfo?.id
    ? 'Xem thông tin cá nhân'
    : 'Đăng nhập để xem thông tin cá nhân';

  const goToCategoryDetail = (category: CategoryGridItem) => {
    router.push({
      pathname: '/category-detail',
      params: {
        categoryId: String(category.id),
        level1Url: category.url || '',
      },
    });
  };

  const renderBlock = (block: HomePageBlock) => {
    switch (block.type) {
      case 'banner-slider':
        return (
          <BannerSlider
            key={`${block.type}-${block.id}`}
            banners={block.banners}
          />
        );

      case 'grid-category':
        return (
          <CategoryGrid
            key={`${block.type}-${block.id}`}
            categories={block.categories as CategoryGridItem[]}
            onPressCategory={goToCategoryDetail}
          />
        );

      case 'single-image':
        return (
          <SingleImage
            key={`${block.type}-${block.id}`}
            imageUrl={block.image.imageUrl}
          />
        );

      case 'feature-category':
        return (
          <FeatureCategorySection
            key={`${block.type}-${block.id}`}
            section={block.section}
          />
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
      >
        <HomeHeader
          onPressSearch={() => router.push('/search')}
          onPressNotification={() => router.push('/(tabs)/notification')}
        />

        <View style={styles.quickActionRow}>
          <QuickAction
            icon="pricetag"
            label="Ưu đãi"
            onPress={handlePromotionPress}
          />

          <QuickAction
            icon="call"
            label="Thu mua"
            onPress={handleBuyPress}
          />

          <QuickAction
            icon="storefront"
            label="Cửa hàng"
            onPress={() => router.push('/select-branch')}
          />

          <QuickAction
            icon="newspaper"
            label="Tin tức"
            onPress={() => router.push('/news')}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.accountBanner}
          onPress={handleAccountPress}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.accountTitle}>
              {greetingText}
            </Text>

            <Text style={styles.accountSubtitle}>
              {accountSubtitle}
            </Text>
          </View>

          {avatarUrl ? (
            <Image
              key={avatarUrl}
              source={{ uri: avatarUrl }}
              style={styles.avatarImage}
              width={62}
              height={62}
            />
          ) : (
            <Ionicons
              name="person-circle-outline"
              size={62}
              color="#FFFFFF"
            />
          )}
        </TouchableOpacity>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.stateText}>Đang tải trang chủ...</Text>
          </View>
        ) : homeError ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{homeError}</Text>
          </View>
        ) : (
          blocks.map(renderBlock)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.quickActionButton}
      onPress={onPress}
    >
      <Ionicons name={icon} size={18} color="#FFFFFF" />
      <Text style={styles.quickActionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.background,
  },

  avatarImage: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFFFFF20',
  },

  scrollContent: {
    paddingBottom: 120,
  },

  header: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  searchBox: {
    flex: 1,
    height: 58,
    backgroundColor: theme.surface,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: theme.primarySoft,
  },

  searchInput: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.lg,
    color: theme.primary,
    padding: 0,
  },

  headerIcon: {
    width: 42,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickActionRow: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    marginTop: Spacing.lg,
    flexDirection: 'row',
    gap: 8,
  },

  quickActionButton: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: theme.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  quickActionText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    color: '#FFFFFF',
  },

  accountBanner: {
    marginHorizontal: Layout.screenHorizontalPadding,
    marginTop: Spacing.md,
    minHeight: 72,
    borderRadius: Radius.md,
    backgroundColor: theme.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  accountTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    color: '#FFFFFF',
  },

  accountSubtitle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    color: '#FFFFFF',
  },

  stateBox: {
    height: 184,
    marginHorizontal: Layout.screenHorizontalPadding,
    marginTop: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },

  stateText: {
    marginTop: Spacing.md,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    color: theme.textSecondary,
  },

  errorText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    color: theme.primary,
  },
});