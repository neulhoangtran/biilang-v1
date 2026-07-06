export default {
  routes: [
    {
      method: 'GET',
      path: '/vikof/profile',
      handler: 'profile.getProfile',
      config: {},
    },
    {
      method: 'PUT',
      path: '/vikof/profile',
      handler: 'profile.updateProfile',
      config: {},
    },
    {
      method: 'POST',
      path: '/vikof/profile/avatar',
      handler: 'profile.uploadAvatar',
      config: {},
    },
    {
      method: 'PUT',
      path: '/vikof/profile/branch',
      handler: 'profile.selectBranch',
      config: {},
    },
    {
      method: 'POST',
      path: '/vikof/profile/change-password',
      handler: 'profile.changePassword',
      config: {},
    },
  ],
};