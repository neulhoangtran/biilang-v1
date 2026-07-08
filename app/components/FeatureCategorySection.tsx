import React from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import ProductCard from '@/components/ProductCard';
import type { HomeProduct, HomeProductSection } from '@/services/home.service';

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

const { width } = Dimensions.get('window');

const PRODUCT_GAP = 12;
const PRODUCT_CARD_WIDTH =
  (width - Layout.screenHorizontalPadding * 2 - PRODUCT_GAP) / 2;

type FeatureCategorySectionProps = {
  section: HomeProductSection;
};

export default function FeatureCategorySection({
  section,
}: FeatureCategorySectionProps) {
  const {
    isWishlisted,
    toggleWishlist,
  } = useWishlist();

  if (!section.products.length) return null;

  const goToCategoryDetail = () => {
    if (!section.categoryUrl) return;

    router.push({
      pathname: '/category-detail',
      params: {
        level1Url: section.categoryUrl,
      },
    });
  };

  const goToProductDetail = (product: HomeProduct) => {
    router.push({
      pathname: '/product-detail',
      params: {
        productId: product.id,
        productName: product.name,
        productUrl: product.url,
        documentId: product.documentId ?? '',
      },
    });
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {section.title || section.categoryName || 'Sản phẩm nổi bật'}
        </Text>

        {section.categoryUrl ? (
          <Pressable style={styles.viewAllButton} onPress={goToCategoryDetail}>
            <Text style={styles.viewAllText}>Xem tất cả</Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={theme.primary}
            />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        horizontal
        data={section.products}
        keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.productList}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            width={PRODUCT_CARD_WIDTH}
            isWishlisted={isWishlisted(item.id)}
            onPress={() => goToProductDetail(item)}
            onPressWishlist={() => toggleWishlist(item.id)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.xxl,
  },

  header: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  title: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.headingSm,
    color: theme.text,
  },

  viewAllButton: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
    backgroundColor: theme.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  viewAllText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xs,
    color: theme.primary,
  },

  productList: {
    paddingHorizontal: Layout.screenHorizontalPadding,
  },

  separator: {
    width: PRODUCT_GAP,
  },
});