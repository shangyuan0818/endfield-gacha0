import { getApiRouteHandler } from './_routes/index.js';

function createQueryObject(req) {
  try {
    const url = new URL(req.url || '', 'https://example.com');
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return {};
  }
}

function getRequestPath(req) {
  try {
    const url = new URL(req.url || '', 'https://example.com');
    const rewrittenPath = url.searchParams.get('__path');
    if (rewrittenPath) {
      return `/api/${rewrittenPath}`.replace(/\/+$/, '');
    }

    return url.pathname.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export default async function handler(req, res) {
  const requestPath = getRequestPath(req);
  const routeHandler = getApiRouteHandler(requestPath)
    || (requestPath.startsWith('/api') ? null : getApiRouteHandler(`/api${requestPath}`));

  if (!routeHandler) {
    return res.status(404).json({
      success: false,
      error: 'API route not found',
    });
  }

  if (!req.query) {
    req.query = createQueryObject(req);
  }

  return routeHandler(req, res);
}
