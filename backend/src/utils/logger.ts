import fs from 'fs';
import path from 'path';
import util from 'util';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export type LoggerOptions = {
  dir?: string;
  fileName: string;
  level: LogLevel;
  event: string;
  data?: unknown;
};

const LOG_TIMEOUT_MS = 1500;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function getDateText(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-');
}

export function getDateTimeText(date = new Date()) {
  return `${getDateText(date)} ${[
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join(':')}`;
}

function serialize(data: unknown) {
  if (data === undefined) {
    return '';
  }

  if (data instanceof Error) {
    return JSON.stringify({
      name: data.name,
      message: data.message,
      stack: data.stack,
    });
  }

  try {
    return JSON.stringify(data);
  } catch {
    return util.inspect(data, {
      depth: 10,
      colors: false,
      compact: true,
      breakLength: Infinity,
    });
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Logger timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

async function writeLogFile(options: LoggerOptions) {
  const { dir = 'logs', fileName, level, event, data } = options;

  const logDir = path.join(process.cwd(), dir);
  const now = new Date();
  const filePath = path.join(logDir, fileName);

  const serializedData = serialize(data);

  const content = [
    `[${getDateTimeText(now)}]`,
    `[${level}]`,
    `[${event}]`,
    serializedData,
  ]
    .filter(Boolean)
    .join(' ') + '\n';

  await fs.promises.mkdir(logDir, {
    recursive: true,
  });

  await fs.promises.appendFile(filePath, content, 'utf8');
}

/**
 * Logger an toàn:
 * - Không throw lỗi ra ngoài
 * - Không block API
 * - Nếu ghi file lỗi hoặc timeout thì chỉ console.warn
 */
export function logger(options: LoggerOptions) {
  void withTimeout(writeLogFile(options), LOG_TIMEOUT_MS).catch((error) => {
    try {
      console.warn('[LOGGER_WRITE_FAILED]', {
        event: options.event,
        fileName: options.fileName,
        message: error?.message || String(error),
      });
    } catch {
      // Không làm gì thêm. Logger tuyệt đối không được phá API.
    }
  });
}