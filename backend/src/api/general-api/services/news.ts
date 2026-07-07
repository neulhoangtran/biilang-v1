const NEWS_UID = 'api::news.news';

class NewsServiceError extends Error {
    status: number;

    constructor(message: string, status = 400) {
        super(message);
        this.name = 'NewsServiceError';
        this.status = status;
    }
}

function notFound(message: string): never {
    throw new NewsServiceError(message, 404);
}

function getColumnName(
    metadata: any,
    attributeName: string,
    fallback: string
) {
    return (
        metadata?.attributes?.[attributeName]
            ?.columnName || fallback
    );
}

function normalizeView(value: unknown) {
    const numberValue = Number(value || 0);

    if (!Number.isFinite(numberValue)) {
        return 0;
    }

    return Math.max(0, numberValue);
}

async function findPublishedNews(
    documentId: string
) {
    if (!documentId) {
        notFound('Thiếu thông tin bài viết.');
    }

    const news = await strapi
        .documents(NEWS_UID)
        .findOne({
            documentId,
            status: 'published',
            fields: [
                'Title',
                'View',
                'publishedAt',
            ],
        } as any);

    if (!news) {
        notFound('Không tìm thấy bài viết.');
    }

    return news as any;
}

export default () => ({
    async increaseView(documentId: string) {
        const news = await findPublishedNews(
            documentId
        );
        const metadata =
            strapi.db.metadata.get(NEWS_UID);
        const tableName = metadata?.tableName;
        const viewColumn = getColumnName(
            metadata,
            'View',
            'view'
        );

        if (!tableName) {
            throw new NewsServiceError(
                'Không tìm thấy bảng News.',
                500
            );
        }

        await strapi.db
            .connection(tableName)
            .where({
                id: news.id,
            })
            .update({
                [viewColumn]: strapi.db.connection.raw(
                    'COALESCE(??, 0) + 1',
                    [viewColumn]
                ),
            });

        const updatedNews =
            await findPublishedNews(documentId);

        return {
            id: updatedNews.id,
            documentId: updatedNews.documentId,
            Title: updatedNews.Title,
            View: normalizeView(updatedNews.View),
            publishedAt: updatedNews.publishedAt,
        };
    },
});