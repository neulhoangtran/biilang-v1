const aligoapi = require('aligoapi');

import {
  cronStart,
  cronEnd,
  cronInfo,
  cronWarn,
  cronError,
} from '../utils/cron-logger';

const SMS_UID = 'api::sms-message.sms-message';
const USER_UID =
  'plugin::users-permissions.user';

const SMS_CRON_LOG_FILE = 'sms-cron';
const TIME_ZONE =
  process.env.CRON_TIME_ZONE || 'Asia/Seoul';

const USER_PAGE_SIZE = 300;
const SMS_RECEIVER_BATCH_SIZE = Math.min(
  Math.max(
    Number(
      process.env.SMS_RECEIVER_BATCH_SIZE || 500
    ),
    1
  ),
  1000
);
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

type SmsMessageJob = {
  id: number;
  documentId: string;
  Title: string;
  Content: string;
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
  IsConfirmed?: boolean;
  LastRunAt?: string | null;
  NextRunAt?: string | null;
  ProcessingAt?: string | null;
  RetryTime?: number | null;
  RunCount?: number | null;
  Users?: RelationItem[];
  Branches?: RelationItem[];
};

type SmsUser = {
  id: number;
  PhoneNumber?: string | null;
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
  validPhoneCount: number;
  duplicatePhoneCount: number;
  invalidPhoneCount: number;
  sentPhoneCount: number;
  sentBatchCount: number;
};

const runningSchedules = new Set<ScheduleType>();

const ALIGO_AUTH = {
  key: process.env.ALIGO_API_KEY,
  user_id: process.env.ALIGO_USER_ID,
};
const ALIGO_SENDER = process.env.ALIGO_SENDER;
const ALIGO_TEST_MODE =
  process.env.ALIGO_TEST_MODE || 'N';

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

