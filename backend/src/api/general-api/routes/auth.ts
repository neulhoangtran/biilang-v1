export default {
  routes: [
    {
      method: 'POST',
      path: '/app/auth/register',
      handler: 'auth.register',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/app/auth/login',
      handler: 'auth.login',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/app/auth/login/send-otp',
      handler: 'auth.sendLoginOtp',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/app/auth/login/verify-otp',
      handler: 'auth.verifyLoginOtp',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/app/auth/verify-phone',
      handler: 'auth.verifyPhone',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/app/auth/resend-phone-verify-otp',
      handler: 'auth.resendPhoneVerifyOtp',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/app/auth/forgot-password/send-otp',
      handler: 'auth.sendForgotPasswordOtp',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/app/auth/forgot-password/reset',
      handler: 'auth.resetPasswordWithOtp',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/app/auth/request-delete-account',
      handler: 'auth.requestDeleteAccount',
      config: {},
    },
    {
      method: 'POST',
      path: '/app/auth/cancel-delete-account',
      handler: 'auth.cancelDeleteAccount',
      config: {},
    },
  ],
};