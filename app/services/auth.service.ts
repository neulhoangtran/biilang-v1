import type {
  AuthPayload,
  VoucherSmsResult,
} from '@/services/auth-flow.service';
import { apiRequest } from './api';

const API_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

const AUTH_BASE = '/api/vikof/auth';

export type RegisterPayload = {
  phoneNumber: string;
  lastName: string;
  firstName: string;
  email: string;
  password: string;
  dateOfBirth: string;
};

export type LoginPayload = {
  identifier: string;
  password: string;
};

export type SendLoginOtpPayload = {
  phoneNumber: string;
};

export type VerifyLoginOtpPayload = {
  phoneNumber: string;
  otp: string;
};

export type AuthResponse = AuthPayload & {
  smsErrorMessage?: string;
  voucherSms?: VoucherSmsResult | null;
  message?: string;
  [key: string]: any;
};

export type ChangePasswordPayload = {
  currentPassword: string;
  password: string;
  passwordConfirmation: string;
};

type ChangePasswordResponse = {
  jwt?: string;
  user?: unknown;
};

export async function changePassword(
  payload: ChangePasswordPayload
) {
  return apiRequest<ChangePasswordResponse>(
    '/api/auth/change-password',
    {
      method: 'POST',
      authMode: 'user',
      body: {
        currentPassword:
          payload.currentPassword,
        password: payload.password,
        passwordConfirmation:
          payload.passwordConfirmation,
      },
    }
  );
}

export function normalizePhone(value: string) {
  let phone = String(value || '').replace(
    /[^\d]/g,
    ''
  );

  if (phone.startsWith('82')) {
    phone = `0${phone.slice(2)}`;
  }

  return phone;
}

export function getApiErrorMessage(
  data: any,
  fallback =
    'Có lỗi xảy ra. Vui lòng thử lại.'
) {
  const message =
    data?.error?.message ||
    data?.message?.[0]?.messages?.[0]
      ?.message ||
    data?.message;

  if (typeof message !== 'string') {
    return fallback;
  }

  if (
    message.includes(
      'Email or Username are already taken'
    )
  ) {
    return 'Email hoặc số điện thoại đã được sử dụng.';
  }

  if (
    message.includes(
      'Email is already taken'
    )
  ) {
    return 'Email này đã được sử dụng.';
  }

  if (
    message.includes(
      'Username is already taken'
    )
  ) {
    return 'Số điện thoại này đã được sử dụng.';
  }

  if (
    message.includes(
      'Email hoặc số điện thoại đã được sử dụng'
    )
  ) {
    return 'Email hoặc số điện thoại đã được sử dụng.';
  }

  if (
    message.includes('Tài khoản đã bị khóa')
  ) {
    return 'Tài khoản này đã bị vô hiệu hóa. Vui lòng đăng ký lại hoặc liên hệ admin.';
  }

  return message;
}

async function parseJsonResponse(
  response: Response
) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function postAuth<TResponse>(
  path: string,
  body: Record<string, unknown>,
  fallbackMessage: string
): Promise<TResponse> {
  if (!API_URL) {
    throw new Error(
      'Thiếu cấu hình API URL. Vui lòng kiểm tra file .env'
    );
  }

  const response = await fetch(
    `${API_URL}${path}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  const data =
    await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      getApiErrorMessage(
        data,
        fallbackMessage
      )
    );
  }

  return data as TResponse;
}

export async function registerAccount(
  payload: RegisterPayload
): Promise<AuthResponse> {
  return postAuth<AuthResponse>(
    `${AUTH_BASE}/register`,
    {
      phoneNumber: normalizePhone(
        payload.phoneNumber
      ),
      lastName: payload.lastName.trim(),
      firstName: payload.firstName.trim(),
      email: payload.email
        .trim()
        .toLowerCase(),
      password: payload.password,
      dateOfBirth:
        payload.dateOfBirth.trim(),
    },
    'Đăng ký thất bại. Vui lòng thử lại.'
  );
}

export async function loginWithPassword(
  payload: LoginPayload
): Promise<AuthResponse> {
  return postAuth<AuthResponse>(
    `${AUTH_BASE}/login`,
    {
      identifier: payload.identifier.trim(),
      password: payload.password,
    },
    'Đăng nhập thất bại. Vui lòng thử lại.'
  );
}

export async function sendLoginOtp(
  payload: SendLoginOtpPayload
) {
  return postAuth<{
    userId?: number;
    phoneNumber?: string;
    otpExpiresIn?: number;
    success?: boolean;
    message?: string;
    [key: string]: any;
  }>(
    `${AUTH_BASE}/login/send-otp`,
    {
      phoneNumber: normalizePhone(
        payload.phoneNumber
      ),
    },
    'Không thể gửi OTP. Vui lòng thử lại.'
  );
}

export async function verifyLoginOtp(
  payload: VerifyLoginOtpPayload
): Promise<AuthResponse> {
  return postAuth<AuthResponse>(
    `${AUTH_BASE}/login/verify-otp`,
    {
      phoneNumber: normalizePhone(
        payload.phoneNumber
      ),
      otp: payload.otp,
    },
    'Đăng nhập bằng OTP thất bại. Vui lòng thử lại.'
  );
}
