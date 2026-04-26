import { getApiRouteHandler } from './_routes/index.js';

function parseRouterRequest(req) {
  try {
    const url = new URL(req.url || '', 'https://example.com');
    const rewrittenPath = url.searchParams.get('__path');
    const query = Object.fromEntries(url.searchParams.entries());
    delete query.__path;

    if (rewrittenPath) {
      const rewrittenUrl = new URL(
        rewrittenPath.startsWith('/') ? rewrittenPath : `/${rewrittenPath}`,
        'https://example.com'
      );
      rewrittenUrl.searchParams.forEach((value, key) => {
        if (!(key in query)) {
          query[key] = value;
        }
      });

      return {
        path: `/api${rewrittenUrl.pathname}`.replace(/\/+$/, ''),
        query,
      };
    }

    return {
      path: url.pathname.replace(/\/+$/, ''),
      query,
    };
  } catch {
    return {
      path: '',
      query: {},
    };
  }
}

export default async function handler(req, res) {
  const parsedRequest = parseRouterRequest(req);
  const requestPath = parsedRequest.path;
  const routeHandler = getApiRouteHandler(requestPath)
    || (requestPath.startsWith('/api') ? null : getApiRouteHandler(`/api${requestPath}`));

  if (!routeHandler) {
    return res.status(404).json({
      success: false,
      error: 'API route not found',
    });
  }

  const nextQuery = {
    ...(req.query && typeof req.query === 'object' ? req.query : {}),
    ...parsedRequest.query,
  };
  delete nextQuery.__path;
  req.query = nextQuery;

  const queryString = new URLSearchParams(nextQuery).toString();
  req.url = queryString ? `${requestPath}?${queryString}` : requestPath;

  return routeHandler(req, res);
}
