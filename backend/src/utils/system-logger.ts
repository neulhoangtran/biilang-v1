import { getDateText, logger, LogLevel } from './logger';

type SystemLogOptions = {
  scope?: string;
  event: string;
  requestId?: string;
  userId?: number | string | null;
  data?: unknown;
};

function normalizeScope(scope?: string) {
  const safeScope = String(scope || 'other')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-');

  return safeScope || 'other';
}

function getScopedLogFileName(scope?: string) {
  const safeScope = normalizeScope(scope);
  return `${safeScope}-log-${getDateText()}.log`;
}

function mergeLogData(options: SystemLogOptions) {
  const { scope, requestId, userId, data } = options;

  const baseData = {
    scope: normalizeScope(scope),
    requestId,
    userId,
  };

  if (data === undefined || data === null) {
    return baseData;
  }

  if (typeof data === 'object' && !Array.isArray(data)) {
    return {
      ...baseData,
      ...(data as Record<string, unknown>),
    };
  }

  return {
    ...baseData,
    data,
  };
}

function writeScopedLog(level: LogLevel, options: SystemLogOptions) {
  const scope = normalizeScope(options.scope);

  logger({
    fileName: getScopedLogFileName(scope),
    level,
    event: options.event,
    data: mergeLogData({
      ...options,
      scope,
    }),
  });
}

export function systemInfo(options: SystemLogOptions) {
  writeScopedLog('INFO', options);
}

export function systemWarn(options: SystemLogOptions) {
  writeScopedLog('WARN', options);
}

export function systemError(options: SystemLogOptions) {
  writeScopedLog('ERROR', options);
}

export function systemDebug(options: SystemLogOptions) {
  writeScopedLog('DEBUG', options);
}