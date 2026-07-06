import {
  checkImmediateSmsMessages,
  checkHourlySmsMessages,
  checkDailySmsMessages,
  checkWeeklySmsMessages,
  checkMonthlySmsMessages,
  checkManualSmsMessages,
} from '../src/cron/sms-message.cron';

import {
  checkImmediateNotifications,
  checkHourlyNotifications,
  checkDailyNotifications,
  checkWeeklyNotifications,
  checkMonthlyNotifications,
  checkManualNotifications,
} from '../src/cron/notification-push.cron';

import {
  checkDeletedUsers,
} from '../src/cron/deleted-user.cron';

import {
  processNewsNotifications,
} from '../src/cron/news-notification.cron';

type CronContext = {
  strapi: any;
};

export default {
  immediateSms: {
    task: async ({ strapi }: CronContext) => {
      await checkImmediateSmsMessages(strapi);
    },
    options: {
      rule: '0 * * * * *',
    },
  },

  hourlySms: {
    task: async ({ strapi }: CronContext) => {
      await checkHourlySmsMessages(strapi);
    },
    options: {
      rule: '0 0 * * * *',
    },
  },

  dailySms: {
    task: async ({ strapi }: CronContext) => {
      await checkDailySmsMessages(strapi);
    },
    options: {
      rule: '0 * * * * *',
    },
  },

  weeklySms: {
    task: async ({ strapi }: CronContext) => {
      await checkWeeklySmsMessages(strapi);
    },
    options: {
      rule: '0 * * * * *',
    },
  },

  monthlySms: {
    task: async ({ strapi }: CronContext) => {
      await checkMonthlySmsMessages(strapi);
    },
    options: {
      rule: '0 * * * * *',
    },
  },

  manualSms: {
    task: async ({ strapi }: CronContext) => {
      await checkManualSmsMessages(strapi);
    },
    options: {
      rule: '0 * * * * *',
    },
  },

  immediatePush: {
    task: async ({ strapi }: CronContext) => {
      await checkImmediateNotifications(strapi);
    },
    options: {
      rule: '0 * * * * *',
    },
  },

  hourlyPush: {
    task: async ({ strapi }: CronContext) => {
      await checkHourlyNotifications(strapi);
    },
    options: {
      rule: '0 0 * * * *',
    },
  },

  dailyPush: {
    task: async ({ strapi }: CronContext) => {
      await checkDailyNotifications(strapi);
    },
    options: {
      rule: '0 * * * * *',
    },
  },

  weeklyPush: {
    task: async ({ strapi }: CronContext) => {
      await checkWeeklyNotifications(strapi);
    },
    options: {
      rule: '0 * * * * *',
    },
  },

  monthlyPush: {
    task: async ({ strapi }: CronContext) => {
      await checkMonthlyNotifications(strapi);
    },
    options: {
      rule: '0 * * * * *',
    },
  },

  manualPush: {
    task: async ({ strapi }: CronContext) => {
      await checkManualNotifications(strapi);
    },
    options: {
      rule: '0 * * * * *',
    },
  },

  checkDeletedUsers: {
    task: async ({ strapi }: CronContext) => {
      await checkDeletedUsers(strapi);
    },
    options: {
      rule: '0 0 */12 * * *',
    },
  },

  newsNotificationEveryTwoMinutes: {
    task: async ({ strapi }: CronContext) => {
      await processNewsNotifications(strapi);
    },
    options: {
      rule: '0 */2 * * * *',
    },
  },
};