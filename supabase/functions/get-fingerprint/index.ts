import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 生成服务端指纹
 * 基于 IP + User-Agent + 盐值的哈希
 */
async function generateFingerprint(req: Request): Promise<string> {
  const ip = req.headers.get('x-forwarded-for') ||
             req.headers.get('x-real-ip') ||
             'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const salt = Deno.env.get('FINGERPRINT_SALT') || 'default-salt';

  // 使用Web Crypto API生成SHA-256哈希
  const data = `${ip}:${userAgent}:${salt}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * 检查频率限制
 */
async function checkRateLimit(
  supabase: any,
  fingerprint: string,
  action: string
): Promise<{ allowed: boolean; message?: string; retryAfter?: number }> {
  try {
    // 调用现有的频率限制RPC函数
    const { data, error } = await supabase.rpc('check_and_log_rate_limit', {
      identifier: fingerprint,
      action: action,
      max_attempts: 5,
      window_minutes: 15
    });

    if (error) throw error;

    if (!data.allowed) {
      return {
        allowed: false,
        message: '请求过于频繁，请稍后再试',
        retryAfter: data.retry_after_seconds || 900
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // 降级策略：如果频率限制检查失败，允许访问
    return { allowed: true };
  }
}

Deno.serve(async (req) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 生成指纹
    const fingerprint = await generateFingerprint(req);

    // 创建Supabase客户端
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 检查频率限制
    const rateLimitResult = await checkRateLimit(supabase, fingerprint, 'app_access');

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: 'rate_limit_exceeded',
          message: rateLimitResult.message,
          retryAfter: rateLimitResult.retryAfter
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 返回指纹和访问令牌
    return new Response(
      JSON.stringify({
        fingerprint: fingerprint.substring(0, 16), // 返回前16位用于日志
        allowed: true,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
