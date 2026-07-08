import { systemError } from '../../../utils/system-logger';

function getAuthUserId(ctx: any) {
  const userId = Number(ctx.state?.user?.id);

  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

function getErrorStatus(error: any) {
  return Number(error?.status || 500);
}

function getErrorMessage(error: any, fallback: string) {
  return error?.message || fallback;
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
  if (error?.logged) {
    return;
  }

  systemError({
    scope: 'auth',
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

export default {
  async getProfile(ctx: any) {
    try {
      const authUserId = getAuthUserId(ctx);

      if (!authUserId) {
        return ctx.unauthorized('Bạn cần đăng nhập.');
      }

      const result = await strapi
        .service('api::general-api.profile')
        .getProfile({
          authUserId,
          requestId: ctx.state?.requestId,
        });

      return ctx.send(result);
    } catch (error: any) {
      logControllerError({
        ctx,
        event: 'PROFILE_GET_CONTROLLER_FAILED',
        error,
      });

      return sendErrorResponse(
        ctx,
        error,
        'Không tải được thông tin tài khoản.'
      );
    }
  },

  async selectBranch(ctx: any) {
    try {
      const authUserId = getAuthUserId(ctx);

      if (!authUserId) {
        return ctx.unauthorized('Vui lòng đăng nhập');
      }

      const { branchId, branchDocumentId } = ctx.request.body ?? {};

      const result = await strapi
        .service('api::general-api.profile')
        .selectBranch({
          authUserId,
          requestId: ctx.state?.requestId,
          branchId,
          branchDocumentId,
        });

      return ctx.send(result);
    } catch (error: any) {
      logControllerError({
        ctx,
        event: 'PROFILE_SELECT_BRANCH_CONTROLLER_FAILED',
        error,
      });

      return sendErrorResponse(
        ctx,
        error,
        'Không chọn được chi nhánh.'
      );
    }
  },

  async updateProfile(ctx: any) {
    try {
      const authUserId = getAuthUserId(ctx);

      if (!authUserId) {
        return ctx.unauthorized('Bạn cần đăng nhập.');
      }

      const {
        FirstName,
        LastName,
        email,
        DateOfBirth,
        Sex,
        Avatar,
      } = ctx.request.body ?? {};

      const result = await strapi
        .service('api::general-api.profile')
        .updateProfile({
          authUserId,
          requestId: ctx.state?.requestId,
          FirstName,
          LastName,
          email,
          DateOfBirth,
          Sex,
          Avatar,
        });

      return ctx.send(result);
    } catch (error: any) {
      logControllerError({
        ctx,
        event: 'PROFILE_UPDATE_CONTROLLER_FAILED',
        error,
      });

      return sendErrorResponse(
        ctx,
        error,
        'Không cập nhật được hồ sơ.'
      );
    }
  },

  async uploadAvatar(ctx: any) {
    try {
      const authUserId = getAuthUserId(ctx);

      if (!authUserId) {
        return ctx.unauthorized('Bạn cần đăng nhập.');
      }

      const result = await strapi
        .service('api::general-api.profile')
        .uploadAvatar({
          authUserId,
          requestId: ctx.state?.requestId,
          files: ctx.request.files?.files,
        });

      return ctx.send(result);
    } catch (error: any) {
      logControllerError({
        ctx,
        event: 'PROFILE_UPLOAD_AVATAR_CONTROLLER_FAILED',
        error,
      });

      return sendErrorResponse(
        ctx,
        error,
        'Upload avatar thất bại.'
      );
    }
  },

  async changePassword(ctx: any) {
    try {
      const authUserId = getAuthUserId(ctx);

      if (!authUserId) {
        return ctx.unauthorized('Bạn cần đăng nhập.');
      }

      const { currentPassword, newPassword } = ctx.request.body ?? {};

      const result = await strapi
        .service('api::general-api.profile')
        .changePassword({
          authUserId,
          requestId: ctx.state?.requestId,
          currentPassword,
          newPassword,
        });

      return ctx.send(result);
    } catch (error: any) {
      logControllerError({
        ctx,
        event: 'PROFILE_CHANGE_PASSWORD_CONTROLLER_FAILED',
        error,
      });

      return sendErrorResponse(
        ctx,
        error,
        'Không đổi được mật khẩu.'
      );
    }
  },
};