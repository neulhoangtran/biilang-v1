import { Ionicons } from '@expo/vector-icons';
import { goBackOrDefault } from '@/services/safe-router.service';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CachedImage from '@/components/CachedImage';
import PhoneLink from '@/components/PhoneLink';

import {
  ButtonSizes,
  Colors,
  Fonts,
  FontSizes,
  FontWeights,
  Layout,
  LineHeights,
  Radius,
  Spacing,
} from '@/constants/theme';

import {
  getBranchByDocumentId,
  getBranchImageUrl,
  selectBranchForCurrentUser,
  type Branch,
} from '@/services/branch.service';

import {
  getAppConfig,
  updateAppConfig,
} from '@/services/app-storage.service';

import {
  redirectAfterAuth,
  type AuthPayload,
} from '@/services/auth-flow.service';

function stripHtml(value?: string | null) {
  if (!value) return '';

  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default function BranchDetailScreen() {
  const colorScheme = 'light';
  const theme = Colors[colorScheme];

  const params = useLocalSearchParams<{
    id?: string;
    documentId?: string;
  }>();

  const rawId = params.id ?? params.documentId;
  const documentId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [branch, setBranch] = useState<Branch | null>(null);
  const [selectedBranchKey, setSelectedBranchKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBranch();
  }, [documentId]);

  const fetchBranch = async () => {
    if (!documentId) {
      setLoading(false);
      setError('Thiếu thông tin chi nhánh');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const [data, config] = await Promise.all([
        getBranchByDocumentId(documentId),
        getAppConfig(),
      ]);

      console.log('[BRANCH_DETAIL_DATA]', data);

      setBranch(data);

      setSelectedBranchKey(
        config.selected_branch?.documentId ||
        String(config.selected_branch?.id || '')
      );

      if (!data) {
        setError('Không tìm thấy chi nhánh');
      }
    } catch (error) {
      console.log('Fetch branch detail failed:', error);
      setError('Không thể tải thông tin chi nhánh');
    } finally {
      setLoading(false);
    }
  };

  const isAlreadySelected = useMemo(() => {
    if (!branch || !selectedBranchKey) return false;

    return (
      selectedBranchKey === branch.documentId ||
      selectedBranchKey === String(branch.id)
    );
  }, [branch, selectedBranchKey]);

  const hasSelectedBranch = Boolean(selectedBranchKey);

  const handleOpenMap = async () => {
    if (!branch?.MapLink) return;

    try {
      await Linking.openURL(branch.MapLink);
    } catch (error) {
      console.log('Open map failed:', error);
    }
  };

  const buildBranchCopyText = () => {
    if (!branch) return '';

    return [
      branch.Name,
      branch.Address,
      branch.Phone,
    ]
      .map(item => String(item || '').trim())
      .filter(Boolean)
      .join(' - ');
  };

  const handleCopyAddress = async () => {
    const text = buildBranchCopyText();

    if (!text) return;

    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Đã copy', text);
    } catch (error) {
      console.log('[COPY_BRANCH_ADDRESS_FAILED]', error);
      Alert.alert('Thông báo', 'Không thể copy địa chỉ. Vui lòng thử lại.');
    }
  };

  const handleSelectBranch = async () => {
    if (!branch || selecting) return;

    if (hasSelectedBranch) {
      return;
    }

    try {
      setSelecting(true);
      setError('');

      const result = await selectBranchForCurrentUser(branch);

      await updateAppConfig({
        selected_branch: {
          id: branch.id,
          documentId: branch.documentId,
          name: branch.Name,
          slug: branch.Slug,
          area: branch.Area,
          address: branch.Address,
          phone: branch.Phone,
          zalo: branch.Zalo ?? null,
          messenger: branch.Messenger ?? null,
          messenger_web: branch.MessengerWeb ?? null,
        },
      });

      if (result?.jwt || result?.token) {
        await redirectAfterAuth(result as AuthPayload);
        return;
      }

      if (result?.user_info || result?.user) {
        await redirectAfterAuth({
          user_info: result.user_info || result.user,
          nextStep: result.nextStep || 'HOME',
          config: {
            selected_branch: {
              id: branch.id,
              documentId: branch.documentId,
              name: branch.Name,
              slug: branch.Slug,
              area: branch.Area,
              address: branch.Address,
              phone: branch.Phone,
              zalo: branch.Zalo ?? null,
              messenger: branch.Messenger ?? null,
              messenger_web: branch.MessengerWeb ?? null,
            },
          },
        });
        return;
      }

      router.replace('/(tabs)');
    } catch (error) {
      console.log('Select branch failed:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Không thể chọn chi nhánh. Vui lòng thử lại.';

      setError(message);
    } finally {
      setSelecting(false);
    }
  };

  const imageUrl = getBranchImageUrl(branch);
  const cleanDayOff = stripHtml(branch?.DayOff);

  const shouldShowBottomBar = !hasSelectedBranch || isAlreadySelected;

  if (loading) {
    return (
      <SafeAreaView
        edges={['top', 'bottom']}
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!branch) {
    return (
      <SafeAreaView
        edges={['top', 'bottom']}
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <Header title="Chi nhánh" />

        <View style={styles.emptyBox}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {error || 'Không tìm thấy chi nhánh'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <Header title={branch.Name} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          !shouldShowBottomBar && styles.scrollContentNoBottomBar,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: theme.surface,
              borderColor: isAlreadySelected ? theme.primary : theme.border,
            },
          ]}
        >
          <View style={styles.logoBox}>
            <Image
              source={require('@/assets/images/logo-v1.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <Text style={[styles.heroTitle, { color: theme.primary }]}>
            {branch.Name}
          </Text>

          <Text style={[styles.heroSubtitle, { color: theme.text }]}>
            {branch.Area}
          </Text>

          {isAlreadySelected ? (
            <View style={styles.heroSelectedBadge}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={theme.primary}
              />

              <Text style={[styles.heroSelectedText, { color: theme.primary }]}>
                Đang chọn
              </Text>
            </View>
          ) : null}
        </View>

        {imageUrl ? (
          <View
            style={[
              styles.imageCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <CachedImage
              uri={imageUrl}
              style={styles.branchImage}
              cachePolicy="disk"
              contentFit="cover"
            />
          </View>
        ) : null}

        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <Pressable
            style={[styles.infoRow, styles.alignStart]}
            onPress={handleCopyAddress}
          >
            <Text style={styles.infoIcon}>📍</Text>

            <View style={styles.copyAddressContent}>
              <Text
                style={[
                  styles.infoText,
                  styles.multilineText,
                  { color: theme.text },
                ]}
              >
                {branch.Address || 'Đang cập nhật'}
              </Text>

              <Text style={[styles.copyHintText, { color: theme.primary }]}>
                Chạm để copy địa chỉ
              </Text>
            </View>
          </Pressable>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={[styles.infoRow, styles.phoneRow]}>
            <Text style={styles.infoIcon}>☎️</Text>

            <PhoneLink
              phone={branch.Phone}
              style={styles.phoneLink}
            >
              <Text
                style={[
                  styles.infoText,
                  styles.phoneText,
                  { color: theme.text },
                ]}
              >
                {branch.Phone || 'Đang cập nhật'}
              </Text>
            </PhoneLink>
          </View>

          {!!branch.WorkingTime && (
            <>
              <View
                style={[styles.divider, { backgroundColor: theme.border }]}
              />

              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>⏰</Text>

                <Text style={[styles.infoText, { color: theme.text }]}>
                  {branch.WorkingTime}
                </Text>
              </View>
            </>
          )}

          {!!cleanDayOff && (
            <>
              <View
                style={[styles.divider, { backgroundColor: theme.border }]}
              />

              <View style={[styles.infoRow, styles.alignStart]}>
                <Text style={styles.infoIcon}>📅</Text>

                <Text
                  style={[
                    styles.infoText,
                    styles.multilineText,
                    { color: theme.text },
                  ]}
                >
                  {cleanDayOff}
                </Text>
              </View>
            </>
          )}

          {branch.MapLink ? (
            <>
              <View
                style={[styles.divider, { backgroundColor: theme.border }]}
              />

              <Pressable style={styles.infoRow} onPress={handleOpenMap}>
                <Text style={styles.infoIcon}>🗺️</Text>

                <Text style={[styles.linkText, { color: theme.primary }]}>
                  Xem bản đồ
                </Text>
              </Pressable>
            </>
          ) : null}
        </View>

        {!!error && (
          <Text style={[styles.errorText, { color: theme.danger }]}>
            {error}
          </Text>
        )}
      </ScrollView>

      {shouldShowBottomBar ? (
        <View style={[styles.bottomBar, { backgroundColor: theme.background }]}>
          {isAlreadySelected ? (
            <View
              style={[
                styles.selectedNotice,
                { backgroundColor: theme.primarySoft },
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={theme.primary}
              />

              <Text
                style={[styles.selectedNoticeText, { color: theme.primary }]}
              >
                Đây là cửa hàng bạn đang chọn
              </Text>
            </View>
          ) : (
            <Pressable
              style={[
                styles.selectButton,
                {
                  backgroundColor: selecting ? theme.border : theme.primary,
                },
              ]}
              disabled={selecting}
              onPress={handleSelectBranch}
            >
              {selecting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.selectButtonText}>Chọn chi nhánh này</Text>
              )}
            </Pressable>
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function Header({ title }: { title: string }) {
  const theme = Colors.light;

  return (
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
        <Text style={[styles.backText, { color: theme.text }]}>{'‹'}</Text>
      </Pressable>

      <Text
        numberOfLines={1}
        style={[styles.headerTitle, { color: theme.primary }]}
      >
        {title}
      </Text>

      <View style={styles.headerRight} />
    </View>
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
    flex: 1,
    textAlign: 'center',
    fontSize: FontSizes.headingSm,
    lineHeight: LineHeights.headingSm,
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
  },

  headerRight: {
    width: 40,
  },

  scrollContent: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Spacing.lg,
    paddingBottom: 120,
  },

  scrollContentNoBottomBar: {
    paddingBottom: Spacing.xxl,
  },

  heroCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },

  logoBox: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderRadius: 14,
    overflow: 'hidden',
  },

  logoImage: {
    width: 72,
    height: 72,
  },

  heroTitle: {
    fontSize: FontSizes.headingSm,
    lineHeight: LineHeights.headingSm,
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
    textAlign: 'center',
    marginBottom: 6,
  },

  heroSubtitle: {
    fontSize: FontSizes.sm,
    lineHeight: LineHeights.sm,
    fontFamily: Fonts.regular,
    textTransform: 'uppercase',
  },

  heroSelectedBadge: {
    marginTop: 10,
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  heroSelectedText: {
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
    fontSize: FontSizes.sm,
  },

  imageCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },

  branchImage: {
    width: '100%',
    height: 240,
  },

  infoCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },

  infoRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
  },

  phoneRow: {
    alignItems: 'flex-start',
    paddingTop: 17,
    paddingBottom: 17,
  },

  alignStart: {
    alignItems: 'flex-start',
    paddingTop: 18,
    paddingBottom: 18,
  },

  infoIcon: {
    width: 30,
    fontSize: 18,
    lineHeight: 24,
    marginRight: 8,
    textAlign: 'center',
  },

  infoText: {
    flex: 1,
    fontSize: FontSizes.md,
    lineHeight: LineHeights.md,
    fontFamily: Fonts.medium,
    fontWeight: FontWeights.medium,
  },

  phoneLink: {
    flex: 1,
    minHeight: 24,
    justifyContent: 'center',
  },

  phoneText: {
    flex: 0,
    includeFontPadding: false,
  },

  multilineText: {
    lineHeight: 22,
  },

  linkText: {
    flex: 1,
    fontSize: FontSizes.md,
    lineHeight: LineHeights.md,
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
  },

  divider: {
    height: 1,
  },

  copyAddressContent: {
    flex: 1,
  },

  copyHintText: {
    marginTop: 4,
    fontSize: FontSizes.xs,
    lineHeight: LineHeights.xs,
    fontFamily: Fonts.regular,
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: 12,
    paddingBottom: 20,
  },

  selectButton: {
    height: ButtonSizes.sm,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectButtonText: {
    color: '#FFFFFF',
    fontSize: FontSizes.md,
    lineHeight: LineHeights.md,
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
  },

  selectedNotice: {
    minHeight: ButtonSizes.sm,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  selectedNoticeText: {
    flex: 1,
    fontSize: FontSizes.md,
    lineHeight: LineHeights.md,
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
    textAlign: 'center',
  },

  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.screenHorizontalPadding,
  },

  emptyText: {
    fontSize: FontSizes.md,
    lineHeight: LineHeights.md,
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },

  errorText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.regular,
    textAlign: 'center',
  },
});
