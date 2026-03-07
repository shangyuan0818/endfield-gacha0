import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }

          if (
            id.includes('react-markdown')
            || id.includes('remark-gfm')
            || id.includes('rehype-raw')
            || id.includes('rehype-sanitize')
            || id.includes('@uiw/react-md-editor')
            || id.includes('dompurify')
          ) {
            return 'markdown-vendor';
          }

          if (
            id.includes('recharts')
            || id.includes('/d3-')
            || id.includes('/victory-vendor/')
          ) {
            return 'charts-vendor';
          }

          if (id.includes('@supabase/')) {
            return 'supabase-vendor';
          }

          if (id.includes('react-window') || id.includes('react-virtualized-auto-sizer')) {
            return 'virtual-list-vendor';
          }

          if (
            id.includes('react-router')
            || id.includes('react-dom')
            || id.includes('/react/')
            || id.includes('/scheduler/')
            || id.includes('zustand')
          ) {
            return 'react-vendor';
          }

          if (id.includes('canvas-confetti')) {
            return 'effects-vendor';
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
            console.log('[Vite Proxy] 私有代理不可用，公开仓库默认不附带该服务');
            console.log('[Vite Proxy] 如需导入链路，请接入单独维护的私有代理/后端');
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
