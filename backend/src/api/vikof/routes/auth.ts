export default {
  routes: [
    {
      method: 'POST',
      path: '/vikof/auth/register',
      handler: 'auth.register',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/vikof/auth/login',
      handler: 'auth.login',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/vikof/auth/login/send-otp',
      handler: 'auth.sendLoginOtp',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/vikof/auth/login/verify-otp',
      handler: 'auth.verifyLoginOtp',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/vikof/auth/verify-phone',
      handler: 'auth.verifyPhone',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/vikof/auth/resend-phone-verify-otp',
      handler: 'auth.resendPhoneVerifyOtp',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/vikof/auth/forgot-password/send-otp',
      handler: 'auth.sendForgotPasswordOtp',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/vikof/auth/forgot-password/reset',
      handler: 'auth.resetPasswordWithOtp',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/vikof/auth/request-delete-account',
      handler: 'auth.requestDeleteAccount',
      config: {},
    },
    {
      method: 'POST',
      path: '/vikof/auth/cancel-delete-account',
      handler: 'auth.cancelDeleteAccount',
      config: {},
    },
  ],
};