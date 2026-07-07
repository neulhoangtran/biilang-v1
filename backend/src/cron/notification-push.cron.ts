import {
  cronStart,
  cronEnd,
  cronInfo,
  cronWarn,
  cronError,
} from '../utils/cron-logger';

const NOTIFICATION_UID =
  'api::notification.notification';
const USER_UID =
  'plugin::users-permissions.user';
const DEVICE_TOKEN_UID =
  'api::device-token.device-token';

const PUSH_CRON_LOG_FILE =
  'push-notification-cron';
const EXPO_PUSH_URL =
  'https://exp.host/--/api/v2/push/send';
const TIME_ZONE =
  process.env.CRON_TIME_ZONE || 'Asia/Seoul';

const USER_PAGE_SIZE = 300;
const EXPO_BATCH_SIZE = 100;
const INITIALIZE_LIMIT = 100;
const JOB_LIMIT = 20;
const MAX_RETRY_TIME = 5;
const PROCESSING_TIMEOUT_MINUTES = 15;

type ScheduleType =
  | 'Immediately'
  | 'Hourly'
  | 'Daily'
  | 'Weekly'
  | 'Monthly'
  | 'Manually';

type SendToType = 'All' | 'User' | 'Branch';

type SendStatus =
  | 'waiting'
  | 'hold'
  | 'processing'
  | 'done'
  | 'error';

type RelationItem = {
  id: number;
  documentId?: string;
};

type NotificationJob = {
  id: number;
  documentId: string;
  Title: string;
  Description?: string | null;
  ShortDescription?: string | null;
  ActiveDate: string;
  SendTo: SendToType;
  Schedule: ScheduleType;
  SelectTime?: string | null;
  SelectWeekDay?: string | null;
  SelectMonthDay?: number | null;
  ManualDateTime1?: string | null;
  ManualDateTime2?: string | null;
  ManualDateTime3?: string | null;
  ManualDateTime4?: string | null;
  ManualDateTime5?: string | null;
  SendStatus: SendStatus;
  LastRunAt?: string | null;
  NextRunAt?: string | null;
  ProcessingAt?: string | null;
  RetryTime?: number | null;
  RunCount?: number | null;
  Users?: RelationItem[];
  Branch?: RelationItem[];
};

type PushUser = {
  id: number;
};

type DeviceToken = {
  id?: number;
  Token?: string | null;
  IsActive?: boolean | null;
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

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type SendSummary = {
  userCount: number;
  validTokenCount: number;
  duplicateTokenCount: number;
  invalidTokenCount: number;
  acceptedCount: number;
  rejectedCount: number;
  sentBatchCount: number;
};

const runningSchedules = new Set<ScheduleType>();

const dateTimeFormatter = new Intl.DateTimeFormat(
  'en-CA',
  {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }
);

function stripHtml(value?: string | null) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getNotificationBody(job: NotificationJob) {
  return (
    stripHtml(job.ShortDescription) ||
    stripHtml(job.Description) ||
    job.Title
  );
}

function getZonedParts(date: Date): ZonedParts {
  const values: Record<string, number> = {};

  for (const part of dateTimeFormatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      values[part.type] = Number(part.value);
    }
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function zonedDateToUtc(parts: ZonedParts) {
  const desiredTimestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0
  );

  let timestamp = desiredTimestamp;

  for (let index = 0; index < 3; index += 1) {
    const actual = getZonedParts(new Date(timestamp));
    const actualTimestamp = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
      0
    );

    timestamp += desiredTimestamp - actualTimestamp;
  }

  return new Date(timestamp);
}

function addCalendarDays(
  parts: ZonedParts,
  amount: number
): ZonedParts {
  const date = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day + amount
    )
  );

  return {
    ...parts,
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function parseTime(value?: string | null) {
  const match = String(value || '').match(
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?/
  );

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);

  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  return { hour, minute, second };
}

function getWeekDay(parts: ZonedParts) {
  const names = [
    'SUN',
    'MON',
    'TUE',
    'WED',
    'THU',
    'FRI',
    'SAT',
  ];

  return names[
    new Date(
      Date.UTC(parts.year, parts.month - 1, parts.day)
    ).getUTCDay()
  ];
}

