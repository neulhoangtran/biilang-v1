function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function normalizePlatform(value: unknown) {
  const platform = normalizeText(value).toLowerCase();

  if (['ios', 'android', 'web'].includes(platform)) {
    return platform;
  }

  return 'unknown';
}

function getHeader(ctx: any, name: string) {
  const headers = ctx.request?.headers || {};
  const lowerName = name.toLowerCase();

  return normalizeText(headers[lowerName] || headers[name] || '');
}

function getUserName(user: any) {
  const customName = normalizeText(user?.CustomName);

  if (customName) {
    return customName;
  }

  const fullName = [
    user?.LastName || user?.lastName,
    user?.FirstName || user?.firstName,
  ]
    .map(item => normalizeText(item))
    .filter(Boolean)
    .join(' ')
    .trim();

  return (
    fullName ||
    normalizeText(user?.username) ||
    normalizeText(user?.email) ||
    ''
  );
}

function shouldTrackPath(path: string) {
  const cleanPath = normalizeText(path).toLowerCase();

  if (!cleanPath) {
    return false;
  }

  /**
   * Chỉ track API của app.
   * Không track admin, upload static, content-manager...
   */
  return (
    cleanPath.startsWith('/api/app') ||
    cleanPath.startsWith('/api/general-api') ||
    cleanPath.startsWith('/api/auth') ||
    cleanPath.startsWith('/api/users') ||
    cleanPath.startsWith('/api/upload')
  );
}

function getActivityUser(ctx: any) {
  return ctx.state?.user || null;
}

function getActivityIdentity({
  userId,
  guestId,
  deviceId,
}: {
  userId: number | null;
  guestId: string;
  deviceId: string;
}) {
  if (userId) {
    return {
      identityType: 'user',
      identityKey: String(userId),
    };
  }

  if (guestId) {
    return {
      identityType: 'guest',
      identityKey: guestId,
    };
  }

  if (deviceId) {
    return {
      identityType: 'device',
      identityKey: deviceId,
    };
  }

  return {
    identityType: 'anonymous',
    identityKey: 'anonymous',
  };
}

function getDateRangeFilter({
  startDate,
  endDate,
}: {
  startDate?: string;
  endDate?: string;
}) {
  const filter: any = {};

  if (startDate) {
    filter.$gte = new Date(startDate).toISOString();
  }

  if (endDate) {
    filter.$lte = new Date(endDate).toISOString();
  }

  return Object.keys(filter).length > 0 ? filter : undefined;
}

