import { Ionicons } from '@expo/vector-icons';
import { goBackOrDefault } from '@/services/safe-router.service';
import React, { useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
  changePassword,
} from '@/services/auth.service';

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
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const initialErrors: FormErrors = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Không đổi được mật khẩu. Vui lòng thử lại.';
}

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errors, setErrors] = useState<FormErrors>(initialErrors);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return (
      currentPassword.trim() !== '' &&
      newPassword.trim() !== '' &&
      confirmPassword.trim() !== '' &&
      !isSubmitting
    );
  }, [
    currentPassword,
    newPassword,
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

  const handleCurrentPasswordChange = (value: string) => {
    setCurrentPassword(value);

    if (errors.currentPassword) {
      clearFieldError('currentPassword');
    }

    clearSubmitError();
  };

  const handleNewPasswordChange = (value: string) => {
    setNewPassword(value);

    if (errors.newPassword) {
      clearFieldError('newPassword');
    }

    clearSubmitError();
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);

    if (errors.confirmPassword) {
      clearFieldError('confirmPassword');
    }

    clearSubmitError();
  };

  const validateForm = () => {
    const nextErrors: FormErrors = { ...initialErrors };
    let isValid = true;

    if (!currentPassword.trim()) {
      nextErrors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại';
      isValid = false;
    }

    if (!newPassword.trim()) {
      nextErrors.newPassword = 'Vui lòng nhập mật khẩu mới';
      isValid = false;
    } else if (newPassword.length < 6) {
      nextErrors.newPassword = 'Mật khẩu mới cần tối thiểu 6 ký tự';
      isValid = false;
    }

    if (!confirmPassword.trim()) {
      nextErrors.confirmPassword = 'Vui lòng nhập lại mật khẩu mới';
      isValid = false;
    } else if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = 'Mật khẩu nhập lại không khớp';
      isValid = false;
    }

    if (
      currentPassword.trim() &&
      newPassword.trim() &&
      currentPassword === newPassword
    ) {
      nextErrors.newPassword = 'Mật khẩu mới không được trùng mật khẩu hiện tại';
      isValid = false;
    }

    setErrors(nextErrors);

    return isValid;
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError('');

      await changePassword({
        currentPassword,
        password: newPassword,
        passwordConfirmation: confirmPassword,
      });

      Alert.alert(
        'Đã đổi mật khẩu',
        'Mật khẩu của bạn đã được cập nhật.',
        [
          {
            text: 'OK',
            onPress: goBackOrDefault,
          },
        ]
      );
    } catch (error) {
      console.error('Change password failed:', error);
      setSubmitError(getErrorMessage(error));
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

        <Text style={styles.headerTitle}>Đổi mật khẩu</Text>

        <View style={styles.headerSpacer} />
      </View>

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
          <View style={styles.noticeBox}>
            <Ionicons
              name="shield-checkmark-outline"
              size={28}
              color={theme.primary}
            />

            <Text style={styles.noticeText}>
              Vui lòng nhập mật khẩu hiện tại và mật khẩu mới để bảo vệ tài khoản của bạn.
            </Text>
          </View>

          <PasswordInput
            label="Mật khẩu hiện tại"
            value={currentPassword}
            placeholder="Nhập mật khẩu hiện tại"
            visible={showCurrentPassword}
            error={errors.currentPassword}
            editable={!isSubmitting}
            borderColor={getInputBorderColor(errors.currentPassword)}
            onChangeText={handleCurrentPasswordChange}
            onToggleVisible={() => setShowCurrentPassword(prev => !prev)}
          />

          <PasswordInput
            label="Mật khẩu mới"
            value={newPassword}
            placeholder="Nhập mật khẩu mới"
            visible={showNewPassword}
            error={errors.newPassword}
            editable={!isSubmitting}
            borderColor={getInputBorderColor(errors.newPassword)}
            onChangeText={handleNewPasswordChange}
            onToggleVisible={() => setShowNewPassword(prev => !prev)}
          />

          <PasswordInput
            label="Nhập lại mật khẩu mới"
            value={confirmPassword}
            placeholder="Nhập lại mật khẩu mới"
            visible={showConfirmPassword}
            error={errors.confirmPassword}
            editable={!isSubmitting}
            borderColor={getInputBorderColor(errors.confirmPassword)}
            onChangeText={handleConfirmPasswordChange}
            onToggleVisible={() => setShowConfirmPassword(prev => !prev)}
          />

          {!!submitError && (
            <Text style={styles.submitErrorText}>{submitError}</Text>
          )}
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
                Lưu mật khẩu
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PasswordInput({
  label,
  value,
  placeholder,
  visible,
  error,
  editable,
  borderColor,
  onChangeText,
  onToggleVisible,
}: {
  label: string;
  value: string;
  placeholder: string;
  visible: boolean;
  error: string;
  editable: boolean;
  borderColor: string;
  onChangeText: (value: string) => void;
  onToggleVisible: () => void;
}) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.label}>
        {label} <Text style={styles.required}>*</Text>
      </Text>

      <View
        style={[
          styles.passwordInputWrap,
          {
            borderColor,
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable}
          style={styles.passwordInput}
        />

        <Pressable
          hitSlop={8}
          style={styles.eyeButton}
          onPress={onToggleVisible}
          disabled={!editable}
        >
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={24}
            color={theme.textSecondary}
          />
        </Pressable>
      </View>

      {!!error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
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

  scrollContent: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Spacing.xl,
    paddingBottom: 120,
  },

  noticeBox: {
    borderRadius: Radius.md,
    backgroundColor: theme.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },

  noticeText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    lineHeight: 22,
    color: theme.textSecondary,
  },

  formGroup: {
    marginBottom: Spacing.lg,
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

  passwordInputWrap: {
    height: 58,
    borderWidth: 1,
    borderRadius: Radius.md,
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
  },

  passwordInput: {
    flex: 1,
    height: '100%',
    paddingLeft: 16,
    paddingRight: 8,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.lg,
    color: theme.text,
  },

  eyeButton: {
    width: 54,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
});