function getManualDates(job: NotificationJob) {
  return [
    job.ManualDateTime1,
    job.ManualDateTime2,
    job.ManualDateTime3,
    job.ManualDateTime4,
    job.ManualDateTime5,
  ]
    .map(value => new Date(String(value || '')))
    .filter(date => !Number.isNaN(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());
}

function getNextHourlyAt(reference: Date) {
  const parts = getZonedParts(reference);
  const next = addCalendarDays(
    {
      ...parts,
      hour: parts.hour + 1,
      minute: 0,
      second: 0,
    },
    0
  );

  if (next.hour > 23) {
    const nextDay = addCalendarDays(parts, 1);

    return zonedDateToUtc({
      ...nextDay,
      hour: 0,
      minute: 0,
      second: 0,
    });
  }

  return zonedDateToUtc(next);
}

function getNextDailyAt(
  reference: Date,
  timeValue?: string | null,
  includeCurrent = true
) {
  const time = parseTime(timeValue);

  if (!time) {
    throw new Error('SelectTime không hợp lệ.');
  }

  let parts = {
    ...getZonedParts(reference),
    ...time,
  };
  let candidate = zonedDateToUtc(parts);

  if (
    candidate.getTime() < reference.getTime() ||
    (!includeCurrent &&
      candidate.getTime() === reference.getTime())
  ) {
    parts = addCalendarDays(parts, 1);
    candidate = zonedDateToUtc(parts);
  }

  return candidate;
}

function getNextWeeklyAt(
  reference: Date,
  weekDay?: string | null,
  timeValue?: string | null,
  includeCurrent = true
) {
  const time = parseTime(timeValue);
  const targetWeekDay = String(weekDay || '');

  if (
    !time ||
    ![
      'MON',
      'TUE',
      'WED',
      'THU',
      'FRI',
      'SAT',
      'SUN',
    ].includes(targetWeekDay)
  ) {
    throw new Error(
      'SelectWeekDay hoặc SelectTime không hợp lệ.'
    );
  }

  const start = getZonedParts(reference);

  for (let offset = 0; offset <= 7; offset += 1) {
    const day = addCalendarDays(start, offset);

    if (getWeekDay(day) !== targetWeekDay) {
      continue;
    }

    const candidate = zonedDateToUtc({
      ...day,
      ...time,
    });

    if (
      candidate.getTime() > reference.getTime() ||
      (includeCurrent &&
        candidate.getTime() === reference.getTime())
    ) {
      return candidate;
    }
  }

  throw new Error('Không tính được lịch chạy Weekly.');
}

function getNextMonthlyAt(
  reference: Date,
  monthDay?: number | null,
  timeValue?: string | null,
  includeCurrent = true
) {
  const time = parseTime(timeValue);
  const targetDay = Number(monthDay);

  if (
    !time ||
    !Number.isInteger(targetDay) ||
    targetDay < 1 ||
    targetDay > 31
  ) {
    throw new Error(
      'SelectMonthDay hoặc SelectTime không hợp lệ.'
    );
  }

  const start = getZonedParts(reference);

  for (let offset = 0; offset < 24; offset += 1) {
    const rawMonth = start.month - 1 + offset;
    const year =
      start.year + Math.floor(rawMonth / 12);
    const month = (rawMonth % 12) + 1;
    const lastDay = new Date(
      Date.UTC(year, month, 0)
    ).getUTCDate();

    if (targetDay > lastDay) {
      continue;
    }

    const candidate = zonedDateToUtc({
      year,
      month,
      day: targetDay,
      ...time,
    });

    if (
      candidate.getTime() > reference.getTime() ||
      (includeCurrent &&
        candidate.getTime() === reference.getTime())
    ) {
      return candidate;
    }
  }

  throw new Error('Không tính được lịch chạy Monthly.');
}

function getInitialNextRunAt(
  job: NotificationJob,
  now: Date
) {
  const activeDate = new Date(job.ActiveDate);

  if (Number.isNaN(activeDate.getTime())) {
    throw new Error('ActiveDate không hợp lệ.');
  }

  if (job.Schedule === 'Immediately') {
    return activeDate;
  }

  if (job.Schedule === 'Hourly') {
    return activeDate.getTime() <= now.getTime()
      ? now
      : activeDate;
  }

  const reference = new Date(
    Math.max(now.getTime(), activeDate.getTime())
  );

  if (job.Schedule === 'Daily') {
    return getNextDailyAt(
      reference,
      job.SelectTime
    );
  }

  if (job.Schedule === 'Weekly') {
    return getNextWeeklyAt(
      reference,
      job.SelectWeekDay,
      job.SelectTime
    );
  }

  if (job.Schedule === 'Monthly') {
    return getNextMonthlyAt(
      reference,
      job.SelectMonthDay,
      job.SelectTime
    );
  }

  const manualDates = getManualDates(job).filter(
    date => date.getTime() >= activeDate.getTime()
  );

  if (manualDates.length === 0) {
    throw new Error(
      'Manually cần ít nhất một thời điểm hợp lệ.'
    );
  }

  return manualDates[0];
}

function getNextRunAfterSuccess(
  job: NotificationJob,
  executedAt: Date
) {
  if (job.Schedule === 'Immediately') {
    return null;
  }

  if (job.Schedule === 'Hourly') {
    return getNextHourlyAt(executedAt);
  }

  if (job.Schedule === 'Daily') {
    return getNextDailyAt(
      new Date(executedAt.getTime() + 1000),
      job.SelectTime
    );
  }

  if (job.Schedule === 'Weekly') {
    return getNextWeeklyAt(
      new Date(executedAt.getTime() + 1000),
      job.SelectWeekDay,
      job.SelectTime
    );
  }

  if (job.Schedule === 'Monthly') {
    return getNextMonthlyAt(
      new Date(executedAt.getTime() + 1000),
      job.SelectMonthDay,
      job.SelectTime
    );
  }

  return (
    getManualDates(job).find(
      date => date.getTime() > executedAt.getTime()
    ) || null
  );
}

function isValidExpoPushToken(value?: string | null) {
  return /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(
    String(value || '').trim()
  );
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (
    let index = 0;
    index < items.length;
    index += size
  ) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function getRelationIds(items?: RelationItem[]) {
  return Array.isArray(items)
    ? items
        .map(item => Number(item?.id))
        .filter(id => Number.isFinite(id) && id > 0)
    : [];
}

function getRelationDocumentIds(items?: RelationItem[]) {
  return Array.isArray(items)
    ? items
        .map(item => String(item?.documentId || '').trim())
        .filter(Boolean)
    : [];
}

async function findActiveDeviceTokensByUserIds(
  strapi: any,
  userIds: number[]
) {
  if (userIds.length === 0) {
    return [];
  }

  const deviceTokens = await strapi.db
    .query(DEVICE_TOKEN_UID)
    .findMany({
      where: {
        IsActive: true,
        User: {
          id: {
            $in: userIds,
          },
        },
      },
      select: ['Token'],
      limit: Math.max(userIds.length * 5, 100),
      orderBy: {
        id: 'asc',
      },
    } as any);

  return Array.isArray(deviceTokens)
    ? (deviceTokens as DeviceToken[])
    : [];
}

async function updateNotification(
  strapi: any,
  documentId: string,
  data: Record<string, unknown>
) {
  return strapi
    .documents(NOTIFICATION_UID)
    .update({
      documentId,
      status: 'published',
      data,
    } as any);
}

async function initializeNextRunAt(
  strapi: any,
  schedule: ScheduleType,
  runId: string,
  now: Date
) {
  const jobs = await strapi
    .documents(NOTIFICATION_UID)
    .findMany({
      status: 'published',
      filters: {
        isActive: { $eq: true },
        Schedule: { $eq: schedule },
        SendStatus: { $eq: 'waiting' },
        NextRunAt: { $null: true },
      },
      populate: {
        Users: { fields: ['documentId'] },
        Branch: { fields: ['documentId'] },
      },
      limit: INITIALIZE_LIMIT,
    } as any);

  const list = Array.isArray(jobs)
    ? (jobs as NotificationJob[])
    : [];

  for (const job of list) {
    try {
      const nextRunAt = getInitialNextRunAt(job, now);

      await updateNotification(
        strapi,
        job.documentId,
        {
          NextRunAt: nextRunAt.toISOString(),
        }
      );
    } catch (error: any) {
      await updateNotification(
        strapi,
        job.documentId,
        {
          SendStatus: 'error',
          ProcessingAt: null,
        }
      );

      cronError({
        file: PUSH_CRON_LOG_FILE,
        event: 'PUSH_SCHEDULE_INITIALIZE_FAILED',
        data: {
          runId,
          schedule,
          documentId: job.documentId,
          errorMessage:
            error?.message || String(error),
        },
      });
    }
  }
}

async function recoverStaleJobs(
  strapi: any,
  schedule: ScheduleType,
  runId: string,
  now: Date
) {
  const staleAt = new Date(
    now.getTime() -
      PROCESSING_TIMEOUT_MINUTES * 60 * 1000
  );

  const jobs = await strapi
    .documents(NOTIFICATION_UID)
    .findMany({
      status: 'published',
      filters: {
        Schedule: { $eq: schedule },
        SendStatus: { $eq: 'processing' },
        ProcessingAt: {
          $lte: staleAt.toISOString(),
        },
      },
      limit: JOB_LIMIT,
    } as any);

  const list = Array.isArray(jobs) ? jobs : [];

  for (const job of list) {
    await updateNotification(
      strapi,
      job.documentId,
      {
        SendStatus: 'waiting',
        ProcessingAt: null,
      }
    );
  }

  if (list.length > 0) {
    cronWarn({
      file: PUSH_CRON_LOG_FILE,
      event: 'PUSH_STALE_JOBS_RECOVERED',
      data: {
        runId,
        schedule,
        count: list.length,
      },
    });
  }
}

async function findDueJobs(
  strapi: any,
  schedule: ScheduleType,
  now: Date
) {
  const jobs = await strapi
    .documents(NOTIFICATION_UID)
    .findMany({
      status: 'published',
      filters: {
        isActive: { $eq: true },
        Schedule: { $eq: schedule },
        SendStatus: { $eq: 'waiting' },
        ActiveDate: { $lte: now.toISOString() },
        NextRunAt: { $lte: now.toISOString() },
        $or: [
          { RetryTime: { $null: true } },
          {
            RetryTime: {
              $lt: MAX_RETRY_TIME,
            },
          },
        ],
      },
      populate: {
        Users: { fields: ['documentId'] },
        Branch: { fields: ['documentId'] },
      },
      sort: {
        NextRunAt: 'asc',
      },
      limit: JOB_LIMIT,
    } as any);

  return Array.isArray(jobs)
    ? (jobs as NotificationJob[])
    : [];
}

function buildUserFilters(job: NotificationJob) {
  const filters: Record<string, unknown> = {
    blocked: { $eq: false },
    confirmed: { $eq: true },
  };

  if (job.SendTo === 'User') {
    const userIds = getRelationIds(job.Users);

    if (userIds.length === 0) {
      throw new Error(
        'Notification SendTo=User nhưng chưa chọn Users.'
      );
    }

    filters.id = { $in: userIds };
  }

  if (job.SendTo === 'Branch') {
    const branchIds = getRelationIds(job.Branch);
    const branchDocumentIds = getRelationDocumentIds(
      job.Branch
    );
    const branchFilters: Record<string, unknown>[] = [];

    if (branchDocumentIds.length > 0) {
      branchFilters.push({
        Branch: {
          documentId: {
            $in: branchDocumentIds,
          },
        },
      });
    }

    if (branchIds.length > 0) {
      branchFilters.push({
        Branch: {
          id: {
            $in: branchIds,
          },
        },
      });
    }

    if (branchFilters.length === 0) {
      throw new Error(
        'Notification SendTo=Branch nhưng chưa chọn Branch.'
      );
    }

    filters.$or = branchFilters;
  }

  return filters;
}

async function sendExpoBatch(
  messages: Record<string, unknown>[]
) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    15000
  );

  try {
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
      throw new Error(
        `Expo Push API lỗi ${response.status}: ` +
          JSON.stringify(responseData)
      );
    }

    const tickets = Array.isArray(responseData.data)
      ? responseData.data
      : [];

    if (tickets.length !== messages.length) {
      throw new Error(
        'Expo Push API trả về số ticket không khớp.'
      );
    }

    return tickets;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendNotificationToRecipients(
  strapi: any,
  job: NotificationJob,
  runId: string
): Promise<SendSummary> {
  const filters = buildUserFilters(job);
  const seenTokens = new Set<string>();
  const summary: SendSummary = {
    userCount: 0,
    validTokenCount: 0,
    duplicateTokenCount: 0,
    invalidTokenCount: 0,
    acceptedCount: 0,
    rejectedCount: 0,
    sentBatchCount: 0,
  };
  let start = 0;

  try {
    while (true) {
      const users = await strapi.entityService.findMany(
        USER_UID,
        {
          filters,
          fields: ['id'],
          start,
          limit: USER_PAGE_SIZE,
          sort: { id: 'asc' },
        } as any
      );

      const page = Array.isArray(users)
        ? (users as PushUser[])
        : [];

      if (page.length === 0) {
        break;
      }

      summary.userCount += page.length;

      const userIds = page
        .map(user => Number(user?.id))
        .filter(
          userId =>
            Number.isFinite(userId) && userId > 0
        );

      const deviceTokens =
        await findActiveDeviceTokensByUserIds(
          strapi,
          userIds
        );

      const tokens: string[] = [];

      for (const deviceToken of deviceTokens) {
        const token = String(
          deviceToken.Token || ''
        ).trim();

        if (!isValidExpoPushToken(token)) {
          summary.invalidTokenCount += 1;
          continue;
        }

        if (seenTokens.has(token)) {
          summary.duplicateTokenCount += 1;
          continue;
        }

        seenTokens.add(token);
        tokens.push(token);
      }

      summary.validTokenCount += tokens.length;

      for (const tokenChunk of chunkArray(
        tokens,
        EXPO_BATCH_SIZE
      )) {
        const messages = tokenChunk.map(token => ({
          to: token,
          sound: 'default',
          title: job.Title,
          body: getNotificationBody(job),
          data: {
            type: 'notification',
            notificationId: job.id,
            documentId: job.documentId,
          },
        }));
        const tickets =
          await sendExpoBatch(messages);

        summary.sentBatchCount += 1;
        summary.acceptedCount += tickets.filter(
          ticket => ticket?.status === 'ok'
        ).length;
        summary.rejectedCount += tickets.filter(
          ticket => ticket?.status !== 'ok'
        ).length;
      }

      start += page.length;

      if (page.length < USER_PAGE_SIZE) {
        break;
      }
    }
  } catch (error: any) {
    error.sendSummary = summary;
    throw error;
  }

  cronInfo({
    file: PUSH_CRON_LOG_FILE,
    event: 'PUSH_RECIPIENT_SEND_DONE',
    data: {
      runId,
      documentId: job.documentId,
      sendTo: job.SendTo,
      ...summary,
    },
  });

  return summary;
}

async function processNotificationJob(
  strapi: any,
  job: NotificationJob,
  runId: string,
  now: Date
) {
  const processingAt = new Date();

  await updateNotification(
    strapi,
    job.documentId,
    {
      SendStatus: 'processing',
      ProcessingAt: processingAt.toISOString(),
    }
  );

  let summary: SendSummary | null = null;

  try {
    summary = await sendNotificationToRecipients(
      strapi,
      job,
      runId
    );

    if (summary.validTokenCount === 0) {
      throw new Error(
        'Không tìm thấy device token hợp lệ.'
      );
    }

    const scheduledRunAt = new Date(
      job.NextRunAt || now.toISOString()
    );
    const nextRunAt = getNextRunAfterSuccess(
      job,
      scheduledRunAt
    );
    const isCompleted =
      job.Schedule === 'Immediately' ||
      (job.Schedule === 'Manually' &&
        !nextRunAt);

    await updateNotification(
      strapi,
      job.documentId,
      {
        SendStatus: isCompleted
          ? 'done'
          : 'waiting',
        LastRunAt: scheduledRunAt.toISOString(),
        NextRunAt:
          nextRunAt?.toISOString() || null,
        ProcessingAt: null,
        RetryTime: 0,
        RunCount: Number(job.RunCount || 0) + 1,
      }
    );

    cronInfo({
      file: PUSH_CRON_LOG_FILE,
      event: 'PUSH_JOB_DONE',
      data: {
        runId,
        schedule: job.Schedule,
        documentId: job.documentId,
        nextRunAt:
          nextRunAt?.toISOString() || null,
        isCompleted,
        summary,
      },
    });

    return true;
  } catch (error: any) {
    summary = error?.sendSummary || summary;

    const retryTime =
      Number(job.RetryTime || 0) + 1;
    const hasPartialSend =
      Number(summary?.acceptedCount || 0) > 0;
    const hasNoValidRecipients =
      summary !== null &&
      summary.validTokenCount === 0;
    const shouldStop =
      hasPartialSend ||
      hasNoValidRecipients ||
      retryTime >= MAX_RETRY_TIME;

    await updateNotification(
      strapi,
      job.documentId,
      {
        SendStatus: shouldStop
          ? 'error'
          : 'waiting',
        ProcessingAt: null,
        RetryTime: retryTime,
        NextRunAt: job.NextRunAt,
      }
    );

    cronError({
      file: PUSH_CRON_LOG_FILE,
      event: shouldStop
        ? 'PUSH_JOB_FAILED_STOPPED'
        : 'PUSH_JOB_FAILED_WILL_RETRY',
      data: {
        runId,
        schedule: job.Schedule,
        documentId: job.documentId,
        retryTime,
        hasPartialSend,
        hasNoValidRecipients,
        summary,
        errorName: error?.name,
        errorMessage:
          error?.message || String(error),
        errorStack: error?.stack,
      },
    });

    return false;
  }
}

async function runNotificationSchedule(
  strapi: any,
  schedule: ScheduleType
) {
  if (runningSchedules.has(schedule)) {
    return {
      checked: false,
      skipped: 'already_running',
      schedule,
    };
  }

  runningSchedules.add(schedule);

  const runId = `${schedule}-${Date.now()}`;
  const startedAt = new Date();

  cronStart({
    file: PUSH_CRON_LOG_FILE,
    runId,
    data: {
      schedule,
      timeZone: TIME_ZONE,
      startedAt: startedAt.toISOString(),
    },
  });

  try {
    await recoverStaleJobs(
      strapi,
      schedule,
      runId,
      startedAt
    );
    await initializeNextRunAt(
      strapi,
      schedule,
      runId,
      startedAt
    );

    const jobs = await findDueJobs(
      strapi,
      schedule,
      startedAt
    );
    let successCount = 0;
    let errorCount = 0;

    cronInfo({
      file: PUSH_CRON_LOG_FILE,
      event: 'PUSH_DUE_JOBS_FOUND',
      data: {
        runId,
        schedule,
        count: jobs.length,
      },
    });

    for (const job of jobs) {
      const success =
        await processNotificationJob(
          strapi,
          job,
          runId,
          startedAt
        );

      if (success) {
        successCount += 1;
      } else {
        errorCount += 1;
      }
    }

    return {
      checked: true,
      schedule,
      count: jobs.length,
      successCount,
      errorCount,
    };
  } catch (error: any) {
    cronError({
      file: PUSH_CRON_LOG_FILE,
      event: 'PUSH_SCHEDULE_CRON_FAILED',
      data: {
        runId,
        schedule,
        errorName: error?.name,
        errorMessage:
          error?.message || String(error),
        errorStack: error?.stack,
      },
    });

    throw error;
  } finally {
    const finishedAt = new Date();

    runningSchedules.delete(schedule);

    cronEnd({
      file: PUSH_CRON_LOG_FILE,
      runId,
      data: {
        schedule,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs:
          finishedAt.getTime() -
          startedAt.getTime(),
      },
    });
  }
}

export function checkImmediateNotifications(
  strapi: any
) {
  return runNotificationSchedule(
    strapi,
    'Immediately'
  );
}

export function checkHourlyNotifications(
  strapi: any
) {
  return runNotificationSchedule(
    strapi,
    'Hourly'
  );
}

export function checkDailyNotifications(
  strapi: any
) {
  return runNotificationSchedule(
    strapi,
    'Daily'
  );
}

export function checkWeeklyNotifications(
  strapi: any
) {
  return runNotificationSchedule(
    strapi,
    'Weekly'
  );
}

export function checkMonthlyNotifications(
  strapi: any
) {
  return runNotificationSchedule(
    strapi,
    'Monthly'
  );
}

export function checkManualNotifications(
  strapi: any
) {
  return runNotificationSchedule(
    strapi,
    'Manually'
  );
}

export async function checkDueNotifications(
  strapi: any
) {
  const results = [];

  for (const schedule of [
    'Immediately',
    'Hourly',
    'Daily',
    'Weekly',
    'Monthly',
    'Manually',
  ] as ScheduleType[]) {
    results.push(
      await runNotificationSchedule(
        strapi,
        schedule
      )
    );
  }

  return results;
}