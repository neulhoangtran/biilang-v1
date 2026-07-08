import { ReactNode } from 'react';
import {
  Linking,
  Pressable,
  StyleProp,
  ViewStyle,
} from 'react-native';

type PhoneLinkProps = {
  phone?: string | null;
  children: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onError?: (error: unknown) => void;
};

export function normalizePhoneForTel(value?: string | null) {
  const raw = String(value || '').trim();

  if (!raw) return '';

  let phone = raw
    // đổi số full-width nếu có: ０１２３...
    .replace(/[０-９]/g, char =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0)
    )
    .trim();

  // bỏ khoảng trắng
  phone = phone.replace(/\s+/g, '');

  // xử lý dạng (+82)
  phone = phone.replace(/^\(\+/, '+');
  phone = phone.replace(/[()]/g, '');

  // xử lý dạng 0082...
  if (phone.startsWith('00')) {
    phone = `+${phone.slice(2)}`;
  }

  const hasPlus = phone.startsWith('+');

  // chỉ giữ số và dấu +
  phone = phone.replace(/[^\d+]/g, '');

  // nếu có + thì chỉ giữ + ở đầu
  if (hasPlus) {
    phone = `+${phone.replace(/[^\d]/g, '')}`;
  } else {
    phone = phone.replace(/[^\d]/g, '');
  }

  return phone;
}

export default function PhoneLink({
  phone,
  children,
  disabled,
  style,
  onError,
}: PhoneLinkProps) {
  const telPhone = normalizePhoneForTel(phone);

  const handlePress = async () => {
    if (!telPhone || disabled) return;

    const url = `tel:${telPhone}`;

    try {
      await Linking.openURL(url);
    } catch (error) {
      console.log('[PHONE_LINK_OPEN_FAILED]', error);
      onError?.(error);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || !telPhone}
      style={style}
      hitSlop={8}
    >
      {children}
    </Pressable>
  );
}