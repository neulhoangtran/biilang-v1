import fs from 'fs';
import path from 'path';
import {
  getDateText,
  getDateTimeText,
  logger,
  LogLevel,
} from './logger';

type CronLoggerOptions = {
  file: string;
  event: string;
  data?: unknown;
};

type CronBoundaryOptions = {
  file: string;
  runId?: string;
  data?: unknown;
};

const CRON_LOG_TIMEOUT_MS = 1500;

function getCronDir(file: string) {
  return `logs/cron/${file}`;
}

function getCronFileName(file: string) {
  return `${file}-${getDateText()}.log`;
}

function getCronFilePath(file: string) {
  return path.join(process.cwd(), getCronDir(file), getCronFileName(file));
}

async function appendCronRawAsync(file: string, content: string) {
  const dir = path.join(process.cwd(), getCronDir(file));

  await fs.promises.mkdir(dir, {
    recursive: true,
  });

  await fs.promises.appendFile(getCronFilePath(file), content, 'utf8');
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Cron logger timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

function appendCronRaw(file: string, content: string) {
  void withTimeout(
    appendCronRawAsync(file, content),
    CRON_LOG_TIMEOUT_MS
  ).catch((error) => {
    try {
      console.warn('[CRON_LOGGER_WRITE_FAILED]', {
        file,
        message: error?.message || String(error),
      });
    } catch {
      // Không làm gì thêm.
    }
  });
}

function writeCronLog(level: LogLevel, options: CronLoggerOptions) {
  logger({
    dir: getCronDir(options.file),
    fileName: getCronFileName(options.file),
    level,
    event: options.event,
    data: options.data,
  });
}

export function cronStart(options: CronBoundaryOptions) {
  const now = new Date();

  appendCronRaw(
    options.file,
    [
      '',
      `==================== START CRON ${options.file} | ${getDateTimeText(now)}${
        options.runId ? ` | RUN ${options.runId}` : ''
      } ====================`,
      '',
    ].join('\n')
  );

  if (options.data !== undefined) {
    cronInfo({
      file: options.file,
      event: 'CRON_RUN_START',
      data: options.data,
    });
  }
}

export function cronEnd(options: CronBoundaryOptions) {
  const now = new Date();

  if (options.data !== undefined) {
    cronInfo({
      file: options.file,
      event: 'CRON_RUN_END',
      data: options.data,
    });
  }

  appendCronRaw(
    options.file,
    [
      '',
      `==================== END CRON ${options.file} | ${getDateTimeText(now)}${
        options.runId ? ` | RUN ${options.runId}` : ''
      } ====================`,
      '',
    ].join('\n')
  );
}

export function cronInfo(options: CronLoggerOptions) {
  writeCronLog('INFO', options);
}

export function cronWarn(options: CronLoggerOptions) {
  writeCronLog('WARN', options);
}

export function cronError(options: CronLoggerOptions) {
  writeCronLog('ERROR', options);
}

export function cronDebug(options: CronLoggerOptions) {
  writeCronLog('DEBUG', options);
}