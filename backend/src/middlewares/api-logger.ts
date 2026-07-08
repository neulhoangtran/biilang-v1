import { systemInfo, systemError } from '../utils/system-logger';

function createRequestId() {
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function shouldSkipLog(path: string) {
  const cleanPath = String(path || '').toLowerCase();

  return (
    /**
     * Static files
     */
    cleanPath.startsWith('/uploads') ||
    cleanPath.startsWith('/favicon') ||

    /**
     * Strapi Admin UI / Admin API
     */
    cleanPath.startsWith('/admin') ||

    /**
     * Strapi internal admin plugins
     */
    cleanPath.startsWith('/content-manager') ||
    cleanPath.startsWith('/content-type-builder') ||
    cleanPath.startsWith('/upload') ||
    cleanPath.startsWith('/i18n') ||
    cleanPath.startsWith('/documentation') ||

    /**
     * Admin dev/build assets
     */
    cleanPath.includes('/admin/node_modules') ||
    cleanPath.includes('/admin/assets') ||

    /**
     * Static extensions
     */
    cleanPath.endsWith('.js') ||
    cleanPath.endsWith('.css') ||
    cleanPath.endsWith('.map') ||
    cleanPath.endsWith('.ico') ||
    cleanPath.endsWith('.png') ||
    cleanPath.endsWith('.jpg') ||
    cleanPath.endsWith('.jpeg') ||
    cleanPath.endsWith('.svg') ||
    cleanPath.endsWith('.webp') ||
    cleanPath.endsWith('.woff') ||
    cleanPath.endsWith('.woff2') ||
    cleanPath.endsWith('.ttf')
  );
}

function getSafeUser(ctx: any) {
  const user = ctx.state?.user;

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
  };
}

export default () => {
  return async (ctx: any, next: any) => {
    const startedAt = Date.now();
    const requestId = ctx.state.requestId || createRequestId();

    ctx.state.requestId = requestId;

    const skipLog = shouldSkipLog(ctx.path);

    if (!skipLog) {
      systemInfo({
        scope: 'api',
        event: 'REQUEST_START',
        requestId,
        userId: ctx.state?.user?.id,
        data: {
          method: ctx.method,
          path: ctx.path,
          query: ctx.query,
          ip: ctx.ip,
          userAgent: ctx.request.headers['user-agent'],
          user: getSafeUser(ctx),
        },
      });
    }

    try {
      await next();

      if (!skipLog) {
        systemInfo({
          scope: 'api',
          event: 'REQUEST_END',
          requestId,
          userId: ctx.state?.user?.id,
          data: {
            method: ctx.method,
            path: ctx.path,
            status: ctx.status,
            durationMs: Date.now() - startedAt,
          },
        });
      }
    } catch (error: any) {
      if (!skipLog) {
        systemError({
          scope: 'error',
          event: 'REQUEST_FAILED',
          requestId,
          userId: ctx.state?.user?.id,
          data: {
            method: ctx.method,
            path: ctx.path,
            status: error?.status || ctx.status || 500,
            durationMs: Date.now() - startedAt,
            errorName: error?.name,
            errorMessage: error?.message || String(error),
            errorStack: error?.stack,
          },
        });
      }

      throw error;
    }
  };
};