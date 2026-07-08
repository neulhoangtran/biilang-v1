import { apiRequest } from './api';

export type AppNotificationItem = {
  id: string;
  documentId: string;
  title: string;
  shortDescription: string;
  content: string;
  time: string;
  raw?: Record<string, any>;
};

type RawNotificationItem = {
  id?: number | string;
  documentId?: string;
  Title?: string | null;
  ShortDescription?: string | null;
  Description?: string | null;
  ActiveDate?: string | null;
  createdAt?: string | null;
  publishedAt?: string | null;
  [key: string]: any;
};

type NotificationListResponse = {
  data?: RawNotificationItem[];
  meta?: {
    pagination?: {
      page?: number;
      pageSize?: number;
      pageCount?: number;
      total?: number;
    };
  };
};

type NotificationDetailResponse = {
  data?: RawNotificationItem | null;
};

type GetNotificationsOptions = {
  page?: number;
  pageSize?: number;
};

function getStringValue(value: unknown) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}

function stripHtml(value?: string | null) {
  return getStringValue(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatNotificationTime(value?: string | null) {
  const rawValue = getStringValue(value);

  if (!rawValue) {
    return '';
  }

  const date = new Date(rawValue);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mapNotification(
  item: RawNotificationItem
): AppNotificationItem {
  const id = getStringValue(item.id);
  const documentId =
    getStringValue(item.documentId) || id;
  const content = getStringValue(item.Description);
  const shortDescription = stripHtml(
    item.ShortDescription
  );
  const time = formatNotificationTime(
    item.ActiveDate ||
      item.publishedAt ||
      item.createdAt
  );

  return {
    id,
    documentId,
    title:
      getStringValue(item.Title) ||
      'Thông báo',
    shortDescription,
    content,
    time,
    raw: item,
  };
}

export async function getNotifications({
  page = 1,
  pageSize = 20,
}: GetNotificationsOptions = {}) {
  const response =
    await apiRequest<NotificationListResponse>(
      `/api/vikof/notifications?page=${page}&pageSize=${pageSize}`,
      {
        authMode: 'user',
      }
    );

  const pagination =
    response.meta?.pagination;

  return {
    items: (response.data ?? []).map(
      mapNotification
    ),
    page: pagination?.page ?? page,
    pageSize: pagination?.pageSize ?? pageSize,
    pageCount: pagination?.pageCount ?? 1,
    total: pagination?.total ?? response.data?.length ?? 0,
  };
}

export async function getNotificationDetail(
  documentId: string
) {
  const cleanDocumentId =
    getStringValue(documentId);

  if (!cleanDocumentId) {
    return null;
  }

  const response =
    await apiRequest<NotificationDetailResponse>(
      `/api/vikof/notifications/${encodeURIComponent(cleanDocumentId)}`,
      {
        authMode: 'user',
      }
    );

  return response.data
    ? mapNotification(response.data)
    : null;
}
