import React, { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

import CategoryFiterComponent, {
  CategoryFilterValue,
} from '@/components/CategoryFilterComponent';

import {
  Colors,
  Fonts,
  FontSizes,
  Layout,
  LineHeights,
  Radius,
  Spacing,
} from '@/constants/theme';

const theme = Colors.light;

export default function CategoryScreen() {
  const [selectedTree, setSelectedTree] = useState<CategoryFilterValue>({});

  const viewTargetCategory = useMemo(() => {
    return selectedTree.level3 ?? selectedTree.level2 ?? selectedTree.level1;
  }, [selectedTree]);

  const handleViewProducts = () => {
    // if (!viewTargetCategory) return;

    router.push({
      pathname: '/category-detail',
      params: {
        level1Url: selectedTree.level1?.url ?? '',
        level2Url: selectedTree.level2?.url ?? '',
        level3Url: selectedTree.level3?.url ?? '',
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Danh mục</Text>

        <CategoryFiterComponent
          onChange={setSelectedTree}
          showTitle
          contentPaddingHorizontal={Layout.screenHorizontalPadding}
        />
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          disabled={!viewTargetCategory}
          style={({ pressed }) => [
            styles.viewProductButton,
            !viewTargetCategory && styles.viewProductButtonDisabled,
            pressed && styles.cardPressed,
          ]}
          onPress={handleViewProducts}
        >
          <Text style={styles.viewProductText}>Xem sản phẩm</Text>
        </Pressable>
      </View>

    </SafeAreaView>
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
    paddingTop: Spacing.lg,
    paddingBottom: 110,
  },

  pageTitle: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.headingSm,
    lineHeight: LineHeights.headingSm,
    color: theme.text,
    marginBottom: Spacing.lg,
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Spacing.sm,
    paddingBottom: 20,
    backgroundColor: theme.background,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },

  viewProductButton: {
    height: 42,
    borderRadius: 12,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  viewProductButtonDisabled: {
    opacity: 0.45,
  },

  viewProductText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    color: '#FFFFFF',
  },

  cardPressed: {
    opacity: 0.75,
  },
});