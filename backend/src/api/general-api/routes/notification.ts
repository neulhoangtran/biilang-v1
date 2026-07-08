export default {
  routes: [
    {
      method: 'POST',
      path: '/app/device-token',
      handler: 'notification.saveDeviceToken',
      config: {},
    },
    {
      method: 'GET',
      path: '/app/notifications',
      handler: 'notification.list',
      config: {},
    },
    {
      method: 'GET',
      path: '/app/notifications/:documentId',
      handler: 'notification.detail',
      config: {},
    },
  ],
};
