import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // 仅在开发环境输出警告
  if (import.meta.env.DEV) {
    console.warn('Supabase 配置缺失，云同步功能将不可用。请检查 .env 文件。')
  }
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// 检查 Supabase 是否可用
export const isSupabaseConfigured = () => {
  return supabase !== null
}
