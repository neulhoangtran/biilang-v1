import React, { useMemo } from 'react';

import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

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

const blankImage = require('@/assets/images/blank160x160.png');

export type CategoryGridItem = {
  id: string | number;
  documentId?: string;
  name: string;
  url?: string;
  image: string;
};

type CategoryGridProps = {
  categories: CategoryGridItem[];
  onPressCategory: (category: CategoryGridItem) => void;
};

const GRID_GAP = 8;
const CATEGORY_IMAGE_HEIGHT = 56;

function getColumnCount(width: number) {
  if (width >= 768) {
    return 6;
  }

  if (width >= 390) {
    return 4;
  }

  return 3;
}

export default function CategoryGrid({
  categories,
  onPressCategory,
}: CategoryGridProps) {
  const { width } = useWindowDimensions();

  const layout = useMemo(() => {
    const columnCount = getColumnCount(width);

    const horizontalPadding =
      Layout.screenHorizontalPadding * 2;

    const totalGap =
      GRID_GAP * (columnCount - 1);

    const availableWidth =
      width - horizontalPadding - totalGap;

    const itemWidth =
      Math.floor(availableWidth / columnCount);

    return {
      columnCount,
      itemWidth,
    };
  }, [width]);

  if (!categories?.length) return null;

  return (
    <View style={styles.categoryGrid}>
      {categories.map((category, index) => {
        const isLastInRow =
          (index + 1) % layout.columnCount === 0;

        return (
          <TouchableOpacity
            key={String(category.id)}
            activeOpacity={0.82}
            style={[
              styles.categoryCard,
              {
                width: layout.itemWidth,
                marginRight: isLastInRow ? 0 : GRID_GAP,
                marginBottom: GRID_GAP,
              },
            ]}
            onPress={() => onPressCategory(category)}
          >
            <View style={styles.imageWrap}>
              <CachedImage
                uri={category.image}
                source={blankImage}
                style={styles.categoryImage}
                cachePolicy="disk"
                contentFit="contain"
              />
            </View>

            <Text style={styles.categoryName} numberOfLines={2}>
              {category.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  categoryGrid: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.xxl,
  },

  categoryCard: {
    minHeight: 116,
    borderRadius: Radius.md,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 4,
    paddingTop: 10,
    paddingBottom: 12,
  },

  imageWrap: {
    height: CATEGORY_IMAGE_HEIGHT,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  categoryImage: {
    width: '100%',
    height: '100%',
  },

  categoryName: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    lineHeight: 20,
    color: theme.text,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});