export default {
  routes: [
    {
      method: 'POST',
      path: '/app/news-view/:documentId',
      handler: 'news.increaseView',
      config: {
        auth: false,
      },
    },
  ],
};