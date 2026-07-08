import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  normalizePhone,
  registerAccount,
} from '@/services/auth.service';

import { redirectAfterAuth } from '@/services/auth-flow.service';
import { goBackOrDefault } from '@/services/safe-router.service';

type FormErrors = {
  phoneNumber: string;
  lastName: string;
  firstName: string;
  dateOfBirth: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const initialErrors: FormErrors = {
  phoneNumber: '',
  lastName: '',
  firstName: '',
  dateOfBirth: '',
  email: '',
  password: '',
  confirmPassword: '',
};

function formatDateOfBirthInput(value: string) {
  const digits = String(value || '')
    .replace(/[^\d]/g, '')
    .slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatDateOfBirthValue({
  day,
  month,
  year,
}: {
  day: number;
  month: number;
  year: number;
}) {
  return (
    `${String(day).padStart(2, '0')}/` +
    `${String(month).padStart(2, '0')}/` +
    String(year).padStart(4, '0')
  );
}

function parseDateOfBirth(value: string) {
  const match = value.match(
    /^(\d{2})\/(\d{2})\/(\d{4})$/
  );

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    date,
    apiValue:
      `${String(year).padStart(4, '0')}-` +
      `${String(month).padStart(2, '0')}-` +
      `${String(day).padStart(2, '0')}`,
  };
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getDatePickerInitialValue(value: string) {
  const parsed = parseDateOfBirth(value);

  if (parsed) {
    return {
      day: parsed.date.getUTCDate(),
      month: parsed.date.getUTCMonth() + 1,
      year: parsed.date.getUTCFullYear(),
    };
  }

  const now = new Date();

  return {
    day: 1,
    month: 1,
    year: now.getFullYear() - 25,
  };
}

export default function RegisterScreen() {
  const colorScheme = 'light';
  const theme = Colors[colorScheme];

  const [phoneNumber, setPhoneNumber] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [dateOfBirth, setDateOfBirth] =
    useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isDatePickerVisible, setIsDatePickerVisible] =
    useState(false);
  const [draftDay, setDraftDay] = useState(1);
  const [draftMonth, setDraftMonth] = useState(1);
  const [draftYear, setDraftYear] = useState(
    () => new Date().getFullYear() - 25
  );

  const [errors, setErrors] = useState<FormErrors>(initialErrors);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const phoneRegex = /^\d{10,12}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const passwordRegex =
    /^[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+$/;

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    return Array.from(
      { length: 101 },
      (_, index) => currentYear - index
    );
  }, [currentYear]);
  const months = useMemo(() => {
    return Array.from(
      { length: 12 },
      (_, index) => index + 1
    );
  }, []);
  const days = useMemo(() => {
    return Array.from(
      {
        length: getDaysInMonth(
          draftYear,
          draftMonth
        ),
      },
      (_, index) => index + 1
    );
  }, [draftMonth, draftYear]);

  const canSubmit = useMemo(() => {
    return (
      phoneNumber.trim() !== '' &&
      lastName.trim() !== '' &&
      firstName.trim() !== '' &&
      dateOfBirth.trim() !== '' &&
      email.trim() !== '' &&
      password.trim() !== '' &&
      confirmPassword.trim() !== '' &&
      !isSubmitting
    );
  }, [
    phoneNumber,
    lastName,
    firstName,
    dateOfBirth,
    email,
    password,
    confirmPassword,
    isSubmitting,
  ]);

  const clearFieldError = (field: keyof FormErrors) => {
    setErrors(prev => ({
      ...prev,
      [field]: '',
    }));
  };

  const clearSubmitError = () => {
    if (submitError) {
      setSubmitError('');
    }
  };

  const handlePhoneChange = (value: string) => {
    const sanitized = value.replace(/[^\d]/g, '');

    setPhoneNumber(sanitized);

    if (errors.phoneNumber) clearFieldError('phoneNumber');
    clearSubmitError();
  };

  const handleLastNameChange = (value: string) => {
    setLastName(value);

    if (errors.lastName) clearFieldError('lastName');
    clearSubmitError();
  };

  const handleFirstNameChange = (value: string) => {
    setFirstName(value);

    if (errors.firstName) clearFieldError('firstName');
    clearSubmitError();
  };

  const handleDateOfBirthChange = (
    value: string
  ) => {
    setDateOfBirth(
      formatDateOfBirthInput(value)
    );

    if (errors.dateOfBirth) {
      clearFieldError('dateOfBirth');
    }

    clearSubmitError();
  };

  const openDatePicker = () => {
    if (isSubmitting) return;

    const initial =
      getDatePickerInitialValue(dateOfBirth);

    setDraftYear(initial.year);
    setDraftMonth(initial.month);
    setDraftDay(initial.day);
    setIsDatePickerVisible(true);
  };

  const closeDatePicker = () => {
    setIsDatePickerVisible(false);
  };

  const handleDraftYearChange = (year: number) => {
    const nextDay = Math.min(
      draftDay,
      getDaysInMonth(year, draftMonth)
    );

    setDraftYear(year);
    setDraftDay(nextDay);
  };

  const handleDraftMonthChange = (month: number) => {
    const nextDay = Math.min(
      draftDay,
      getDaysInMonth(draftYear, month)
    );

    setDraftMonth(month);
    setDraftDay(nextDay);
  };

  const confirmDatePicker = () => {
    handleDateOfBirthChange(
      formatDateOfBirthValue({
        day: draftDay,
        month: draftMonth,
        year: draftYear,
      })
    );
    closeDatePicker();
  };

  const handleEmailChange = (value: string) => {
    setEmail(value.trim());

    if (errors.email) clearFieldError('email');
    clearSubmitError();
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);

    if (errors.password) clearFieldError('password');
    if (errors.confirmPassword) clearFieldError('confirmPassword');
    clearSubmitError();
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);

    if (errors.confirmPassword) clearFieldError('confirmPassword');
    clearSubmitError();
  };

  const validateForm = () => {
    const nextErrors: FormErrors = { ...initialErrors };
    let isValid = true;

    const cleanPhone = normalizePhone(phoneNumber);

    if (!cleanPhone) {
      nextErrors.phoneNumber = 'Vui lòng nhập số điện thoại';
      isValid = false;
    } else if (!phoneRegex.test(cleanPhone)) {
      nextErrors.phoneNumber = 'Số điện thoại phải từ 10 đến 12 chữ số';
      isValid = false;
    }

    if (!lastName.trim()) {
      nextErrors.lastName = 'Vui lòng nhập họ';
      isValid = false;
    }

    if (!firstName.trim()) {
      nextErrors.firstName = 'Vui lòng nhập tên đệm và tên';
      isValid = false;
    }

    const parsedDateOfBirth =
      parseDateOfBirth(dateOfBirth);

    if (!dateOfBirth.trim()) {
      nextErrors.dateOfBirth =
        'Vui lòng nhập ngày sinh';
      isValid = false;
    } else if (!parsedDateOfBirth) {
      nextErrors.dateOfBirth =
        'Ngày sinh không hợp lệ';
      isValid = false;
    } else {
      const now = new Date();
      const todayUtc = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate()
      );

      if (
        parsedDateOfBirth.date.getTime() >
        todayUtc
      ) {
        nextErrors.dateOfBirth =
          'Ngày sinh không được lớn hơn ngày hiện tại';
        isValid = false;
      }
    }

    if (!email.trim()) {
      nextErrors.email = 'Vui lòng nhập email';
      isValid = false;
    } else if (!emailRegex.test(email)) {
      nextErrors.email = 'Email không hợp lệ';
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

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu';
      isValid = false;
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
      isValid = false;
    }

    setErrors(nextErrors);

    return isValid;
  };

  const onSubmit = async () => {
    if (!validateForm()) return;
    if (isSubmitting) return;

    const parsedDateOfBirth =
      parseDateOfBirth(dateOfBirth);

    if (!parsedDateOfBirth) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const data = await registerAccount({
        phoneNumber,
        lastName,
        firstName,
        email,
        password,
        dateOfBirth:
          parsedDateOfBirth.apiValue,
      });

      await redirectAfterAuth(data);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Đăng ký thất bại. Vui lòng thử lại.';

      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInputBorderColor = (fieldError: string) => {
    return fieldError ? theme.danger : theme.border;
  };

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
            activeOpacity={0.8}
            onPress={goBackOrDefault}
            style={styles.backButton}
          >
            <Text style={[styles.backText, { color: theme.text }]}>
              {'‹'}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: theme.text }]}>
            Đăng ký
          </Text>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.text }]}>
              Số điện thoại chính <Text style={styles.required}>*</Text>
            </Text>

            <TextInput
              value={phoneNumber}
              onChangeText={handlePhoneChange}
              placeholder="Nhập số điện thoại"
              placeholderTextColor={theme.textMuted}
              keyboardType="phone-pad"
              maxLength={12}
              editable={!isSubmitting}
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.surface,
                  borderColor: getInputBorderColor(errors.phoneNumber),
                },
              ]}
            />

            {!!errors.phoneNumber && (
              <Text style={[styles.errorText, { color: theme.danger }]}>
                {errors.phoneNumber}
              </Text>
            )}

            <Text style={[styles.helperText, { color: theme.textSecondary }]}>
              Số điện thoại sẽ được dùng để xác thực tài khoản.
            </Text>
          </View>

          <View style={styles.row}>
            <View style={[styles.column, styles.columnLeft]}>
              <Text style={[styles.label, { color: theme.text }]}>
                Họ <Text style={styles.required}>*</Text>
              </Text>

              <TextInput
                value={lastName}
                onChangeText={handleLastNameChange}
                placeholder="Họ"
                placeholderTextColor={theme.textMuted}
                editable={!isSubmitting}
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    backgroundColor: theme.surface,
                    borderColor: getInputBorderColor(errors.lastName),
                  },
                ]}
              />

              {!!errors.lastName && (
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {errors.lastName}
                </Text>
              )}
            </View>

            <View style={[styles.column, styles.columnRight]}>
              <Text style={[styles.label, { color: theme.text }]}>
                Tên đệm & tên <Text style={styles.required}>*</Text>
              </Text>

              <TextInput
                value={firstName}
                onChangeText={handleFirstNameChange}
                placeholder="Tên"
                placeholderTextColor={theme.textMuted}
                editable={!isSubmitting}
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    backgroundColor: theme.surface,
                    borderColor: getInputBorderColor(errors.firstName),
                  },
                ]}
              />

              {!!errors.firstName && (
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {errors.firstName}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text
              style={[
                styles.label,
                { color: theme.text },
              ]}
            >
              Ngày tháng năm sinh{' '}
              <Text style={styles.required}>*</Text>
            </Text>

            <Pressable
              onPress={openDatePicker}
              disabled={isSubmitting}
              style={[
                styles.dateInputWrapper,
                {
                  backgroundColor: theme.surface,
                  borderColor:
                    getInputBorderColor(
                      errors.dateOfBirth
                    ),
                },
              ]}
            >
              <Text
                style={[
                  styles.dateInputText,
                  {
                    color: dateOfBirth
                      ? theme.text
                      : theme.textMuted,
                  },
                ]}
              >
                {dateOfBirth || 'Chọn ngày sinh'}
              </Text>

              <Ionicons
                name="calendar-outline"
                size={21}
                color={theme.textSecondary}
              />
            </Pressable>

            {!!errors.dateOfBirth && (
              <Text
                style={[
                  styles.errorText,
                  { color: theme.danger },
                ]}
              >
                {errors.dateOfBirth}
              </Text>
            )}

            <View style={styles.birthdayBenefit}>
              <Ionicons
                name="gift-outline"
                size={17}
                color={theme.primary}
              />

              <Text
                style={[
                  styles.birthdayBenefitText,
                  { color: theme.textSecondary },
                ]}
              >
                Nhập ngày sinh để nhận quà sinh nhật
                trị giá 30.000₩ áp dụng trên toàn hệ
                thống Vikof Mobile
              </Text>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.text }]}>
              Email <Text style={styles.required}>*</Text>
            </Text>

            <TextInput
              value={email}
              onChangeText={handleEmailChange}
              placeholder="Nhập email"
              placeholderTextColor={theme.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.surface,
                  borderColor: getInputBorderColor(errors.email),
                },
              ]}
            />

            {!!errors.email && (
              <Text style={[styles.errorText, { color: theme.danger }]}>
                {errors.email}
              </Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.text }]}>
              Mật khẩu <Text style={styles.required}>*</Text>
            </Text>

            <View
              style={[
                styles.passwordWrapper,
                {
                  backgroundColor: theme.surface,
                  borderColor: getInputBorderColor(errors.password),
                },
              ]}
            >
              <TextInput
                value={password}
                onChangeText={handlePasswordChange}
                placeholder="Tạo mới mật khẩu"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
                style={[styles.passwordInput, { color: theme.text }]}
              />

              <Pressable
                onPress={() => setShowPassword(prev => !prev)}
                hitSlop={8}
                disabled={isSubmitting}
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

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.text }]}>
              Xác nhận mật khẩu <Text style={styles.required}>*</Text>
            </Text>

            <View
              style={[
                styles.passwordWrapper,
                {
                  backgroundColor: theme.surface,
                  borderColor: getInputBorderColor(errors.confirmPassword),
                },
              ]}
            >
              <TextInput
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                placeholder="Nhập lại mật khẩu"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
                style={[styles.passwordInput, { color: theme.text }]}
              />

              <Pressable
                onPress={() => setShowConfirmPassword(prev => !prev)}
                hitSlop={8}
                disabled={isSubmitting}
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

            {!!errors.confirmPassword && (
              <Text style={[styles.errorText, { color: theme.danger }]}>
                {errors.confirmPassword}
              </Text>
            )}
          </View>

          {!!submitError && (
            <Text style={[styles.submitErrorText, { color: theme.danger }]}>
              {submitError}
            </Text>
          )}

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
                Đăng ký
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.bottomSection}>
            <Text style={[styles.bottomText, { color: theme.textSecondary }]}>
              Đã có tài khoản?{' '}
            </Text>

            <TouchableOpacity
              onPress={() => router.push('/login')}
              disabled={isSubmitting}
            >
              <Text style={[styles.bottomLink, { color: theme.link }]}>
                Đăng nhập
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={isDatePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDatePicker}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={closeDatePicker}
        >
          <Pressable
            style={[
              styles.datePickerModal,
              {
                backgroundColor: theme.surface,
              },
            ]}
            onPress={event => event.stopPropagation()}
          >
            <View style={styles.datePickerHeader}>
              <Text
                style={[
                  styles.datePickerTitle,
                  { color: theme.text },
                ]}
              >
                Chọn ngày sinh
              </Text>

              <Pressable
                hitSlop={8}
                onPress={closeDatePicker}
              >
                <Ionicons
                  name="close-outline"
                  size={26}
                  color={theme.textSecondary}
                />
              </Pressable>
            </View>

            <View style={styles.datePickerColumns}>
              <DateOptionColumn
                title="Ngày"
                values={days}
                selectedValue={draftDay}
                onSelect={setDraftDay}
              />

              <DateOptionColumn
                title="Tháng"
                values={months}
                selectedValue={draftMonth}
                onSelect={handleDraftMonthChange}
              />

              <DateOptionColumn
                title="Năm"
                values={years}
                selectedValue={draftYear}
                onSelect={handleDraftYearChange}
              />
            </View>

            <Pressable
              onPress={confirmDatePicker}
              style={[
                styles.datePickerConfirmButton,
                {
                  backgroundColor:
                    theme.buttonPrimary,
                },
              ]}
            >
              <Text
                style={[
                  styles.datePickerConfirmText,
                  {
                    color:
                      theme.buttonPrimaryText,
                  },
                ]}
              >
                Xác nhận
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function DateOptionColumn({
  title,
  values,
  selectedValue,
  onSelect,
}: {
  title: string;
  values: number[];
  selectedValue: number;
  onSelect: (value: number) => void;
}) {
  const theme = Colors.light;

  return (
    <View style={styles.dateOptionColumn}>
      <Text
        style={[
          styles.dateOptionTitle,
          { color: theme.textSecondary },
        ]}
      >
        {title}
      </Text>

      <ScrollView
        style={styles.dateOptionList}
        contentContainerStyle={
          styles.dateOptionListContent
        }
        showsVerticalScrollIndicator={false}
      >
        {values.map(value => {
          const isSelected =
            value === selectedValue;

          return (
            <Pressable
              key={String(value)}
              onPress={() => onSelect(value)}
              style={[
                styles.dateOptionItem,
                {
                  backgroundColor: isSelected
                    ? theme.primarySoft
                    : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.dateOptionText,
                  {
                    color: isSelected
                      ? theme.primary
                      : theme.text,
                    fontFamily: isSelected
                      ? Fonts.bold
                      : Fonts.regular,
                    fontWeight: isSelected
                      ? FontWeights.bold
                      : FontWeights.regular,
                  },
                ]}
              >
                {String(value).padStart(
                  title === 'Năm' ? 4 : 2,
                  '0'
                )}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
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
    marginBottom: Spacing.xl,
  },

  formGroup: {
    marginBottom: Spacing.lg,
  },

  row: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },

  column: {
    flex: 1,
  },

  columnLeft: {
    marginRight: 6,
  },

  columnRight: {
    marginLeft: 6,
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

  dateInputWrapper: {
    height: 52,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingLeft: 14,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  dateInputText: {
    flex: 1,
    fontSize: FontSizes.md,
    lineHeight: LineHeights.md,
    fontFamily: Fonts.regular,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
    paddingHorizontal: Layout.screenHorizontalPadding,
    alignItems: 'center',
    justifyContent: 'center',
  },

  datePickerModal: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.lg,
    padding: 16,
  },

  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  datePickerTitle: {
    fontSize: FontSizes.lg,
    lineHeight: LineHeights.lg,
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
  },

  datePickerColumns: {
    flexDirection: 'row',
    gap: 8,
  },

  dateOptionColumn: {
    flex: 1,
  },

  dateOptionTitle: {
    marginBottom: 8,
    textAlign: 'center',
    fontSize: FontSizes.sm,
    lineHeight: LineHeights.sm,
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
  },

  dateOptionList: {
    height: 210,
  },

  dateOptionListContent: {
    paddingBottom: 4,
  },

  dateOptionItem: {
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  dateOptionText: {
    fontSize: FontSizes.md,
    lineHeight: LineHeights.md,
  },

  datePickerConfirmButton: {
    height: ButtonSizes.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },

  datePickerConfirmText: {
    fontSize: FontSizes.md,
    lineHeight: LineHeights.md,
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
  },

  birthdayBenefit: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },

  birthdayBenefitText: {
    flex: 1,
    fontSize: FontSizes.xs,
    lineHeight: LineHeights.sm,
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

  helperText: {
    marginTop: 6,
    fontSize: FontSizes.xs,
    lineHeight: LineHeights.xs,
    fontFamily: Fonts.regular,
  },

  errorText: {
    marginTop: 6,
    fontSize: FontSizes.xs,
    lineHeight: LineHeights.xs,
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
    fontSize: FontSizes.lg,
    lineHeight: LineHeights.lg,
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
  },

  bottomSection: {
    marginTop: Spacing.xl,
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
});
