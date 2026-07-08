import React, { useEffect, useMemo, useState } from 'react';
import { goBackOrDefault } from '@/services/safe-router.service';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import RenderHTML from 'react-native-render-html';

import CachedImage from '@/components/CachedImage';
import ProductCard from '@/components/ProductCard';

import { formatPrice } from '@/utils/price';

import {
  AppProduct,
  getProductByDocumentId,
  getProductByUrl,
  getRelatedProducts,
} from '@/services/product.service';

import {
  getAppConfig,
  getUserInfo,
} from '@/services/app-storage.service';

import { useWishlist } from '@/hooks/useWishlist';

import {
  Colors,
  Fonts,
  FontSizes,
  Layout,
  Radius,
  Spacing,
} from '@/constants/theme';

const blankImage = require('@/assets/images/blank600x600.png');

const theme = Colors.light;
const { width } = Dimensions.get('window');

const PRODUCT_GAP = 12;

const RELATED_CARD_WIDTH =
  (width - Layout.screenHorizontalPadding * 2 - PRODUCT_GAP) / 2;

const DESCRIPTION_CONTENT_WIDTH =
  width - Layout.screenHorizontalPadding * 2 - 32;

const BANK_INFO_ITEMS = [
  {
    label: 'Ngân hàng',
    value: '하나은행',
  },
  {
    label: 'Số tài khoản',
    value: '37191061976507',
  },
  {
    label: 'Chủ tài khoản',
    value: 'TRAN DUY QUANG',
  },
] as const;

type MessengerLinkResult = {
  rawUrl: string;
  appUrl: string;
  webUrl: string;
};

function getCurrentPrice(product: AppProduct) {
  return product.salePrice > 0 ? product.salePrice : product.price;
}

function normalizeHtml(value?: string | null) {
  if (!value) return '';

  return value
    .replace(/\\n/g, '')
    .replace(/\n/g, '')
    .trim();
}

function appendMessageToUrl(baseUrl: string, message: string) {
  const cleanBaseUrl = baseUrl.trim();

  if (!cleanBaseUrl) return '';

  const separator = cleanBaseUrl.includes('?') ? '&' : '?';

  return `${cleanBaseUrl}${separator}text=${encodeURIComponent(message)}`;
}

