export default {
  routes: [
    {
      method: 'POST',
      path: '/vikof/device-token',
      handler: 'notification.saveDeviceToken',
      config: {},
    },
    {
      method: 'GET',
      path: '/vikof/notifications',
      handler: 'notification.list',
      config: {},
    },
    {
      method: 'GET',
      path: '/vikof/notifications/:documentId',
      handler: 'notification.detail',
      config: {},
    },
  ],
};
