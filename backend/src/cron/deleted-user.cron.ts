import {
  cronStart,
  cronEnd,
  cronInfo,
  cronWarn,
  cronError,
} from '../utils/cron-logger';

const DELETE_USER_CRON_LOG_FILE = 'deleted-user-cron';

const MAX_DELETE_USER_PER_RUN = 100;

type DeletePendingUser = {
  id: number;
  username?: string;
  email?: string;
  PhoneNumber?: string;
  FirstName?: string;
  LastName?: string;
  CustomName?: string;
  confirmed?: boolean;
  blocked?: boolean;
  MarkDelete?: boolean;
  MarkDeleteDate?: string;
  Branch?: any;
};

function normalizePhone(value: unknown) {
  let phone = String(value || '').replace(/[^\d]/g, '');

  if (phone.startsWith('82')) {
    phone = `0${phone.slice(2)}`;
  }

  return phone;
}

function getUserPhone(user: any) {
  return normalizePhone(
    user?.PhoneNumber ||
      user?.phoneNumber ||
      user?.phone_number ||
      user?.username ||
      ''
  );
}

function getUserDisplayName(user: any) {
  const customName = String(user?.CustomName || '').trim();

  if (customName) {
    return customName;
  }

  const fullName = [user?.LastName, user?.FirstName]
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  const phone = getUserPhone(user);

  if (phone && fullName) {
    return `${phone} - ${fullName}`;
  }

  return phone || fullName || String(user?.email || user?.id || '');
}

function isValidDueDate(value: unknown) {
  const date = new Date(String(value || ''));

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.getTime() <= Date.now();
}

async function findPendingDeleteUsers(strapi: any, now: string) {
  const users = await strapi.entityService.findMany(
    'plugin::users-permissions.user',
    {
      filters: {
        MarkDelete: {
          $eq: true,
        },
        MarkDeleteDate: {
          $lte: now,
        },
      },
      populate: {
        Branch: true,
      },
      sort: {
        MarkDeleteDate: 'asc',
      },
      limit: MAX_DELETE_USER_PER_RUN,
    } as any
  );

  return Array.isArray(users) ? (users as DeletePendingUser[]) : [];
}

async function disableUserAccount({
  strapi,
  user,
}: {
  strapi: any;
  user: DeletePendingUser;
}) {
  return strapi.entityService.update(
    'plugin::users-permissions.user',
    user.id,
    {
      data: {
        confirmed: false,
        blocked: true,
        Branch: null,
        MarkDelete: false,
        MarkDeleteDate: null,
      } as any,
      populate: {
        Branch: true,
        Avatar: true,
        role: true,
      },
    } as any
  );
}

