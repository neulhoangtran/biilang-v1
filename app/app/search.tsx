import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import ProductCard from '@/components/ProductCard';

import {
  AppProduct,
  getProducts,
} from '@/services/product.service';

import { useWishlist } from '@/hooks/useWishlist';

import {
  addRecentSearchTerm,
  getRecentSearchTerms,
  removeRecentSearchTerm,
} from '@/services/search-storage.service';

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

function sanitizeSearchText(value: string) {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[<>{}\[\]\\^`$|;"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function SearchScreen() {
  const inputRef = useRef<TextInput | null>(null);

  const {
    isWishlisted,
    toggleWishlist,
    refreshWishlistProductIds,
  } = useWishlist();

  const [keyword, setKeyword] = useState('');
  const [submittedKeyword, setSubmittedKeyword] = useState('');
  const [recentKeywords, setRecentKeywords] = useState<string[]>([]);

  const [products, setProducts] = useState<AppProduct[]>([]);

  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [searchTotal, setSearchTotal] = useState(0);

  const [searchError, setSearchError] = useState('');
  const [productError, setProductError] = useState('');

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const trimmedKeyword = useMemo(() => {
    return keyword.trim();
  }, [keyword]);

  const trimmedSubmittedKeyword = useMemo(() => {
    return submittedKeyword.trim();
  }, [submittedKeyword]);

  const showResult = Boolean(trimmedSubmittedKeyword);
  const hasMore = page < pageCount;

  const loadRecentKeywords = useCallback(async () => {
    const terms = await getRecentSearchTerms();
    setRecentKeywords(terms);
  }, []);

  useEffect(() => {
    loadRecentKeywords();
    refreshWishlistProductIds();
  }, [loadRecentKeywords, refreshWishlistProductIds]);

  const loadProducts = useCallback(
    async ({
      nextPage = 1,
      append = false,
      isRefresh = false,
      nextSearchText = trimmedSubmittedKeyword,
    }: {
      nextPage?: number;
      append?: boolean;
      isRefresh?: boolean;
      nextSearchText?: string;
    } = {}) => {
      const cleanKeyword = sanitizeSearchText(nextSearchText);

      if (!cleanKeyword) {
        setProducts([]);
        setPage(1);
        setPageCount(1);
        setSearchTotal(0);
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        setProductError('');

        const result = await getProducts({
          searchText: cleanKeyword,
          page: nextPage,
          pageSize: PAGE_SIZE,
          sort: ['id:desc'],
        });

        setProducts(prev =>
          append ? [...prev, ...result.products] : result.products
        );

        setPage(result.page);
        setPageCount(result.pageCount);
        setSearchTotal(result.total);
      } catch (error) {
        console.error('Search products failed:', error);
        setProductError('Không tải được sản phẩm');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [trimmedSubmittedKeyword]
  );

  useEffect(() => {
    if (!trimmedSubmittedKeyword) {
      setProducts([]);
      setPage(1);
      setPageCount(1);
      setSearchTotal(0);
      setProductError('');
      return;
    }

    loadProducts({
      nextPage: 1,
      append: false,
      nextSearchText: trimmedSubmittedKeyword,
    });
  }, [trimmedSubmittedKeyword, loadProducts]);

  const handleSearch = async (value = trimmedKeyword) => {
    const cleanKeyword = sanitizeSearchText(value);

    if (cleanKeyword.length < 2) {
      setSubmittedKeyword('');
      setProducts([]);
      setSearchTotal(0);
      setProductError('');
      setSearchError('Vui lòng nhập ít nhất 2 ký tự để tìm kiếm');
      inputRef.current?.focus();
      return;
    }

    Keyboard.dismiss();

    setSearchError('');
    setKeyword(cleanKeyword);
    setSubmittedKeyword(cleanKeyword);
    setPage(1);

    const nextTerms = await addRecentSearchTerm(cleanKeyword);
    setRecentKeywords(nextTerms);
  };

  const selectKeyword = async (value: string) => {
    setKeyword(value);
    await handleSearch(value);
  };

  const handleRemoveRecentKeyword = async (value: string) => {
    const nextTerms = await removeRecentSearchTerm(value);
    setRecentKeywords(nextTerms);
  };

  const clearKeyword = () => {
    setKeyword('');
    setSubmittedKeyword('');
    setProducts([]);
    setSearchTotal(0);
    setPage(1);
    setPageCount(1);
    setSearchError('');
    setProductError('');
    inputRef.current?.focus();
  };

  const onRefresh = async () => {
    await Promise.all([
      loadProducts({
        nextPage: 1,
        append: false,
        isRefresh: true,
      }),
      refreshWishlistProductIds(),
    ]);
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore || loading) return;

    await loadProducts({
      nextPage: page + 1,
      append: true,
    });
  };

  const goBack = () => {
    Keyboard.dismiss();
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.backButton}
          onPress={goBack}
        >
          <Ionicons name="chevron-back" size={28} color={theme.primary} />
        </TouchableOpacity>

        <View style={styles.searchBox}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleSearch()}
            style={styles.searchIconButton}
          >
            <Ionicons name="search-outline" size={28} color={theme.primary} />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            value={keyword}
            onChangeText={value => {
              setKeyword(value);
              setSearchError('');

              if (!value.trim()) {
                setSubmittedKeyword('');
                setProducts([]);
                setSearchTotal(0);
                setProductError('');
              }
            }}
            autoFocus
            placeholder="Tìm kiếm"
            placeholderTextColor={theme.primary}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => handleSearch()}
          />

          {trimmedKeyword ? (
            <TouchableOpacity activeOpacity={0.85} onPress={clearKeyword}>
              <Ionicons name="close" size={30} color={theme.primary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {searchError ? (
        <Text style={styles.searchErrorText}>{searchError}</Text>
      ) : null}

      {!showResult ? (
        <View style={styles.emptyContent}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="time" size={28} color={theme.primary} />
            <Text style={styles.sectionTitle}>Gần đây</Text>
          </View>

          {recentKeywords.length > 0 ? (
            recentKeywords.map(item => (
              <View key={item} style={styles.recentRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.recentTextButton}
                  onPress={() => selectKeyword(item)}
                >
                  <Text style={styles.recentText}>{item}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.recentRemoveButton}
                  onPress={() => handleRemoveRecentKeyword(item)}
                >
                  <Ionicons name="close" size={28} color={theme.primary} />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.emptyRecentText}>
              Chưa có tìm kiếm gần đây
            </Text>
          )}

          <View style={[styles.sectionTitleRow, styles.popularTitle]}>
            <Ionicons name="flame" size={28} color={theme.primary} />
            <Text style={styles.sectionTitle}>Phổ biến</Text>
          </View>
        </View>
      ) : (
        <View style={styles.resultContent}>
          <Text style={styles.resultTitle}>
            <Text style={styles.resultMuted}>
              {searchTotal.toLocaleString('en-US')} kết quả cho{' '}
            </Text>
            <Text style={styles.resultKeyword}>
              {trimmedSubmittedKeyword}
            </Text>
          </Text>

          {loading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={styles.stateText}>Đang tìm sản phẩm...</Text>
            </View>
          ) : productError ? (
            <View style={styles.stateBox}>
              <Text style={styles.errorText}>{productError}</Text>

              <Pressable
                style={styles.retryButton}
                onPress={() =>
                  loadProducts({
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
              columnWrapperStyle={styles.productRow}
              contentContainerStyle={styles.productList}
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
                  onPressWishlist={() => toggleWishlist(item.id)}
                />
              )}
              ListEmptyComponent={
                <Text style={styles.emptyResultText}>
                  Không tìm thấy sản phẩm phù hợp
                </Text>
              }
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.footerLoading}>
                    <ActivityIndicator color={theme.primary} />
                  </View>
                ) : null
              }
            />
          )}
        </View>
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
    paddingTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  backButton: {
    width: 42,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchBox: {
    flex: 1,
    height: 58,
    backgroundColor: theme.surface,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    gap: 12,
  },

  searchIconButton: {
    width: 36,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xl,
    color: theme.primary,
    borderRadius: 0,
    padding: 0,
  },

  searchErrorText: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    marginTop: Spacing.sm,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    color: theme.danger,
  },

  emptyContent: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: 52,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.xl,
  },

  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xxl,
    color: theme.primary,
  },

  recentRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  recentTextButton: {
    flex: 1,
  },

  recentText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xxl,
    color: theme.primary,
  },

  recentRemoveButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyRecentText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.lg,
    color: theme.textSecondary,
    marginBottom: Spacing.xl,
  },

  popularTitle: {
    marginTop: Spacing.xl,
  },

  resultContent: {
    flex: 1,
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Spacing.xl,
  },

  resultTitle: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    marginBottom: Spacing.xl,
  },

  resultMuted: {
    color: theme.textSecondary,
  },

  resultKeyword: {
    color: theme.primary,
  },

  productList: {
    paddingBottom: 120,
  },

  productRow: {
    gap: PRODUCT_GAP,
    marginBottom: Spacing.lg,
  },

  stateBox: {
    flex: 1,
    minHeight: 260,
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
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    color: theme.primary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },

  retryButton: {
    minHeight: 40,
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

  footerLoading: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyResultText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.lg,
    color: theme.textSecondary,
    paddingTop: Spacing.xl,
  },
});