import {
  cronStart,
  cronEnd,
  cronInfo,
  cronWarn,
  cronError,
} from '../utils/cron-logger';

const NEWS_UID = 'api::news.news';
const DEVICE_TOKEN_UID =
  'api::device-token.device-token';

const EXPO_PUSH_URL =
  'https://exp.host/--/api/v2/push/send';

const NEWS_CRON_LOG_FILE =
  'news-notification-cron';

const NOTIFICATION_TITLE = 'Vikof Mobile';
const NOTIFICATION_BODY =
  'Vikof Mobile vừa cập nhật tin tức mới, bấm vào đây để xem!';

const PUSH_BATCH_SIZE = 100;
const TOKEN_PAGE_SIZE = 500;
const NEWS_LIMIT = 10;

type NewsDocument = {
  id: number | string;
  documentId: string;
  Title?: string | null;
  IsNotification?: boolean | null;
  publishedAt?: string | null;
};

type DeviceToken = {
  id?: number;
  documentId?: string;
  Token?: string | null;
  IsActive?: boolean | null;
  User?: {
    id?: number | string;
  } | null;
};

type ExpoPushTicket = {
  status?: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
};

type ExpoPushResponse = {
  data?: ExpoPushTicket[];
  errors?: unknown;
};

let isRunning = false;

function chunkValues<T>(
  values: T[],
  size: number
) {
  const chunks: T[][] = [];

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    chunks.push(
      values.slice(index, index + size)
    );
  }

  return chunks;
}

function isExpoPushToken(value: unknown) {
  const token = String(value || '').trim();

  return /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(
    token
  );
}

function maskToken(token?: string | null) {
  const value = String(token || '').trim();

  if (!value) {
    return '';
  }

  if (value.length <= 18) {
    return '***';
  }

  return `${value.slice(0, 14)}...${value.slice(-6)}`;
}

function getNewsDetailPath(
  newsDocumentId: string
) {
  return (
    `/news-detail?id=` +
    encodeURIComponent(newsDocumentId)
  );
}

async function getActiveDeviceTokens(
  strapi: any,
  runId: string
) {
  const tokens: DeviceToken[] = [];
  let offset = 0;
  let pageNumber = 0;

  while (true) {
    pageNumber += 1;

    const page = await strapi.db
      .query(DEVICE_TOKEN_UID)
      .findMany({
        where: {
          IsActive: true,
          Token: {
            $notNull: true,
          },
        },
        select: ['Token'],
        populate: {
          User: {
            select: ['id'],
          },
        },
        orderBy: {
          id: 'asc',
        },
        offset,
        limit: TOKEN_PAGE_SIZE,
      } as any);

    if (!Array.isArray(page) || page.length === 0) {
      break;
    }

    tokens.push(...(page as DeviceToken[]));

    cronInfo({
      file: NEWS_CRON_LOG_FILE,
      event: 'NEWS_PUSH_TOKEN_PAGE_LOADED',
      data: {
        runId,
        pageNumber,
        offset,
        pageSize: page.length,
        loadedTokenCount: tokens.length,
      },
    });

    if (page.length < TOKEN_PAGE_SIZE) {
      break;
    }

    offset += TOKEN_PAGE_SIZE;
  }

  return tokens;
}

async function disableInvalidTokens(
  strapi: any,
  tokens: string[],
  runId: string
) {
  if (tokens.length === 0) {
    return;
  }

  const result = await strapi.db
    .query(DEVICE_TOKEN_UID)
    .updateMany({
      where: {
        Token: {
          $in: tokens,
        },
      },
      data: {
        IsActive: false,
      },
    } as any);

  cronWarn({
    file: NEWS_CRON_LOG_FILE,
    event: 'NEWS_PUSH_INVALID_TOKENS_DISABLED',
    data: {
      runId,
      invalidTokenCount: tokens.length,
      updatedCount:
        result?.count ??
        result?.affectedRows ??
        null,
    },
  });
}