function getManualDates(job: SmsMessageJob) {
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

  if (parts.hour >= 23) {
    const nextDay = addCalendarDays(parts, 1);

    return zonedDateToUtc({
      ...nextDay,
      hour: 0,
      minute: 0,
      second: 0,
    });
  }

  return zonedDateToUtc({
    ...parts,
    hour: parts.hour + 1,
    minute: 0,
    second: 0,
  });
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
  job: SmsMessageJob,
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
  job: SmsMessageJob,
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

function normalizePhone(value?: string | null) {
  const phone = String(value || '')
    .replace(/[^\d]/g, '');

  return phone || null;
}

function isValidKoreaMobilePhone(phone: string) {
  return /^01[016789]\d{7,8}$/.test(phone);
}

function getAligoMsgType(content: string) {
  return Buffer.byteLength(
    content || '',
    'utf8'
  ) > 90
    ? 'LMS'
    : 'SMS';
}

function isAligoSuccess(result: any) {
  const resultCode = String(
    result?.result_code ??
      result?.code ??
      result?.resultCode ??
      ''
  ).trim();

  return (
    resultCode === '1' ||
    resultCode.toLowerCase() === 'success'
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

async function sendSmsByAligo({
  title,
  content,
  phones,
}: {
  title: string;
  content: string;
  phones: string[];
}) {
  if (!ALIGO_AUTH.key) {
    throw new Error('Missing env ALIGO_API_KEY');
  }

  if (!ALIGO_AUTH.user_id) {
    throw new Error('Missing env ALIGO_USER_ID');
  }

  if (!ALIGO_SENDER) {
    throw new Error('Missing env ALIGO_SENDER');
  }

  const req = {
    headers: {},
    body: {
      sender: ALIGO_SENDER,
      receiver: phones.join(','),
      msg: content,
      msg_type: getAligoMsgType(content),
      title,
      testmode_yn: ALIGO_TEST_MODE,
    },
  };

  const result = await aligoapi.send(
    req,
    ALIGO_AUTH
  );

  if (!isAligoSuccess(result)) {
    throw new Error(
      `ALIGO_SEND_FAILED: ${JSON.stringify(result)}`
    );
  }

  return result;
}

async function updateSmsMessage(
  strapi: any,
  documentId: string,
  data: Record<string, unknown>
) {
  return strapi.documents(SMS_UID).update({
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
    .documents(SMS_UID)
    .findMany({
      status: 'published',
      filters: {
        isActive: { $eq: true },
        IsConfirmed: { $eq: true },
        Schedule: { $eq: schedule },
        SendStatus: { $eq: 'waiting' },
        NextRunAt: { $null: true },
      },
      populate: {
        Users: { fields: ['documentId'] },
        Branches: { fields: ['documentId'] },
      },
      limit: INITIALIZE_LIMIT,
    } as any);

  const list = Array.isArray(jobs)
    ? (jobs as SmsMessageJob[])
    : [];

  for (const job of list) {
    try {
      const nextRunAt = getInitialNextRunAt(job, now);

      await updateSmsMessage(
        strapi,
        job.documentId,
        {
          NextRunAt: nextRunAt.toISOString(),
        }
      );
    } catch (error: any) {
      await updateSmsMessage(
        strapi,
        job.documentId,
        {
          SendStatus: 'error',
          ProcessingAt: null,
        }
      );

      cronError({
        file: SMS_CRON_LOG_FILE,
        event: 'SMS_SCHEDULE_INITIALIZE_FAILED',
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
    .documents(SMS_UID)
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
    await updateSmsMessage(
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
      file: SMS_CRON_LOG_FILE,
      event: 'SMS_STALE_JOBS_RECOVERED',
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
    .documents(SMS_UID)
    .findMany({
      status: 'published',
      filters: {
        isActive: { $eq: true },
        IsConfirmed: { $eq: true },
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
        Branches: { fields: ['documentId'] },
      },
      sort: {
        NextRunAt: 'asc',
      },
      limit: JOB_LIMIT,
    } as any);

  return Array.isArray(jobs)
    ? (jobs as SmsMessageJob[])
    : [];
}

function buildUserFilters(job: SmsMessageJob) {
  const filters: Record<string, unknown> = {
    blocked: { $eq: false },
    confirmed: { $eq: true },
  };

  if (job.SendTo === 'User') {
    const userIds = getRelationIds(job.Users);

    if (userIds.length === 0) {
      throw new Error(
        'SMS SendTo=User nhưng chưa chọn Users.'
      );
    }

    filters.id = { $in: userIds };
  }

  if (job.SendTo === 'Branch') {
    const branchIds = getRelationIds(job.Branches);

    if (branchIds.length === 0) {
      throw new Error(
        'SMS SendTo=Branch nhưng chưa chọn Branches.'
      );
    }

    filters.Branch = {
      id: { $in: branchIds },
    };
  }

  return filters;
}

async function sendSmsToRecipients(
  strapi: any,
  job: SmsMessageJob,
  runId: string
): Promise<SendSummary> {
  const filters = buildUserFilters(job);
  const seenPhones = new Set<string>();
  const summary: SendSummary = {
    userCount: 0,
    validPhoneCount: 0,
    duplicatePhoneCount: 0,
    invalidPhoneCount: 0,
    sentPhoneCount: 0,
    sentBatchCount: 0,
  };
  let start = 0;

  try {
    while (true) {
      const users = await strapi.entityService.findMany(
        USER_UID,
        {
          filters,
          fields: ['PhoneNumber'],
          start,
          limit: USER_PAGE_SIZE,
          sort: { id: 'asc' },
        } as any
      );

      const page = Array.isArray(users)
        ? (users as SmsUser[])
        : [];

      if (page.length === 0) {
        break;
      }

      summary.userCount += page.length;
      const phones: string[] = [];

      for (const user of page) {
        const phone = normalizePhone(
          user.PhoneNumber
        );

        if (
          !phone ||
          !isValidKoreaMobilePhone(phone)
        ) {
          summary.invalidPhoneCount += 1;
          continue;
        }

        if (seenPhones.has(phone)) {
          summary.duplicatePhoneCount += 1;
          continue;
        }

        seenPhones.add(phone);
        phones.push(phone);
      }

      summary.validPhoneCount += phones.length;

      for (const phoneChunk of chunkArray(
        phones,
        SMS_RECEIVER_BATCH_SIZE
      )) {
        await sendSmsByAligo({
          title: job.Title,
          content: job.Content,
          phones: phoneChunk,
        });

        summary.sentBatchCount += 1;
        summary.sentPhoneCount +=
          phoneChunk.length;
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
    file: SMS_CRON_LOG_FILE,
    event: 'SMS_RECIPIENT_SEND_DONE',
    data: {
      runId,
      documentId: job.documentId,
      sendTo: job.SendTo,
      ...summary,
    },
  });

  return summary;
}

async function processSmsJob(
  strapi: any,
  job: SmsMessageJob,
  runId: string,
  now: Date
) {
  await updateSmsMessage(
    strapi,
    job.documentId,
    {
      SendStatus: 'processing',
      ProcessingAt: new Date().toISOString(),
    }
  );

  let summary: SendSummary | null = null;

  try {
    summary = await sendSmsToRecipients(
      strapi,
      job,
      runId
    );

    if (summary.validPhoneCount === 0) {
      throw new Error(
        'Không tìm thấy số điện thoại hợp lệ.'
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

    await updateSmsMessage(
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
      file: SMS_CRON_LOG_FILE,
      event: 'SMS_JOB_DONE',
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
      Number(summary?.sentPhoneCount || 0) > 0;
    const hasNoValidRecipients =
      summary !== null &&
      summary.validPhoneCount === 0;
    const shouldStop =
      hasPartialSend ||
      hasNoValidRecipients ||
      retryTime >= MAX_RETRY_TIME;

    await updateSmsMessage(
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
      file: SMS_CRON_LOG_FILE,
      event: shouldStop
        ? 'SMS_JOB_FAILED_STOPPED'
        : 'SMS_JOB_FAILED_WILL_RETRY',
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

async function runSmsSchedule(
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
    file: SMS_CRON_LOG_FILE,
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
      file: SMS_CRON_LOG_FILE,
      event: 'SMS_DUE_JOBS_FOUND',
      data: {
        runId,
        schedule,
        count: jobs.length,
      },
    });

    for (const job of jobs) {
      const success = await processSmsJob(
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
      file: SMS_CRON_LOG_FILE,
      event: 'SMS_SCHEDULE_CRON_FAILED',
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
      file: SMS_CRON_LOG_FILE,
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

export function checkImmediateSmsMessages(
  strapi: any
) {
  return runSmsSchedule(strapi, 'Immediately');
}

export function checkHourlySmsMessages(
  strapi: any
) {
  return runSmsSchedule(strapi, 'Hourly');
}

export function checkDailySmsMessages(
  strapi: any
) {
  return runSmsSchedule(strapi, 'Daily');
}

export function checkWeeklySmsMessages(
  strapi: any
) {
  return runSmsSchedule(strapi, 'Weekly');
}

export function checkMonthlySmsMessages(
  strapi: any
) {
  return runSmsSchedule(strapi, 'Monthly');
}

export function checkManualSmsMessages(
  strapi: any
) {
  return runSmsSchedule(strapi, 'Manually');
}

export async function checkSmsMessages(
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
      await runSmsSchedule(strapi, schedule)
    );
  }

  return results;
}
