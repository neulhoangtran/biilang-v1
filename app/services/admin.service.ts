import { apiRequest } from './api';

type AdminMediaFormat = {
  url?: string;
};

export type AdminVoucherHistoryItem = {
  id: number;
  documentId?: string;
  Name?: string;
  IsSuccess?: boolean;
  AppliedDate?: string;
};

export type AdminVoucherItem = {
  id: number | string;
  documentId?: string | null;
  Type: 'FIRST_REGISTER' | 'STANDARD';
  Name?: string;
  Description?: string | null;
  VoucherCode?: string | null;
  ApplyFor?: 'All' | 'User' | 'Branch';
  IsActive?: boolean;
  ExpiryDate?: string | null;
  IsUsed?: boolean;
  IsExpired?: boolean;
  Status?: 'AVAILABLE' | 'USED' | 'EXPIRED';
  UsedAt?: string | null;
  createdAt?: string;
  voucher_histories?: AdminVoucherHistoryItem[];
};

export type AdminCustomerItem = {
  id: number;
  documentId?: string;
  username?: string;
  email?: string;
  PhoneNumber?: string;
  FirstName?: string;
  LastName?: string;
  DateOfBirth?: string | null;
  IsFirstRegister?: boolean;
  ExpiredFirstRegisterVoucher?: string | null;
  IsUseFirstRegisterVoucher?: boolean;
  confirmed?: boolean;
  blocked?: boolean;
  createdAt?: string;

  Branch?: {
    id: number;
    documentId?: string;
    Name?: string;
    Area?: string;
  } | null;

  Avatar?: {
    url?: string;
    formats?: {
      thumbnail?: AdminMediaFormat;
      small?: AdminMediaFormat;
    };
  } | null;

  Vouchers?: AdminVoucherItem[];
};

export type AdminMessageItem = {
  id: number;
  documentId?: string;
  Title?: string;
  Content?: string;
  Schedule?: string;
  IsConfirmed?: boolean;
  SendStatus?: string;
  LogMessage?: string | null;
  LogDetail?: string | null;
  createdAt?: string;
  updatedAt?: string;

  Branches?: {
    id: number;
    documentId?: string;
    Name?: string;
    Area?: string;
  }[];

  Author?: {
    id: number;
    username?: string;
    email?: string;
  } | null;
};

export type CreateAdminMessagePayload = {
  title: string;
  content: string;
  schedule: string;
};

export type UpdateAdminMessagePayload = {
  id: number;
  title: string;
  content: string;
  schedule: string;
};

export type UseAdminCustomerVoucherPayload = {
  customerId: number;
  voucherType: 'FIRST_REGISTER' | 'STANDARD';
  voucherId?: number;
};

type CustomerListResponse = {
  data?: AdminCustomerItem[];
};

type MessageListResponse = {
  data?: AdminMessageItem[];
};

type AdminMessageResponse = {
  success?: boolean;
  message?: string;
  data?: AdminMessageItem | null;
};

export type UseAdminCustomerVoucherResponse = {
  success?: boolean;
  message?: string;
  data?: {
    customerId: number;
    voucherId: number | string;
    voucherType: 'FIRST_REGISTER' | 'STANDARD';
    IsUsed: boolean;
    UsedAt?: string | null;
    history?: AdminVoucherHistoryItem;
  };
};

export async function getAdminCustomers() {
  const response = await apiRequest<CustomerListResponse>(
    '/api/vikof/admin/customers',
    {
      authMode: 'user',
    }
  );

  return response.data ?? [];
}

export async function useAdminCustomerVoucher(
  payload: UseAdminCustomerVoucherPayload
) {
  const customerId = Number(payload.customerId);

  if (!Number.isFinite(customerId) || customerId <= 0) {
    throw new Error('Khách hàng không hợp lệ.');
  }

  if (
    payload.voucherType !== 'FIRST_REGISTER' &&
    payload.voucherType !== 'STANDARD'
  ) {
    throw new Error('Loại voucher không hợp lệ.');
  }

  const voucherId =
    payload.voucherType === 'STANDARD'
      ? Number(payload.voucherId)
      : undefined;

  if (
    payload.voucherType === 'STANDARD' &&
    (!Number.isFinite(voucherId) || Number(voucherId) <= 0)
  ) {
    throw new Error('Voucher không hợp lệ.');
  }

  return apiRequest<UseAdminCustomerVoucherResponse>(
    '/api/vikof/admin/customers/use-voucher',
    {
      method: 'POST',
      authMode: 'user',
      body: {
        customerId,
        voucherType: payload.voucherType,
        ...(voucherId
          ? {
              voucherId,
            }
          : {}),
      },
    }
  );
}

export async function getAdminMessages() {
  const response = await apiRequest<MessageListResponse>(
    '/api/vikof/admin/messages',
    {
      authMode: 'user',
    }
  );

  return response.data ?? [];
}

export async function createAdminMessage(
  payload: CreateAdminMessagePayload
) {
  const cleanTitle = String(payload.title || '').trim();
  const cleanContent = String(payload.content || '').trim();
  const cleanSchedule = String(payload.schedule || '').trim();

  if (!cleanTitle) {
    throw new Error('Vui lòng nhập tiêu đề');
  }

  if (!cleanContent) {
    throw new Error('Vui lòng nhập nội dung');
  }

  if (!cleanSchedule) {
    throw new Error('Vui lòng chọn ngày giờ gửi');
  }

  return apiRequest<AdminMessageResponse>(
    '/api/vikof/admin/message',
    {
      method: 'POST',
      authMode: 'user',
      body: {
        title: cleanTitle,
        content: cleanContent,
        schedule: cleanSchedule,
      },
    }
  );
}

export async function updateAdminMessage(
  payload: UpdateAdminMessagePayload
) {
  const messageId = Number(payload.id);
  const cleanTitle = String(payload.title || '').trim();
  const cleanContent = String(payload.content || '').trim();
  const cleanSchedule = String(payload.schedule || '').trim();

  if (!Number.isFinite(messageId) || messageId <= 0) {
    throw new Error('Message không hợp lệ');
  }

  if (!cleanTitle) {
    throw new Error('Vui lòng nhập tiêu đề');
  }

  if (!cleanContent) {
    throw new Error('Vui lòng nhập nội dung');
  }

  if (!cleanSchedule) {
    throw new Error('Vui lòng chọn ngày giờ gửi');
  }

  return apiRequest<AdminMessageResponse>(
    `/api/vikof/admin/message-update/${messageId}`,
    {
      method: 'PUT',
      authMode: 'user',
      body: {
        title: cleanTitle,
        content: cleanContent,
        schedule: cleanSchedule,
      },
    }
  );
}