async function sendExpoBatch(
  messages: Record<string, unknown>[],
  context: {
    runId: string;
    newsDocumentId: string;
    batchNumber: number;
    batchCount: number;
  },
  retry = 0
): Promise<ExpoPushTicket[]> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    15000
  );

  try {
    cronInfo({
      file: NEWS_CRON_LOG_FILE,
      event: 'NEWS_PUSH_BATCH_SEND_START',
      data: {
        ...context,
        messageCount: messages.length,
        retry,
      },
    });

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    const accessToken = String(
      process.env.EXPO_ACCESS_TOKEN || ''
    ).trim();

    if (accessToken) {
      headers.Authorization =
        `Bearer ${accessToken}`;
    }

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
      signal: controller.signal,
    });

    const responseData = (await response
      .json()
      .catch(() => ({}))) as ExpoPushResponse;

    if (!response.ok) {
      const retryable =
        response.status === 429 ||
        response.status >= 500;

      if (retryable && retry < 3) {
        cronWarn({
          file: NEWS_CRON_LOG_FILE,
          event: 'NEWS_PUSH_BATCH_WILL_RETRY',
          data: {
            ...context,
            messageCount: messages.length,
            retry,
            nextRetry: retry + 1,
            status: response.status,
            responseData,
          },
        });

        await new Promise(resolve =>
          setTimeout(
            resolve,
            1000 * 2 ** retry
          )
        );

        return sendExpoBatch(
          messages,
          context,
          retry + 1
        );
      }

      throw new Error(
        `Expo Push API lỗi ${response.status}: ` +
          JSON.stringify(responseData)
      );
    }

    const tickets = Array.isArray(
      responseData?.data
    )
      ? responseData.data
      : [];

    if (tickets.length !== messages.length) {
      throw new Error(
        'Expo Push API trả về số ticket không khớp.'
      );
    }

    const acceptedCount = tickets.filter(
      ticket => ticket?.status === 'ok'
    ).length;
    const rejectedCount =
      tickets.length - acceptedCount;

    cronInfo({
      file: NEWS_CRON_LOG_FILE,
      event: 'NEWS_PUSH_BATCH_SEND_DONE',
      data: {
        ...context,
        messageCount: messages.length,
        ticketCount: tickets.length,
        acceptedCount,
        rejectedCount,
        retry,
      },
    });

    return tickets;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendNewsPushNotification(
  strapi: any,
  news: NewsDocument,
  runId: string
) {
  const deviceTokens = await getActiveDeviceTokens(
    strapi,
    runId
  );
  const tokenSet = new Set<string>();
  const tokenToUserId = new Map<
    string,
    number | string | null
  >();
  let invalidFormatCount = 0;
  let duplicateTokenCount = 0;

  for (const deviceToken of deviceTokens) {
    const token = String(
      deviceToken.Token || ''
    ).trim();

    if (!isExpoPushToken(token)) {
      invalidFormatCount += 1;

      cronWarn({
        file: NEWS_CRON_LOG_FILE,
        event: 'NEWS_PUSH_TOKEN_INVALID_FORMAT',
        data: {
          runId,
          newsDocumentId: news.documentId,
          token: maskToken(token),
          userId: deviceToken.User?.id ?? null,
        },
      });

      continue;
    }

    if (tokenSet.has(token)) {
      duplicateTokenCount += 1;
      continue;
    }

    tokenSet.add(token);
    tokenToUserId.set(
      token,
      deviceToken.User?.id ?? null
    );
  }

  const tokens = [...tokenSet];

  cronInfo({
    file: NEWS_CRON_LOG_FILE,
    event: 'NEWS_PUSH_RECEIVERS_RESOLVED',
    data: {
      runId,
      newsDocumentId: news.documentId,
      queriedTokenCount: deviceTokens.length,
      validUniqueTokenCount: tokens.length,
      invalidFormatCount,
      duplicateTokenCount,
    },
  });

  if (tokens.length === 0) {
    cronWarn({
      file: NEWS_CRON_LOG_FILE,
      event: 'NEWS_PUSH_NO_VALID_RECEIVERS',
      data: {
        runId,
        newsDocumentId: news.documentId,
        queriedTokenCount: deviceTokens.length,
        invalidFormatCount,
        duplicateTokenCount,
      },
    });

    return {
      total: 0,
      accepted: 0,
      rejected: 0,
      invalidFormatCount,
      duplicateTokenCount,
      invalidTokenCount: 0,
      batchCount: 0,
    };
  }

  const invalidTokens: string[] = [];
  let accepted = 0;
  let rejected = 0;
  const tokenBatches = chunkValues(
    tokens,
    PUSH_BATCH_SIZE
  );
  const batchCount = tokenBatches.length;
  let batchNumber = 0;

  for (const tokenBatch of tokenBatches) {
    batchNumber += 1;

    const messages = tokenBatch.map(token => ({
      to: token,
      title: NOTIFICATION_TITLE,
      body: NOTIFICATION_BODY,
      sound: 'default',
      priority: 'high',
      channelId: 'default',
      data: {
        type: 'news',
        documentId: news.documentId,
        newsDocumentId: news.documentId,
        path: getNewsDetailPath(news.documentId),
      },
    }));

    let tickets: ExpoPushTicket[] = [];

    try {
      tickets = await sendExpoBatch(
        messages,
        {
          runId,
          newsDocumentId: news.documentId,
          batchNumber,
          batchCount,
        }
      );
    } catch (error: any) {
      rejected += tokenBatch.length;

      cronError({
        file: NEWS_CRON_LOG_FILE,
        event: 'NEWS_PUSH_BATCH_FAILED_CONTINUE',
        data: {
          runId,
          newsDocumentId: news.documentId,
          batchNumber,
          batchCount,
          tokenCount: tokenBatch.length,
          errorName: error?.name,
          errorMessage:
            error?.message || String(error),
          errorStack: error?.stack,
        },
      });

      continue;
    }

    tickets.forEach((ticket, index) => {
      const token = tokenBatch[index];

      if (ticket?.status === 'ok') {
        accepted += 1;
        return;
      }

      rejected += 1;

      cronWarn({
        file: NEWS_CRON_LOG_FILE,
        event: 'NEWS_PUSH_TOKEN_REJECTED_CONTINUE',
        data: {
          runId,
          newsDocumentId: news.documentId,
          token: maskToken(token),
          userId: tokenToUserId.get(token) ?? null,
          message: ticket?.message,
          detailError: ticket?.details?.error,
        },
      });

      if (
        ticket?.details?.error ===
        'DeviceNotRegistered'
      ) {
        invalidTokens.push(token);
      }
    });
  }

  await disableInvalidTokens(
    strapi,
    invalidTokens,
    runId
  );

  return {
    total: tokens.length,
    accepted,
    rejected,
    invalidFormatCount,
    duplicateTokenCount,
    invalidTokenCount:
      invalidTokens.length,
    batchCount,
  };
}

