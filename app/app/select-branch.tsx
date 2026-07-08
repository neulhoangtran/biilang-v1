import { router } from 'expo-router';
import { goBackOrDefault } from '@/services/safe-router.service';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Colors,
  Fonts,
  FontSizes,
  FontWeights,
  Layout,
  LineHeights,
  Radius,
} from '@/constants/theme';

import { getBranches, type Branch } from '@/services/branch.service';

import {
  getAppConfig,
} from '@/services/app-storage.service';

export default function SelectBranchScreen() {
  const colorScheme = 'light';
  const theme = Colors[colorScheme];

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchKey, setSelectedBranchKey] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      setLoading(true);

      const [data, config] = await Promise.all([
        getBranches(),
        getAppConfig(),
      ]);

      setBranches(data);

      setSelectedBranchKey(
        config.selected_branch?.documentId ||
        String(config.selected_branch?.id || '')
      );
    } catch (error) {
      console.log('Fetch branches failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBranchKey = (branch: Branch) => {
    return branch.documentId || String(branch.id || '');
  };

  const handleOpenDetail = (branch: Branch) => {
    router.push({
      pathname: '/branch-detail',
      params: {
        id: branch.documentId || branch.Slug || String(branch.id),
      },
    });
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: Branch;
    index: number;
  }) => {
    const branchKey = getBranchKey(item);

    const isSelected = Boolean(
      selectedBranchKey &&
      (selectedBranchKey === branchKey ||
        selectedBranchKey === String(item.id))
    );

    return (
      <Pressable
        onPress={() => handleOpenDetail(item)}
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: isSelected ? theme.primary : theme.border,
          },
        ]}
      >
        <View style={styles.leftContent}>
          <View style={styles.logoBox}>
            <Image
              source={require('@/assets/images/logo-v1.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.textWrap}>
            <Text
              numberOfLines={1}
              style={[styles.branchName, { color: theme.primary }]}
            >
              {index + 1}. {item.Name}
            </Text>

            <Text
              numberOfLines={1}
              style={[styles.branchArea, { color: theme.textSecondary }]}
            >
              {item.Area}
            </Text>

            {isSelected ? (
              <Text style={[styles.selectedText, { color: theme.primary }]}>
                Đang chọn
              </Text>
            ) : null}
          </View>
        </View>

        <Text style={[styles.arrow, { color: theme.primary }]}>{'›'}</Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View
        style={[
          styles.header,
          {
            borderBottomColor: theme.border,
            backgroundColor: theme.background,
          },
        ]}
      >
        <Pressable
          hitSlop={8}
          style={styles.backButton}
          onPress={() => {
            void goBackOrDefault();
          }}
        >
          <Text style={[styles.backText, { color: theme.primary }]}>{'‹'}</Text>
        </Pressable>

        <Text style={[styles.headerTitle, { color: theme.primary }]}>
          Cửa hàng
        </Text>

        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={branches}
          keyExtractor={item => item.documentId || String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    height: 56,
    paddingHorizontal: Layout.screenHorizontalPadding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },

  backText: {
    fontSize: 34,
    lineHeight: 34,
    fontFamily: Fonts.regular,
    fontWeight: FontWeights.regular,
  },

  headerTitle: {
    fontSize: FontSizes.headingMd,
    lineHeight: LineHeights.headingMd,
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
  },

  headerRight: {
    width: 40,
  },

  listContent: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: 12,
    paddingBottom: 24,
  },

  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  leftContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  logoBox: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderRadius: 8,
    overflow: 'hidden',
  },

  logoImage: {
    width: 44,
    height: 44,
  },

  textWrap: {
    flex: 1,
    paddingRight: 12,
  },

  branchName: {
    fontSize: FontSizes.md,
    lineHeight: LineHeights.md,
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
    marginBottom: 4,
  },

  branchArea: {
    fontSize: FontSizes.sm,
    lineHeight: LineHeights.sm,
    fontFamily: Fonts.regular,
    textTransform: 'uppercase',
  },

  workingTime: {
    marginTop: 4,
    fontSize: FontSizes.xs,
    lineHeight: LineHeights.xs,
    fontFamily: Fonts.regular,
  },

  selectedText: {
    marginTop: 4,
    fontSize: FontSizes.xs,
    lineHeight: LineHeights.xs,
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
  },

  arrow: {
    fontSize: 30,
    lineHeight: 30,
  },
});