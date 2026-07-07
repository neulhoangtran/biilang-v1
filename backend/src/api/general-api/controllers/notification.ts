import { systemError } from '../../../utils/system-logger';

function getErrorLogData(error: any) {
  return {
    errorName: error?.name,
    errorMessage: error?.message || String(error),
    errorStack: error?.stack,
  };
}

function sendServiceError(
  ctx: any,
  error: any,
  fallbackMessage: string
) {
  const status = Number(error?.status || 500);

  ctx.status = status;
  ctx.body = {
    data: null,
    error: {
      status,
      name: error?.name || 'NotificationError',
      message: error?.message || fallbackMessage,
    },
  };
}

export default {
  async saveDeviceToken(ctx: any) {
    const requestId = ctx.state?.requestId;
    const user = ctx.state?.user;

    try {
      if (!user?.id) {
        return ctx.unauthorized('Bạn cần đăng nhập.');
      }

      const { token, platform } = ctx.request.body || {};

      const cleanToken = String(token || '').trim();
      const cleanPlatform = String(platform || 'other')
        .trim()
        .toLowerCase();

      if (!cleanToken) {
        return ctx.badRequest('Missing device token.');
      }

      const allowedPlatforms = [
        'ios',
        'android',
        'web',
        'other',
      ];

      if (!allowedPlatforms.includes(cleanPlatform)) {
        return ctx.badRequest('Invalid platform.');
      }

      const result = await strapi
        .service('api::vikof.notification')
        .saveDeviceToken({
          userId: user.id,
          token: cleanToken,
          platform: cleanPlatform,
          requestId,
        });

      return ctx.send({
        success: true,
        message: result.isNew
          ? 'Device token saved.'
          : 'Device token updated.',
        data: {
          id: result.data?.id,
          documentId: result.data?.documentId,
          platform: result.data?.Platform,
          isActive: result.data?.IsActive,
          lastSeenAt: result.data?.LastSeenAt,
        },
      });
    } catch (error: any) {
      systemError({
        scope: 'notification',
        event: 'SAVE_DEVICE_TOKEN_CONTROLLER_FAILED',
        requestId,
        userId: user?.id,
        data: {
          path: ctx.path,
          method: ctx.method,
          ...getErrorLogData(error),
        },
      });

      return ctx.internalServerError(
        'Không thể lưu device token.'
      );
    }
  },

  async list(ctx: any) {
    const requestId = ctx.state?.requestId;
    const user = ctx.state?.user;

    try {
      if (!user?.id) {
        return ctx.unauthorized('Bạn cần đăng nhập.');
      }

      const data = await strapi
        .service('api::vikof.notification')
        .listForUser({
          userId: user.id,
          page: ctx.query?.page,
          pageSize: ctx.query?.pageSize,
        });

      return ctx.send(data);
    } catch (error: any) {
      systemError({
        scope: 'notification',
        event: 'LIST_NOTIFICATIONS_CONTROLLER_FAILED',
        requestId,
        userId: user?.id,
        data: {
          path: ctx.path,
          method: ctx.method,
          ...getErrorLogData(error),
        },
      });

      return sendServiceError(
        ctx,
        error,
        'Không thể tải danh sách thông báo.'
      );
    }
  },

  async detail(ctx: any) {
    const requestId = ctx.state?.requestId;
    const user = ctx.state?.user;

    try {
      if (!user?.id) {
        return ctx.unauthorized('Bạn cần đăng nhập.');
      }

      const documentId = String(
        ctx.params?.documentId || ''
      ).trim();

      const data = await strapi
        .service('api::vikof.notification')
        .detailForUser({
          userId: user.id,
          documentId,
        });

      return ctx.send({
        data,
      });
    } catch (error: any) {
      systemError({
        scope: 'notification',
        event: 'GET_NOTIFICATION_DETAIL_CONTROLLER_FAILED',
        requestId,
        userId: user?.id,
        data: {
          path: ctx.path,
          method: ctx.method,
          documentId: ctx.params?.documentId,
          ...getErrorLogData(error),
        },
      });

      return sendServiceError(
        ctx,
        error,
        'Không thể tải thông báo.'
      );
    }
  },
};
