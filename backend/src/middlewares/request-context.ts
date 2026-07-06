import crypto from 'crypto';

function createRequestId() {
  return `req_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

export default () => {
  return async (ctx, next) => {
    const requestId =
      ctx.request.headers['x-request-id'] ||
      ctx.request.headers['x-correlation-id'] ||
      createRequestId();

    ctx.state.requestId = String(requestId);
    ctx.set('X-Request-Id', String(requestId));

    await next();
  };
};