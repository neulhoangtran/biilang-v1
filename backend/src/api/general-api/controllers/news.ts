export default {
  async increaseView(ctx: any) {
    const documentId = String(
      ctx.params?.documentId || ''
    ).trim();

    try {
      const data = await strapi
        .service('api::general-api.news')
        .increaseView(documentId);

      ctx.body = {
        data,
      };
    } catch (error: any) {
      const status = Number(error?.status || 500);

      ctx.status = status;
      ctx.body = {
        data: null,
        error: {
          status,
          name: error?.name || 'NewsViewError',
          message:
            error?.message ||
            'Không thể cập nhật lượt xem.',
        },
      };
    }
  },
};