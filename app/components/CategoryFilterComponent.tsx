import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import CachedImage from '@/components/CachedImage';

import {
  AppCategory,
  AppCategoryTreeNode,
  getCategoryTree,
} from '@/services/category.service';

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

export type CategoryFilterValue = {
  level1?: AppCategory;
  level2?: AppCategory;
  level3?: AppCategory;
};

type CategoryFilterInputValue = {
  level1Url?: string;
  level2Url?: string;
  level3Url?: string;
};

type CategoryFilterComponentProps = {
  value?: CategoryFilterInputValue;
  showTitle?: boolean;
  contentPaddingHorizontal?: number;
  defaultLevel1OnEmpty?: boolean;
  onChange: (value: CategoryFilterValue) => void;
};

function getValueKey(value?: CategoryFilterInputValue) {
  return [
    value?.level1Url ?? '',
    value?.level2Url ?? '',
    value?.level3Url ?? '',
  ].join('|');
}

function getEmitKey(value: CategoryFilterValue) {
  return [
    value.level1?.url ?? '',
    value.level2?.url ?? '',
    value.level3?.url ?? '',
  ].join('|');
}

function toAppCategory(
  item?: AppCategoryTreeNode | null
): AppCategory | undefined {
  if (!item) return undefined;

  return {
    id: item.id,
    documentId: item.documentId,
    name: item.name,
    url: item.url,
    image: item.image,
  };
}

function findLevel1ByUrl(
  tree: AppCategoryTreeNode[],
  url?: string
) {
  if (!url) return null;

  return tree.find(item => item.url === url) ?? null;
}

function findLevel2ByUrl(
  tree: AppCategoryTreeNode[],
  url?: string
) {
  if (!url) return null;

  for (const level1 of tree) {
    const level2 = level1.children.find(item => item.url === url);

    if (level2) {
      return {
        level1,
        level2,
      };
    }
  }

  return null;
}

function findLevel3ByUrl(
  tree: AppCategoryTreeNode[],
  url?: string
) {
  if (!url) return null;

  for (const level1 of tree) {
    for (const level2 of level1.children) {
      const level3 = level2.children.find(item => item.url === url);

      if (level3) {
        return {
          level1,
          level2,
          level3,
        };
      }
    }
  }

  return null;
}

function findSelectedPathFromValue(
  tree: AppCategoryTreeNode[],
  value?: CategoryFilterInputValue,
  defaultLevel1OnEmpty = true
) {
  const byLevel3 = findLevel3ByUrl(tree, value?.level3Url);

  if (byLevel3) {
    return byLevel3;
  }

  const byLevel2 = findLevel2ByUrl(tree, value?.level2Url);

  if (byLevel2) {
    return {
      level1: byLevel2.level1,
      level2: byLevel2.level2,
      level3: undefined,
    };
  }

  const byLevel1 = findLevel1ByUrl(tree, value?.level1Url);

  if (byLevel1) {
    return {
      level1: byLevel1,
      level2: undefined,
      level3: undefined,
    };
  }

  if (defaultLevel1OnEmpty && tree.length > 0) {
    return {
      level1: tree[0],
      level2: undefined,
      level3: undefined,
    };
  }

  return {
    level1: undefined,
    level2: undefined,
    level3: undefined,
  };
}

function getAllLevel3FromLevel1(level1?: AppCategoryTreeNode) {
  if (!level1?.children?.length) {
    return [];
  }

  const map = new Map<string, AppCategoryTreeNode>();

  level1.children.forEach(level2 => {
    level2.children?.forEach(level3 => {
      if (!map.has(level3.url)) {
        map.set(level3.url, level3);
      }
    });
  });

  return Array.from(map.values());
}

