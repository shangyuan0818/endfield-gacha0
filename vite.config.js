import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import authRateLimitHandler from './api/auth-rate-limit.js'
import authAccountStatusHandler from './api/auth-account-status.js'
import accountRecoveryRequestHandler from './api/account-recovery-request.js'
import adminOpsAutomationHandler from './api/admin-ops-automation.js'
import adminResetRecoveryPasswordHandler from './api/admin-reset-recovery-password.js'
import automationFeedHandler from './api/automation-feed.js'
import selfDeleteAccountHandler from './api/self-delete-account.js'

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
    ['/api/automation-feed', automationFeedHandler],
    ['/api/admin-ops-automation', adminOpsAutomationHandler],
    ['/api/admin-reset-recovery-password', adminResetRecoveryPasswordHandler],
    ['/api/self-delete-account', selfDeleteAccountHandler]
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
    plugins: [react(), createDevApiPlugin()],
    base: './',
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
