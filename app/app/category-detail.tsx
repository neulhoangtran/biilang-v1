import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { goBackOrDefault } from '@/services/safe-router.service';

import CategoryFilterComponent, {
  CategoryFilterValue,
} from '@/components/CategoryFilterComponent';

import ProductCard from '@/components/ProductCard';

import {
  AppProduct,
  getProducts,
} from '@/services/product.service';

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

type SortType = 'newest' | 'oldest' | 'price-desc' | 'price-asc';

function sanitizeSearchText(value: string) {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[<>{}\[\]\\^`$|;"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSortValue(sortType: SortType) {
  switch (sortType) {
    case 'oldest':
      return ['id:asc'];

    case 'price-desc':
      return ['SalePrice:desc', 'Price:desc', 'id:desc'];

    case 'price-asc':
      return ['SalePrice:asc', 'Price:asc', 'id:asc'];

    case 'newest':
    default:
      return ['id:desc'];
  }
}

function getStringParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

function buildCategoryFromParams(params: {
  level1Url?: string | string[];
  level2Url?: string | string[];
  level3Url?: string | string[];
}): CategoryFilterValue {
  const level1Url = getStringParam(params.level1Url);
  const level2Url = getStringParam(params.level2Url);
  const level3Url = getStringParam(params.level3Url);

  const value: CategoryFilterValue = {};

  if (level1Url) {
    value.level1 = {
      id: '',
      documentId: '',
      name: '',
      url: level1Url,
      image: '',
    };
  }

  if (level2Url) {
    value.level2 = {
      id: '',
      documentId: '',
      name: '',
      url: level2Url,
      image: '',
    };
  }

  if (level3Url) {
    value.level3 = {
      id: '',
      documentId: '',
      name: '',
      url: level3Url,
      image: '',
    };
  }

  return value;
}

function getDeepestCategoryUrl(tree: CategoryFilterValue) {
  return tree.level3?.url || tree.level2?.url || tree.level1?.url || '';
}

function cloneCategoryTree(tree: CategoryFilterValue): CategoryFilterValue {
  return {
    level1: tree.level1,
    level2: tree.level2,
    level3: tree.level3,
  };
}

export default function CategoryDetailScreen() {
  const params = useLocalSearchParams<{
    level1Url?: string;
    level2Url?: string;
    level3Url?: string;
  }>();

  const {
    isWishlisted,
    toggleWishlist,
    refreshWishlistProductIds,
  } = useWishlist();

  const initialTree = useMemo(() => {
    return buildCategoryFromParams({
      level1Url: params.level1Url,
      level2Url: params.level2Url,
      level3Url: params.level3Url,
    });
  }, [
    params.level1Url,
    params.level2Url,
    params.level3Url,
  ]);

  const [selectedTree, setSelectedTree] =
    useState<CategoryFilterValue>(initialTree);

  const [draftTree, setDraftTree] =
    useState<CategoryFilterValue>(initialTree);

  const [products, setProducts] = useState<AppProduct[]>([]);

  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [searchError, setSearchError] = useState('');

  const [sortType, setSortType] = useState<SortType>('newest');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [productError, setProductError] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);

  const activeCategoryUrl = useMemo(() => {
    return getDeepestCategoryUrl(selectedTree);
  }, [selectedTree]);

  const hasMore = page < pageCount;

  useEffect(() => {
    setSelectedTree(initialTree);
    setDraftTree(initialTree);
    setPage(1);
  }, [initialTree]);

  const loadProducts = useCallback(
    async ({
      nextPage = 1,
      append = false,
      isRefresh = false,
      nextSortType = sortType,
      nextSearchText = submittedSearch,
      nextCategoryUrl = activeCategoryUrl,
    }: {
      nextPage?: number;
      append?: boolean;
      isRefresh?: boolean;
      nextSortType?: SortType;
      nextSearchText?: string;
      nextCategoryUrl?: string;
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

        const result = await getProducts({
          categoryUrl: nextCategoryUrl || undefined,
          searchText: nextSearchText || undefined,
          page: nextPage,
          pageSize: PAGE_SIZE,
          sort: getSortValue(nextSortType),
        });

        setProducts(prev =>
          append ? [...prev, ...result.products] : result.products
        );

        setPage(result.page);
        setPageCount(result.pageCount);
        setTotal(result.total);
      } catch (error) {
        console.error('Fetch products failed:', error);
        setProductError('Không tải được sản phẩm');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [
      activeCategoryUrl,
      submittedSearch,
      sortType,
    ]
  );

  useEffect(() => {
    loadProducts({
      nextPage: 1,
      append: false,
    });
  }, [
    activeCategoryUrl,
    submittedSearch,
    sortType,
    loadProducts,
  ]);

  const handleSubmitSearch = async () => {
    const cleanKeyword = sanitizeSearchText(searchInput);

    if (cleanKeyword && cleanKeyword.length < 2) {
      setSearchError('Vui lòng nhập ít nhất 2 ký tự');
      return;
    }

    Keyboard.dismiss();

    setSearchError('');
    setSearchInput(cleanKeyword);
    setSubmittedSearch(cleanKeyword);
    setPage(1);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSubmittedSearch('');
    setSearchError('');
    setPage(1);
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

  const changeSort = (nextSortType: SortType) => {
    if (nextSortType === sortType) return;

    setSortType(nextSortType);
    setPage(1);
  };

  const openFilter = () => {
    setDraftTree(cloneCategoryTree(selectedTree));
    setFilterVisible(true);
  };

  const closeFilter = () => {
    setDraftTree(cloneCategoryTree(selectedTree));
    setFilterVisible(false);
  };

  const applyFilter = () => {
    const nextTree = cloneCategoryTree(draftTree);

    setSelectedTree(nextTree);
    setFilterVisible(false);
    setPage(1);

    router.setParams({
      level1Url: nextTree.level1?.url ?? '',
      level2Url: nextTree.level2?.url ?? '',
      level3Url: nextTree.level3?.url ?? '',
    });
  };

  const clearCategoryFilter = () => {
    setSelectedTree({});
    setDraftTree({});
    setPage(1);

    router.setParams({
      level1Url: '',
      level2Url: '',
      level3Url: '',
    });
  };

  const resetDraftFilter = () => {
    setDraftTree({});
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={goBackOrDefault}
        >
          <Ionicons name="chevron-back" size={28} color={theme.primary} />
        </Pressable>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={22} color={theme.primary} />

          <TextInput
            value={searchInput}
            onChangeText={value => {
              setSearchInput(value);
              setSearchError('');
            }}
            placeholder="Tìm kiếm"
            placeholderTextColor={theme.primary}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={handleSubmitSearch}
          />

          {searchInput ? (
            <Pressable onPress={clearSearch} style={styles.clearSearchButton}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          style={styles.searchButton}
          onPress={handleSubmitSearch}
        >
          <Ionicons name="search" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      {searchError ? (
        <Text style={styles.searchErrorText}>{searchError}</Text>
      ) : null}

      <View style={styles.filterArea}>
        <View style={styles.filterRow}>
          <Pressable
            style={styles.clearButton}
            onPress={clearCategoryFilter}
          >
            <Ionicons name="close" size={22} color={theme.danger} />
          </Pressable>

          <Pressable
            style={styles.filterButton}
            onPress={openFilter}
          >
            <Ionicons name="filter" size={20} color={theme.text} />
            <Text style={styles.filterButtonText}>Lọc</Text>
          </Pressable>

          <View style={styles.resultInfoBox}>
            <Text style={styles.resultInfoText} numberOfLines={1}>
              {total.toLocaleString('en-US')} sản phẩm
            </Text>
          </View>
        </View>

        {submittedSearch ? (
          <View style={styles.selectedChip}>
            <Text style={styles.selectedChipText} numberOfLines={1}>
              {submittedSearch}
            </Text>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortRow}
        >
          <SortChip
            icon="calendar-outline"
            label="Mới nhất"
            active={sortType === 'newest'}
            onPress={() => changeSort('newest')}
          />

          <SortChip
            icon="calendar-clear-outline"
            label="Cũ nhất"
            active={sortType === 'oldest'}
            onPress={() => changeSort('oldest')}
          />

          <SortChip
            icon="trending-up-outline"
            label="Giá thấp"
            active={sortType === 'price-asc'}
            onPress={() => changeSort('price-asc')}
          />

          <SortChip
            icon="trending-down-outline"
            label="Giá cao"
            active={sortType === 'price-desc'}
            onPress={() => changeSort('price-desc')}
          />
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.stateText}>Đang tải sản phẩm...</Text>
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
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.productRow}
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
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Không có sản phẩm phù hợp</Text>
            </View>
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

      <Modal
        visible={filterVisible}
        transparent
        animationType="slide"
        onRequestClose={closeFilter}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={closeFilter}
          />

          <View style={styles.filterSheet}>
            <View style={styles.filterSheetHeader}>
              <Text style={styles.filterSheetTitle}>Bộ lọc</Text>

              <Pressable
                style={styles.filterCloseButton}
                onPress={closeFilter}
              >
                <Ionicons name="close" size={26} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.filterSheetScroll}
              contentContainerStyle={styles.filterSheetContent}
              showsVerticalScrollIndicator={false}
            >
              <CategoryFilterComponent
                value={{
                  level1Url: draftTree.level1?.url ?? '',
                  level2Url: draftTree.level2?.url ?? '',
                  level3Url: draftTree.level3?.url ?? '',
                }}
                defaultLevel1OnEmpty={false}
                showTitle={false}
                contentPaddingHorizontal={Layout.screenHorizontalPadding}
                onChange={setDraftTree}
              />
            </ScrollView>

            <View style={styles.filterSheetFooter}>
              <Pressable
                style={styles.resetButton}
                onPress={resetDraftFilter}
              >
                <Text style={styles.resetButtonText}>Bỏ chọn</Text>
              </Pressable>

              <Pressable
                style={styles.applyButton}
                onPress={applyFilter}
              >
                <Text style={styles.applyButtonText}>Đồng ý</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SortChip({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.sortChip,
        active && styles.sortChipActive,
      ]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={18}
        color={active ? '#FFFFFF' : theme.text}
      />

      <Text
        style={[
          styles.sortChipText,
          active && styles.sortChipTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
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
    width: 40,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchBox: {
    flex: 1,
    height: 44,
    backgroundColor: theme.surface,
    borderRadius: Radius.sm,
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
    fontSize: FontSizes.sm,
    color: theme.primary,
    padding: 0,
  },

  clearSearchButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchErrorText: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    marginTop: Spacing.sm,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    color: theme.danger,
  },

  filterArea: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Spacing.md,
  },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },

  clearButton: {
    width: 40,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  filterButton: {
    height: 38,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  filterButtonText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    color: theme.text,
  },

  resultInfoBox: {
    flex: 1,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: theme.surface,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  resultInfoText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    color: theme.text,
  },

  selectedChip: {
    minHeight: 36,
    borderRadius: Radius.sm,
    backgroundColor: theme.primarySoft,
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },

  selectedChipText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    color: theme.primary,
  },

  sortRow: {
    gap: 8,
    paddingRight: Layout.screenHorizontalPadding,
    paddingBottom: Spacing.sm,
  },

  sortChip: {
    height: 34,
    borderRadius: Radius.sm,
    backgroundColor: theme.surface,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  sortChipActive: {
    backgroundColor: theme.primary,
  },

  sortChipText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    color: theme.text,
  },

  sortChipTextActive: {
    color: '#FFFFFF',
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

  listContent: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Spacing.md,
    paddingBottom: 80,
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
    paddingTop: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.md,
    color: theme.textSecondary,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
  },

  filterSheet: {
    height: '88%',
    backgroundColor: theme.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },

  filterSheetHeader: {
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },

  filterSheetTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    color: theme.text,
  },

  filterCloseButton: {
    position: 'absolute',
    right: Layout.screenHorizontalPadding,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },

  filterSheetScroll: {
    flex: 1,
  },

  filterSheetContent: {
    paddingTop: Spacing.xxl,
    paddingBottom: 120,
  },

  filterSheetFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Spacing.md,
    paddingBottom: 28,
    backgroundColor: theme.background,
    flexDirection: 'row',
    gap: 12,
  },

  resetButton: {
    width: 110,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  resetButtonText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    color: theme.text,
  },

  applyButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  applyButtonText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    color: '#FFFFFF',
  },
});