export async function checkDeletedUsers(strapi: any) {
  const runId = `${Date.now()}`;
  const startedAt = new Date();
  const now = new Date().toISOString();

  cronStart({
    file: DELETE_USER_CRON_LOG_FILE,
    runId,
    data: {
      runId,
      startedAt: startedAt.toISOString(),
      now,
      maxDeleteUserPerRun: MAX_DELETE_USER_PER_RUN,
    },
  });

  try {
    cronInfo({
      file: DELETE_USER_CRON_LOG_FILE,
      event: 'DELETE_USER_CRON_TICK',
      data: {
        runId,
        now,
        maxDeleteUserPerRun: MAX_DELETE_USER_PER_RUN,
      },
    });

    const users = await findPendingDeleteUsers(strapi, now);

    cronInfo({
      file: DELETE_USER_CRON_LOG_FILE,
      event: 'DELETE_USER_PENDING_RESULT',
      data: {
        runId,
        count: users.length,
        users: users.map(user => ({
          id: user.id,
          username: user.username,
          email: user.email,
          phoneNumber: getUserPhone(user),
          customName: getUserDisplayName(user),
          confirmed: user.confirmed,
          blocked: user.blocked,
          markDelete: user.MarkDelete,
          markDeleteDate: user.MarkDeleteDate,
          branchId: user.Branch?.id || null,
        })),
      },
    });

    if (users.length === 0) {
      return {
        checked: true,
        pendingCount: 0,
        disabledCount: 0,
        skippedCount: 0,
        failedCount: 0,
      };
    }

    let disabledCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const user of users) {
      try {
        if (!user?.id) {
          skippedCount += 1;

          cronWarn({
            file: DELETE_USER_CRON_LOG_FILE,
            event: 'DELETE_USER_SKIP_INVALID_USER',
            data: {
              runId,
              user,
            },
          });

          continue;
        }

        if (!user.MarkDelete) {
          skippedCount += 1;

          cronWarn({
            file: DELETE_USER_CRON_LOG_FILE,
            event: 'DELETE_USER_SKIP_MARK_DELETE_FALSE',
            data: {
              runId,
              userId: user.id,
              customName: getUserDisplayName(user),
              markDelete: user.MarkDelete,
              markDeleteDate: user.MarkDeleteDate,
            },
          });

          continue;
        }

        if (!isValidDueDate(user.MarkDeleteDate)) {
          skippedCount += 1;

          cronWarn({
            file: DELETE_USER_CRON_LOG_FILE,
            event: 'DELETE_USER_SKIP_NOT_DUE',
            data: {
              runId,
              userId: user.id,
              customName: getUserDisplayName(user),
              markDeleteDate: user.MarkDeleteDate,
              now,
            },
          });

          continue;
        }

        cronInfo({
          file: DELETE_USER_CRON_LOG_FILE,
          event: 'DELETE_USER_DISABLE_START',
          data: {
            runId,
            userId: user.id,
            username: user.username,
            email: user.email,
            phoneNumber: getUserPhone(user),
            customName: getUserDisplayName(user),
            confirmed: user.confirmed,
            blocked: user.blocked,
            markDeleteDate: user.MarkDeleteDate,
            branchId: user.Branch?.id || null,
          },
        });

        const updatedUser = await disableUserAccount({
          strapi,
          user,
        });

        disabledCount += 1;

        cronInfo({
          file: DELETE_USER_CRON_LOG_FILE,
          event: 'DELETE_USER_DISABLE_DONE',
          data: {
            runId,
            userId: user.id,
            username: user.username,
            email: user.email,
            phoneNumber: getUserPhone(user),
            customName: getUserDisplayName(user),
            old: {
              confirmed: user.confirmed,
              blocked: user.blocked,
              markDelete: user.MarkDelete,
              markDeleteDate: user.MarkDeleteDate,
              branchId: user.Branch?.id || null,
            },
            updated: {
              confirmed: updatedUser?.confirmed,
              blocked: updatedUser?.blocked,
              markDelete: updatedUser?.MarkDelete,
              markDeleteDate: updatedUser?.MarkDeleteDate,
              branchId: updatedUser?.Branch?.id || null,
            },
          },
        });
      } catch (userError: any) {
        failedCount += 1;

        cronError({
          file: DELETE_USER_CRON_LOG_FILE,
          event: 'DELETE_USER_DISABLE_FAILED',
          data: {
            runId,
            userId: user?.id,
            username: user?.username,
            email: user?.email,
            phoneNumber: getUserPhone(user),
            customName: getUserDisplayName(user),
            markDeleteDate: user?.MarkDeleteDate,
            errorName: userError?.name,
            errorMessage: userError?.message || String(userError),
            errorStack: userError?.stack,
          },
        });
      }
    }

    return {
      checked: true,
      pendingCount: users.length,
      disabledCount,
      skippedCount,
      failedCount,
    };
  } catch (error: any) {
    cronError({
      file: DELETE_USER_CRON_LOG_FILE,
      event: 'DELETE_USER_CRON_FAILED',
      data: {
        runId,
        now,
        errorName: error?.name,
        errorMessage: error?.message || String(error),
        errorStack: error?.stack,
      },
    });

    throw error;
  } finally {
    const finishedAt = new Date();

    cronEnd({
      file: DELETE_USER_CRON_LOG_FILE,
      runId,
      data: {
        runId,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      },
    });
  }
}