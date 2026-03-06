import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: {
      // 开发环境代理 - 将 /api/hg-proxy 请求转发到鹰角 API
      '/api/hg-proxy': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy) => {
          // 如果本地代理服务器不可用，会报错
          proxy.on('error', () => {
            console.log('[Vite Proxy] 代理错误，请确保运行了本地代理服务器');
            console.log('[Vite Proxy] 运行: node dev-proxy.js');
          });
        }
      },
      // 开发环境代理 - 将 /api/wiki-proxy 请求转发到本地代理
      '/api/wiki-proxy': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
