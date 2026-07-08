import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { getUserInfo } from '@/services/app-storage.service';

import {
  addWishlistItem,
  getLocalWishlistProductIds,
  removeWishlistItem,
  saveWishlistProductIdsToStorage,
} from '@/services/wishlist.service';

import {
  appEvents,
  APP_EVENTS,
} from '@/services/app-events.service';

function normalizeId(value?: string | number | null) {
  if (value === undefined || value === null) return '';

  return String(value).trim();
}

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map(item => normalizeId(item as string | number))
        .filter(Boolean)
    )
  );
}

export function useWishlist() {
  const [wishlistProductIds, setWishlistProductIds] = useState<string[]>([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  /**
   * Refresh local only:
   * Dùng cho lúc init nhanh hoặc khi event storage đã được cập nhật.
   */
  const refreshLocalWishlistProductIds = useCallback(async () => {
    const ids = await getLocalWishlistProductIds();
    const normalizedIds = normalizeIds(ids);

    setWishlistProductIds(normalizedIds);

    return normalizedIds;
  }, []);

  /**
   * Refresh chính:
   * - Nếu có userId: fetch wishlist mới nhất từ server rồi lưu lại storage.
   * - Nếu chưa login: chỉ đọc local.
   *
   * Đây là phần quan trọng để máy B nhận wishlist mà máy A vừa thay đổi.
   */
  const refreshWishlistProductIds = useCallback(async () => {
    const userInfo = await getUserInfo();
    const userId = normalizeId(userInfo?.id);

    if (!userId) {
      return refreshLocalWishlistProductIds();
    }

    try {
      const ids = await saveWishlistProductIdsToStorage(userId);
      const normalizedIds = normalizeIds(ids);

      setWishlistProductIds(normalizedIds);

      return normalizedIds;
    } catch (error) {
      console.log('[REFRESH_WISHLIST_FROM_SERVER_FAILED]', error);

      return refreshLocalWishlistProductIds();
    }
  }, [refreshLocalWishlistProductIds]);

  useEffect(() => {
    refreshLocalWishlistProductIds();

    const handleWishlistUpdated = (productIds: string[]) => {
      setWishlistProductIds(normalizeIds(productIds));
    };

    appEvents.on(
      APP_EVENTS.WISHLIST_UPDATED,
      handleWishlistUpdated
    );

    return () => {
      appEvents.off(
        APP_EVENTS.WISHLIST_UPDATED,
        handleWishlistUpdated
      );
    };
  }, [refreshLocalWishlistProductIds]);

  const isWishlisted = useCallback(
    (productIdValue?: string | number | null) => {
      const productId = normalizeId(productIdValue);

      if (!productId) return false;

      return wishlistProductIds.includes(productId);
    },
    [wishlistProductIds]
  );

  const addWishlist = useCallback(
    async (productIdValue?: string | number | null) => {
      const productId = normalizeId(productIdValue);

      if (!productId) {
        Alert.alert('Thiếu sản phẩm', 'Không tìm thấy mã sản phẩm.');

        return false;
      }

      const userInfo = await getUserInfo();
      const userId = normalizeId(userInfo?.id);

      if (!userId) {
        Alert.alert(
          'Chưa đăng nhập',
          'Vui lòng đăng nhập để thêm yêu thích.'
        );

        return false;
      }

      const previousIds = wishlistProductIds;

      setWishlistProductIds(prev =>
        Array.from(
          new Set([
            ...prev.map(normalizeId).filter(Boolean),
            productId,
          ])
        )
      );

      try {
        setWishlistLoading(true);

        await addWishlistItem({
          userId,
          productId,
        });

        await refreshWishlistProductIds();

        return true;
      } catch (error) {
        console.error('Add wishlist failed:', error);

        setWishlistProductIds(previousIds);

        await refreshWishlistProductIds();

        Alert.alert(
          'Không cập nhật được yêu thích',
          'Vui lòng thử lại sau.'
        );

        return false;
      } finally {
        setWishlistLoading(false);
      }
    },
    [
      refreshWishlistProductIds,
      wishlistProductIds,
    ]
  );

  const removeWishlist = useCallback(
    async (productIdValue?: string | number | null) => {
      const productId = normalizeId(productIdValue);

      if (!productId) {
        Alert.alert('Thiếu sản phẩm', 'Không tìm thấy mã sản phẩm.');

        return false;
      }

      const userInfo = await getUserInfo();
      const userId = normalizeId(userInfo?.id);

      if (!userId) {
        Alert.alert(
          'Chưa đăng nhập',
          'Vui lòng đăng nhập để cập nhật yêu thích.'
        );

        return false;
      }

      const previousIds = wishlistProductIds;

      setWishlistProductIds(prev =>
        prev
          .map(normalizeId)
          .filter(id => id && id !== productId)
      );

      try {
        setWishlistLoading(true);

        await removeWishlistItem({
          userId,
          productId,
        });

        await refreshWishlistProductIds();

        return true;
      } catch (error) {
        console.error('Remove wishlist failed:', error);

        setWishlistProductIds(previousIds);

        await refreshWishlistProductIds();

        Alert.alert(
          'Không cập nhật được yêu thích',
          'Vui lòng thử lại sau.'
        );

        return false;
      } finally {
        setWishlistLoading(false);
      }
    },
    [
      refreshWishlistProductIds,
      wishlistProductIds,
    ]
  );

  const toggleWishlist = useCallback(
    async (productIdValue?: string | number | null) => {
      const productId = normalizeId(productIdValue);

      if (!productId) {
        Alert.alert('Thiếu sản phẩm', 'Không tìm thấy mã sản phẩm.');

        return false;
      }

      if (isWishlisted(productId)) {
        return removeWishlist(productId);
      }

      return addWishlist(productId);
    },
    [
      addWishlist,
      isWishlisted,
      removeWishlist,
    ]
  );

  return {
    wishlistProductIds,
    wishlistLoading,
    refreshWishlistProductIds,
    isWishlisted,
    addWishlist,
    removeWishlist,
    toggleWishlist,
  };
}