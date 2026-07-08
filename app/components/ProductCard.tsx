import { Ionicons } from '@expo/vector-icons';
import { formatPrice } from '@/utils/price';
import { router } from 'expo-router';
import React from 'react';
import {
  Alert,
  GestureResponderEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import CachedImage from '@/components/CachedImage';

import {
  Colors,
  Fonts,
  FontSizes,
  Radius,
  Spacing,
} from '@/constants/theme';

const theme = Colors.light;

const blankImage = require('@/assets/images/blank400x400.png');

export type ProductCardItem = {
  id: string;
  documentId?: string;
  name: string;
  url: string;
  price: number;
  salePrice: number;
  displayPrice?: number;
  image: string;
  isOutOfStock?: boolean;
};

type ProductCardProps = {
  product: ProductCardItem;
  width: number;
  isWishlisted?: boolean;
  buttonLabel?: string;
  style?: StyleProp<ViewStyle>;

  /**
   * Optional override.
   * Nếu không truyền, ProductCard sẽ tự router.push sang product-detail.
   */
  onPress?: () => void;

  onPressWishlist?: () => void;
};

function getProductPrice(product: ProductCardItem) {
  if (product.salePrice > 0) return product.salePrice;

  if (product.displayPrice && product.displayPrice > 0) {
    return product.displayPrice;
  }

  return product.price;
}

export default function ProductCard({
  product,
  width,
  isWishlisted = false,
  buttonLabel = 'Xem chi tiết',
  style,
  onPress,
  onPressWishlist,
}: ProductCardProps) {
  const currentPrice = getProductPrice(product);
  const showOldPrice = product.salePrice > 0 && product.price > 0;

  const goToProductDetail = () => {
    if (!product.url) return;

    router.push({
      pathname: '/product-detail',
      params: {
        productUrl: product.url,
      },
    });
  };

  const handlePressCard = () => {
    if (onPress) {
      onPress();
      return;
    }

    goToProductDetail();
  };

  const handlePressDetail = (event: GestureResponderEvent) => {
    event.stopPropagation();
    handlePressCard();
  };

  const handleLoginRequired = () => {
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
  };

  const handlePressWishlist = (event: GestureResponderEvent) => {
    event.stopPropagation();

    if (!onPressWishlist) {
      handleLoginRequired();
      return;
    }

    onPressWishlist();
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          width,
        },
        pressed && styles.cardPressed,
        style,
      ]}
      onPress={handlePressCard}
    >
      <View style={styles.imageWrap}>
        <CachedImage
          uri={product.image}
          source={blankImage}
          style={styles.image}
          cachePolicy="disk"
          contentFit="contain"
        />

        {showOldPrice ? (
          <View style={styles.saleBadge}>
            <Text style={styles.saleBadgeText}>Sale</Text>
          </View>
        ) : null}

        {product.isOutOfStock ? (
          <View style={styles.outOfStockOverlay}>
            <Text style={styles.outOfStockText}>Hết hàng</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.name} numberOfLines={3}>
        {product.name}
      </Text>

      <View style={styles.priceRow}>
        {showOldPrice ? (
          <Text style={styles.oldPrice}>
            {formatPrice(product.price)}
          </Text>
        ) : null}

        <Text style={styles.salePrice}>
          {formatPrice(currentPrice)}
        </Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [
            styles.detailButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handlePressDetail}
        >
          <Text style={styles.detailButtonText}>{buttonLabel}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.wishlistButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handlePressWishlist}
          hitSlop={8}
        >
          <Ionicons
            name={isWishlisted ? 'heart' : 'heart-outline'}
            size={26}
            color={isWishlisted ? theme.danger : theme.icon}
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderRadius: Radius.md,
    padding: 10,
  },

  cardPressed: {
    opacity: 0.86,
  },

  imageWrap: {
    height: 138,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },

  image: {
    width: '88%',
    height: '88%',
  },

  saleBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    minHeight: 24,
    paddingHorizontal: 8,
    borderTopLeftRadius: Radius.sm,
    borderBottomRightRadius: Radius.sm,
    backgroundColor: theme.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },

  saleBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xs,
    color: '#FFFFFF',
  },

  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  outOfStockText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    color: '#FFFFFF',
  },

  name: {
    minHeight: 62,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    lineHeight: 20,
    color: theme.text,
    marginBottom: Spacing.sm,
  },

  priceRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },

  oldPrice: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    color: theme.textSecondary,
    textDecorationLine: 'line-through',
  },

  salePrice: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    color: theme.danger,
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  detailButton: {
    flex: 1,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  detailButtonText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    color: '#FFFFFF',
  },

  wishlistButton: {
    width: 42,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: '#F0F0F5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonPressed: {
    opacity: 0.75,
  },
});