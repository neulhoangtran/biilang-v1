import { router } from 'expo-router';
import { useRef, useState } from 'react';

import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    NativeSyntheticEvent,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TextInputKeyPressEventData,
    TouchableOpacity,
    View,
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

import {
    getApiErrorMessage,
    normalizePhone,
} from '@/services/auth.service';
import { goBackOrDefault } from '@/services/safe-router.service';

const API_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

const RESEND_ERROR_MESSAGE =
    'Đã xảy ra lỗi, vui lòng liên hệ admin để được hỗ trợ.';

const passwordRegex =
    /^[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+$/;

async function parseJsonResponse(response: Response) {
    const text = await response.text();

    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch {
        return {};
    }
}

export default function ForgotPasswordScreen() {
    const colorScheme = 'light';
    const theme = Colors[colorScheme];

    const [phone, setPhone] = useState('');
    const [phoneError, setPhoneError] = useState('');

    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [otpError, setOtpError] = useState('');

    const [newPassword, setNewPassword] = useState('');
    const [newPasswordError, setNewPasswordError] = useState('');

    const [confirmPassword, setConfirmPassword] = useState('');
    const [confirmPasswordError, setConfirmPasswordError] = useState('');

    const [message, setMessage] = useState('');
    const [submitError, setSubmitError] = useState('');

    const [isOtpSent, setIsOtpSent] = useState(false);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const otpRefs = useRef<Array<TextInput | null>>([]);

    const phoneRegex = /^\d{10,12}$/;

    const clearAllMessage = () => {
        if (phoneError) setPhoneError('');
        if (otpError) setOtpError('');
        if (newPasswordError) setNewPasswordError('');
        if (confirmPasswordError) setConfirmPasswordError('');
        if (submitError) setSubmitError('');
        if (message) setMessage('');
    };

    const handlePhoneChange = (value: string) => {
        const sanitized = value.replace(/[^\d]/g, '');

        setPhone(sanitized);
        clearAllMessage();
    };

    const handleNewPasswordChange = (value: string) => {
        setNewPassword(value);

        if (newPasswordError) setNewPasswordError('');
        if (confirmPasswordError) setConfirmPasswordError('');
        if (submitError) setSubmitError('');
    };

    const handleConfirmPasswordChange = (value: string) => {
        setConfirmPassword(value);

        if (confirmPasswordError) setConfirmPasswordError('');
        if (submitError) setSubmitError('');
    };

    const validatePhone = () => {
        const cleanPhone = normalizePhone(phone);

        if (!API_URL) {
            setPhoneError('Thiếu cấu hình API URL. Vui lòng kiểm tra file .env');
            return '';
        }

        if (!cleanPhone) {
            setPhoneError('Vui lòng nhập số điện thoại');
            return '';
        }

        if (!phoneRegex.test(cleanPhone)) {
            setPhoneError('Số điện thoại phải từ 10 đến 12 chữ số');
            return '';
        }

        return cleanPhone;
    };

    const validatePassword = () => {
        let isValid = true;

        if (!newPassword) {
            setNewPasswordError('Vui lòng nhập mật khẩu mới');
            isValid = false;
        } else if (newPassword.length < 6) {
            setNewPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự');
            isValid = false;
        } else if (!passwordRegex.test(newPassword)) {
            setNewPasswordError(
                'Mật khẩu chỉ được chứa chữ, số và ký tự đặc biệt hợp lệ'
            );
            isValid = false;
        }

        if (!confirmPassword) {
            setConfirmPasswordError('Vui lòng xác nhận mật khẩu mới');
            isValid = false;
        } else if (newPassword !== confirmPassword) {
            setConfirmPasswordError('Mật khẩu xác nhận không khớp');
            isValid = false;
        }

        return isValid;
    };

    const resetOtpInput = () => {
        setOtp(['', '', '', '', '', '']);

        setTimeout(() => {
            otpRefs.current[0]?.focus();
        }, 120);
    };

    const handleSendOtp = async () => {
        if (isSendingOtp || isResetting) return;

        clearAllMessage();

        const cleanPhone = validatePhone();

        if (!cleanPhone) return;

        setIsSendingOtp(true);

        try {
            const response = await fetch(
                `${API_URL}/api/vikof/auth/forgot-password/send-otp`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        phoneNumber: cleanPhone,
                    }),
                }
            );

            const data = await parseJsonResponse(response);

            if (!response.ok) {
                throw new Error(getApiErrorMessage(data, RESEND_ERROR_MESSAGE));
            }

            setIsOtpSent(true);
            resetOtpInput();

            setMessage(data?.message || 'Đã gửi mã OTP đặt lại mật khẩu.');
        } catch (error) {
            console.log('[FORGOT_PASSWORD_SEND_OTP_ERROR]', error);

            const errorMessage =
                error instanceof Error
                    ? error.message
                    : 'Không thể gửi OTP. Vui lòng thử lại.';

            setPhoneError(errorMessage);
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleResendOtp = async () => {
        await handleSendOtp();
    };

    const handleOtpChange = (value: string, index: number) => {
        const digits = value.replace(/[^\d]/g, '');

        clearAllMessage();

        if (!digits) {
            setOtp(prev => {
                const nextOtp = [...prev];
                nextOtp[index] = '';

                return nextOtp;
            });

            return;
        }

        setOtp(prev => {
            const nextOtp = [...prev];

            if (digits.length > 1) {
                const chars = digits.slice(0, 6 - index).split('');

                chars.forEach((char, offset) => {
                    nextOtp[index + offset] = char;
                });

                const nextFocusIndex = Math.min(index + chars.length, 5);

                setTimeout(() => {
                    otpRefs.current[nextFocusIndex]?.focus();
                }, 0);

                return nextOtp;
            }

            nextOtp[index] = digits[0];

            if (index < 5) {
                setTimeout(() => {
                    otpRefs.current[index + 1]?.focus();
                }, 0);
            }

            return nextOtp;
        });
    };

    const handleOtpKeyPress = (
        e: NativeSyntheticEvent<TextInputKeyPressEventData>,
        index: number
    ) => {
        if (e.nativeEvent.key !== 'Backspace') return;

        if (otp[index]) {
            setOtp(prev => {
                const nextOtp = [...prev];
                nextOtp[index] = '';

                return nextOtp;
            });

            return;
        }

        if (index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleSubmit = async () => {
        if (isSendingOtp || isResetting) return;

        clearAllMessage();

        const cleanPhone = validatePhone();

        if (!cleanPhone) return;

        const otpCode = otp.join('');

        if (otpCode.length < 6) {
            setOtpError('Vui lòng nhập đầy đủ mã OTP');
            return;
        }

        if (!validatePassword()) return;

        setIsResetting(true);

        try {
            const response = await fetch(
                `${API_URL}/api/vikof/auth/forgot-password/reset`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        phoneNumber: cleanPhone,
                        otp: otpCode,
                        newPassword,
                    }),
                }
            );

            const data = await parseJsonResponse(response);

            if (!response.ok) {
                throw new Error(
                    getApiErrorMessage(
                        data,
                        'Không thể đặt lại mật khẩu. Vui lòng thử lại.'
                    )
                );
            }

            Alert.alert(
                'Thành công',
                data?.message || 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.',
                [
                    {
                        text: 'Đăng nhập',
                        onPress: () => router.replace('/login'),
                    },
                ]
            );
        } catch (error) {
            console.log('[FORGOT_PASSWORD_RESET_ERROR]', error);

            const errorMessage =
                error instanceof Error
                    ? error.message
                    : 'Không thể đặt lại mật khẩu. Vui lòng thử lại.';

            setSubmitError(errorMessage);
        } finally {
            setIsResetting(false);
        }
    };

    const canSendOtp = Boolean(phone.trim()) && !isSendingOtp && !isResetting;

    const canSubmit =
        otp.every(item => item !== '') &&
        newPassword.trim() !== '' &&
        confirmPassword.trim() !== '' &&
        !isSendingOtp &&
        !isResetting;

    return (
        <SafeAreaView
            edges={['top', 'bottom']}
            style={[styles.container, { backgroundColor: theme.background }]}
        >
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                    showsVerticalScrollIndicator={false}
                >
                    <TouchableOpacity
                        onPress={goBackOrDefault}
                        style={styles.backButton}
                        disabled={isSendingOtp || isResetting}
                    >
                        <Text style={[styles.backText, { color: theme.text }]}>{'‹'}</Text>
                    </TouchableOpacity>

                    <Text style={[styles.title, { color: theme.text }]}>
                        Quên mật khẩu
                    </Text>

                    <Text style={[styles.description, { color: theme.textSecondary }]}>
                        Nhập số điện thoại để nhận mã xác thực và đặt lại mật khẩu.
                    </Text>

                    <View style={styles.formGroup}>
                        <Text style={[styles.label, { color: theme.text }]}>
                            Số điện thoại <Text style={styles.required}>*</Text>
                        </Text>

                        <TextInput
                            value={phone}
                            onChangeText={handlePhoneChange}
                            placeholder="Nhập số điện thoại"
                            placeholderTextColor={theme.textMuted}
                            keyboardType="phone-pad"
                            maxLength={12}
                            editable={!isSendingOtp && !isResetting}
                            style={[
                                styles.input,
                                {
                                    color: theme.text,
                                    backgroundColor: theme.surface,
                                    borderColor: phoneError ? theme.danger : theme.border,
                                },
                            ]}
                        />

                        {!!phoneError && (
                            <Text style={[styles.errorText, { color: theme.danger }]}>
                                {phoneError}
                            </Text>
                        )}
                    </View>

                    {!isOtpSent ? (
                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={handleSendOtp}
                            disabled={!canSendOtp}
                            style={[
                                styles.submitButton,
                                {
                                    backgroundColor: canSendOtp
                                        ? theme.buttonPrimary
                                        : theme.border,
                                },
                            ]}
                        >
                            {isSendingOtp ? (
                                <ActivityIndicator
                                    size="small"
                                    color={theme.buttonPrimaryText}
                                />
                            ) : (
                                <Text
                                    style={[
                                        styles.submitButtonText,
                                        {
                                            color: canSendOtp
                                                ? theme.buttonPrimaryText
                                                : theme.textSecondary,
                                        },
                                    ]}
                                >
                                    Gửi mã OTP
                                </Text>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <>
                            <View style={styles.otpSection}>
                                <View style={styles.labelRow}>
                                    <Text style={[styles.label, { color: theme.text }]}>
                                        Mã OTP <Text style={styles.required}>*</Text>
                                    </Text>

                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        onPress={handleResendOtp}
                                        disabled={isSendingOtp || isResetting}
                                        style={styles.resendButton}
                                    >
                                        {isSendingOtp ? (
                                            <ActivityIndicator size="small" color={theme.link} />
                                        ) : (
                                            <Text style={[styles.resendText, { color: theme.link }]}>
                                                Gửi lại mã
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </View>

                                <Text
                                    style={[styles.descriptionSmall, { color: theme.textSecondary }]}
                                >
                                    Vui lòng nhập mã xác thực gồm 6 chữ số.
                                </Text>

                                <View style={styles.otpWrapper}>
                                    {otp.map((digit, index) => (
                                        <TextInput
                                            key={index}
                                            ref={ref => {
                                                otpRefs.current[index] = ref;
                                            }}
                                            value={digit}
                                            onChangeText={value => handleOtpChange(value, index)}
                                            onKeyPress={e => handleOtpKeyPress(e, index)}
                                            keyboardType="number-pad"
                                            maxLength={index === 0 ? 6 : 1}
                                            selectTextOnFocus
                                            textContentType="oneTimeCode"
                                            autoComplete="sms-otp"
                                            editable={!isSendingOtp && !isResetting}
                                            style={[
                                                styles.otpInput,
                                                {
                                                    borderColor: otpError ? theme.danger : theme.border,
                                                    backgroundColor: theme.surface,
                                                    color: theme.text,
                                                },
                                            ]}
                                        />
                                    ))}
                                </View>

                                {!!otpError && (
                                    <Text style={[styles.errorText, { color: theme.danger }]}>
                                        {otpError}
                                    </Text>
                                )}

                                {!!message && !otpError && (
                                    <Text style={[styles.messageText, { color: theme.link }]}>
                                        {message}
                                    </Text>
                                )}
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={[styles.label, { color: theme.text }]}>
                                    Mật khẩu mới <Text style={styles.required}>*</Text>
                                </Text>

                                <View
                                    style={[
                                        styles.passwordWrapper,
                                        {
                                            backgroundColor: theme.surface,
                                            borderColor: newPasswordError
                                                ? theme.danger
                                                : theme.border,
                                        },
                                    ]}
                                >
                                    <TextInput
                                        value={newPassword}
                                        onChangeText={handleNewPasswordChange}
                                        placeholder="Nhập mật khẩu mới"
                                        placeholderTextColor={theme.textMuted}
                                        secureTextEntry={!showPassword}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        editable={!isSendingOtp && !isResetting}
                                        style={[styles.passwordInput, { color: theme.text }]}
                                    />

                                    <Pressable
                                        onPress={() => setShowPassword(prev => !prev)}
                                        hitSlop={8}
                                        disabled={isSendingOtp || isResetting}
                                        style={styles.passwordAction}
                                    >
                                        <Text
                                            style={[
                                                styles.passwordActionText,
                                                { color: theme.textSecondary },
                                            ]}
                                        >
                                            {showPassword ? 'Ẩn' : 'Hiện'}
                                        </Text>
                                    </Pressable>
                                </View>

                                {!!newPasswordError && (
                                    <Text style={[styles.errorText, { color: theme.danger }]}>
                                        {newPasswordError}
                                    </Text>
                                )}
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={[styles.label, { color: theme.text }]}>
                                    Xác nhận mật khẩu mới <Text style={styles.required}>*</Text>
                                </Text>

                                <View
                                    style={[
                                        styles.passwordWrapper,
                                        {
                                            backgroundColor: theme.surface,
                                            borderColor: confirmPasswordError
                                                ? theme.danger
                                                : theme.border,
                                        },
                                    ]}
                                >
                                    <TextInput
                                        value={confirmPassword}
                                        onChangeText={handleConfirmPasswordChange}
                                        placeholder="Nhập lại mật khẩu mới"
                                        placeholderTextColor={theme.textMuted}
                                        secureTextEntry={!showConfirmPassword}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        editable={!isSendingOtp && !isResetting}
                                        style={[styles.passwordInput, { color: theme.text }]}
                                    />

                                    <Pressable
                                        onPress={() => setShowConfirmPassword(prev => !prev)}
                                        hitSlop={8}
                                        disabled={isSendingOtp || isResetting}
                                        style={styles.passwordAction}
                                    >
                                        <Text
                                            style={[
                                                styles.passwordActionText,
                                                { color: theme.textSecondary },
                                            ]}
                                        >
                                            {showConfirmPassword ? 'Ẩn' : 'Hiện'}
                                        </Text>
                                    </Pressable>
                                </View>

                                {!!confirmPasswordError && (
                                    <Text style={[styles.errorText, { color: theme.danger }]}>
                                        {confirmPasswordError}
                                    </Text>
                                )}
                            </View>

                            {!!submitError && (
                                <Text style={[styles.submitErrorText, { color: theme.danger }]}>
                                    {submitError}
                                </Text>
                            )}

                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={handleSubmit}
                                disabled={!canSubmit}
                                style={[
                                    styles.submitButton,
                                    {
                                        backgroundColor: canSubmit
                                            ? theme.buttonPrimary
                                            : theme.border,
                                    },
                                ]}
                            >
                                {isResetting ? (
                                    <ActivityIndicator
                                        size="small"
                                        color={theme.buttonPrimaryText}
                                    />
                                ) : (
                                    <Text
                                        style={[
                                            styles.submitButtonText,
                                            {
                                                color: canSubmit
                                                    ? theme.buttonPrimaryText
                                                    : theme.textSecondary,
                                            },
                                        ]}
                                    >
                                        Đặt lại mật khẩu
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    keyboardView: {
        flex: 1,
    },

    scrollContent: {
        paddingHorizontal: Layout.screenHorizontalPadding,
        paddingTop: Spacing.sm,
        paddingBottom: 140,
    },

    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        marginBottom: Spacing.md,
    },

    backText: {
        fontSize: 34,
        lineHeight: 34,
        fontFamily: Fonts.regular,
        fontWeight: FontWeights.regular,
    },

    title: {
        fontSize: FontSizes.headingMd,
        lineHeight: LineHeights.headingMd,
        fontFamily: Fonts.bold,
        fontWeight: FontWeights.bold,
        marginBottom: 8,
    },

    description: {
        fontSize: FontSizes.md,
        lineHeight: LineHeights.md,
        fontFamily: Fonts.regular,
        marginBottom: Spacing.xl,
    },

    descriptionSmall: {
        fontSize: FontSizes.sm,
        lineHeight: LineHeights.sm,
        fontFamily: Fonts.regular,
        marginBottom: Spacing.md,
    },

    formGroup: {
        marginBottom: Spacing.lg,
    },

    otpSection: {
        marginBottom: Spacing.lg,
    },

    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },

    label: {
        fontSize: FontSizes.md,
        lineHeight: LineHeights.md,
        fontFamily: Fonts.bold,
        fontWeight: FontWeights.bold,
        marginBottom: 8,
    },

    required: {
        color: '#DC2626',
    },

    input: {
        height: 52,
        borderWidth: 1,
        borderRadius: Radius.md,
        paddingHorizontal: 14,
        fontSize: FontSizes.md,
        lineHeight: LineHeights.md,
        fontFamily: Fonts.regular,
    },

    passwordWrapper: {
        height: 52,
        borderWidth: 1,
        borderRadius: Radius.md,
        paddingLeft: 14,
        paddingRight: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },

    passwordInput: {
        flex: 1,
        height: '100%',
        fontSize: FontSizes.md,
        lineHeight: LineHeights.md,
        fontFamily: Fonts.regular,
        padding: 0,
    },

    passwordAction: {
        minWidth: 42,
        height: 42,
        alignItems: 'center',
        justifyContent: 'center',
    },

    passwordActionText: {
        fontSize: FontSizes.sm,
        lineHeight: LineHeights.sm,
        fontFamily: Fonts.bold,
        fontWeight: FontWeights.bold,
    },

    otpWrapper: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },

    otpInput: {
        flex: 1,
        height: 52,
        borderWidth: 1,
        borderRadius: Radius.md,
        textAlign: 'center',
        fontSize: 18,
        fontFamily: Fonts.bold,
    },

    resendButton: {
        minHeight: 28,
        justifyContent: 'center',
    },

    resendText: {
        fontSize: FontSizes.sm,
        lineHeight: LineHeights.sm,
        fontFamily: Fonts.bold,
        fontWeight: FontWeights.bold,
    },

    errorText: {
        marginTop: 6,
        fontSize: 13,
        lineHeight: 18,
        fontFamily: Fonts.regular,
    },

    messageText: {
        marginTop: 6,
        fontSize: 13,
        lineHeight: 18,
        fontFamily: Fonts.regular,
    },

    submitErrorText: {
        marginBottom: Spacing.md,
        fontSize: FontSizes.sm,
        lineHeight: LineHeights.sm,
        fontFamily: Fonts.regular,
    },

    submitButton: {
        height: ButtonSizes.md,
        borderRadius: Radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: Spacing.sm,
    },

    submitButtonText: {
        fontSize: FontSizes.md,
        lineHeight: LineHeights.md,
        fontFamily: Fonts.bold,
        fontWeight: FontWeights.bold,
    },
});
