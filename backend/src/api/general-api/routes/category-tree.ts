export default {
  routes: [
    {
      method: 'GET',
      path: '/app/category-tree',
      handler: 'category-tree.getCategoryTree',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};