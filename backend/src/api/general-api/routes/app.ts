export default {
  routes: [
    {
      method: 'GET',
      path: '/app/admin/customers',
      handler: 'app.getAdminCustomers',
      config: {},
    },
    {
      method: 'POST',
      path: '/app/admin/customers/use-voucher',
      handler:
        'app.useCustomerVoucher',
    },
    {
      method: 'GET',
      path: '/app/admin/messages',
      handler: 'app.getAdminMessages',
      config: {},
    },
    {
      method: 'POST',
      path: '/app/admin/message',
      handler: 'app.createAdminMessage',
      config: {},
    },
    {
      method: 'PUT',
      path: '/app/admin/message-update/:id',
      handler: 'app.updateAdminMessage',
      config: {},
    },
  ],
};