export default function CategoryFilterComponent({
  value,
  showTitle = true,
  contentPaddingHorizontal = Layout.screenHorizontalPadding,
  defaultLevel1OnEmpty = true,
  onChange,
}: CategoryFilterComponentProps) {
  const [categoryTree, setCategoryTree] = useState<AppCategoryTreeNode[]>([]);

  const [selectedLevel1Url, setSelectedLevel1Url] = useState('');
  const [selectedLevel2Url, setSelectedLevel2Url] = useState('');
  const [selectedLevel3Url, setSelectedLevel3Url] = useState('');

  const [loading, setLoading] = useState(true);

  const lastSyncedKeyRef = useRef('');
  const lastEmittedKeyRef = useRef('');

  const selectedLevel1 = useMemo(() => {
    return categoryTree.find(item => item.url === selectedLevel1Url);
  }, [categoryTree, selectedLevel1Url]);

  const level2Categories = useMemo(() => {
    return selectedLevel1?.children ?? [];
  }, [selectedLevel1]);

  const selectedLevel2 = useMemo(() => {
    return level2Categories.find(item => item.url === selectedLevel2Url);
  }, [level2Categories, selectedLevel2Url]);

  const level3Categories = useMemo(() => {
    if (selectedLevel2) {
      return selectedLevel2.children ?? [];
    }

    return getAllLevel3FromLevel1(selectedLevel1);
  }, [selectedLevel1, selectedLevel2]);

  const selectedLevel3 = useMemo(() => {
    return level3Categories.find(item => item.url === selectedLevel3Url);
  }, [level3Categories, selectedLevel3Url]);

  const emitValue = useCallback(
    (nextValue: CategoryFilterValue) => {
      const emitKey = getEmitKey(nextValue);

      if (lastEmittedKeyRef.current === emitKey) {
        return;
      }

      lastEmittedKeyRef.current = emitKey;
      onChange(nextValue);
    },
    [onChange]
  );

  const setSelectionAndEmit = useCallback(
    ({
      level1,
      level2,
      level3,
    }: {
      level1?: AppCategoryTreeNode;
      level2?: AppCategoryTreeNode;
      level3?: AppCategoryTreeNode;
    }) => {
      setSelectedLevel1Url(level1?.url ?? '');
      setSelectedLevel2Url(level2?.url ?? '');
      setSelectedLevel3Url(level3?.url ?? '');

      emitValue({
        level1: toAppCategory(level1),
        level2: toAppCategory(level2),
        level3: toAppCategory(level3),
      });
    },
    [emitValue]
  );

  useEffect(() => {
    let mounted = true;

    async function loadCategoryTree() {
      try {
        setLoading(true);

        const tree = await getCategoryTree();

        if (!mounted) return;

        setCategoryTree(tree);
      } catch (error) {
        console.error('Fetch category tree failed:', error);

        if (!mounted) return;

        setCategoryTree([]);
        setSelectionAndEmit({});
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadCategoryTree();

    return () => {
      mounted = false;
    };
  }, [setSelectionAndEmit]);

  useEffect(() => {
    if (loading) return;

    const syncKey = [
      getValueKey(value),
      defaultLevel1OnEmpty ? 'default-on' : 'default-off',
      categoryTree.map(item => item.url).join(','),
    ].join('#');

    if (lastSyncedKeyRef.current === syncKey) {
      return;
    }

    lastSyncedKeyRef.current = syncKey;

    const path = findSelectedPathFromValue(
      categoryTree,
      value,
      defaultLevel1OnEmpty
    );

    setSelectionAndEmit({
      level1: path.level1,
      level2: path.level2,
      level3: path.level3,
    });
  }, [
    loading,
    categoryTree,
    value?.level1Url,
    value?.level2Url,
    value?.level3Url,
    defaultLevel1OnEmpty,
    setSelectionAndEmit,
  ]);

  const clearSelection = useCallback(() => {
    setSelectionAndEmit({});
  }, [setSelectionAndEmit]);

  const handleSelectLevel1 = (category: AppCategoryTreeNode) => {
    const isSameCategory = selectedLevel1Url === category.url;

    if (isSameCategory) {
      if (!defaultLevel1OnEmpty) {
        clearSelection();
      }

      return;
    }

    setSelectionAndEmit({
      level1: category,
      level2: undefined,
      level3: undefined,
    });
  };

  const handleSelectLevel2 = (category: AppCategoryTreeNode) => {
    const isSameCategory = selectedLevel2Url === category.url;

    if (isSameCategory) {
      setSelectionAndEmit({
        level1: selectedLevel1,
        level2: undefined,
        level3: undefined,
      });

      return;
    }

    setSelectionAndEmit({
      level1: selectedLevel1,
      level2: category,
      level3: undefined,
    });
  };

  const handleSelectLevel3 = (category: AppCategoryTreeNode) => {
    const isSameCategory = selectedLevel3Url === category.url;

    if (isSameCategory) {
      setSelectionAndEmit({
        level1: selectedLevel1,
        level2: selectedLevel2,
        level3: undefined,
      });

      return;
    }

    setSelectionAndEmit({
      level1: selectedLevel1,
      level2: selectedLevel2,
      level3: category,
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.level1Row,
          {
            paddingHorizontal: contentPaddingHorizontal,
          },
        ]}
      >
        {categoryTree.map(category => {
          const active = category.url === selectedLevel1Url;

          return (
            <Pressable
              key={category.url}
              style={({ pressed }) => [
                styles.level1Card,
                active && styles.level1CardActive,
                pressed && styles.cardPressed,
              ]}
              onPress={() => handleSelectLevel1(category)}
            >
              <View style={styles.level1ImageWrap}>
                <CachedImage
                  uri={category.image}
                  source={blankImage}
                  style={styles.level1Image}
                  cachePolicy="disk"
                  contentFit="contain"
                />
              </View>

              <Text
                style={[
                  styles.level1Name,
                  active && styles.level1NameActive,
                ]}
                numberOfLines={2}
              >
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {showTitle && selectedLevel1 ? (
        <Text
          style={[
            styles.currentCategoryTitle,
            {
              paddingHorizontal: contentPaddingHorizontal,
            },
          ]}
        >
          {selectedLevel1.name}
        </Text>
      ) : null}

      {level2Categories.length > 0 ? (
        <View
          style={[
            styles.section,
            {
              paddingHorizontal: contentPaddingHorizontal,
            },
          ]}
        >
          <Text style={styles.sectionTitle}>Thương hiệu</Text>

          <View style={styles.chipWrap}>
            {level2Categories.map(category => {
              const active = category.url === selectedLevel2Url;

              return (
                <Pressable
                  key={category.url}
                  style={({ pressed }) => [
                    styles.chip,
                    active && styles.chipActive,
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() => handleSelectLevel2(category)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active && styles.chipTextActive,
                    ]}
                  >
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {level3Categories.length > 0 ? (
        <View
          style={[
            styles.section,
            {
              paddingHorizontal: contentPaddingHorizontal,
            },
          ]}
        >
          <Text style={styles.sectionTitle}>Dòng sản phẩm</Text>

          <View style={styles.chipWrap}>
            {level3Categories.map(category => {
              const active = category.url === selectedLevel3Url;

              return (
                <Pressable
                  key={category.url}
                  style={({ pressed }) => [
                    styles.chip,
                    active && styles.chipActive,
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() => handleSelectLevel3(category)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active && styles.chipTextActive,
                    ]}
                  >
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },

  level1Row: {
    gap: 10,
    paddingBottom: Spacing.xl,
  },

  level1Card: {
    width: 108,
    minHeight: 124,
    backgroundColor: theme.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },

  level1CardActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },

  level1ImageWrap: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  level1Image: {
    width: '100%',
    height: '100%',
  },

  level1Name: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    lineHeight: 18,
    color: theme.text,
    textAlign: 'center',
    textTransform: 'uppercase',
  },

  level1NameActive: {
    color: '#FFFFFF',
  },

  currentCategoryTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xxl,
    color: theme.text,
    marginBottom: Spacing.xl,
  },

  section: {
    marginBottom: Spacing.xxl,
  },

  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.headingSm,
    color: theme.text,
    marginBottom: Spacing.lg,
  },

  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  chip: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: theme.textMuted,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },

  chipText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.lg,
    color: theme.text,
  },

  chipTextActive: {
    color: '#FFFFFF',
    fontFamily: Fonts.bold,
  },

  cardPressed: {
    opacity: 0.75,
  },
});