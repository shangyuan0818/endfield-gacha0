import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { preloadAllData } from './services/cacheService'

// 在应用启动时预加载缓存数据（不阻塞渲染）
preloadAllData().catch(err => {
  console.warn('预加载数据失败，将使用实时查询:', err);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
