-- ============================================
-- 020: 修复函数 search_path 安全警告
-- 为所有 SECURITY DEFINER 函数添加 SET search_path = public
-- ============================================

-- ============================================
-- 1. validate_email_domain
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_email_domain(check_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    email_domain TEXT;
    is_valid BOOLEAN := FALSE;
BEGIN
    -- 检查邮箱格式
    IF check_email IS NULL OR check_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        RETURN jsonb_build_object('valid', false, 'reason', '邮箱格式不正确');
    END IF;

    -- 提取域名
    email_domain := LOWER(SPLIT_PART(check_email, '@', 2));

    -- 1. 检查是否在黑名单中
    IF EXISTS (SELECT 1 FROM public.email_blacklist WHERE 
        (type = 'email' AND LOWER(email) = LOWER(check_email)) OR
        (type = 'domain' AND LOWER(email) = email_domain)
    ) THEN
        RETURN jsonb_build_object('valid', false, 'reason', '该邮箱已被禁止注册');
    END IF;

    -- 2. 检查精确匹配的域名
    IF EXISTS (SELECT 1 FROM public.email_whitelist WHERE domain = email_domain) THEN
        is_valid := TRUE;
    END IF;

    -- 返回结果
    IF is_valid THEN
        RETURN jsonb_build_object('valid', true);
    ELSE
        RETURN jsonb_build_object(
            'valid', false, 
            'reason', '请使用主流邮箱服务商（如 Gmail、Outlook、QQ邮箱、163邮箱等）、知名论坛/社区邮箱或企业邮箱注册'
        );
    END IF;
END;
$$;

-- ============================================
-- 2. is_email_blacklisted (如果存在)
-- ============================================
CREATE OR REPLACE FUNCTION public.is_email_blacklisted(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    email_domain TEXT;
BEGIN
    IF check_email IS NULL THEN
        RETURN FALSE;
    END IF;
    
    email_domain := LOWER(SPLIT_PART(check_email, '@', 2));
    
    RETURN EXISTS (
        SELECT 1 FROM public.email_blacklist 
        WHERE (type = 'email' AND LOWER(email) = LOWER(check_email))
           OR (type = 'domain' AND LOWER(email) = email_domain)
    );
END;
$$;

-- ============================================
-- 3. cleanup_rate_limit_logs
-- ============================================
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.rate_limit_logs WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- ============================================
-- 4. check_rate_limit
-- ============================================
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_identifier TEXT,
    p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    config_row public.rate_limit_config%ROWTYPE;
    attempt_count INT;
    oldest_attempt TIMESTAMPTZ;
    lockout_until TIMESTAMPTZ;
BEGIN
    -- 获取配置
    SELECT * INTO config_row FROM public.rate_limit_config WHERE action = p_action;
    
    IF config_row IS NULL THEN
        RETURN jsonb_build_object('allowed', true);
    END IF;

    -- 计算时间窗口内的尝试次数
    SELECT COUNT(*), MIN(created_at)
    INTO attempt_count, oldest_attempt
    FROM public.rate_limit_logs
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

-- ============================================
-- 5. log_rate_limit
-- ============================================
CREATE OR REPLACE FUNCTION public.log_rate_limit(
    p_identifier TEXT,
    p_action TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.rate_limit_logs (identifier, action) VALUES (p_identifier, p_action);
END;
$$;

-- ============================================
-- 6. check_and_log_rate_limit
-- ============================================
CREATE OR REPLACE FUNCTION public.check_and_log_rate_limit(
    p_identifier TEXT,
    p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    check_result JSONB;
BEGIN
    check_result := public.check_rate_limit(p_identifier, p_action);
    
    IF (check_result->>'allowed')::BOOLEAN THEN
        PERFORM public.log_rate_limit(p_identifier, p_action);
    END IF;
    
    RETURN check_result;
END;
$$;

-- ============================================
-- 7. is_super_admin
-- ============================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    );
END;
$$;

-- ============================================
-- 8. handle_new_user
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, username, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
        'user'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- ============================================
-- 9. update_tickets_updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.update_tickets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ============================================
-- 重新授权
-- ============================================
GRANT EXECUTE ON FUNCTION public.validate_email_domain(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_email_domain(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_email_blacklisted(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.is_email_blacklisted(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_rate_limit(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.log_rate_limit(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_log_rate_limit(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_and_log_rate_limit(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

