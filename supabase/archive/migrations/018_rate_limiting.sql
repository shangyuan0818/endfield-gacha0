-- ============================================
-- 018: API 请求频率限制
-- 修复 SEC-002: 防止暴力破解和滥用
-- ============================================

-- 创建请求记录表
CREATE TABLE IF NOT EXISTS rate_limit_logs (
    id SERIAL PRIMARY KEY,
    identifier TEXT NOT NULL,           -- IP地址或用户ID
    action TEXT NOT NULL,               -- 操作类型: 'login', 'register', 'password_reset'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_lookup 
ON rate_limit_logs (identifier, action, created_at DESC);

-- 自动清理过期记录（保留24小时）
CREATE OR REPLACE FUNCTION cleanup_rate_limit_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM rate_limit_logs WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- 频率限制配置
CREATE TABLE IF NOT EXISTS rate_limit_config (
    action TEXT PRIMARY KEY,
    max_attempts INT NOT NULL,          -- 最大尝试次数
    window_minutes INT NOT NULL,        -- 时间窗口（分钟）
    lockout_minutes INT DEFAULT 30      -- 锁定时间（分钟）
);

-- 插入默认配置
INSERT INTO rate_limit_config (action, max_attempts, window_minutes, lockout_minutes) VALUES
    ('login', 5, 15, 30),               -- 15分钟内最多5次登录尝试，超过后锁定30分钟
    ('register', 3, 60, 60),            -- 60分钟内最多3次注册尝试
    ('password_reset', 3, 60, 60),      -- 60分钟内最多3次密码重置
    ('email_verify', 3, 60, 60)         -- 60分钟内最多3次发送验证邮件
ON CONFLICT (action) DO NOTHING;

-- 检查是否超过频率限制
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_identifier TEXT,
    p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    config_row rate_limit_config%ROWTYPE;
    attempt_count INT;
    oldest_attempt TIMESTAMPTZ;
    lockout_until TIMESTAMPTZ;
BEGIN
    -- 获取配置
    SELECT * INTO config_row FROM rate_limit_config WHERE action = p_action;
    
    IF config_row IS NULL THEN
        -- 如果没有配置，默认允许
        RETURN jsonb_build_object('allowed', true);
    END IF;

    -- 计算时间窗口内的尝试次数
    SELECT COUNT(*), MIN(created_at)
    INTO attempt_count, oldest_attempt
    FROM rate_limit_logs
    WHERE identifier = p_identifier
      AND action = p_action
      AND created_at > NOW() - (config_row.window_minutes || ' minutes')::INTERVAL;

    -- 检查是否超过限制
    IF attempt_count >= config_row.max_attempts THEN
        lockout_until := oldest_attempt + (config_row.window_minutes + config_row.lockout_minutes || ' minutes')::INTERVAL;
        
        IF lockout_until > NOW() THEN
            RETURN jsonb_build_object(
                'allowed', false,
                'reason', '操作过于频繁，请稍后再试',
                'retry_after', EXTRACT(EPOCH FROM (lockout_until - NOW()))::INT,
                'lockout_until', lockout_until
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'remaining', config_row.max_attempts - attempt_count,
        'reset_at', NOW() + (config_row.window_minutes || ' minutes')::INTERVAL
    );
END;
$$;

-- 记录请求
CREATE OR REPLACE FUNCTION log_rate_limit(
    p_identifier TEXT,
    p_action TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO rate_limit_logs (identifier, action) VALUES (p_identifier, p_action);
END;
$$;

-- 组合函数：检查并记录
CREATE OR REPLACE FUNCTION check_and_log_rate_limit(
    p_identifier TEXT,
    p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    check_result JSONB;
BEGIN
    -- 先检查
    check_result := check_rate_limit(p_identifier, p_action);
    
    -- 如果允许，记录这次请求
    IF (check_result->>'allowed')::BOOLEAN THEN
        PERFORM log_rate_limit(p_identifier, p_action);
    END IF;
    
    RETURN check_result;
END;
$$;

-- 授权
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION log_rate_limit(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION log_rate_limit(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_log_rate_limit(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_and_log_rate_limit(TEXT, TEXT) TO authenticated;

-- 定期清理任务（需要 pg_cron 扩展，如果可用）
-- SELECT cron.schedule('cleanup-rate-limits', '0 * * * *', 'SELECT cleanup_rate_limit_logs()');

COMMENT ON TABLE rate_limit_logs IS '请求频率限制日志表';
COMMENT ON TABLE rate_limit_config IS '频率限制配置表';
COMMENT ON FUNCTION check_rate_limit IS '检查是否超过频率限制';
COMMENT ON FUNCTION check_and_log_rate_limit IS '检查频率限制并记录请求';

