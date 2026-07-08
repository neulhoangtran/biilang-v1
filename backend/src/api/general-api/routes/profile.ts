export default {
  routes: [
    {
      method: 'GET',
      path: '/app/profile',
      handler: 'profile.getProfile',
      config: {},
    },
    {
      method: 'PUT',
      path: '/app/profile',
      handler: 'profile.updateProfile',
      config: {},
    },
    {
      method: 'POST',
      path: '/app/profile/avatar',
      handler: 'profile.uploadAvatar',
      config: {},
    },
    {
      method: 'PUT',
      path: '/app/profile/branch',
      handler: 'profile.selectBranch',
      config: {},
    },
    {
      method: 'POST',
      path: '/app/profile/change-password',
      handler: 'profile.changePassword',
      config: {},
    },
  ],
};