async function turnOffNewsNotification(
  strapi: any,
  news: NewsDocument
) {
  return strapi
    .documents(NEWS_UID)
    .update({
      documentId: news.documentId,
      status: 'published',
      data: {
        IsNotification: false,
      },
    } as any);
}

async function getPendingNews(
  strapi: any,
  runId: string
) {
  const result = await strapi
    .documents(NEWS_UID)
    .findMany({
      status: 'published',
      filters: {
        IsNotification: {
          $eq: true,
        },
      },
      fields: [
        'Title',
        'IsNotification',
        'publishedAt',
      ],
      sort: {
        publishedAt: 'asc',
      },
      limit: NEWS_LIMIT,
    } as any);

  const list = Array.isArray(result)
    ? (result as NewsDocument[])
    : [];

  cronInfo({
    file: NEWS_CRON_LOG_FILE,
    event: 'NEWS_NOTIFICATION_QUERY_RESULT',
    data: {
      runId,
      count: list.length,
      news: list.map(news => ({
        id: news.id,
        documentId: news.documentId,
        title: news.Title,
        isNotification: news.IsNotification,
        publishedAt: news.publishedAt,
      })),
    },
  });

  return list;
}

async function processOneNews(
  strapi: any,
  news: NewsDocument,
  runId: string
) {
  cronInfo({
    file: NEWS_CRON_LOG_FILE,
    event: 'NEWS_NOTIFICATION_ITEM_START',
    data: {
      runId,
      id: news.id,
      documentId: news.documentId,
      title: news.Title,
      publishedAt: news.publishedAt,
    },
  });

  try {
    const result =
      await sendNewsPushNotification(
        strapi,
        news,
        runId
      );

    await turnOffNewsNotification(strapi, news);

    cronInfo({
      file: NEWS_CRON_LOG_FILE,
      event: 'NEWS_NOTIFICATION_ITEM_DONE',
      data: {
        runId,
        documentId: news.documentId,
        title: news.Title,
        isNotification: false,
        ...result,
      },
    });

    return true;
  } catch (error: any) {
    cronError({
      file: NEWS_CRON_LOG_FILE,
      event: 'NEWS_NOTIFICATION_ITEM_FAILED',
      data: {
        runId,
        documentId: news.documentId,
        title: news.Title,
        errorName: error?.name,
        errorMessage:
          error?.message || String(error),
        errorStack: error?.stack,
      },
    });

    return false;
  }
}