export default () => ({
  async createRequestActivity({
    ctx,
    status,
    durationMs,
    error,
  }: {
    ctx: any;
    status?: number;
    durationMs?: number;
    error?: any;
  }) {
    const path = normalizeText(ctx.path);

    if (!shouldTrackPath(path)) {
      return null;
    }

    const user = getActivityUser(ctx);
    const userId = user?.id ? Number(user.id) : null;

    const requestId =
      normalizeText(ctx.state?.requestId) ||
      getHeader(ctx, 'x-request-id');

    const platform = normalizePlatform(
      getHeader(ctx, 'x-platform')
    );

    const appVersion = getHeader(ctx, 'x-app-version');
    const deviceId = getHeader(ctx, 'x-device-id');
    const guestId = getHeader(ctx, 'x-guest-id');
    const screenName = getHeader(ctx, 'x-screen-name');

    const eventName = error ? 'REQUEST_FAILED' : 'REQUEST';
    const occurredAt = new Date().toISOString();

    try {
      const data: any = {
        UserId: userId,
        UserEmail: normalizeText(user?.email),
        UserName: getUserName(user),

        GuestId: guestId || null,
        DeviceId: deviceId || null,

        EventName: eventName,
        ScreenName: screenName || null,

        Path: path,
        Method: normalizeText(ctx.method).toUpperCase(),
        Status: Number(status || ctx.status || error?.status || 500),
        DurationMs: Number(durationMs || 0),

        RequestId: requestId || null,

        Platform: platform,
        AppVersion: appVersion || null,

        Ip: normalizeText(ctx.ip),
        UserAgent: normalizeText(
          ctx.request?.headers?.['user-agent']
        ),

        OccurredAt: occurredAt,

        Metadata: {
          query: ctx.query || {},
          errorName: error?.name,
          errorMessage: error?.message || undefined,
        },
      };

      if (userId) {
        data.User = userId;
      }

      const created = await strapi.entityService.create(
        'api::user-activity.user-activity' as any,
        {
          data,
        } as any
      );

      return created;
    } catch (activityError: any) {
      strapi.log.error('[GENERAL_API_CREATE_USER_ACTIVITY_FAILED]', {
        path,
        method: ctx.method,
        status,
        durationMs,
        userId,
        requestId,
        errorName: activityError?.name,
        errorMessage:
          activityError?.message || String(activityError),
        errorStack: activityError?.stack,
      });

      return null;
    }
  },

  async getGroupedActivities(input?: {
    page?: number;
    pageSize?: number;
    startDate?: string;
    endDate?: string;
    platform?: string;
    keyword?: string;
  }) {
    const page = Math.max(Number(input?.page || 1), 1);
    const pageSize = Math.min(
      Math.max(Number(input?.pageSize || 20), 1),
      100
    );

    const start = (page - 1) * pageSize;
    const limit = pageSize;

    const occurredAtFilter = getDateRangeFilter({
      startDate: input?.startDate,
      endDate: input?.endDate,
    });

    const filters: any = {};

    if (occurredAtFilter) {
      filters.OccurredAt = occurredAtFilter;
    }

    if (input?.platform) {
      filters.Platform = {
        $eq: normalizePlatform(input.platform),
      };
    }

    if (input?.keyword) {
      const keyword = normalizeText(input.keyword);

      filters.$or = [
        {
          UserEmail: {
            $containsi: keyword,
          },
        },
        {
          UserName: {
            $containsi: keyword,
          },
        },
        {
          GuestId: {
            $containsi: keyword,
          },
        },
        {
          DeviceId: {
            $containsi: keyword,
          },
        },
      ];
    }

    /**
     * Lấy nhiều activity mới nhất rồi group bằng JS.
     * Giai đoạn đầu đủ dùng, dễ maintain.
     * Sau này data lớn thì đổi sang raw SQL GROUP BY.
     */
    const activities = await strapi.entityService.findMany(
      'api::user-activity.user-activity' as any,
      {
        filters,
        sort: {
          OccurredAt: 'desc',
        },
        limit: 5000,
        populate: {
          User: {
            fields: ['id', 'username', 'email'],
          },
        },
      } as any
    );

    const groupMap = new Map<string, any>();

    for (const activity of activities as any[]) {
      const userId = activity.UserId
        ? Number(activity.UserId)
        : null;

      const guestId = normalizeText(activity.GuestId);
      const deviceId = normalizeText(activity.DeviceId);

      const {
        identityType,
        identityKey,
      } = getActivityIdentity({
        userId,
        guestId,
        deviceId,
      });

      const groupKey = `${identityType}:${identityKey}`;

      const current = groupMap.get(groupKey);

      if (!current) {
        groupMap.set(groupKey, {
          groupKey,
          identityType,
          identityKey,

          userId,
          userEmail: activity.UserEmail || '',
          userName: activity.UserName || '',
          guestId,
          deviceId,

          platform: activity.Platform || 'unknown',
          appVersion: activity.AppVersion || '',

          lastActivityAt: activity.OccurredAt,
          lastEventName: activity.EventName,
          lastScreenName: activity.ScreenName,
          lastPath: activity.Path,
          lastMethod: activity.Method,
          lastStatus: activity.Status,

          activityCount: 1,
          latestActivity: activity,
        });

        continue;
      }

      current.activityCount += 1;

      /**
       * Vì list đã sort OccurredAt desc,
       * record đầu tiên là latestActivity.
       */
      groupMap.set(groupKey, current);
    }

    const groupedItems = Array.from(groupMap.values()).sort(
      (a, b) =>
        new Date(b.lastActivityAt).getTime() -
        new Date(a.lastActivityAt).getTime()
    );

    const pagedItems = groupedItems.slice(start, start + limit);

    return {
      data: pagedItems,
      pagination: {
        page,
        pageSize,
        total: groupedItems.length,
        pageCount: Math.ceil(groupedItems.length / pageSize),
      },
    };
  },

  async getActivitiesByIdentity(input: {
    identityType: 'user' | 'guest' | 'device' | 'anonymous';
    identityKey: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(Number(input?.page || 1), 1);
    const pageSize = Math.min(
      Math.max(Number(input?.pageSize || 50), 1),
      200
    );

    const start = (page - 1) * pageSize;
    const identityType = normalizeText(input.identityType);
    const identityKey = normalizeText(input.identityKey);

    const filters: any = {};

    if (identityType === 'user') {
      filters.UserId = {
        $eq: Number(identityKey),
      };
    } else if (identityType === 'guest') {
      filters.GuestId = {
        $eq: identityKey,
      };
    } else if (identityType === 'device') {
      filters.DeviceId = {
        $eq: identityKey,
      };
    } else {
      filters.UserId = {
        $null: true,
      };
      filters.GuestId = {
        $null: true,
      };
      filters.DeviceId = {
        $null: true,
      };
    }

    const [activities, total] = await Promise.all([
      strapi.entityService.findMany(
        'api::user-activity.user-activity' as any,
        {
          filters,
          sort: {
            OccurredAt: 'desc',
          },
          start,
          limit: pageSize,
          populate: {
            User: {
              fields: ['id', 'username', 'email'],
            },
          },
        } as any
      ),
      strapi.entityService.count(
        'api::user-activity.user-activity' as any,
        {
          filters,
        } as any
      ),
    ]);

    return {
      data: activities,
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  },
});