-- ============================================
-- 017: 邮箱域名白名单验证 (后端实现)
-- 修复 SEC-001: 将前端验证移至后端
-- ============================================

-- 创建邮箱白名单表
CREATE TABLE IF NOT EXISTS email_whitelist (
    id SERIAL PRIMARY KEY,
    domain TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('mainstream', 'community', 'corporate')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入主流邮箱服务商
INSERT INTO email_whitelist (domain, type) VALUES
    -- 国际
    ('gmail.com', 'mainstream'),
    ('googlemail.com', 'mainstream'),
    ('outlook.com', 'mainstream'),
    ('hotmail.com', 'mainstream'),
    ('live.com', 'mainstream'),
    ('msn.com', 'mainstream'),
    ('yahoo.com', 'mainstream'),
    ('yahoo.co.jp', 'mainstream'),
    ('yahoo.co.uk', 'mainstream'),
    ('icloud.com', 'mainstream'),
    ('me.com', 'mainstream'),
    ('mac.com', 'mainstream'),
    ('protonmail.com', 'mainstream'),
    ('proton.me', 'mainstream'),
    ('zoho.com', 'mainstream'),
    ('aol.com', 'mainstream'),
    ('mail.com', 'mainstream'),
    ('gmx.com', 'mainstream'),
    ('gmx.net', 'mainstream'),
    ('yandex.com', 'mainstream'),
    ('yandex.ru', 'mainstream'),
    -- 国内
    ('qq.com', 'mainstream'),
    ('foxmail.com', 'mainstream'),
    ('163.com', 'mainstream'),
    ('126.com', 'mainstream'),
    ('yeah.net', 'mainstream'),
    ('netease.com', 'mainstream'),
    ('sina.com', 'mainstream'),
    ('sina.cn', 'mainstream'),
    ('sohu.com', 'mainstream'),
    ('aliyun.com', 'mainstream'),
    ('alibaba-inc.com', 'mainstream'),
    ('189.cn', 'mainstream'),
    ('21cn.com', 'mainstream'),
    ('tom.com', 'mainstream')
ON CONFLICT (domain) DO NOTHING;

-- 插入知名社区邮箱
INSERT INTO email_whitelist (domain, type) VALUES
    ('linux.do', 'community'),
    ('v2ex.com', 'community'),
    ('github.com', 'community'),
    ('gitlab.com', 'community'),
    ('bitbucket.org', 'community'),
    ('sourcehut.org', 'community')
ON CONFLICT (domain) DO NOTHING;

-- 插入知名企业邮箱
INSERT INTO email_whitelist (domain, type) VALUES
    ('microsoft.com', 'corporate'),
    ('apple.com', 'corporate'),
    ('google.com', 'corporate'),
    ('amazon.com', 'corporate'),
    ('meta.com', 'corporate'),
    ('facebook.com', 'corporate'),
    ('tencent.com', 'corporate'),
    ('alibaba.com', 'corporate'),
    ('bytedance.com', 'corporate'),
    ('baidu.com', 'corporate'),
    ('bilibili.com', 'corporate'),
    ('mihoyo.com', 'corporate'),
    ('hypergryph.com', 'corporate'),
    ('gryphline.com', 'corporate')
ON CONFLICT (domain) DO NOTHING;

-- 创建邮箱域名验证函数 (RPC)
CREATE OR REPLACE FUNCTION validate_email_domain(check_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    email_domain TEXT;
    is_valid BOOLEAN := FALSE;
    reject_reason TEXT := '';
BEGIN
    -- 检查邮箱格式
    IF check_email IS NULL OR check_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        RETURN jsonb_build_object('valid', false, 'reason', '邮箱格式不正确');
    END IF;

    -- 提取域名
    email_domain := LOWER(SPLIT_PART(check_email, '@', 2));

    -- 1. 检查是否在黑名单中
    IF EXISTS (SELECT 1 FROM email_blacklist WHERE 
        (type = 'email' AND LOWER(email) = LOWER(check_email)) OR
        (type = 'domain' AND LOWER(email) = email_domain)
    ) THEN
        RETURN jsonb_build_object('valid', false, 'reason', '该邮箱已被禁止注册');
    END IF;

    -- 2. 检查精确匹配的域名
    IF EXISTS (SELECT 1 FROM email_whitelist WHERE domain = email_domain) THEN
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

-- 授权匿名用户可以调用此函数
GRANT EXECUTE ON FUNCTION validate_email_domain(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION validate_email_domain(TEXT) TO authenticated;

-- 允许读取白名单表（用于调试）
-- GRANT SELECT ON email_whitelist TO authenticated;

COMMENT ON FUNCTION validate_email_domain IS '验证邮箱域名是否在白名单中，防止临时邮箱注册';
COMMENT ON TABLE email_whitelist IS '邮箱域名白名单，用于注册验证';

