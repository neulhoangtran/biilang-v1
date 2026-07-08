import { systemError } from '../../../utils/system-logger';

function getErrorStatus(error: any) {
  return Number(error?.status || 500);
}

function getErrorMessage(error: any, fallback: string) {
  return error?.message || fallback;
}

function logAuthError({
  ctx,
  event,
  error,
}: {
  ctx: any;
  event: string;
  error: any;
}) {
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

  if (status >= 400 && status < 500) {
    return ctx.badRequest(message);
  }

  return ctx.internalServerError(fallback);
}

export default {
  async register(ctx: any) {
    try {
      const result = await strapi
        .service('api::general-api.auth')
        .register(ctx.request.body ?? {});

      return ctx.send(result);
    } catch (error: any) {
      logAuthError({
        ctx,
        event: 'AUTH_REGISTER_FAILED',
        error,
      });

      return sendErrorResponse(ctx, error, 'Đăng ký thất bại.');
    }
  },

  async login(ctx: any) {
    try {
      const result = await strapi
        .service('api::general-api.auth')
        .login(ctx.request.body ?? {});

      return ctx.send(result);
    } catch (error: any) {
      logAuthError({
        ctx,
        event: 'AUTH_LOGIN_FAILED',
        error,
      });

      return sendErrorResponse(ctx, error, 'Đăng nhập thất bại.');
    }
  },

  async sendLoginOtp(ctx: any) {
    try {
      const result = await strapi
        .service('api::general-api.auth')
        .sendLoginOtp(ctx.request.body ?? {});

      return ctx.send(result);
    } catch (error: any) {
      logAuthError({
        ctx,
        event: 'AUTH_SEND_LOGIN_OTP_FAILED',
        error,
      });

      return sendErrorResponse(ctx, error, 'Không thể gửi OTP.');
    }
  },

  async verifyLoginOtp(ctx: any) {
    try {
      const result = await strapi
        .service('api::general-api.auth')
        .verifyLoginOtp(ctx.request.body ?? {});

      return ctx.send(result);
    } catch (error: any) {
      logAuthError({
        ctx,
        event: 'AUTH_VERIFY_LOGIN_OTP_FAILED',
        error,
      });

      return sendErrorResponse(ctx, error, 'Mã OTP không hợp lệ');
    }
  },

  async verifyPhone(ctx: any) {
    try {
      const result = await strapi
        .service('api::general-api.auth')
        .verifyPhone(ctx.request.body ?? {});

      return ctx.send(result);
    } catch (error: any) {
      logAuthError({
        ctx,
        event: 'AUTH_VERIFY_PHONE_FAILED',
        error,
      });

      return sendErrorResponse(ctx, error, 'Mã OTP không hợp lệ');
    }
  },

  async resendPhoneVerifyOtp(ctx: any) {
    try {
      const result = await strapi
        .service('api::general-api.auth')
        .resendPhoneVerifyOtp(ctx.request.body ?? {});

      return ctx.send(result);
    } catch (error: any) {
      logAuthError({
        ctx,
        event: 'AUTH_RESEND_PHONE_VERIFY_OTP_FAILED',
        error,
      });

      return sendErrorResponse(ctx, error, 'Không gửi lại được OTP.');
    }
  },

  async sendForgotPasswordOtp(ctx: any) {
    try {
      const result = await strapi
        .service('api::general-api.auth')
        .sendForgotPasswordOtp(ctx.request.body ?? {});

      return ctx.send(result);
    } catch (error: any) {
      logAuthError({
        ctx,
        event: 'AUTH_SEND_FORGOT_PASSWORD_OTP_FAILED',
        error,
      });

      return sendErrorResponse(
        ctx,
        error,
        'Không thể gửi OTP đặt lại mật khẩu.'
      );
    }
  },

  async resetPasswordWithOtp(ctx: any) {
    try {
      const result = await strapi
        .service('api::general-api.auth')
        .resetPasswordWithOtp(ctx.request.body ?? {});

      return ctx.send(result);
    } catch (error: any) {
      logAuthError({
        ctx,
        event: 'AUTH_RESET_PASSWORD_WITH_OTP_FAILED',
        error,
      });

      return sendErrorResponse(ctx, error, 'Không thể đặt lại mật khẩu.');
    }
  },

  async requestDeleteAccount(ctx: any) {
    try {
      const user = ctx.state?.user;

      if (!user?.id) {
        return ctx.unauthorized('Authentication required');
      }

      const result = await strapi
        .service('api::general-api.auth')
        .requestDeleteAccount({
          userId: user.id,
        });

      return ctx.send(result);
    } catch (error: any) {
      logAuthError({
        ctx,
        event: 'AUTH_REQUEST_DELETE_ACCOUNT_FAILED',
        error,
      });

      return sendErrorResponse(
        ctx,
        error,
        'Không thể gửi yêu cầu xóa tài khoản.'
      );
    }
  },

  async cancelDeleteAccount(ctx: any) {
    try {
      const user = ctx.state?.user;

      if (!user?.id) {
        return ctx.unauthorized('Authentication required');
      }

      const result = await strapi
        .service('api::general-api.auth')
        .cancelDeleteAccount({
          userId: user.id,
        });

      return ctx.send(result);
    } catch (error: any) {
      logAuthError({
        ctx,
        event: 'AUTH_CANCEL_DELETE_ACCOUNT_FAILED',
        error,
      });

      return sendErrorResponse(
        ctx,
        error,
        'Không thể hủy yêu cầu xóa tài khoản.'
      );
    }
  },
};