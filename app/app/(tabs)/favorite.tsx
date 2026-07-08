import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import ProductCard from '@/components/ProductCard';

import {
  AppProduct,
  getProductsByIds,
} from '@/services/product.service';

import { getUserInfo } from '@/services/app-storage.service';

import { useWishlist } from '@/hooks/useWishlist';

import {
  Colors,
  Fonts,
  FontSizes,
  Layout,
  Radius,
  Spacing,
} from '@/constants/theme';

const theme = Colors.light;

const PAGE_SIZE = 12;

const { width } = Dimensions.get('window');

const PRODUCT_GAP = 12;

const PRODUCT_CARD_WIDTH =
  (width - Layout.screenHorizontalPadding * 2 - PRODUCT_GAP) / 2;

function normalizeId(value?: string | number | null) {
  if (value === undefined || value === null) return '';

  return String(value).trim();
}

export default function FavoriteScreen() {
  const {
    wishlistProductIds,
    refreshWishlistProductIds,
    isWishlisted,
    removeWishlist,
  } = useWishlist();

  const [products, setProducts] = useState<AppProduct[]>([]);

  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [productError, setProductError] = useState('');

  const hasMore = page < pageCount;

  const titleText = useMemo(() => {
    if (!isLoggedIn) return 'Yêu thích';

    if (!wishlistProductIds.length) return 'Yêu thích';

    return `Yêu thích (${wishlistProductIds.length})`;
  }, [isLoggedIn, wishlistProductIds.length]);

  const resetWishlistState = () => {
    setProducts([]);
    setPage(1);
    setPageCount(1);
    setTotal(0);
  };

  const loadWishlistProducts = useCallback(
    async ({
      nextPage = 1,
      append = false,
      isRefresh = false,
    }: {
      nextPage?: number;
      append?: boolean;
      isRefresh?: boolean;
    } = {}) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        setProductError('');

        const user = await getUserInfo();
        const nextIsLoggedIn = Boolean(user?.id);

        setIsLoggedIn(nextIsLoggedIn);

        /**
         * Guest mode:
         * Không load wishlist server/local ở màn này.
         * Chỉ hiển thị trạng thái yêu cầu đăng nhập.
         */
        if (!nextIsLoggedIn) {
          resetWishlistState();

          return;
        }

        const ids = await refreshWishlistProductIds();

        if (!ids.length) {
          resetWishlistState();

          return;
        }

        const result = await getProductsByIds({
          productIds: ids,
          page: nextPage,
          pageSize: PAGE_SIZE,
          sort: ['id:desc'],
        });

        setProducts(prev => {
          if (append) {
            return [...prev, ...result.products];
          }

          return result.products;
        });

        setPage(result.page);
        setPageCount(result.pageCount);
        setTotal(result.total);
      } catch (error) {
        console.error('Fetch wishlist products failed:', error);
        setProductError('Không tải được sản phẩm yêu thích');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [refreshWishlistProductIds]
  );

  useFocusEffect(
    useCallback(() => {
      loadWishlistProducts({
        nextPage: 1,
        append: false,
      });
    }, [loadWishlistProducts])
  );

  const onRefresh = async () => {
    await loadWishlistProducts({
      nextPage: 1,
      append: false,
      isRefresh: true,
    });
  };

  const loadMore = async () => {
    if (!isLoggedIn) return;
    if (!hasMore || loadingMore || loading) return;

    await loadWishlistProducts({
      nextPage: page + 1,
      append: true,
    });
  };

  const removeFromWishlist = async (product: AppProduct) => {
    const productId = normalizeId(product.id);

    if (!productId) return;

    const removed = await removeWishlist(productId);

    if (!removed) return;

    setProducts(prev =>
      prev.filter(item => normalizeId(item.id) !== productId)
    );

    setTotal(prev => Math.max(prev - 1, 0));

    /**
     * Nếu đang ở page sau và remove hết sản phẩm đang render,
     * reload lại từ page 1 để tránh list bị trống lệch pagination.
     */
    if (products.length === 1 && page > 1) {
      await loadWishlistProducts({
        nextPage: 1,
        append: false,
      });
    }
  };

  const renderEmptyComponent = () => {
    const emptyMessage = isLoggedIn
      ? 'Các sản phẩm bạn bấm tim sẽ hiển thị ở đây.'
      : 'Tính năng yêu cầu đăng nhập, đăng nhập để không bỏ lỡ tin tức hấp dẫn.';

    const buttonText = isLoggedIn
      ? 'Khám phá sản phẩm'
      : 'Đăng nhập ngay';

    const handlePressButton = () => {
      if (isLoggedIn) {
        router.push('/category');
        return;
      }

      router.push('/login');
    };

    return (
      <View style={styles.emptyBox}>
        <Ionicons
          name="heart-outline"
          size={56}
          color={theme.textSecondary}
        />

        <Text style={styles.emptyTitle}>
          Chưa có sản phẩm yêu thích
        </Text>

        <Text style={styles.emptyText}>
          {emptyMessage}
        </Text>

        <Pressable
          style={styles.exploreButton}
          onPress={handlePressButton}
        >
          <Text style={styles.exploreButtonText}>
            {buttonText}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{titleText}</Text>

        {isLoggedIn && total > 0 ? (
          <Text style={styles.subtitle}>
            {total.toLocaleString('en-US')} sản phẩm
          </Text>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color={theme.primary} />

          <Text style={styles.stateText}>
            Đang tải sản phẩm yêu thích...
          </Text>
        </View>
      ) : productError ? (
        <View style={styles.stateBox}>
          <Ionicons
            name="alert-circle-outline"
            size={44}
            color={theme.primary}
          />

          <Text style={styles.errorText}>{productError}</Text>

          <Pressable
            style={styles.retryButton}
            onPress={() =>
              loadWishlistProducts({
                nextPage: 1,
                append: false,
              })
            }
          >
            <Text style={styles.retryText}>Tải lại</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={[
            styles.listContent,
            !products.length && styles.listContentEmpty,
          ]}
          columnWrapperStyle={products.length ? styles.productRow : undefined}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              width={PRODUCT_CARD_WIDTH}
              isWishlisted={isWishlisted(item.id)}
              onPressWishlist={() => removeFromWishlist(item)}
            />
          )}
          ListEmptyComponent={renderEmptyComponent}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator color={theme.primary} />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.background,
  },

  header: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },

  title: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.headingSm,
    color: theme.text,
  },

  subtitle: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    color: theme.textSecondary,
  },

  stateBox: {
    flex: 1,
    marginHorizontal: Layout.screenHorizontalPadding,
    marginTop: Spacing.xl,
    borderRadius: Radius.lg,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },

  stateText: {
    marginTop: Spacing.md,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    color: theme.textSecondary,
    textAlign: 'center',
  },

  errorText: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    color: theme.primary,
    textAlign: 'center',
  },

  retryButton: {
    minHeight: 42,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  retryText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    color: '#FFFFFF',
  },

  listContent: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Spacing.md,
    paddingBottom: 90,
  },

  listContentEmpty: {
    flexGrow: 1,
  },

  productRow: {
    gap: PRODUCT_GAP,
    marginBottom: 14,
  },

  footerLoading: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyBox: {
    flex: 1,
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },

  emptyTitle: {
    marginTop: Spacing.md,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    color: theme.text,
    textAlign: 'center',
  },

  emptyText: {
    marginTop: Spacing.sm,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  exploreButton: {
    marginTop: Spacing.xl,
    minHeight: 44,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  exploreButtonText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    color: '#FFFFFF',
  },
});