import { useLocalSearchParams } from 'expo-router';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  NativeSyntheticEvent,
  Platform,
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
  redirectAfterAuth,
  type AuthPayload,
} from '@/services/auth-flow.service';
import { goBackOrDefault } from '@/services/safe-router.service';

const API_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

const RESEND_ERROR_MESSAGE =
  'Đã xảy ra lỗi, vui lòng liên hệ admin để được hỗ trợ.';

function getOtpAutoFillProps(index: number) {
  if (index !== 0) {
    return {
      autoComplete: 'off' as const,
      textContentType: 'none' as const,
      importantForAutofill: 'no' as const,
    };
  }

  if (Platform.OS === 'ios') {
    return {
      textContentType: 'oneTimeCode' as const,
    };
  }

  if (Platform.OS === 'android') {
    return {
      autoComplete: 'sms-otp' as const,
      importantForAutofill: 'yes' as const,
    };
  }

  return {
    autoComplete: 'one-time-code' as const,
  };
}

const normalizePhone = (value: string) => {
  let phone = String(value || '').replace(/[^\d]/g, '');

  if (phone.startsWith('82')) {
    phone = `0${phone.slice(2)}`;
  }

  return phone;
};

async function parseJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function getApiErrorMessage(data: any) {
  const messageText =
    data?.error?.message ||
    data?.message?.[0]?.messages?.[0]?.message ||
    data?.message;

  if (typeof messageText !== 'string') {
    return 'Có lỗi xảy ra. Vui lòng thử lại.';
  }

  return messageText;
}

