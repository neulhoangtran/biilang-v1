import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import React, {
    useEffect,
    useMemo,
    useState,
} from 'react';

import {
    ActivityIndicator,
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

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
    getNewsImageSource,
    getNewsList,
    getNewsViewCount,
    type NewsItem,
} from '@/services/news.service';

const theme = Colors.light;

type NewsListItem = NewsItem & {
    View?: string | number | null;
};

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

function normalizeSearchText(value: unknown) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();
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

export default function NewsScreen() {
    const [items, setItems] = useState<
        NewsListItem[]
    >([]);

    const [keyword, setKeyword] =
        useState('');

    const [loading, setLoading] =
        useState(true);

    const [refreshing, setRefreshing] =
        useState(false);

    const [error, setError] =
        useState('');

    useEffect(() => {
        loadNews();
    }, []);

    const filteredItems = useMemo(() => {
        const cleanKeyword =
            normalizeSearchText(keyword);

        if (!cleanKeyword) {
            return items;
        }

        return items.filter(item => {
            return normalizeSearchText(
                item.Title
            ).includes(cleanKeyword);
        });
    }, [items, keyword]);

    const loadNews = async (
        isRefresh = false
    ) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError('');

            const data = await getNewsList();

            setItems(data);
        } catch (err) {
            console.log(err);

            setError(
                'Không tải được danh sách tin tức'
            );
        } finally {
            if (isRefresh) {
                setRefreshing(false);
            } else {
                setLoading(false);
            }
        }
    };

    const onRefresh = async () => {
        await loadNews(true);
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

    return (
        <SafeAreaView style={styles.safe}>
            <FlatList
                data={filteredItems}
                keyExtractor={item =>
                    item.documentId
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={
                    styles.content
                }
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={theme.primary}
                    />
                }
                ListHeaderComponent={
                    <View style={styles.headerBox}>
                        <Text style={styles.header}>
                            Tin tức
                        </Text>

                        <Text
                            style={styles.headerSubtitle}
                        >
                            Cập nhật hoạt động và ưu
                            đãi mới nhất từ Vikof
                            Mobile
                        </Text>

                        <View style={styles.searchBox}>
                            <TextInput
                                value={keyword}
                                onChangeText={setKeyword}
                                placeholder="Tìm kiếm theo tên bài viết"
                                placeholderTextColor={
                                    theme.textMuted
                                }
                                autoCapitalize="none"
                                autoCorrect={false}
                                clearButtonMode="while-editing"
                                style={styles.searchInput}
                            />

                            {!!keyword && (
                                <Pressable
                                    hitSlop={8}
                                    onPress={() =>
                                        setKeyword('')
                                    }
                                    style={
                                        styles.clearButton
                                    }
                                >
                                    <Text
                                        style={
                                            styles.clearText
                                        }
                                    >
                                        Xóa
                                    </Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                }
                ListEmptyComponent={
                    error ? (
                        <View style={styles.stateBox}>
                            <Text style={styles.errorText}>
                                {error}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.stateBox}>
                            <Text style={styles.emptyText}>
                                {keyword.trim()
                                    ? 'Không tìm thấy bài viết phù hợp'
                                    : 'Chưa có bài viết nào'}
                            </Text>
                        </View>
                    )
                }
                renderItem={({ item }) => (
                    <Pressable
                        style={({ pressed }) => [
                            styles.card,
                            pressed &&
                                styles.cardPressed,
                        ]}
                        onPress={() =>
                            router.push({
                                pathname:
                                    '/news/[documentId]',

                                params: {
                                    documentId:
                                        item.documentId,
                                },
                            })
                        }
                    >
                        <Image
                            source={getNewsImageSource(
                                item
                            )}
                            style={styles.image}
                            resizeMode="cover"
                        />

                        <View style={styles.info}>
                            <View style={styles.metaRow}>
                                {!!item.publishedAt && (
                                    <Text style={styles.date}>
                                        {formatDate(
                                            item.publishedAt
                                        )}
                                    </Text>
                                )}

                                <View style={styles.viewRow}>
                                    <Ionicons
                                        name="eye-outline"
                                        size={14}
                                        color={
                                            theme.textSecondary
                                        }
                                    />

                                    <Text
                                        style={styles.viewText}
                                    >
                                        {formatViewCount(
                                            getNewsViewCount(
                                                item
                                            )
                                        )}
                                    </Text>
                                </View>
                            </View>

                            <Text
                                style={styles.title}
                                numberOfLines={2}
                            >
                                {item.Title}
                            </Text>

                            {!!item.ShortDescription && (
                                <Text
                                    style={
                                        styles.description
                                    }
                                    numberOfLines={3}
                                >
                                    {
                                        item.ShortDescription
                                    }
                                </Text>
                            )}
                        </View>
                    </Pressable>
                )}
            />
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
        paddingHorizontal:
            Layout.screenHorizontalPadding,

        paddingTop: Spacing.lg,

        paddingBottom: 140,
    },

    headerBox: {
        marginBottom: Spacing.xl,
    },

    header: {
        fontFamily: Fonts.bold,

        fontSize: 32,

        lineHeight: 40,

        color: theme.text,
    },

    headerSubtitle: {
        marginTop: 6,
        fontFamily: Fonts.regular,
        fontSize: FontSizes.md,
        lineHeight: 24,

        color:
            theme.textSecondary,
    },

    searchBox: {
        height: 48,
        marginTop: Spacing.md,
        paddingLeft: 14,
        paddingRight: 8,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: Radius.md,
        backgroundColor: theme.surface,
        flexDirection: 'row',
        alignItems: 'center',
    },

    searchInput: {
        flex: 1,
        height: '100%',
        padding: 0,
        fontFamily: Fonts.regular,
        fontSize: FontSizes.md,
        color: theme.text,
    },

    clearButton: {
        minWidth: 42,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },

    clearText: {
        fontFamily: Fonts.bold,
        fontSize: FontSizes.sm,
        color: theme.primary,
    },

    card: {
        flexDirection: 'row',
        marginBottom: Spacing.xl,
    },

    cardPressed: {
        opacity: 0.84,
    },

    image: {
        width: 100,
        height: 100,
        borderRadius: Radius.md,
        backgroundColor: '#EEE',
    },

    info: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'flex-start',
    },

    metaRow: {
        marginBottom: 6,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
    },

    date: {
        fontFamily: Fonts.medium,
        fontSize: FontSizes.xs,
        color:
            theme.textSecondary,
    },

    viewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },

    viewText: {
        fontFamily: Fonts.medium,
        fontSize: FontSizes.xs,
        color:
            theme.textSecondary,
    },

    title: {
        fontFamily: Fonts.bold,
        fontSize: FontSizes.md,
        lineHeight: 24,

        color: theme.text,
    },

    description: {
        marginTop: 8,
        fontFamily: Fonts.regular,
        fontSize: FontSizes.sm,
        lineHeight: 18,

        color:
            theme.textSecondary,
    },

    stateBox: {
        height: 240,

        justifyContent: 'center',

        alignItems: 'center',
    },

    errorText: {
        fontFamily: Fonts.bold,

        fontSize: FontSizes.md,

        color: theme.danger,
    },

    emptyText: {
        fontFamily: Fonts.regular,

        fontSize: FontSizes.md,

        color:
            theme.textSecondary,
    },
});
