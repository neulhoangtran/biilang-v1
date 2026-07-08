import React from 'react';
import { formatPrice } from '@/utils/price';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import CachedImage from '@/components/CachedImage';

import {
  Colors,
  Fonts,
  FontSizes,
  Layout,
  Radius,
  Spacing,
} from '@/constants/theme';

const theme = Colors.light;

const blankImage = require('@/assets/images/blank400x400.png');

export type ProductItem = {
  id: string;
  categoryId: string;
  categoryName: string;
  brand: string;
  name: string;
  price: number;
  image: string;
  warrantyType?: '18-months' | '5-years';
  isOutOfStock?: boolean;
};

export type ProductSectionData = {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  products: ProductItem[];
};

type ProductSectionProps = {
  section: ProductSectionData;
  onPressMore: () => void;
  onPressProduct: (product: ProductItem) => void;
  onPressBuy?: (product: ProductItem) => void;
  onPressFavorite?: (product: ProductItem) => void;
};

export default function ProductSection({
  section,
  onPressMore,
  onPressProduct,
  onPressBuy,
  onPressFavorite,
}: ProductSectionProps) {
  return (
    <View style={styles.productSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.moreButton}
          onPress={onPressMore}
        >
          <Text style={styles.moreText}>Xem thêm</Text>
          <Ionicons name="chevron-forward" size={28} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalProductList}
      >
        {section.products.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            onPress={() => onPressProduct(product)}
            onPressBuy={() => onPressBuy?.(product)}
            onPressFavorite={() => onPressFavorite?.(product)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function ProductCard({
  product,
  onPress,
  onPressBuy,
  onPressFavorite,
}: {
  product: ProductItem;
  onPress: () => void;
  onPressBuy?: () => void;
  onPressFavorite?: () => void;
}) {
  const isFiveYears = product.warrantyType === '5-years';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.productCard}
      onPress={onPress}
    >
      <View style={styles.productImageWrap}>
        <CachedImage
          uri={product.image}
          source={blankImage}
          style={styles.productImage}
          cachePolicy="disk"
          contentFit="contain"
        />

        {product.warrantyType ? (
          <View style={styles.warrantyBadge}>
            <Text style={styles.warrantyNumber}>
              {isFiveYears ? '5' : '18'}
            </Text>

            <View>
              <Text style={styles.warrantyText}>
                {isFiveYears ? 'YEARS' : 'MONTHS'}
              </Text>
              <Text style={styles.warrantySmall}>WARRANTY</Text>
            </View>
          </View>
        ) : null}
      </View>

      <Text style={styles.productBrand} numberOfLines={1}>
        {product.brand}
      </Text>

      <Text style={styles.productName} numberOfLines={4}>
        {product.name}
      </Text>

      <Text style={styles.productPrice}>
        Từ {formatPrice(product.price)}
      </Text>

      <View style={styles.productActionRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.buyButton,
            product.isOutOfStock && styles.buyButtonDisabled,
          ]}
          disabled={product.isOutOfStock}
          onPress={event => {
            event.stopPropagation();
            onPressBuy?.();
          }}
        >
          <Text style={styles.buyButtonText}>
            {product.isOutOfStock ? 'Hết hàng' : 'Mua'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.favoriteButton}
          onPress={event => {
            event.stopPropagation();
            onPressFavorite?.();
          }}
        >
          <Ionicons name="heart-outline" size={32} color={theme.icon} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  productSection: {
    marginBottom: Spacing.xxl,
  },

  sectionHeader: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sectionTitle: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xxl,
    color: theme.text,
  },

  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  moreText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xl,
    color: theme.text,
  },

  horizontalProductList: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    gap: 12,
  },

  productCard: {
    width: 178,
    backgroundColor: theme.surface,
    borderRadius: Radius.md,
    padding: 10,
  },

  productImageWrap: {
    height: 178,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },

  productImage: {
    width: '88%',
    height: '88%',
  },

  warrantyBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 62,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#2B2B2B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 2,
  },

  warrantyNumber: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: '#FFD84D',
    lineHeight: 20,
  },

  warrantyText: {
    fontFamily: Fonts.bold,
    fontSize: 6,
    color: '#FFFFFF',
    lineHeight: 7,
  },

  warrantySmall: {
    fontFamily: Fonts.bold,
    fontSize: 6,
    color: '#FFD84D',
    lineHeight: 7,
  },

  productBrand: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    color: theme.text,
    marginBottom: Spacing.sm,
  },

  productName: {
    minHeight: 92,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    lineHeight: 27,
    color: theme.text,
    marginBottom: Spacing.md,
  },

  productPrice: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xxl,
    color: theme.danger,
    marginBottom: Spacing.md,
  },

  productActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  buyButton: {
    flex: 1,
    height: 46,
    borderRadius: Radius.sm,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },

  buyButtonDisabled: {
    backgroundColor: '#B9B9B9',
  },

  buyButtonText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    color: '#FFFFFF',
  },

  favoriteButton: {
    width: 48,
    height: 46,
    borderRadius: Radius.sm,
    backgroundColor: '#F0F0F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
});