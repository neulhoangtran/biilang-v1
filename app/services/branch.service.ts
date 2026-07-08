import qs from 'qs';

import { apiRequest, API_BASE_URL } from './api';
import { getAuthToken } from './app-storage.service';

type StrapiImageFormat = {
  url: string;
  width?: number;
  height?: number;
};

type StrapiImageFormats = {
  thumbnail?: StrapiImageFormat;
  small?: StrapiImageFormat;
  medium?: StrapiImageFormat;
  large?: StrapiImageFormat;
};

export type StrapiMediaItem = {
  id: number;
  documentId?: string;
  name?: string;
  alternativeText?: string | null;
  width?: number;
  height?: number;
  url: string;
  formats?: StrapiImageFormats;
};

export type Branch = {
  id: number;
  documentId: string;

  Name: string;
  Slug: string;
  Area: string;
  Address: string;
  Phone: string | null;

  MapLink: string | null;
  MapImage?: StrapiMediaItem[] | null;

  Zalo?: string | null;
  Messenger?: string | null;
  MessengerWeb?: string | null;

  SortOrder?: number | null;
  WorkingTime?: string | null;
  DayOff?: string | null;

  createdAt: string;
  updatedAt: string;
  publishedAt: string;
};

type BranchListResponse = {
  data?: Branch[];
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
};

type BranchDetailResponse = {
  data?: Branch;
  meta?: Record<string, unknown>;
};

export type SelectBranchResponse = {
  user?: Record<string, unknown>;
  user_info?: Record<string, unknown>;
  branch?: Branch;
  nextStep?: 'HOME' | 'SELECT_BRANCH' | 'VERIFY_PHONE';
  message?: string;
  jwt?: string;
  token?: string;
};

const mediaFields = [
  'url',
  'formats',
  'name',
  'alternativeText',
  'width',
  'height',
];

function buildQuery(queryObject: Record<string, unknown>) {
  return qs.stringify(queryObject, {
    encode: false,
    encodeValuesOnly: true,
  });
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function getApiErrorMessage(data: any, fallback: string) {
  const message =
    data?.error?.message ||
    data?.message?.[0]?.messages?.[0]?.message ||
    data?.message;

  return typeof message === 'string' ? message : fallback;
}

const branchListQuery = buildQuery({
  populate: {
    MapImage: {
      fields: mediaFields,
    },
  },
  pagination: {
    pageSize: 100,
  },
  sort: ['SortOrder:asc', 'id:asc'],
});

const branchDetailQuery = buildQuery({
  populate: {
    MapImage: {
      fields: mediaFields,
    },
  },
});

export function getMediaUrl(media?: StrapiMediaItem | null) {
  if (!media?.url) return '';

  const url = media.url;

  return url?.startsWith('http') ? url : `${API_BASE_URL}${url}`;
}

export function getBranchImageUrl(branch?: Branch | null) {
  return getMediaUrl(branch?.MapImage?.[0] ?? null);
}

function sortBranchesBySortOrder(branches: Branch[]) {
  return [...branches].sort((a, b) => {
    const sortA =
      typeof a.SortOrder === 'number'
        ? a.SortOrder
        : Number.MAX_SAFE_INTEGER;

    const sortB =
      typeof b.SortOrder === 'number'
        ? b.SortOrder
        : Number.MAX_SAFE_INTEGER;

    if (sortA !== sortB) {
      return sortA - sortB;
    }

    return Number(a.id || 0) - Number(b.id || 0);
  });
}

export async function getBranches(): Promise<Branch[]> {
  const response = await apiRequest<BranchListResponse>(
    `/api/branches?${branchListQuery}`,
    {
      authMode: 'public',
    }
  );

  return sortBranchesBySortOrder(response.data ?? []);
}

export async function getBranchByDocumentId(
  documentId: string
): Promise<Branch | null> {
  if (!documentId) return null;

  const response = await apiRequest<BranchDetailResponse>(
    `/api/branches/${documentId}?${branchDetailQuery}`,
    {
      authMode: 'public',
    }
  );

  return response.data ?? null;
}

export async function selectBranchForCurrentUser(
  branch: Branch
): Promise<SelectBranchResponse> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error('Vui lòng đăng nhập lại');
  }

  const response = await fetch(`${API_BASE_URL}/api/vikof/profile/branch`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      branchId: branch.id,
      branchDocumentId: branch.documentId,
    }),
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      getApiErrorMessage(
        data,
        'Không thể chọn chi nhánh. Vui lòng thử lại.'
      )
    );
  }

  return data as SelectBranchResponse;
}