export async function processNewsNotifications(
  strapi: any
) {
  const runId = `${Date.now()}`;
  const startedAt = new Date();

  cronStart({
    file: NEWS_CRON_LOG_FILE,
    runId,
    data: {
      runId,
      startedAt: startedAt.toISOString(),
      rule: '0 */2 * * * *',
      timezone: 'Asia/Seoul',
    },
  });

  if (isRunning) {
    cronWarn({
      file: NEWS_CRON_LOG_FILE,
      event:
        'NEWS_NOTIFICATION_CRON_OVERLAP_SKIPPED',
      data: {
        runId,
        reason:
          'Cron trước vẫn đang chạy.',
      },
    });

    const finishedAt = new Date();

    cronEnd({
      file: NEWS_CRON_LOG_FILE,
      runId,
      data: {
        runId,
        startedAt: startedAt.toISOString(),
        finishedAt:
          finishedAt.toISOString(),
        durationMs:
          finishedAt.getTime() -
          startedAt.getTime(),
        skipped: true,
      },
    });

    return;
  }

  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;

  try {
    isRunning = true;

    cronInfo({
      file: NEWS_CRON_LOG_FILE,
      event: 'NEWS_NOTIFICATION_CRON_TICK',
      data: {
        runId,
        pushBatchSize: PUSH_BATCH_SIZE,
        tokenPageSize: TOKEN_PAGE_SIZE,
        newsLimit: NEWS_LIMIT,
      },
    });

    const pendingNews =
      await getPendingNews(strapi, runId);

    for (const news of pendingNews) {
      const success =
        await processOneNews(
          strapi,
          news,
          runId
        );

      processedCount += 1;

      if (success) {
        successCount += 1;
      } else {
        errorCount += 1;
      }
    }

    cronInfo({
      file: NEWS_CRON_LOG_FILE,
      event:
        'NEWS_NOTIFICATION_CRON_RESULT',
      data: {
        runId,
        pendingCount:
          pendingNews.length,
        processedCount,
        successCount,
        errorCount,
      },
    });
  } catch (error: any) {
    cronError({
      file: NEWS_CRON_LOG_FILE,
      event:
        'NEWS_NOTIFICATION_CRON_FAILED',
      data: {
        runId,
        processedCount,
        successCount,
        errorCount,
        errorName: error?.name,
        errorMessage:
          error?.message || String(error),
        errorStack: error?.stack,
      },
    });

    throw error;
  } finally {
    isRunning = false;

    const finishedAt = new Date();

    cronEnd({
      file: NEWS_CRON_LOG_FILE,
      runId,
      data: {
        runId,
        processedCount,
        successCount,
        errorCount,
        startedAt: startedAt.toISOString(),
        finishedAt:
          finishedAt.toISOString(),
        durationMs:
          finishedAt.getTime() -
          startedAt.getTime(),
      },
    });
  }
}
