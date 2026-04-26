import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import webfontDownload from 'vite-plugin-webfont-dl'
import adminHandler from './api/admin.js'
import authRateLimitHandler from './api/auth-rate-limit.js'
import authAccountStatusHandler from './api/auth-account-status.js'
import accountRecoveryRequestHandler from './api/account-recovery-request.js'
import officialAnnouncementImageHandler from './api/official-announcement-image.js'
import selfDeleteAccountHandler from './api/self-delete-account.js'
import devApplicationsHandler from './api/dev/applications/index.js'
import devApplicationsMeHandler from './api/dev/applications/me.js'
import devV1MetaHandler from './api/dev/v1/meta.js'
import devV1OpenApiHandler from './api/dev/v1/openapi.js'
import devV1PoolsHandler from './api/dev/v1/pools.js'
import devV1PoolHandler from './api/dev/v1/pool.js'
import devV1CharactersHandler from './api/dev/v1/characters.js'
import devV1CharacterHandler from './api/dev/v1/character.js'
import devV1AnnouncementsHandler from './api/dev/v1/announcements.js'
import devV1StatsGlobalHandler from './api/dev/v1/stats/global.js'
import devV1StatsRankingsHandler from './api/dev/v1/stats/rankings.js'
import devV1StatsPoolsHandler from './api/dev/v1/stats/pools.js'
import devV1StatsPoolHandler from './api/dev/v1/stats/pool.js'
import devV1StatsItemsHandler from './api/dev/v1/stats/items.js'
import devV1StatsItemHandler from './api/dev/v1/stats/item.js'
import devV1StatsTrendsHandler from './api/dev/v1/stats/trends.js'
import devV1StatsDistributionsHandler from './api/dev/v1/stats/distributions.js'
import devV1BotSelfSummaryHandler from './api/dev/v1/bot/self-summary.js'
import devV1BotRecentPullsHandler from './api/dev/v1/bot/recent-pulls.js'
import devV1BotPoolsHandler from './api/dev/v1/bot/pools.js'
import devV1BotDashboardHandler from './api/dev/v1/bot/dashboard.js'
import devV1BotPoolDetailHandler from './api/dev/v1/bot/pool-detail.js'
import devV1BotAnalysisHandler from './api/dev/v1/bot/analysis.js'
import devV1BotShareCardHandler from './api/dev/v1/bot/share-card.js'
import devV1BotPoolLogHandler from './api/dev/v1/bot/pool-log.js'
import devV1SiteOverviewHandler from './api/dev/v1/site/overview.js'
import bindingMeHandler from './api/integrations/bindings/me.js'
import bindingChallengeHandler from './api/integrations/bindings/challenge.js'
import bindingVerifyHandler from './api/integrations/bindings/verify.js'
import bindingRevokeHandler from './api/integrations/bindings/revoke.js'
import botImportNotifyHandler from './api/integrations/bot/import-notify.js'

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let rawBody = ''

    req.on('data', (chunk) => {
      rawBody += chunk
    })

    req.on('end', () => {
      if (!rawBody) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(rawBody))
      } catch (error) {
        reject(error)
      }
    })

    req.on('error', reject)
  })
}

function createVercelLikeResponse(res) {
  res.status = (statusCode) => {
    res.statusCode = statusCode
    return res
  }

  res.json = (payload) => {
    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
    }
    res.end(JSON.stringify(payload))
    return res
  }

  return res
}

function normalizeRequestPath(url) {
  if (!url) {
    return ''
  }

  const pathname = new URL(url, 'http://localhost').pathname
  if (!pathname || pathname === '/') {
    return pathname
  }

  return pathname.replace(/\/+$/, '')
}

function readQuery(url) {
  if (!url) {
    return {}
  }

  const searchParams = new URL(url, 'http://localhost').searchParams
  return Object.fromEntries(searchParams.entries())
}

function createApiMiddleware(routeHandlers) {
  return async (req, res, next) => {
    const requestPath = normalizeRequestPath(req.url)
    const handler = routeHandlers.get(requestPath)
    const debugApi = process.env.DEBUG_VITE_API === '1'

    if (debugApi && requestPath.startsWith('/api/')) {
      console.log(`[dev-api] ${req.method || 'GET'} ${requestPath} -> ${handler ? 'handler' : 'next'}`)
    }

    if (!handler) {
      next()
      return
    }

    try {
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
        req.body = await readJsonBody(req)
      } else {
        req.body = {}
      }
      req.query = readQuery(req.url)

      await handler(req, createVercelLikeResponse(res))
    } catch (error) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({
        success: false,
        error: error?.message || 'Dev API handler failed'
      }))
    }
  }
}

function installMiddlewareFirst(server, middleware) {
  const stack = server?.middlewares?.stack
  if (Array.isArray(stack)) {
    stack.unshift({
      route: '',
      handle: middleware
    })
    return
  }

  server.middlewares.use(middleware)
}

