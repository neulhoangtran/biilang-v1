export default {
  routes: [
    {
      method: 'GET',
      path: '/app/configuration/version',
      handler: 'configuration.getAppVersion',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/app/configuration/public',
      handler: 'configuration.getPublicConfiguration',
      config: {
        auth: false,
      },
    },
  ],
};