export default function VerifyPhoneScreen() {
  const colorScheme = 'light';
  const theme = Colors[colorScheme];

  const params = useLocalSearchParams<{
    phone?: string;
    email?: string;
    userId?: string;
    smsSent?: string;
  }>();

  const rawPhoneText = Array.isArray(params.phone)
    ? params.phone[0]
    : params.phone || '';

  const phoneText = normalizePhone(rawPhoneText);

  const userId = Array.isArray(params.userId)
    ? params.userId[0]
    : params.userId || '';

  const smsSentParam = Array.isArray(params.smsSent)
    ? params.smsSent[0]
    : params.smsSent;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [resendError, setResendError] = useState('');
  const [message, setMessage] = useState(
    smsSentParam === 'false'
      ? 'Chưa gửi được mã OTP. Vui lòng bấm gửi lại mã.'
      : ''
  );

  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const otpRefs = useRef<Array<TextInput | null>>([]);
  const lastAutoSubmittedOtpRef = useRef('');

  const maskPhoneNumber = (value: string) => {
    if (!value) return '';
    if (value.length <= 4) return value;

    const first = value.slice(0, 3);
    const last = value.slice(-3);
    const middle = 'x'.repeat(Math.max(0, value.length - 6));

    return `${first}${middle}${last}`;
  };

  const clearMessage = () => {
    if (otpError) setOtpError('');
    if (resendError) setResendError('');
    if (message) setMessage('');
  };

  const resetOtpInput = () => {
    lastAutoSubmittedOtpRef.current = '';
    setOtp(['', '', '', '', '', '']);

    setTimeout(() => {
      otpRefs.current[0]?.focus();
    }, 100);
  };

  const focusOtpInput = (index: number) => {
    setTimeout(() => {
      otpRefs.current[index]?.focus();
    }, 0);
  };

  const validateBase = useCallback((
    type: 'verify' | 'resend'
  ) => {
    const setError = type === 'verify' ? setOtpError : setResendError;

    if (!API_URL) {
      setError('Thiếu cấu hình API URL. Vui lòng kiểm tra file .env');
      return false;
    }

    if (!userId) {
      setError('Thiếu userId. Vui lòng đăng ký lại.');
      return false;
    }

    if (!phoneText) {
      setError('Thiếu số điện thoại. Vui lòng đăng ký lại.');
      return false;
    }

    return true;
  }, [phoneText, userId]);

  const handleOtpChange = (value: string, index: number) => {
    const digits = value.replace(/[^\d]/g, '');

    clearMessage();

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

        focusOtpInput(nextFocusIndex);

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

    clearMessage();

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

  const verifyOtpCode = useCallback(async (otpCode: string) => {
    if (isVerifying || isResending) return;

    if (!validateBase('verify')) return;

    if (otpCode.length < 6) {
      setOtpError('Vui lòng nhập đầy đủ 6 số OTP');
      return;
    }

    setIsVerifying(true);
    setOtpError('');
    setResendError('');
    setMessage('');

    try {
      const response = await fetch(
        `${API_URL}/api/vikof/auth/verify-phone`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            phoneNumber: phoneText,
            otp: otpCode,
          }),
        }
      );

      const data = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(getApiErrorMessage(data));
      }

      await redirectAfterAuth(data as AuthPayload);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Xác thực thất bại. Vui lòng thử lại.';

      setOtpError(errorMessage);
    } finally {
      setIsVerifying(false);
    }
  }, [
    isResending,
    isVerifying,
    phoneText,
    userId,
    validateBase,
  ]);

  const handleSubmit = () => {
    void verifyOtpCode(otp.join(''));
  };

  useEffect(() => {
    const otpCode = otp.join('');

    if (otpCode.length < 6) {
      lastAutoSubmittedOtpRef.current = '';
      return;
    }

    if (
      isVerifying ||
      isResending ||
      lastAutoSubmittedOtpRef.current === otpCode
    ) {
      return;
    }

    lastAutoSubmittedOtpRef.current = otpCode;
    void verifyOtpCode(otpCode);
  }, [
    isResending,
    isVerifying,
    otp,
    verifyOtpCode,
  ]);

  const handleResendOtp = async () => {
    if (isResending || isVerifying) return;

    setOtpError('');
    setResendError('');
    setMessage('');

    if (!validateBase('resend')) return;

    setIsResending(true);

    try {
      const response = await fetch(
        `${API_URL}/api/vikof/auth/resend-phone-verify-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            phoneNumber: phoneText,
          }),
        }
      );

      const data = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(getApiErrorMessage(data));
      }

      resetOtpInput();
      setMessage(data?.message || 'Đã gửi lại mã OTP.');
    } catch (error) {
      console.log('[RESEND_OTP_ERROR]', error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : RESEND_ERROR_MESSAGE;

      setResendError(errorMessage);
    } finally {
      setIsResending(false);
    }
  };

  const canSubmit =
    otp.every(digit => digit !== '') && !isVerifying && !isResending;

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
          Xác thực số điện thoại
        </Text>

        <Text style={[styles.description, { color: theme.textSecondary }]}>
          Chúng tôi đã gửi tin nhắn chứa mã xác thực đến số{' '}
          <Text style={[styles.phoneHighlight, { color: theme.text }]}>
            {maskPhoneNumber(phoneText)}
          </Text>
          .
        </Text>

        <View style={styles.formGroup}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: theme.text }]}>
              Mã OTP <Text style={styles.required}>*</Text>
            </Text>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleResendOtp}
              disabled={isResending || isVerifying}
              style={styles.resendButton}
            >
              {isResending ? (
                <ActivityIndicator size="small" color={theme.link} />
              ) : (
                <>
                  <Text style={[styles.reloadIcon, { color: theme.link }]}>
                    ↻
                  </Text>

                  <Text style={[styles.resendText, { color: theme.link }]}>
                    Gửi lại mã
                  </Text>
                </>
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
                {...getOtpAutoFillProps(index)}
                editable={!isVerifying && !isResending}
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

          {!!resendError && (
            <Text style={[styles.errorText, { color: theme.danger }]}>
              {resendError}
            </Text>
          )}

          {!!message && !otpError && !resendError && (
            <Text style={[styles.messageText, { color: theme.link }]}>
              {message}
            </Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          activeOpacity={0.88}
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
          {isVerifying ? (
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
              Xác nhận
            </Text>
          )}
        </TouchableOpacity>
      </View>
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
    paddingBottom: 120,
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
    marginBottom: 10,
  },

  description: {
    fontSize: FontSizes.md,
    lineHeight: LineHeights.lg,
    fontFamily: Fonts.regular,
    marginBottom: Spacing.xl,
  },

  phoneHighlight: {
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
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
  },

  required: {
    color: '#DC2626',
  },

  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 28,
  },

  reloadIcon: {
    fontSize: 16,
    lineHeight: 18,
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
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
    width: 48,
    height: 52,
    borderWidth: 1,
    borderRadius: Radius.md,
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 22,
    fontFamily: Fonts.bold,
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

  bottomBar: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },

  submitButton: {
    height: ButtonSizes.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  submitButtonText: {
    fontSize: FontSizes.md,
    lineHeight: LineHeights.md,
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
  },
});
