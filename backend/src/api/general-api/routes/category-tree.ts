export default {
  routes: [
    {
      method: 'GET',
      path: '/vikof/category-tree',
      handler: 'category-tree.getCategoryTree',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};