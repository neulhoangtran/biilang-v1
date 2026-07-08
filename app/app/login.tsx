import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  NativeSyntheticEvent,
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
  loginWithPassword,
  normalizePhone,
  sendLoginOtp,
  verifyLoginOtp,
} from '@/services/auth.service';

import { redirectAfterAuth } from '@/services/auth-flow.service';
import { goBackOrDefault } from '@/services/safe-router.service';

type LoginErrors = {
  identifier: string;
  password: string;
  otp: string;
};

const initialErrors: LoginErrors = {
  identifier: '',
  password: '',
  otp: '',
};

export default function LoginScreen() {
  const colorScheme = 'light';
  const theme = Colors[colorScheme];

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  const [isOtpMode, setIsOtpMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);

  const [errors, setErrors] = useState<LoginErrors>(initialErrors);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  const otpRefs = useRef<Array<TextInput | null>>([]);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^\d{10,12}$/;
  const usernameRegex = /^[A-Za-z0-9._-]{3,}$/;
  const passwordRegex =
    /^[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+$/;

  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const canSubmit = useMemo(() => {
    if (isSubmitting || isSendingOtp) return false;

    if (isOtpMode) {
      return identifier.trim() !== '' && otp.every(item => item !== '');
    }

    return identifier.trim() !== '' && password.trim() !== '';
  }, [
    identifier,
    password,
    isOtpMode,
    otp,
    isSubmitting,
    isSendingOtp,
  ]);

  const clearFieldError = (field: keyof LoginErrors) => {
    setErrors(prev => ({
      ...prev,
      [field]: '',
    }));
  };

  const resetOtpState = () => {
    setOtpSent(false);
    setOtp(['', '', '', '', '', '']);
    setCountdown(0);
  };

  const handleIdentifierChange = (value: string) => {
    setIdentifier(value);

    if (errors.identifier) clearFieldError('identifier');
    if (errors.password) clearFieldError('password');
    if (errors.otp) clearFieldError('otp');

    if (otpSent) {
      resetOtpState();
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);

    if (errors.password) clearFieldError('password');
  };

  const handleOtpMode = () => {
    setIsOtpMode(true);
    setPassword('');
    setShowPassword(false);
    setErrors(initialErrors);
    resetOtpState();
  };

  const handlePasswordMode = () => {
    setIsOtpMode(false);
    setErrors(initialErrors);
    resetOtpState();
  };

  const validateIdentifier = (value: string) => {
    const trimmed = value.trim();
    const normalizedPhone = normalizePhone(trimmed);

    if (!trimmed) {
      return 'Vui lòng nhập email, username hoặc số điện thoại';
    }

    const isEmail = emailRegex.test(trimmed);
    const isPhone = phoneRegex.test(normalizedPhone);
    const isUsername = usernameRegex.test(trimmed);

    if (!isEmail && !isPhone && !isUsername) {
      return 'Thông tin đăng nhập không hợp lệ';
    }

    return '';
  };

  const validatePhoneForOtp = (value: string) => {
    const phone = normalizePhone(value);

    if (!phone) {
      return 'Vui lòng nhập số điện thoại';
    }

    if (!phoneRegex.test(phone)) {
      return 'Số điện thoại phải từ 10 đến 12 chữ số';
    }

    return '';
  };

  const validatePasswordLogin = () => {
    const nextErrors: LoginErrors = { ...initialErrors };
    let isValid = true;

    const identifierError = validateIdentifier(identifier);

    if (identifierError) {
      nextErrors.identifier = identifierError;
      isValid = false;
    }

    if (!password) {
      nextErrors.password = 'Vui lòng nhập mật khẩu';
      isValid = false;
    } else if (password.length < 6) {
      nextErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
      isValid = false;
    } else if (!passwordRegex.test(password)) {
      nextErrors.password =
        'Mật khẩu chỉ được chứa chữ, số và ký tự đặc biệt hợp lệ';
      isValid = false;
    }

    setErrors(nextErrors);

    return isValid;
  };

  const validateOtpLogin = () => {
    const nextErrors: LoginErrors = { ...initialErrors };
    let isValid = true;

    const phoneError = validatePhoneForOtp(identifier);

    if (phoneError) {
      nextErrors.identifier = phoneError;
      isValid = false;
    }

    if (!otpSent) {
      nextErrors.otp = 'Vui lòng gửi mã OTP trước';
      isValid = false;
    } else if (otp.join('').length < 6) {
      nextErrors.otp = 'Vui lòng nhập đầy đủ 6 số OTP';
      isValid = false;
    }

    setErrors(nextErrors);

    return isValid;
  };

  const focusOtpInput = (index: number) => {
    setTimeout(() => {
      otpRefs.current[index]?.focus();
    }, 0);
  };

  const handleSendOtp = async () => {
    if (isSendingOtp || isSubmitting) return;

    const phoneError = validatePhoneForOtp(identifier);

    if (phoneError) {
      setErrors(prev => ({
        ...prev,
        identifier: phoneError,
      }));
      return;
    }

    setIsSendingOtp(true);

    setErrors(prev => ({
      ...prev,
      identifier: '',
      otp: '',
    }));

    try {
      await sendLoginOtp({
        phoneNumber: identifier,
      });

      setOtpSent(true);
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);

      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 100);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Không thể gửi OTP. Vui lòng thử lại.';

      setErrors(prev => ({
        ...prev,
        otp: message,
      }));
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResendOtp = () => {
    if (countdown > 0 || isSendingOtp || isSubmitting) return;

    handleSendOtp();
  };

  const handleOtpChange = (value: string, index: number) => {
    const digits = value.replace(/[^\d]/g, '');

    if (errors.otp) clearFieldError('otp');

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

        focusOtpInput(Math.min(index + chars.length, 5));

        return nextOtp;
      }

      nextOtp[index] = digits[0];

      if (index < 5) {
        focusOtpInput(index + 1);
      }

      return nextOtp;
    });
  };

  const handleOtpKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number
  ) => {
    if (e.nativeEvent.key !== 'Backspace') return;

    if (errors.otp) clearFieldError('otp');

    if (otp[index]) {
      setOtp(prev => {
        const nextOtp = [...prev];
        nextOtp[index] = '';
        return nextOtp;
      });
      return;
    }

    if (index > 0) {
      focusOtpInput(index - 1);
    }
  };

  const onSubmit = async () => {
    if (isSubmitting || isSendingOtp) return;

    if (isOtpMode) {
      if (!validateOtpLogin()) return;

      setIsSubmitting(true);

      try {
        const data = await verifyLoginOtp({
          phoneNumber: identifier,
          otp: otp.join(''),
        });

        await redirectAfterAuth(data);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Đăng nhập bằng OTP thất bại. Vui lòng thử lại.';

        setErrors(prev => ({
          ...prev,
          otp: message,
        }));
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    if (!validatePasswordLogin()) return;

    setIsSubmitting(true);

    try {
      const data = await loginWithPassword({
        identifier,
        password,
      });

      await redirectAfterAuth(data);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Đăng nhập thất bại. Vui lòng thử lại.';

      setErrors(prev => ({
        ...prev,
        password: message,
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getBorderColor = (fieldError: string) => {
    return fieldError ? theme.danger : theme.border;
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={goBackOrDefault}
          style={styles.backButton}
        >
          <Text style={[styles.backText, { color: theme.text }]}>
            {'‹'}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: theme.text }]}>
          Đăng nhập
        </Text>

        <Text style={[styles.description, { color: theme.textSecondary }]}>
          {isOtpMode
            ? 'Nhập số điện thoại để nhận mã OTP đăng nhập.'
            : 'Đăng nhập bằng email, username hoặc số điện thoại.'}
        </Text>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.text }]}>
            {isOtpMode ? 'Số điện thoại' : 'Email / Username / Số điện thoại'}{' '}
            <Text style={styles.required}>*</Text>
          </Text>

          <TextInput
            value={identifier}
            onChangeText={handleIdentifierChange}
            placeholder={
              isOtpMode
                ? 'Nhập số điện thoại'
                : 'Nhập email, username hoặc số điện thoại'
            }
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={isOtpMode ? 'phone-pad' : 'default'}
            maxLength={isOtpMode ? 12 : undefined}
            editable={!isSubmitting && !isSendingOtp}
            style={[
              styles.input,
              {
                color: theme.text,
                backgroundColor: theme.surface,
                borderColor: getBorderColor(errors.identifier),
              },
            ]}
          />

          {!!errors.identifier && (
            <Text style={[styles.errorText, { color: theme.danger }]}>
              {errors.identifier}
            </Text>
          )}
        </View>

        {!isOtpMode ? (
          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: theme.text }]}>
                Mật khẩu <Text style={styles.required}>*</Text>
              </Text>

              <TouchableOpacity
                onPress={handleOtpMode}
                disabled={isSubmitting || isSendingOtp}
              >
                <Text style={[styles.switchModeText, { color: theme.link }]}>
                  Đăng nhập bằng OTP
                </Text>
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.passwordWrapper,
                {
                  backgroundColor: theme.surface,
                  borderColor: getBorderColor(errors.password),
                },
              ]}
            >
              <TextInput
                value={password}
                onChangeText={handlePasswordChange}
                placeholder="Nhập mật khẩu"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting && !isSendingOtp}
                style={[styles.passwordInput, { color: theme.text }]}
              />

              <Pressable
                onPress={() => setShowPassword(prev => !prev)}
                hitSlop={8}
                disabled={isSubmitting || isSendingOtp}
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

            {!!errors.password && (
              <Text style={[styles.errorText, { color: theme.danger }]}>
                {errors.password}
              </Text>
            )}
          </View>
        ) : null}

        {isOtpMode ? (
          <>
            <View style={styles.otpTopActionWrap}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handlePasswordMode}
                disabled={isSubmitting || isSendingOtp}
              >
                <Text style={[styles.switchModeText, { color: theme.link }]}>
                  Đăng nhập bằng mật khẩu
                </Text>
              </TouchableOpacity>
            </View>

            {!otpSent ? (
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleSendOtp}
                disabled={isSendingOtp || isSubmitting}
                style={[
                  styles.secondaryButton,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                {isSendingOtp ? (
                  <ActivityIndicator size="small" color={theme.text} />
                ) : (
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      { color: theme.text },
                    ]}
                  >
                    Gửi OTP
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.formGroup}>
                <View style={styles.otpHeaderRow}>
                  <Text style={[styles.label, { color: theme.text }]}>
                    Mã OTP <Text style={styles.required}>*</Text>
                  </Text>

                  <TouchableOpacity
                    activeOpacity={countdown > 0 ? 1 : 0.8}
                    onPress={handleResendOtp}
                    disabled={countdown > 0 || isSendingOtp || isSubmitting}
                  >
                    {isSendingOtp ? (
                      <ActivityIndicator size="small" color={theme.link} />
                    ) : (
                      <Text
                        style={[
                          styles.resendText,
                          {
                            color:
                              countdown > 0
                                ? theme.textMuted
                                : theme.link,
                          },
                        ]}
                      >
                        {countdown > 0
                          ? `Gửi lại OTP (${countdown}s)`
                          : 'Gửi lại OTP'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

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
                      importantForAutofill="yes"
                      editable={!isSubmitting && !isSendingOtp}
                      style={[
                        styles.otpInput,
                        {
                          color: theme.text,
                          backgroundColor: theme.surface,
                          borderColor: getBorderColor(errors.otp),
                        },
                      ]}
                    />
                  ))}
                </View>

                {!!errors.otp && (
                  <Text style={[styles.errorText, { color: theme.danger }]}>
                    {errors.otp}
                  </Text>
                )}
              </View>
            )}
          </>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.88}
          onPress={onSubmit}
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
          {isSubmitting ? (
            <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
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
              Đăng nhập
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.bottomSection}>
          <View style={styles.bottomTextWrap}>
            <Text style={[styles.bottomText, { color: theme.textSecondary }]}>
              Chưa có tài khoản?{' '}
            </Text>

            <TouchableOpacity
              onPress={() => router.push('/register')}
              disabled={isSubmitting || isSendingOtp}
            >
              <Text style={[styles.bottomLink, { color: theme.link }]}>
                Đăng ký ngay
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => router.push('/forgot-password')}
            disabled={isSubmitting || isSendingOtp}
            style={styles.forgotWrap}
          >
            <Text style={[styles.forgotText, { color: theme.link }]}>
              Quên mật khẩu?
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Spacing.sm,
    paddingBottom: 40,
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

  formGroup: {
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
    color: '#E11D2E',
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
    padding: 0,
    fontSize: FontSizes.md,
    lineHeight: LineHeights.md,
    fontFamily: Fonts.regular,
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

  switchModeText: {
    fontSize: FontSizes.sm,
    lineHeight: LineHeights.sm,
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
  },

  otpTopActionWrap: {
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
  },

  secondaryButton: {
    height: ButtonSizes.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },

  secondaryButtonText: {
    fontSize: FontSizes.md,
    lineHeight: LineHeights.md,
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
  },

  otpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  resendText: {
    fontSize: FontSizes.sm,
    lineHeight: LineHeights.sm,
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
  },

  otpWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  otpInput: {
    width: 46,
    height: 52,
    borderWidth: 1,
    borderRadius: Radius.md,
    textAlign: 'center',
    fontSize: FontSizes.lg,
    lineHeight: LineHeights.lg,
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
  },

  errorText: {
    marginTop: 6,
    fontSize: FontSizes.xs,
    lineHeight: LineHeights.xs,
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
    fontSize: FontSizes.lg,
    lineHeight: LineHeights.lg,
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
  },

  bottomSection: {
    marginTop: Spacing.xl,
    alignItems: 'center',
  },

  bottomTextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomText: {
    fontSize: FontSizes.md,
    lineHeight: LineHeights.md,
    fontFamily: Fonts.regular,
  },

  bottomLink: {
    fontSize: FontSizes.md,
    lineHeight: LineHeights.md,
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
  },

  forgotWrap: {
    marginTop: Spacing.md,
  },

  forgotText: {
    fontSize: FontSizes.md,
    lineHeight: LineHeights.md,
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
  },
});
