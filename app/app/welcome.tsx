import { router } from 'expo-router';
import {
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

export default function WelcomeScreen() {
    const colorScheme = 'light';
    const theme = Colors[colorScheme];

    const PRIVACY_POLICY_URL = 'https://vikof.kr/privacy-policy';

    const openPrivacyPolicy = async () => {
        try {
            await Linking.openURL(PRIVACY_POLICY_URL);
        } catch (error) {
            console.log('[OPEN_PRIVACY_POLICY_FAILED]', error);
        }
    };

    const handleGuestMode = () => {
        router.replace('/(tabs)');
    };

    return (
        <SafeAreaView
            edges={['top', 'bottom']}
            style={[
                styles.container,
                {
                    backgroundColor: theme.background,
                },
            ]}
        >
            <View style={styles.topArea}>
                <View style={styles.logoContainer}>
                    <Image
                        source={require('@/assets/images/logo-v1.png')}
                        style={styles.logoImage}
                        resizeMode="contain"
                    />
                </View>

                <Text
                    style={[
                        styles.subtitle,
                        {
                            color: theme.textSecondary,
                        },
                    ]}
                >
                    Chuỗi cửa hàng mobile, laptop, đồng hồ và dịch vụ viễn thông toàn Hàn Quốc
                </Text>
            </View>

            <View style={styles.middleArea}>
                <Text
                    style={[
                        styles.policyText,
                        {
                            color: theme.textSecondary,
                        },
                    ]}
                >
                    Bằng việc đăng ký, bạn đồng ý với{' '}
                    <Text
                        style={[
                            styles.boldText,
                            {
                                color: theme.link,
                            },
                        ]}
                        onPress={openPrivacyPolicy}
                    >
                        Điều khoản sử dụng
                    </Text>{' '}
                    và{' '}
                    <Text
                        style={[
                            styles.boldText,
                            {
                                color: theme.link,
                            },
                        ]}
                        onPress={openPrivacyPolicy}
                    >
                        Chính sách quyền riêng tư
                    </Text>{' '}
                    của Vikof Mobile
                </Text>

                <View style={styles.buttonRow}>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={[
                            styles.button,
                            styles.leftButton,
                            {
                                backgroundColor: theme.buttonSecondary,
                                borderColor: theme.border,
                            },
                        ]}
                        onPress={() => router.push('/login')}
                    >
                        <Text
                            style={[
                                styles.buttonText,
                                {
                                    color: theme.buttonSecondaryText,
                                },
                            ]}
                        >
                            Đăng nhập
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={[
                            styles.button,
                            styles.rightButton,
                            {
                                backgroundColor: theme.buttonPrimary,
                            },
                        ]}
                        onPress={() => router.push('/register')}
                    >
                        <Text
                            style={[
                                styles.buttonText,
                                {
                                    color: theme.buttonPrimaryText,
                                },
                            ]}
                        >
                            Đăng ký
                        </Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleGuestMode}
                >
                    <Text
                        style={[
                            styles.guestText,
                            {
                                color: theme.link,
                            },
                        ]}
                    >
                        Hoặc xem không cần tài khoản
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.footer}>
                <Text
                    style={[
                        styles.footerText,
                        {
                            color: theme.textMuted,
                        },
                    ]}
                >
                    © Vikof Mobile
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'space-between',
        paddingHorizontal: Layout.screenHorizontalPadding,
        paddingVertical: Spacing.lg,
    },

    topArea: {
        alignItems: 'center',
        marginTop: 72,
    },

    logoContainer: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
    },

    logoImage: {
        width: 120,
        height: 120,
    },

    subtitle: {
        maxWidth: Layout.maxContentWidth,
        textAlign: 'center',
        fontFamily: Fonts.regular,
        fontSize: FontSizes.lg,
        lineHeight: LineHeights.lg,
        fontWeight: FontWeights.bold,
    },

    middleArea: {
        marginBottom: Spacing.section,
        paddingHorizontal: Layout.contentHorizontalPadding,
    },

    policyText: {
        marginBottom: Spacing.xxl,
        textAlign: 'left',
        fontFamily: Fonts.regular,
        fontSize: FontSizes.md,
        lineHeight: LineHeights.lg,
    },

    boldText: {
        fontFamily: Fonts.bold,
        fontWeight: FontWeights.bold,
    },

    buttonRow: {
        flexDirection: 'row',
        marginBottom: Spacing.xxl,
    },

    button: {
        flex: 1,
        height: ButtonSizes.md,
        borderRadius: Radius.sm,
        justifyContent: 'center',
        alignItems: 'center',
    },

    leftButton: {
        marginRight: Spacing.sm,
        borderWidth: 1,
    },

    rightButton: {
        marginLeft: Spacing.sm,
    },

    buttonText: {
        fontFamily: Fonts.bold,
        fontSize: FontSizes.md,
        fontWeight: FontWeights.bold,
    },

    guestText: {
        textAlign: 'center',
        fontFamily: Fonts.bold,
        fontSize: FontSizes.md,
        fontWeight: FontWeights.bold,
    },

    footer: {
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },

    footerText: {
        fontFamily: Fonts.regular,
        fontSize: FontSizes.sm,
        lineHeight: LineHeights.sm,
    },
});