export default {
  routes: [
    {
      method: 'POST',
      path: '/vikof/news-view/:documentId',
      handler: 'news.increaseView',
      config: {
        auth: false,
      },
    },
  ],
};