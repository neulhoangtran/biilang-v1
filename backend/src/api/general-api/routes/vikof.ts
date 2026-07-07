export default {
  routes: [
    {
      method: 'GET',
      path: '/vikof/admin/customers',
      handler: 'vikof.getAdminCustomers',
      config: {},
    },
    {
      method: 'POST',
      path: '/vikof/admin/customers/use-voucher',
      handler:
        'api::vikof.vikof.useCustomerVoucher',
    },
    {
      method: 'GET',
      path: '/vikof/admin/messages',
      handler: 'vikof.getAdminMessages',
      config: {},
    },
    {
      method: 'POST',
      path: '/vikof/admin/message',
      handler: 'vikof.createAdminMessage',
      config: {},
    },
    {
      method: 'PUT',
      path: '/vikof/admin/message-update/:id',
      handler: 'vikof.updateAdminMessage',
      config: {},
    },
  ],
};