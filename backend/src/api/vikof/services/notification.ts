import { systemError } from '../../../utils/system-logger';

const DEVICE_TOKEN_UID =
  'api::device-token.device-token';

const NOTIFICATION_UID =
  'api::notification.notification';

const USER_UID =
  'plugin::users-permissions.user';

type SaveDeviceTokenInput = {
  userId: number;
  token: string;
  platform: string;
  requestId?: string;
};

type ListForUserInput = {
  userId: number;
  page?: number | string;
  pageSize?: number | string;
};

type DetailForUserInput = {
  userId: number;
  documentId: string;
};

class NotificationServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'NotificationServiceError';
    this.status = status;
  }
}

function unauthorized(message: string): never {
  throw new NotificationServiceError(message, 401);
}

function notFound(message: string): never {
  throw new NotificationServiceError(message, 404);
}

function maskToken(token?: string) {
  if (!token) return '';

  if (token.length <= 16) {
    return '***';
  }

  return `${token.slice(0, 12)}...${token.slice(-6)}`;
}

function getPositiveNumber(
  value: unknown,
  fallback: number
) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return fallback;
  }

  return Math.floor(numberValue);
}

function getNumberId(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue > 0
    ? numberValue
    : null;
}

function getRelationValue(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function getRelationId(value: any) {
  const relation = getRelationValue(value);

  return getNumberId(relation?.id);
}

function getRelationDocumentId(value: any) {
  const relation = getRelationValue(value);

  return String(relation?.documentId || '').trim();
}

function getUserBranchId(user: any) {
  return (
    getRelationId(user?.Branch) ||
    getRelationId(user?.branch) ||
    getRelationId(user?.selectedBranch) ||
    getNumberId(user?.Branch) ||
    getNumberId(user?.branch) ||
    getNumberId(user?.selectedBranch)
  );
}

function getUserBranchDocumentId(user: any) {
  return (
    getRelationDocumentId(user?.Branch) ||
    getRelationDocumentId(user?.branch) ||
    getRelationDocumentId(user?.selectedBranch)
  );
}

function normalizeNotification(item: any) {
  return {
    id: item.id,
    documentId: item.documentId,
    Title: item.Title,
    ShortDescription: item.ShortDescription,
    Description: item.Description,
    ActiveDate: item.ActiveDate,
    SendTo: item.SendTo,
    Schedule: item.Schedule,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    publishedAt: item.publishedAt,
  };
}

async function getCurrentUser(userId: number) {
  if (!userId) {
    unauthorized('Bạn cần đăng nhập.');
  }

  const user = await strapi.db
    .query(USER_UID)
    .findOne({
      where: {
        id: userId,
      },
      populate: {
        Branch: true,
      },
    } as any);

  if (!user) {
    unauthorized('Không tìm thấy tài khoản.');
  }

  return user as any;
}

function buildBranchTargetFilters(user: any) {
  const branchDocumentId =
    getUserBranchDocumentId(user);
  const branchId = getUserBranchId(user);
  const filters: any[] = [];

  if (branchDocumentId) {
    filters.push({
      SendTo: {
        $eq: 'Branch',
      },
      Branch: {
        documentId: {
          $eq: branchDocumentId,
        },
      },
    });
  }

  if (branchId) {
    filters.push({
      SendTo: {
        $eq: 'Branch',
      },
      Branch: {
        id: {
          $eq: branchId,
        },
      },
    });
  }

  return filters;
}

function buildNotificationTargetWhere(user: any) {
  const userId = getNumberId(user?.id);
  const targetFilters: any[] = [
    {
      SendTo: {
        $eq: 'All',
      },
    },
  ];

  if (userId) {
    targetFilters.push({
      SendTo: {
        $eq: 'User',
      },
      Users: {
        id: {
          $eq: userId,
        },
      },
    });
  }

  targetFilters.push(
    ...buildBranchTargetFilters(user)
  );

  return targetFilters;
}

function buildNotificationWhere(user: any) {
  return {
    isActive: {
      $eq: true,
    },
    publishedAt: {
      $notNull: true,
    },
    ActiveDate: {
      $lte: new Date().toISOString(),
    },
    $or: buildNotificationTargetWhere(user),
  };
}

async function findNotificationForUser({
  user,
  documentId,
}: {
  user: any;
  documentId: string;
}) {
  if (!documentId) {
    notFound('Thiếu thông tin thông báo.');
  }

  const items = await strapi.db
    .query(NOTIFICATION_UID)
    .findMany({
      where: {
        ...buildNotificationWhere(user),
        documentId,
      },
      limit: 1,
    } as any);

  const item = items?.[0];

  if (!item) {
    notFound('Không tìm thấy thông báo.');
  }

  return item;
}

export default {
  async saveDeviceToken(input: SaveDeviceTokenInput) {
    const {
      userId,
      token,
      platform,
      requestId,
    } = input;

    try {
      const now = new Date().toISOString();

      const existingTokens = await strapi
        .documents(DEVICE_TOKEN_UID)
        .findMany({
          filters: {
            Token: {
              $eq: token,
            },
          },
          populate: {
            User: true,
          },
          limit: 1,
        } as any);

      const existingToken = Array.isArray(existingTokens)
        ? existingTokens[0]
        : null;

      if (existingToken?.documentId) {
        const updatedToken = await strapi
          .documents(DEVICE_TOKEN_UID)
          .update({
            documentId: existingToken.documentId,
            data: {
              Platform: platform,
              IsActive: true,
              User: userId,
              LastSeenAt: now,
            },
          } as any);

        return {
          isNew: false,
          data: updatedToken,
        };
      }

      const createdToken = await strapi
        .documents(DEVICE_TOKEN_UID)
        .create({
          data: {
            Token: token,
            Platform: platform,
            IsActive: true,
            User: userId,
            LastSeenAt: now,
          },
        } as any);

      return {
        isNew: true,
        data: createdToken,
      };
    } catch (error: any) {
      systemError({
        scope: 'notification',
        event: 'SAVE_DEVICE_TOKEN_FAILED',
        requestId,
        userId,
        data: {
          platform,
          token: maskToken(token),
          errorName: error?.name,
          errorMessage: error?.message || String(error),
          errorStack: error?.stack,
        },
      });

      throw error;
    }
  },

  async listForUser(input: ListForUserInput) {
    const user = await getCurrentUser(input.userId);
    const page = getPositiveNumber(input.page, 1);
    const pageSize = Math.min(
      getPositiveNumber(input.pageSize, 20),
      50
    );
    const start = (page - 1) * pageSize;
    const where = buildNotificationWhere(user);

    const [items, total] = await Promise.all([
      strapi.db
        .query(NOTIFICATION_UID)
        .findMany({
          where,
          orderBy: [
            {
              ActiveDate: 'desc',
            },
            {
              id: 'desc',
            },
          ],
          offset: start,
          limit: pageSize,
        } as any),
      strapi.db
        .query(NOTIFICATION_UID)
        .count({
          where,
        } as any),
    ]);

    const pageCount = Math.max(
      1,
      Math.ceil(total / pageSize)
    );

    return {
      data: items.map(normalizeNotification),
      meta: {
        pagination: {
          page,
          pageSize,
          pageCount,
          total,
        },
      },
    };
  },

  async detailForUser(input: DetailForUserInput) {
    const user = await getCurrentUser(input.userId);
    const notification =
      await findNotificationForUser({
        user,
        documentId: input.documentId,
      });

    return normalizeNotification(notification);
  },
};
