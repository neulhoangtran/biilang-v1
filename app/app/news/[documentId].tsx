import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useLocalSearchParams,
} from 'expo-router';

import React, {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { goBackOrDefault } from '@/services/safe-router.service';

import RenderHtml from 'react-native-render-html';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  Colors,
  Fonts,
  FontSizes,
  Layout,
  Radius,
  Spacing,
} from '@/constants/theme';

import {
  getNewsDetail,
  getNewsImageAspectRatio,
  getNewsImageSource,
  getNewsViewCount,
  increaseNewsView,
  type NewsItem,
} from '@/services/news.service';

const theme = Colors.light;

const contentWidth =
  Dimensions.get('window').width;

function formatDate(value?: string) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatViewCount(value: unknown) {
  const count = Number(value || 0);

  if (!Number.isFinite(count) || count <= 0) {
    return '0';
  }

  if (count >= 1000000) {
    return `${Math.floor(count / 1000000)}M`;
  }

  if (count >= 1000) {
    return `${Math.floor(count / 1000)}K`;
  }

  return String(count);
}

export default function NewsDetailScreen() {
  const { documentId } =
    useLocalSearchParams<{
      documentId: string;
    }>();

  const [news, setNews] =
    useState<NewsItem | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    loadDetail();
  }, [documentId]);

  useEffect(() => {
    const cleanDocumentId = String(
      documentId || ''
    ).trim();

    if (!cleanDocumentId) {
      return;
    }

    let isMounted = true;

    increaseNewsView(cleanDocumentId)
      .then(result => {
        if (!isMounted || !result?.View) {
          return;
        }

        setNews(prev =>
          prev
            ? {
                ...prev,
                View: result.View,
              }
            : prev
        );
      })
      .catch(error => {
        console.log(
          '[NEWS_INCREASE_VIEW_FAILED]',
          error
        );
      });

    return () => {
      isMounted = false;
    };
  }, [documentId]);

  const loadDetail = async () => {
    try {
      setLoading(true);

      const data =
        await getNewsDetail(documentId);

      setNews(data);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={theme.primary}
        />
      </View>
    );
  }

  if (!news) {
    return (
      <View style={styles.center}>
        <Text>
          Không tìm thấy bài viết
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.hero}>
          <Image
            source={getNewsImageSource(news)}
            style={[
              styles.heroImage,
              {
                aspectRatio:
                  getNewsImageAspectRatio(news),
              },
            ]}
            resizeMode="cover"
          />

          <Pressable
            style={styles.backButton}
            onPress={goBackOrDefault}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.metaRow}>
            {!!news.publishedAt && (
              <Text style={styles.date}>
                {formatDate(
                  news.publishedAt
                )}
              </Text>
            )}

            <View style={styles.viewRow}>
              <Ionicons
                name="eye-outline"
                size={15}
                color={theme.textSecondary}
              />

              <Text style={styles.viewText}>
                {formatViewCount(
                  getNewsViewCount(news)
                )}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>
            {news.Title}
          </Text>

          {!!news.ShortDescription && (
            <Text style={styles.shortDesc}>
              {news.ShortDescription}
            </Text>
          )}

          <RenderHtml
            contentWidth={
              contentWidth - 40
            }
            source={{
              html:
                news.Description ||
                '',
            }}
            baseStyle={
              styles.htmlBase
            }
            tagsStyles={{
              p: styles.htmlParagraph,
              h1: styles.htmlH1,
              h2: styles.htmlH2,
              h3: styles.htmlH3,
              li: styles.htmlLi,
              strong: styles.htmlStrong,
              a: styles.htmlLink,
              ul: styles.htmlUl,
              ol: styles.htmlOl,
              blockquote: styles.htmlBlockquote,
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor:
      theme.background,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  content: {
    paddingBottom: 120,
  },

  hero: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#EEE',
  },

  heroImage: {
    width: '100%',
  },

  backButton: {
    position: 'absolute',

    top: 56,
    left: 20,

    width: 42,
    height: 42,

    borderRadius: 21,

    backgroundColor:
      'rgba(0,0,0,0.42)',

    alignItems: 'center',

    justifyContent: 'center',
  },

  body: {
    paddingHorizontal:
      Layout.screenHorizontalPadding,

    paddingTop: Spacing.xl,
  },

  metaRow: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },

  date: {
    fontFamily: Fonts.medium,

    fontSize: FontSizes.sm,

    color:
      theme.textSecondary,
  },

  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  viewText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    color:
      theme.textSecondary,
  },

  title: {
    fontFamily: Fonts.bold,

    fontSize: 32,

    lineHeight: 42,

    color: theme.text,
  },

  shortDesc: {
    marginTop: Spacing.lg,

    marginBottom:
      Spacing.xxl,

    fontFamily: Fonts.regular,

    fontSize: FontSizes.lg,

    lineHeight: 30,

    color:
      theme.textSecondary,
  },

  htmlBase: {
    color: theme.text,

    fontFamily:
      Fonts.regular,

    fontSize: 16,

    lineHeight: 30,
  },

  htmlParagraph: {
    marginBottom: 18,

    lineHeight: 30,

    color: theme.text,
  },

  htmlH1: {
    marginTop: 28,
    marginBottom: 16,

    fontSize: 30,

    lineHeight: 40,

    fontWeight: '700',

    color: theme.text,
  },

  htmlH2: {
    marginTop: 24,
    marginBottom: 14,

    fontSize: 26,

    lineHeight: 36,

    fontWeight: '700',

    color: theme.text,
  },

  htmlH3: {
    marginTop: 20,
    marginBottom: 12,

    fontSize: 22,

    lineHeight: 32,

    fontWeight: '700',

    color: theme.text,
  },

  htmlLi: {
    marginBottom: 8,

    lineHeight: 28,

    color: theme.text,
  },

  htmlStrong: {
    fontWeight: '700',
  },

  htmlLink: {
    color: theme.primary,

    textDecorationLine:
      'underline',
  },

  htmlUl: {
    marginBottom: 18,
  },

  htmlOl: {
    marginBottom: 18,
  },

  htmlBlockquote: {
    marginVertical: 18,

    paddingLeft: 16,

    borderLeftWidth: 4,

    borderLeftColor:
      theme.primary,

    color:
      theme.textSecondary,
  },
});