function getMessengerTargetFromUrl(url: string) {
  const cleanUrl = url.trim();

  if (!cleanUrl) return '';

  if (cleanUrl.startsWith('fb-messenger://user/')) {
    return cleanUrl
      .replace('fb-messenger://user/', '')
      .split(/[/?#]/)[0];
  }

  if (cleanUrl.startsWith('fb-messenger://user-thread/')) {
    return cleanUrl
      .replace('fb-messenger://user-thread/', '')
      .split(/[/?#]/)[0];
  }

  try {
    const parsedUrl = new URL(cleanUrl);
    const host = parsedUrl.hostname.replace(/^www\./, '');

    if (host === 'm.me') {
      return parsedUrl.pathname.replace(/^\/+/, '').split('/')[0];
    }

    if (host === 'facebook.com') {
      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);

      if (
        pathParts[0] === 'messages' &&
        pathParts[1] === 't' &&
        pathParts[2]
      ) {
        return pathParts[2];
      }

      return pathParts[0] ?? '';
    }
  } catch {
    return cleanUrl;
  }

  return '';
}

function buildMessengerUrls(rawUrl: string): MessengerLinkResult {
  const cleanUrl = rawUrl.trim();
  const target = getMessengerTargetFromUrl(cleanUrl);

  if (!target) {
    return {
      rawUrl: cleanUrl,
      appUrl: cleanUrl,
      webUrl: cleanUrl,
    };
  }

  return {
    rawUrl: cleanUrl,
    appUrl: `fb-messenger://user/${target}`,
    webUrl: `https://m.me/${target}`,
  };
}

async function getMessengerLinkFromStorage() {
  const config = await getAppConfig();

  const rawConfig = config as Record<string, any>;
  const selectedBranch = rawConfig.selected_branch as Record<string, any> | null;

  return String(
    selectedBranch?.messenger ||
      selectedBranch?.Messenger ||
      selectedBranch?.messenger_web ||
      selectedBranch?.MessengerWeb ||
      rawConfig.messenger ||
      rawConfig.Messenger ||
      rawConfig.messenger_link ||
      rawConfig.messengerUrl ||
      rawConfig.messenger_url ||
      rawConfig.facebook_messenger_url ||
      rawConfig.facebookMessengerUrl ||
      ''
  ).trim();
}

function buildMessengerMessage(product: AppProduct) {
  const currentPrice = getCurrentPrice(product);
  const priceText = formatPrice(currentPrice);

  return [
    'Tôi đang muốn nhận tư vấn sản phẩm hoặc dịch vụ',
    `${product.name} với giá: ${priceText}`,
  ].join('\n');
}

async function checkLoggedInUser() {
  try {
    const user = await getUserInfo();

    return Boolean(user?.id);
  } catch (error) {
    console.log('[CHECK_LOGIN_USER_ERROR]', error);

    return false;
  }
}

function showMissingBranchAlert(isLoggedIn: boolean) {
  if (!isLoggedIn) {
    Alert.alert(
      'Bạn chưa chọn chi nhánh',
      'Nếu chưa đăng ký tài khoản hãy đăng ký và chọn chi nhánh để liên hệ đặt hàng.',
      [
        {
          text: 'Để sau',
          style: 'cancel',
        },
        {
          text: 'Đăng nhập',
          onPress: () => router.push('/login'),
        },
        {
          text: 'Đăng ký',
          onPress: () => router.push('/register'),
        },
      ]
    );

    return;
  }

  Alert.alert(
    'Bạn chưa chọn chi nhánh',
    'Vui lòng chọn chi nhánh để liên hệ đặt hàng.',
    [
      {
        text: 'Để sau',
        style: 'cancel',
      },
      {
        text: 'Chọn chi nhánh',
        onPress: () => router.push('/select-branch'),
      },
    ]
  );
}

async function openMessengerForProduct(product: AppProduct) {
  try {
    const messengerLink = await getMessengerLinkFromStorage();

    if (!messengerLink) {
      const isLoggedIn = await checkLoggedInUser();

      showMissingBranchAlert(isLoggedIn);

      return;
    }

    const message = buildMessengerMessage(product);

    await Clipboard.setStringAsync(message);

    const messengerUrls = buildMessengerUrls(messengerLink);

    const webUrlWithMessage = appendMessageToUrl(
      messengerUrls.webUrl,
      message
    );

    try {
      if (webUrlWithMessage) {
        await WebBrowser.openBrowserAsync(webUrlWithMessage);
        return;
      }
    } catch (error) {
      console.log('Open m.me with message failed:', error);
    }

    try {
      const canOpenApp = await Linking.canOpenURL(messengerUrls.appUrl);

      if (canOpenApp) {
        await Linking.openURL(messengerUrls.appUrl);

        Alert.alert(
          'Đã copy nội dung',
          'Nếu Messenger không tự điền nội dung, hãy dán nội dung đã copy vào khung chat.'
        );

        return;
      }
    } catch (error) {
      console.log('Open Messenger app failed:', error);
    }

    if (messengerUrls.webUrl) {
      await WebBrowser.openBrowserAsync(messengerUrls.webUrl);

      Alert.alert(
        'Đã copy nội dung',
        'Nếu Messenger không tự điền nội dung, hãy dán nội dung đã copy vào khung chat.'
      );

      return;
    }

    Alert.alert(
      'Không mở được Messenger',
      'Link Messenger không hợp lệ. Nội dung sản phẩm đã được copy.'
    );
  } catch (error) {
    console.error('Open messenger failed:', error);

    Alert.alert(
      'Không mở được Messenger',
      'Nội dung sản phẩm đã được copy. Vui lòng mở Messenger và dán nội dung để gửi.'
    );
  }
}

async function copyBankInfo() {
  const content = BANK_INFO_ITEMS
    .map(item => item.value)
    .join('\n');

  try {
    await Clipboard.setStringAsync(content);

    Alert.alert(
      'Đã sao chép',
      'Đã sao chép đầy đủ thông tin tài khoản ngân hàng.'
    );
  } catch (error) {
    console.error('Copy bank info failed:', error);

    Alert.alert(
      'Không thể sao chép',
      'Vui lòng thử lại.'
    );
  }
}

export default function ProductDetailScreen() {
  const params = useLocalSearchParams<{
    productId?: string;
    productName?: string;
    productUrl?: string;
    documentId?: string;
  }>();

  const productUrl =
    typeof params.productUrl === 'string' ? params.productUrl : '';

  const documentId =
    typeof params.documentId === 'string' ? params.documentId : '';

  const {
    isWishlisted,
    toggleWishlist,
    refreshWishlistProductIds,
  } = useWishlist();

  const [product, setProduct] = useState<AppProduct | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<AppProduct[]>([]);

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const [loading, setLoading] = useState(true);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [productError, setProductError] = useState('');

  const images = useMemo(() => {
    if (!product) return [];

    const galleryImages = product.gallery.map(item => item.imageUrl);
    const allImages = [product.image, ...galleryImages].filter(Boolean);

    return Array.from(new Set(allImages));
  }, [product]);

  const breadcrumbItems = useMemo(() => {
    if (!product) return [];

    return product.categories
      .map(item => ({
        id: item.id,
        name: item.name,
        url: item.url,
      }))
      .filter(item => item.name);
  }, [product]);

  const isCurrentProductWishlisted = useMemo(() => {
    if (!product) return false;

    return isWishlisted(product.id);
  }, [product, isWishlisted]);

  useEffect(() => {
    fetchProduct();
  }, [productUrl, documentId]);

  useEffect(() => {
    if (product) {
      fetchRelatedProducts(product);
    }
  }, [product?.url]);

  const fetchProduct = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setProductError('');

      let result: AppProduct | null = null;

      if (productUrl) {
        result = await getProductByUrl(productUrl);
      } else if (documentId) {
        result = await getProductByDocumentId(documentId);
      }

      if (!result) {
        setProductError('Không tìm thấy sản phẩm');
        setProduct(null);
        return;
      }

      setProduct(result);
      setActiveImageIndex(0);
    } catch (error) {
      console.error('Fetch product detail failed:', error);
      setProductError('Không tải được sản phẩm');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchRelatedProducts = async (currentProduct: AppProduct) => {
    try {
      setRelatedLoading(true);

      const categoryUrl =
        currentProduct.categoryUrls[1] ||
        currentProduct.categoryUrls[0] ||
        '';

      if (!categoryUrl) {
        setRelatedProducts([]);
        return;
      }

      const products = await getRelatedProducts({
        categoryUrl,
        excludeProductUrl: currentProduct.url,
        pageSize: 12,
      });

      setRelatedProducts(products);
    } catch (error) {
      console.error('Fetch related products failed:', error);
      setRelatedProducts([]);
    } finally {
      setRelatedLoading(false);
    }
  };

  const onRefresh = async () => {
    await Promise.all([
      fetchProduct(true),
      refreshWishlistProductIds(),
    ]);
  };

  const goToCategory = () => {
    if (!product) return;

    const level1Url = product.categoryUrls[0] ?? '';
    const level2Url = product.categoryUrls[1] ?? '';
    const level3Url = product.categoryUrls[2] ?? '';

    if (!level1Url && !level2Url && !level3Url) return;

    router.push({
      pathname: '/category-detail',
      params: {
        level1Url,
        level2Url,
        level3Url,
      },
    });
  };

  const showLoginRequiredAlert = () => {
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

  const handleToggleWishlist = async (productId: string) => {
    try {
      const user = await getUserInfo();

      if (!user?.id) {
        showLoginRequiredAlert();
        return;
      }

      await toggleWishlist(productId);
    } catch (error) {
      console.log('[PRODUCT_DETAIL_WISHLIST_AUTH_ERROR]', error);
      showLoginRequiredAlert();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color={theme.primary} />

          <Text style={styles.stateText}>
            Đang tải sản phẩm...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (productError || !product) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={goBackOrDefault}>
            <Ionicons name="chevron-back" size={28} color={theme.primary} />
          </Pressable>
        </View>

        <View style={styles.stateBox}>
          <Text style={styles.errorText}>
            {productError || 'Không tìm thấy sản phẩm'}
          </Text>

          <Pressable style={styles.retryButton} onPress={() => fetchProduct()}>
            <Text style={styles.retryText}>Tải lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const currentPrice = getCurrentPrice(product);
  const showOldPrice = product.salePrice > 0 && product.price > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => {
            void goBackOrDefault();
          }}
        >
          <Ionicons name="chevron-back" size={28} color={theme.primary} />
        </Pressable>

        <Text style={styles.headerTitle} numberOfLines={1}>
          Chi tiết sản phẩm
        </Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
      >
        <View style={styles.imageSection}>
          <CachedImage
            uri={images[activeImageIndex]}
            source={blankImage}
            style={styles.mainImage}
            cachePolicy="disk"
            contentFit="contain"
          />

          {showOldPrice ? (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>Sale</Text>
            </View>
          ) : null}
        </View>

        {images.length > 1 ? (
          <FlatList
            horizontal
            data={images}
            keyExtractor={(item, index) => `${item}-${index}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailList}
            renderItem={({ item, index }) => {
              const active = index === activeImageIndex;

              return (
                <Pressable
                  style={[
                    styles.thumbnailCard,
                    active && styles.thumbnailCardActive,
                  ]}
                  onPress={() => setActiveImageIndex(index)}
                >
                  <CachedImage
                    uri={item}
                    source={blankImage}
                    style={styles.thumbnailImage}
                    cachePolicy="disk"
                    contentFit="contain"
                  />
                </Pressable>
              );
            }}
          />
        ) : null}

        <View style={styles.infoSection}>
          <Text style={styles.productName}>{product.name}</Text>

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

          {breadcrumbItems.length > 0 ? (
            <Pressable style={styles.breadcrumbBox} onPress={goToCategory}>
              {breadcrumbItems.map((item, index) => (
                <React.Fragment key={`${item.id}-${item.url}`}>
                  <Text style={styles.breadcrumbText} numberOfLines={1}>
                    {item.name}
                  </Text>

                  {index < breadcrumbItems.length - 1 ? (
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={theme.textSecondary}
                    />
                  ) : null}
                </React.Fragment>
              ))}
            </Pressable>
          ) : null}
        </View>

        <PaymentNoticeSection />

        {product.description ? (
          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>Mô tả sản phẩm</Text>

            <RenderHTML
              contentWidth={DESCRIPTION_CONTENT_WIDTH}
              source={{
                html: normalizeHtml(product.description),
              }}
              baseStyle={styles.descriptionText}
              tagsStyles={{
                p: styles.htmlParagraph,
                strong: styles.htmlStrong,
                b: styles.htmlStrong,
                h1: styles.htmlHeading,
                h2: styles.htmlHeading,
                h3: styles.htmlHeading,
                ul: styles.htmlList,
                li: styles.htmlListItem,
                table: styles.htmlTable,
                td: styles.htmlTableCell,
                th: styles.htmlTableCell,
              }}
            />
          </View>
        ) : null}

        <View style={styles.relatedSection}>
          <View style={styles.relatedHeader}>
            <Text style={styles.sectionTitle}>Sản phẩm liên quan</Text>

            {relatedLoading ? (
              <ActivityIndicator color={theme.primary} />
            ) : null}
          </View>

          <FlatList
            horizontal
            data={relatedProducts}
            keyExtractor={item => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.relatedList}
            ItemSeparatorComponent={() => (
              <View style={styles.relatedSeparator} />
            )}
            renderItem={({ item }) => (
              <ProductCard
                product={item}
                width={RELATED_CARD_WIDTH}
                isWishlisted={isWishlisted(item.id)}
                onPressWishlist={() => handleToggleWishlist(item.id)}
              />
            )}
            ListEmptyComponent={
              !relatedLoading ? (
                <Text style={styles.emptyRelatedText}>
                  Chưa có sản phẩm liên quan
                </Text>
              ) : null
            }
          />
        </View>
      </ScrollView>

      <View style={styles.fixedBottomBar}>
        <Pressable
          style={styles.fixedContactButton}
          onPress={() => openMessengerForProduct(product)}
        >
          <Text style={styles.fixedContactButtonText}>
            Liên hệ đặt hàng
          </Text>
        </Pressable>

        <Pressable
          style={styles.fixedFavoriteButton}
          onPress={() => handleToggleWishlist(product.id)}
        >
          <Ionicons
            name={isCurrentProductWishlisted ? 'heart' : 'heart-outline'}
            size={28}
            color={
              isCurrentProductWishlisted
                ? theme.danger
                : theme.primary
            }
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function PaymentNoticeSection() {
  return (
    <View style={styles.paymentCard}>
      <View style={styles.paymentHeader}>
        <Text style={styles.paymentHeaderText}>Thanh toán</Text>
      </View>

      <View style={styles.paymentBody}>
        <Text style={styles.paymentBlueTitle}>
          HÃY GỌI XÁC MINH KHI GIAO DỊCH
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sao chép thông tin tài khoản ngân hàng"
          style={({ pressed }) => [
            styles.bankInfo,
            pressed && styles.bankInfoPressed,
          ]}
          onPress={copyBankInfo}
        >
          <View style={styles.bankInfoContent}>
            {BANK_INFO_ITEMS.map(item => (
              <View
                key={item.label}
                style={styles.bankInfoRow}
              >
                <Text style={styles.bankText}>
                  {item.label}
                </Text>

                <Text style={styles.bankValue}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>

          <Ionicons
            name="copy-outline"
            size={20}
            color={theme.primary}
          />
        </Pressable>

        <Text style={styles.warningTitle}>LƯU Ý :</Text>

        <Text style={styles.paymentDescription}>
          Giao dịch chính chủ{' '}
          <Text style={styles.paymentLinkText}>TRAN DUY QUANG</Text> được hiển
          thị trong phần thanh toán, không giao dịch mua bán với các đối tượng
          giả mạo, lừa đảo, page giả mạo trên facebook.
        </Text>
      </View>
    </View>
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
    paddingBottom: 120,
  },

  header: {
    height: 56,
    paddingHorizontal: Layout.screenHorizontalPadding,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.background,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    color: theme.text,
  },

  stateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },

  stateText: {
    marginTop: Spacing.md,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    color: theme.textSecondary,
  },

  errorText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    color: theme.primary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },

  retryButton: {
    height: 42,
    paddingHorizontal: 20,
    borderRadius: Radius.sm,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  retryText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    color: '#FFFFFF',
  },

  imageSection: {
    marginHorizontal: Layout.screenHorizontalPadding,
    marginTop: Spacing.md,
    height: 310,
    borderRadius: Radius.lg,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  mainImage: {
    width: '92%',
    height: '92%',
  },

  discountBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    minHeight: 28,
    paddingHorizontal: 10,
    borderTopLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.sm,
    backgroundColor: theme.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },

  discountText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    color: '#FFFFFF',
  },

  thumbnailList: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Spacing.md,
  },

  thumbnailCard: {
    width: 68,
    height: 68,
    borderRadius: Radius.sm,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  thumbnailCardActive: {
    borderColor: theme.primary,
  },

  thumbnailImage: {
    width: '86%',
    height: '86%',
  },

  infoSection: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Spacing.lg,
  },

  productName: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    lineHeight: 28,
    color: theme.text,
    marginBottom: Spacing.md,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: Spacing.md,
  },

  oldPrice: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.md,
    color: theme.textSecondary,
    textDecorationLine: 'line-through',
  },

  salePrice: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.headingSm,
    color: theme.danger,
  },

  breadcrumbBox: {
    minHeight: 34,
    borderRadius: Radius.sm,
    backgroundColor: theme.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: Spacing.xl,
  },

  breadcrumbText: {
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    fontSize: FontSizes.xs,
    color: theme.primary,
    maxWidth: 120,
  },

  paymentCard: {
    marginHorizontal: Layout.screenHorizontalPadding,
    marginBottom: Spacing.xxl,
    borderWidth: 1,
    borderColor: theme.primary,
    borderRadius: Radius.sm,
    backgroundColor: theme.surface,
    overflow: 'hidden',
  },

  paymentHeader: {
    height: 46,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  paymentHeaderText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    color: '#FFFFFF',
  },

  paymentBody: {
    padding: 16,
  },

  paymentBlueTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    color: theme.primary,
    marginBottom: 18,
  },

  bankInfo: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Radius.sm,
  },

  bankInfoPressed: {
    opacity: 0.55,
  },

  bankInfoContent: {
    flex: 1,
    paddingRight: 10,
  },

  bankInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },

  bankText: {
    width: '34%',
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.text,
  },

  bankValue: {
    flex: 1,
    paddingRight: 10,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.text,
  },

  warningTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    color: theme.danger,
    textDecorationLine: 'underline',
    marginBottom: 18,
  },

  paymentDescription: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    color: theme.text,
  },

  paymentLinkText: {
    fontFamily: Fonts.bold,
    color: theme.primary,
  },

  descriptionSection: {
    marginHorizontal: Layout.screenHorizontalPadding,
    marginBottom: Spacing.xxl,
    padding: 16,
    borderRadius: Radius.md,
    backgroundColor: theme.surface,
  },

  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    color: theme.text,
    marginBottom: Spacing.md,
  },

  descriptionText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    lineHeight: 24,
    color: theme.text,
  },

  htmlParagraph: {
    marginTop: 0,
    marginBottom: 8,
  },

  htmlStrong: {
    fontFamily: Fonts.bold,
    color: theme.text,
  },

  htmlHeading: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    color: theme.text,
    marginTop: 8,
    marginBottom: 8,
  },

  htmlList: {
    marginTop: 0,
    marginBottom: 0,
  },

  htmlListItem: {
    marginBottom: 4,
  },

  htmlTable: {
    borderWidth: 1,
    borderColor: theme.border,
  },

  htmlTableCell: {
    borderWidth: 1,
    borderColor: theme.border,
    padding: 6,
  },

  relatedSection: {
    marginBottom: Spacing.xxl,
  },

  relatedHeader: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  relatedList: {
    paddingHorizontal: Layout.screenHorizontalPadding,
  },

  relatedSeparator: {
    width: PRODUCT_GAP,
  },

  emptyRelatedText: {
    width: width - Layout.screenHorizontalPadding * 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    color: theme.textSecondary,
  },

  fixedBottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: theme.background,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  fixedContactButton: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fixedContactButtonText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    color: '#FFFFFF',
  },

  fixedFavoriteButton: {
    width: 52,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});