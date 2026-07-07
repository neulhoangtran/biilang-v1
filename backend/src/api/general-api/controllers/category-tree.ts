export default {
  async getCategoryTree(ctx) {
    try {
      const debug = String(ctx.query?.debug || '') === '1';

      const result = await strapi
        .service('api::vikof.category-tree')
        .getCategoryTree();

      if (debug) {
        return ctx.send({
          success: true,
          rowCount: result.rawItems.length,
          rootCount: result.tree.length,
          skippedCount: result.skippedItems.length,
          skippedItems: result.skippedItems,
          data: result.tree,
          raw: result.rawItems.map(item => ({
            id: item.id,
            documentId: item.documentId,
            name: item.Name,
            url: item.Url,
            level: item.Level,
            parentPath: item.ParentPath,
            publishedAt: item.publishedAt,
          })),
        });
      }

      return ctx.send({
        success: true,
        data: result.tree,
      });
    } catch (error: any) {
      strapi.log.error('[CATEGORY_TREE_FAILED]', error);

      return ctx.internalServerError(
        'Không thể tải danh mục sản phẩm.'
      );
    }
  },
};