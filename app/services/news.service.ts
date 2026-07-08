import qs from 'qs';
import type { ImageSourcePropType } from 'react-native';

import {
  apiRequest,
  API_BASE_URL,
} from './api';

const BLANK_NEWS_IMAGE = require('@/assets/images/blank400x400.png');

export type NewsMedia = {
  id?: number;
  documentId?: string;
  url?: string;
  width?: number;
  height?: number;
};

export type NewsItem = {
  id: number;
  documentId: string;
  Title: string;
  ShortDescription?: string | null;
  Description?: string | null;
  FeatureImage?: NewsMedia | null;
  View?: string | number | null;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
};

type NewsListResponse = {
  data?: NewsItem[];
};

type NewsDetailResponse = {
  data?: NewsItem;
};

type IncreaseNewsViewResponse = {
  data?: {
    id?: number;
    documentId?: string;
    Title?: string;
    View?: string | number | null;
    publishedAt?: string;
  };
};

const newsFields = [
  'Title',
  'ShortDescription',
  'Description',
  'View',
  'createdAt',
  'updatedAt',
  'publishedAt',
];

const mediaFields = [
  'url',
  'width',
  'height',
];

function buildQuery(queryObject: Record<string, unknown>) {
  return qs.stringify(queryObject, {
    encode: false,
    encodeValuesOnly: true,
  });
}

function normalizeMediaUrl(url?: string | null) {
  if (!url) {
    return '';
  }

  return url.startsWith('http')
    ? url
    : `${API_BASE_URL}${url}`;
}

export function getNewsImageUrl(news?: NewsItem | null) {
  return normalizeMediaUrl(news?.FeatureImage?.url);
}

export function getNewsImageSource(
  news?: NewsItem | null
): ImageSourcePropType {
  const url = getNewsImageUrl(news);

  if (!url) {
    return BLANK_NEWS_IMAGE;
  }

  return { uri: url };
}

export function getNewsImageAspectRatio(news?: NewsItem | null) {
  const width = Number(news?.FeatureImage?.width);
  const height = Number(news?.FeatureImage?.height);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return 16 / 9;
  }

  if (width <= 0 || height <= 0) {
    return 16 / 9;
  }

  return width / height;
}

export function getNewsViewCount(news?: NewsItem | null) {
  const value = Number(news?.View || 0);

  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return value;
}

export async function getNewsList() {
  const query = buildQuery({
    fields: newsFields,

    populate: {
      FeatureImage: {
        fields: mediaFields,
      },
    },

    pagination: {
      pageSize: 100,
    },

    sort: ['publishedAt:desc'],
  });

  const response =
    await apiRequest<NewsListResponse>(
      `/api/newss?${query}`,
      {
        authMode: 'public',
      }
    );

  return response.data ?? [];
}

export async function getNewsDetail(documentId: string) {
  const cleanDocumentId = String(
    documentId || ''
  ).trim();

  if (!cleanDocumentId) {
    return null;
  }

  const query = buildQuery({
    fields: newsFields,

    populate: {
      FeatureImage: {
        fields: mediaFields,
      },
    },
  });

  const response =
    await apiRequest<NewsDetailResponse>(
      `/api/newss/${encodeURIComponent(
        cleanDocumentId
      )}?${query}`,
      {
        authMode: 'public',
      }
    );

  return response.data ?? null;
}

export async function increaseNewsView(
  documentId: string
) {
  const cleanDocumentId = String(
    documentId || ''
  ).trim();

  if (!cleanDocumentId) {
    return null;
  }

  const response =
    await apiRequest<IncreaseNewsViewResponse>(
      `/api/vikof/news-view/${encodeURIComponent(
        cleanDocumentId
      )}`,
      {
        method: 'POST',
        authMode: 'none',
      }
    );

  return response.data ?? null;
}