function createDevApiPlugin() {
  const routeHandlers = new Map([
    ['/api/auth-rate-limit', authRateLimitHandler],
    ['/api/auth-account-status', authAccountStatusHandler],
    ['/api/account-recovery-request', accountRecoveryRequestHandler],
    ['/api/admin', adminHandler],
    ['/api/admin-ops-automation', adminHandler],
    ['/api/admin-reset-recovery-password', adminHandler],
    ['/api/admin-users', adminHandler],
    ['/api/admin-delete-user', adminHandler],
    ['/api/admin-user-reset-password', adminHandler],
    ['/api/official-announcement-image', officialAnnouncementImageHandler],
    ['/api/self-delete-account', selfDeleteAccountHandler],
    ['/api/dev/applications', devApplicationsHandler],
    ['/api/dev/applications/me', devApplicationsMeHandler],
    ['/api/dev/v1/meta', devV1MetaHandler],
    ['/api/dev/v1/openapi', devV1OpenApiHandler],
    ['/api/dev/v1/pools', devV1PoolsHandler],
    ['/api/dev/v1/pool', devV1PoolHandler],
    ['/api/dev/v1/characters', devV1CharactersHandler],
    ['/api/dev/v1/character', devV1CharacterHandler],
    ['/api/dev/v1/announcements', devV1AnnouncementsHandler],
    ['/api/dev/v1/stats/global', devV1StatsGlobalHandler],
    ['/api/dev/v1/stats/rankings', devV1StatsRankingsHandler],
    ['/api/dev/v1/stats/pools', devV1StatsPoolsHandler],
    ['/api/dev/v1/stats/pool', devV1StatsPoolHandler],
    ['/api/dev/v1/stats/items', devV1StatsItemsHandler],
    ['/api/dev/v1/stats/item', devV1StatsItemHandler],
    ['/api/dev/v1/stats/trends', devV1StatsTrendsHandler],
    ['/api/dev/v1/stats/distributions', devV1StatsDistributionsHandler],
    ['/api/dev/v1/bot/self-summary', devV1BotSelfSummaryHandler],
    ['/api/dev/v1/bot/recent-pulls', devV1BotRecentPullsHandler],
    ['/api/dev/v1/bot/pools', devV1BotPoolsHandler],
    ['/api/dev/v1/bot/dashboard', devV1BotDashboardHandler],
    ['/api/dev/v1/bot/pool-detail', devV1BotPoolDetailHandler],
    ['/api/dev/v1/bot/analysis', devV1BotAnalysisHandler],
    ['/api/dev/v1/bot/share-card', devV1BotShareCardHandler],
    ['/api/dev/v1/bot/pool-log', devV1BotPoolLogHandler],
    ['/api/dev/v1/site/overview', devV1SiteOverviewHandler],
    ['/api/integrations/bindings/me', bindingMeHandler],
    ['/api/integrations/bindings/challenge', bindingChallengeHandler],
    ['/api/integrations/bindings/verify', bindingVerifyHandler],
    ['/api/integrations/bindings/revoke', bindingRevokeHandler],
    ['/api/integrations/bot/import-notify', botImportNotifyHandler]
  ])
  const middleware = createApiMiddleware(routeHandlers)

  return {
    name: 'dev-api-handlers',
    configureServer(server) {
      installMiddlewareFirst(server, middleware)
    },
    configurePreviewServer(server) {
      installMiddlewareFirst(server, middleware)
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, process.cwd(), '')
  const backendEnv = loadEnv(mode, `${process.cwd()}/backend`, '')
  const env = {
    ...backendEnv,
    ...rootEnv
  }

  Object.entries(env).forEach(([key, value]) => {
    if (typeof process.env[key] === 'undefined') {
      process.env[key] = value
    }
  })

  return {
    plugins: [
      react(),
      createDevApiPlugin(),
      webfontDownload([
        'https://fonts.googleapis.com/css2?family=Teko:wght@600&family=Noto+Serif+SC:wght@700;900&family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;700&display=swap'
      ])
    ],
    // The app is deployed at the domain root, so generated asset and SW URLs
    // must stay absolute across nested SPA routes like /m/summary.
    base: '/',
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return
            }

            if (id.includes('@supabase/')) {
              return 'supabase-vendor'
            }

            if (id.includes('canvas-confetti')) {
              return 'effects-vendor'
            }
          }
        }
      }
    },
    server: {
      proxy: {
        // 开发环境代理 - 可选地转发到私有代理服务
        '/api/hg-proxy': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          configure: (proxy) => {
            // 如果私有代理服务不可用，会报错
            proxy.on('error', () => {
              console.log('[Vite Proxy] 私有代理不可用，公开仓库默认不附带该服务')
              console.log('[Vite Proxy] 如需导入链路，请接入单独维护的私有代理/后端')
            })
          }
        },
        // 开发环境代理 - 将 /api/wiki-proxy 请求转发到本地代理
        '/api/wiki-proxy': {
          target: 'http://localhost:3001',
          changeOrigin: true
        }
      }
    }
  }
})
