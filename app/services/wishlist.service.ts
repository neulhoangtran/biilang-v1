import qs from 'qs';

import { apiRequest } from './api';
import { getAppConfig, updateAppConfig } from './app-storage.service';
import {
  appEvents,
  APP_EVENTS,
} from './app-events.service';

export type WishlistItem = {
  id: number;
  documentId?: string;
  UserId: string;
  ProductId: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
};

type WishlistListResponse = {
  data?: WishlistItem[];
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
};

type WishlistDetailResponse = {
  data?: WishlistItem;
  meta?: Record<string, unknown>;
};

function buildQuery(queryObject: Record<string, unknown>) {
  return qs.stringify(queryObject, {
    encode: false,
    encodeValuesOnly: true,
  });
}

function normalizeId(value?: string | number | null) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function normalizeProductIds(ids: unknown) {
  if (!Array.isArray(ids)) return [];

  return Array.from(
    new Set(
      ids
        .map(item => normalizeId(item as string | number))
        .filter(Boolean)
    )
  );
}

export async function getWishlistItemsByUserId(
  userId: string | number
): Promise<WishlistItem[]> {
  const cleanUserId = normalizeId(userId);

  if (!cleanUserId) return [];

  const query = buildQuery({
    filters: {
      UserId: {
        $eq: cleanUserId,
      },
    },
    pagination: {
      pageSize: 500,
    },
    sort: ['id:desc'],
  });

  const response = await apiRequest<WishlistListResponse>(
    `/api/wishlists?${query}`
  );

  return response.data ?? [];
}

export async function findWishlistItem(params: {
  userId: string | number;
  productId: string | number;
}): Promise<WishlistItem | null> {
  const cleanUserId = normalizeId(params.userId);
  const cleanProductId = normalizeId(params.productId);

  if (!cleanUserId || !cleanProductId) return null;

  const query = buildQuery({
    filters: {
      UserId: {
        $eq: cleanUserId,
      },
      ProductId: {
        $eq: cleanProductId,
      },
    },
    pagination: {
      pageSize: 1,
    },
  });

  const response = await apiRequest<WishlistListResponse>(
    `/api/wishlists?${query}`
  );

  return response.data?.[0] ?? null;
}

export async function saveWishlistProductIdsToStorage(
  userId: string | number
) {
  const cleanUserId = normalizeId(userId);

  if (!cleanUserId) {
    await updateAppConfig({
      wishlist_product_ids: [],
    });

    return [];
  }

  const items = await getWishlistItemsByUserId(cleanUserId);

  const productIds = Array.from(
    new Set(
      items
        .map(item => normalizeId(item.ProductId))
        .filter(Boolean)
    )
  );

  await updateAppConfig({
    wishlist_product_ids: productIds,
  });

  appEvents.emit(
    APP_EVENTS.WISHLIST_UPDATED,
    productIds
  );

  return productIds;
}

export async function getLocalWishlistProductIds(): Promise<string[]> {
  const config = await getAppConfig();

  return normalizeProductIds(config.wishlist_product_ids);
}

export async function isProductWishlisted(productId: string | number) {
  const cleanProductId = normalizeId(productId);

  if (!cleanProductId) return false;

  const ids = await getLocalWishlistProductIds();

  return ids.includes(cleanProductId);
}

export async function addWishlistItem(params: {
  userId: string | number;
  productId: string | number;
}): Promise<WishlistItem | null> {
  const cleanUserId = normalizeId(params.userId);
  const cleanProductId = normalizeId(params.productId);

  if (!cleanUserId || !cleanProductId) {
    throw new Error('Missing userId or productId');
  }

  const existingItem = await findWishlistItem({
    userId: cleanUserId,
    productId: cleanProductId,
  });

  if (existingItem) {
    await saveWishlistProductIdsToStorage(cleanUserId);
    return existingItem;
  }

  const response = await apiRequest<WishlistDetailResponse>('/api/wishlists', {
    method: 'POST',
    body: {
      data: {
        UserId: cleanUserId,
        ProductId: cleanProductId,
      },
    },
  });

  await saveWishlistProductIdsToStorage(cleanUserId);

  return response.data ?? null;
}

export async function removeWishlistItem(params: {
  userId: string | number;
  productId: string | number;
}) {
  const cleanUserId = normalizeId(params.userId);
  const cleanProductId = normalizeId(params.productId);

  if (!cleanUserId || !cleanProductId) {
    throw new Error('Missing userId or productId');
  }

  const existingItem = await findWishlistItem({
    userId: cleanUserId,
    productId: cleanProductId,
  });

  if (!existingItem) {
    await saveWishlistProductIdsToStorage(cleanUserId);
    return false;
  }

  const targetId = existingItem.documentId || existingItem.id;

  await apiRequest(`/api/wishlists/${targetId}`, {
    method: 'DELETE',
  });

  await saveWishlistProductIdsToStorage(cleanUserId);

  return true;
}

export async function toggleWishlistItem(params: {
  userId: string | number;
  productId: string | number;
}) {
  const cleanUserId = normalizeId(params.userId);
  const cleanProductId = normalizeId(params.productId);

  if (!cleanUserId || !cleanProductId) {
    throw new Error('Missing userId or productId');
  }

  const existingItem = await findWishlistItem({
    userId: cleanUserId,
    productId: cleanProductId,
  });

  if (existingItem) {
    await removeWishlistItem({
      userId: cleanUserId,
      productId: cleanProductId,
    });

    return {
      added: false,
    };
  }

  await addWishlistItem({
    userId: cleanUserId,
    productId: cleanProductId,
  });

  return {
    added: true,
  };
}