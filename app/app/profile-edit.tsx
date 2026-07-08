import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useState } from 'react';
import { goBackOrDefault } from '@/services/safe-router.service';
import {
  ActivityIndicator,
  Alert,
  Image,
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
  getUserInfo,
  type UserInfo,
} from '@/services/app-storage.service';

import {
  getCurrentProfile,
  getUserAvatarUrl,
  getUserDisplayPhone,
  updateProfile,
} from '@/services/profile.service';

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

const theme = Colors.light;

type FormErrors = {
  lastName: string;
  firstName: string;
  email: string;
};

const initialErrors: FormErrors = {
  lastName: '',
  firstName: '',
  email: '',
};

const genderOptions = [
  {
    label: 'Nam',
    value: 'Male',
  },
  {
    label: 'Nữ',
    value: 'Female',
  },
  {
    label: 'Khác',
    value: 'Other',
  },
];

function getStringValue(value: unknown) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function getUserField(user: UserInfo | null, keys: string[]) {
  if (!user) return '';

  for (const key of keys) {
    const value = getStringValue(user[key]);

    if (value) return value;
  }

  return '';
}

function parseApiDate(value: string) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function formatDateForApi(date: Date | null) {
  if (!date) return null;

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(date: Date | null) {
  if (!date) return '';

  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

export default function ProfileEditScreen() {
  const [avatarUri, setAvatarUri] = useState('');
  const [avatarChanged, setAvatarChanged] = useState(false);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [draftDateOfBirth, setDraftDateOfBirth] = useState<Date | null>(null);
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);

  const [errors, setErrors] = useState<FormErrors>(initialErrors);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const canSubmit = useMemo(() => {
    return (
      lastName.trim() !== '' &&
      firstName.trim() !== '' &&
      email.trim() !== '' &&
      !isSubmitting &&
      !loadingProfile
    );
  }, [
    lastName,
    firstName,
    email,
    isSubmitting,
    loadingProfile,
  ]);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        setLoadingProfile(true);

        let user: UserInfo | null = null;

        try {
          user = await getCurrentProfile();
        } catch (error) {
          console.error('Fetch current profile for edit failed:', error);
          user = await getUserInfo();
        }

        if (!mounted) return;

        setPhoneNumber(getUserDisplayPhone(user));
        setAvatarUri(getUserAvatarUrl(user));
        setAvatarChanged(false);

        setLastName(
          getUserField(user, [
            'LastName',
            'lastName',
            'familyName',
          ])
        );

        setFirstName(
          getUserField(user, [
            'FirstName',
            'firstName',
            'givenName',
          ])
        );

        setDateOfBirth(
          parseApiDate(
            getUserField(user, [
              'DateOfBirth',
              'dateOfBirth',
              'birthDate',
            ])
          )
        );

        setGender(
          getUserField(user, [
            'Sex',
            'sex',
            'gender',
          ])
        );

        setEmail(getUserField(user, ['email']));
      } finally {
        if (mounted) {
          setLoadingProfile(false);
        }
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

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

  const handleEmailChange = (value: string) => {
    setEmail(value.trim());

    if (errors.email) clearFieldError('email');
    clearSubmitError();
  };

  const handleGenderChange = (value: string) => {
    setGender(value);
    clearSubmitError();
  };

  const validateForm = () => {
    const nextErrors: FormErrors = { ...initialErrors };
    let isValid = true;

    if (!lastName.trim()) {
      nextErrors.lastName = 'Vui lòng nhập họ';
      isValid = false;
    }

    if (!firstName.trim()) {
      nextErrors.firstName = 'Vui lòng nhập tên đệm và tên';
      isValid = false;
    }

    if (!email.trim()) {
      nextErrors.email = 'Vui lòng nhập email';
      isValid = false;
    } else if (!emailRegex.test(email)) {
      nextErrors.email = 'Email không hợp lệ';
      isValid = false;
    }

    setErrors(nextErrors);

    return isValid;
  };

  const pickAvatar = async () => {
    if (isSubmitting || loadingProfile) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Cần quyền truy cập ảnh',
        'Vui lòng cho phép ứng dụng truy cập thư viện ảnh để chọn avatar.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled) return;

    const asset = result.assets[0];

    if (asset?.uri) {
      setAvatarUri(asset.uri);
      setAvatarChanged(true);
      clearSubmitError();
    }
  };

  const openDatePicker = () => {
    if (isSubmitting || loadingProfile) return;

    setDraftDateOfBirth(dateOfBirth ?? new Date(2000, 0, 1));
    setShowDatePicker(true);
  };

  const closeDatePicker = () => {
    setShowDatePicker(false);
  };

  const confirmDatePicker = () => {
    setDateOfBirth(draftDateOfBirth ?? new Date(2000, 0, 1));
    setShowDatePicker(false);
    clearSubmitError();
  };

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    if (!selectedDate) return;

    setDraftDateOfBirth(selectedDate);
  };

  const onSubmit = async () => {
    if (!validateForm()) return;
    if (isSubmitting || loadingProfile) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      await updateProfile({
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        email: email.trim().toLowerCase(),
        dateOfBirth: formatDateForApi(dateOfBirth),
        sex: gender || null,
        avatarUri,
      });

      setAvatarChanged(false);

      Alert.alert(
        'Đã lưu',
        'Thông tin cá nhân đã được cập nhật.',
        [
          {
            text: 'OK',
            onPress: goBackOrDefault,
          },
        ]
      );
    } catch (error) {
      console.error('Update profile failed:', error);

      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Không cập nhật được thông tin. Vui lòng thử lại.'
      );
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
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={goBackOrDefault}
          style={styles.backButton}
          disabled={isSubmitting}
        >
          <Ionicons name="chevron-back" size={34} color={theme.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Thông tin cá nhân</Text>

        <View style={styles.headerSpacer} />
      </View>

      {loadingProfile ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Đang tải thông tin...</Text>
        </View>
      ) : (
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
            <View style={styles.avatarSection}>
              <Pressable
                style={({ pressed }) => [
                  styles.avatarOuter,
                  pressed && styles.buttonPressed,
                  isSubmitting && styles.disabledBlock,
                ]}
                onPress={pickAvatar}
                disabled={isSubmitting}
              >
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons
                    name="person-circle"
                    size={150}
                    color={theme.textMuted}
                  />
                )}

                <View style={styles.avatarEditButton}>
                  <Ionicons name="pencil" size={24} color="#FFFFFF" />
                </View>
              </Pressable>

              {avatarChanged ? (
                <Text style={styles.avatarChangedText}>
                  Ảnh avatar đã thay đổi, bấm lưu để lưu thay đổi.
                </Text>
              ) : null}
            </View>

            <View style={styles.row}>
              <View style={[styles.column, styles.columnLeft]}>
                <Text style={styles.label}>
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
                      borderColor: getInputBorderColor(errors.lastName),
                    },
                  ]}
                />

                {!!errors.lastName && (
                  <Text style={styles.errorText}>{errors.lastName}</Text>
                )}
              </View>

              <View style={[styles.column, styles.columnRight]}>
                <Text style={styles.label}>
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
                      borderColor: getInputBorderColor(errors.firstName),
                    },
                  ]}
                />

                {!!errors.firstName && (
                  <Text style={styles.errorText}>{errors.firstName}</Text>
                )}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Số điện thoại</Text>

              <TextInput
                value={phoneNumber}
                placeholder="Số điện thoại"
                placeholderTextColor={theme.textMuted}
                editable={false}
                style={[
                  styles.input,
                  styles.disabledInput,
                  {
                    borderColor: theme.border,
                  },
                ]}
              />

              <Text style={styles.helperText}>
                Số điện thoại là định danh đăng nhập nên không thể thay đổi.
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Ngày sinh</Text>

              <Pressable
                style={({ pressed }) => [
                  styles.dateInput,
                  pressed && styles.buttonPressed,
                  isSubmitting && styles.disabledBlock,
                ]}
                onPress={openDatePicker}
                disabled={isSubmitting}
              >
                <Text
                  style={[
                    styles.dateInputText,
                    !dateOfBirth && styles.placeholderText,
                  ]}
                >
                  {dateOfBirth
                    ? formatDateForDisplay(dateOfBirth)
                    : 'Ngày/tháng/năm sinh'}
                </Text>

                <Ionicons
                  name="calendar-outline"
                  size={24}
                  color={theme.textSecondary}
                />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Giới tính</Text>

              <View style={styles.genderRow}>
                {genderOptions.map(item => {
                  const active = gender === item.value;

                  return (
                    <Pressable
                      key={item.value}
                      style={({ pressed }) => [
                        styles.genderChip,
                        active && styles.genderChipActive,
                        pressed && styles.buttonPressed,
                        isSubmitting && styles.disabledBlock,
                      ]}
                      onPress={() => handleGenderChange(item.value)}
                      disabled={isSubmitting}
                    >
                      <Text
                        style={[
                          styles.genderChipText,
                          active && styles.genderChipTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                E-mail <Text style={styles.required}>*</Text>
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
                    borderColor: getInputBorderColor(errors.email),
                  },
                ]}
              />

              {!!errors.email && (
                <Text style={styles.errorText}>{errors.email}</Text>
              )}
            </View>

            {!!submitError && (
              <Text style={styles.submitErrorText}>{submitError}</Text>
            )}
          </ScrollView>

          <View style={styles.bottomBar}>
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
                  Lưu
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={closeDatePicker}
      >
        <View style={styles.dateModalOverlay}>
          <Pressable
            style={styles.dateModalBackdrop}
            onPress={closeDatePicker}
          />

          <View style={styles.dateModalSheet}>
            <View style={styles.dateModalHeader}>
              <Pressable
                style={styles.dateModalAction}
                onPress={closeDatePicker}
              >
                <Text style={styles.dateModalCancelText}>Huỷ</Text>
              </Pressable>

              <Text style={styles.dateModalTitle}>Chọn ngày sinh</Text>

              <Pressable
                style={styles.dateModalAction}
                onPress={confirmDatePicker}
              >
                <Text style={styles.dateModalDoneText}>Xong</Text>
              </Pressable>
            </View>

            <DateTimePicker
              value={draftDateOfBirth ?? dateOfBirth ?? new Date(2000, 0, 1)}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={handleDateChange}
              themeVariant="dark"
              textColor="#FFFFFF"
              style={styles.datePicker}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },

  keyboardView: {
    flex: 1,
  },

  header: {
    height: 58,
    paddingHorizontal: Layout.screenHorizontalPadding,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },

  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
    fontSize: FontSizes.headingSm,
    lineHeight: LineHeights.headingSm,
    color: theme.text,
  },

  headerSpacer: {
    width: 42,
  },

  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },

  loadingText: {
    marginTop: Spacing.md,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    color: theme.textSecondary,
  },

  scrollContent: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Spacing.xl,
    paddingBottom: 180,
  },

  avatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },

  avatarOuter: {
    width: 166,
    height: 166,
    borderRadius: 83,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 83,
  },

  avatarChangedText: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: theme.primarySoft,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    lineHeight: LineHeights.sm,
    color: theme.primary,
    textAlign: 'center',
  },

  avatarEditButton: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.background,
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
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
    fontSize: FontSizes.lg,
    lineHeight: LineHeights.lg,
    color: theme.text,
    marginBottom: 8,
  },

  required: {
    color: theme.danger,
  },

  input: {
    height: 58,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.lg,
    color: theme.text,
    backgroundColor: theme.surface,
  },

  disabledInput: {
    backgroundColor: '#F1F1F4',
    color: theme.textSecondary,
  },

  helperText: {
    marginTop: 6,
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: theme.textSecondary,
  },

  dateInput: {
    height: 58,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dateInputText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.lg,
    color: theme.text,
  },

  placeholderText: {
    color: theme.textMuted,
  },

  genderRow: {
    flexDirection: 'row',
    gap: 10,
  },

  genderChip: {
    flex: 1,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  genderChipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },

  genderChipText: {
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
    fontSize: FontSizes.md,
    color: theme.textSecondary,
  },

  genderChipTextActive: {
    color: '#FFFFFF',
  },

  errorText: {
    marginTop: 6,
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: theme.danger,
  },

  submitErrorText: {
    marginTop: -4,
    marginBottom: Spacing.md,
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: theme.danger,
  },

  bottomBar: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    backgroundColor: theme.background,
  },

  submitButton: {
    height: ButtonSizes.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  submitButtonText: {
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
    fontSize: FontSizes.lg,
    lineHeight: LineHeights.lg,
  },

  buttonPressed: {
    opacity: 0.75,
  },

  disabledBlock: {
    opacity: 0.6,
  },

  dateModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  dateModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },

  dateModalSheet: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    overflow: 'hidden',
  },

  dateModalHeader: {
    height: 54,
    paddingHorizontal: Layout.screenHorizontalPadding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },

  dateModalAction: {
    minWidth: 64,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dateModalTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
    fontSize: FontSizes.lg,
    color: '#FFFFFF',
  },

  dateModalCancelText: {
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
    fontSize: FontSizes.md,
    color: 'rgba(255, 255, 255, 0.72)',
  },

  dateModalDoneText: {
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
    fontSize: FontSizes.md,
    color: '#FFFFFF',
  },

  datePicker: {
    height: 220,
    backgroundColor: '#111111',
  },
});