import { systemError } from '../../../utils/system-logger';

function getErrorStatus(error: any) {
  return Number(error?.status || 500);
}

function getErrorMessage(error: any, fallback: string) {
  return error?.message || fallback;
}

function sendErrorResponse(ctx: any, error: any, fallback: string) {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error, fallback);

  if (status === 401) {
    return ctx.unauthorized(message);
  }

  if (status === 403) {
    return ctx.forbidden(message);
  }

  if (status === 404) {
    return ctx.notFound(message);
  }

  if (status >= 400 && status < 500) {
    return ctx.badRequest(message);
  }

  return ctx.internalServerError(fallback);
}

function logControllerError({
  ctx,
  event,
  error,
}: {
  ctx: any;
  event: string;
  error: any;
}) {
  systemError({
    scope: 'admin',
    event,
    requestId: ctx.state?.requestId,
    userId: ctx.state?.user?.id,
    data: {
      path: ctx.path,
      method: ctx.method,
      errorName: error?.name,
      errorMessage: error?.message || String(error),
      errorStack: error?.stack,
    },
  });
}

function getAuthUserId(ctx: any) {
  const userId = Number(ctx.state?.user?.id);

  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

export default {
  async getAdminCustomers(ctx: any) {
    try {
      const authUserId = getAuthUserId(ctx);

      if (!authUserId) {
        return ctx.unauthorized('Bạn cần đăng nhập.');
      }

      const result = await strapi
        .service('api::vikof.vikof')
        .getAdminCustomers({
          authUserId,
          requestId: ctx.state?.requestId,
        });

      return ctx.send(result);
    } catch (error: any) {
      logControllerError({
        ctx,
        event: 'GET_ADMIN_CUSTOMERS_CONTROLLER_FAILED',
        error,
      });

      return sendErrorResponse(
        ctx,
        error,
        'Không tải được danh sách khách hàng.'
      );
    }
  },
  async useCustomerVoucher(ctx: any) {
    const authUserId = Number(
      ctx.state.user?.id
    );

    if (!authUserId) {
      return ctx.unauthorized(
        'Bạn cần đăng nhập.'
      );
    }

    const {
      customerId,
      voucherType,
      voucherId,
    } = ctx.request.body || {};

    const result = await strapi
      .service('api::vikof.vikof')
      .useAdminCustomerVoucher({
        authUserId,
        customerId,
        voucherType,
        voucherId,
        requestId:
          ctx.state.requestId,
      });

    ctx.body = result;
  },
  async getAdminMessages(ctx: any) {
    try {
      const authUserId = getAuthUserId(ctx);

      if (!authUserId) {
        return ctx.unauthorized('Bạn cần đăng nhập.');
      }

      const result = await strapi
        .service('api::vikof.vikof')
        .getAdminMessages({
          authUserId,
          requestId: ctx.state?.requestId,
        });

      return ctx.send(result);
    } catch (error: any) {
      logControllerError({
        ctx,
        event: 'GET_ADMIN_MESSAGES_CONTROLLER_FAILED',
        error,
      });

      return sendErrorResponse(
        ctx,
        error,
        'Không tải được danh sách thông báo.'
      );
    }
  },

  async createAdminMessage(ctx: any) {
    try {
      const authUserId = getAuthUserId(ctx);

      if (!authUserId) {
        return ctx.unauthorized('Bạn cần đăng nhập.');
      }

      const { title, content, schedule } = ctx.request.body ?? {};

      const result = await strapi
        .service('api::vikof.vikof')
        .createAdminMessage({
          authUserId,
          title,
          content,
          schedule,
          requestId: ctx.state?.requestId,
        });

      return ctx.send(result);
    } catch (error: any) {
      logControllerError({
        ctx,
        event: 'CREATE_ADMIN_MESSAGE_CONTROLLER_FAILED',
        error,
      });

      return sendErrorResponse(
        ctx,
        error,
        'Không tạo được thông báo.'
      );
    }
  },

  async updateAdminMessage(ctx: any) {
    try {
      const authUserId = getAuthUserId(ctx);

      if (!authUserId) {
        return ctx.unauthorized('Bạn cần đăng nhập.');
      }

      const { title, content, schedule } = ctx.request.body ?? {};

      const result = await strapi
        .service('api::vikof.vikof')
        .updateAdminMessage({
          authUserId,
          id: ctx.params.id,
          title,
          content,
          schedule,
          requestId: ctx.state?.requestId,
        });

      return ctx.send(result);
    } catch (error: any) {
      logControllerError({
        ctx,
        event: 'UPDATE_ADMIN_MESSAGE_CONTROLLER_FAILED',
        error,
      });

      return sendErrorResponse(
        ctx,
        error,
        'Không cập nhật được thông báo.'
      );
    }
  },
};