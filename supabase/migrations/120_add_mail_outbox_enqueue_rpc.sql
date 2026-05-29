-- 120: add provider-independent mail outbox enqueue RPC.
--
-- MAIL-ABUSE-001 finish slice:
-- - keep enqueue server-only via service_role;
-- - atomically check hashed budget counters and insert a queued outbox row;
-- - return dedupe/block/queue metadata without exposing raw recipient data.

CREATE OR REPLACE FUNCTION public.enqueue_mail_outbox_event(
  p_event_type TEXT,
  p_recipient_email_hash TEXT,
  p_recipient_domain TEXT,
  p_template_key TEXT,
  p_idempotency_key TEXT,
  p_locale TEXT DEFAULT 'zh-CN',
  p_payload_redacted_json JSONB DEFAULT '{}'::jsonb,
  p_priority SMALLINT DEFAULT 5,
  p_guard_decision JSONB DEFAULT '{}'::jsonb,
  p_budget_buckets JSONB DEFAULT '[]'::jsonb,
  p_created_by_user_id UUID DEFAULT NULL,
  p_related_entity_type TEXT DEFAULT NULL,
  p_related_entity_id TEXT DEFAULT NULL,
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
  v_inserted_id UUID;
  v_bucket JSONB;
  v_bucket_key TEXT;
  v_scope TEXT;
  v_bucket_event_type TEXT;
  v_window_reset_at TIMESTAMPTZ;
  v_max_attempts INTEGER;
  v_used_count INTEGER;
  v_block_result JSONB;
BEGIN
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RETURN jsonb_build_object(
      'action', 'block',
      'code', 'mail_missing_idempotency_key',
      'reason', 'Missing mail idempotency key.'
    );
  END IF;

  SELECT id INTO v_existing_id
  FROM public.mail_outbox
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'action', 'dedupe',
      'code', 'mail_idempotency_hit',
      'outbox_id', v_existing_id,
      'idempotency_key', p_idempotency_key
    );
  END IF;

  IF jsonb_typeof(COALESCE(p_budget_buckets, '[]'::jsonb)) <> 'array' THEN
    RETURN jsonb_build_object(
      'action', 'block',
      'code', 'mail_invalid_budget_buckets',
      'reason', 'Budget buckets must be a JSON array.',
      'idempotency_key', p_idempotency_key
    );
  END IF;

  IF jsonb_array_length(COALESCE(p_budget_buckets, '[]'::jsonb)) = 0 THEN
    RETURN jsonb_build_object(
      'action', 'block',
      'code', 'mail_missing_budget_buckets',
      'reason', 'At least one budget bucket is required.',
      'idempotency_key', p_idempotency_key
    );
  END IF;

  FOR v_bucket IN SELECT value FROM jsonb_array_elements(COALESCE(p_budget_buckets, '[]'::jsonb))
  LOOP
    v_bucket_key := btrim(COALESCE(v_bucket ->> 'bucketKeyHash', v_bucket ->> 'bucket_key_hash', ''));
    v_scope := btrim(COALESCE(v_bucket ->> 'scope', 'unknown'));
    v_bucket_event_type := btrim(COALESCE(v_bucket ->> 'eventType', v_bucket ->> 'event_type', p_event_type));
    v_max_attempts := NULLIF(v_bucket ->> 'max', '')::INTEGER;
    v_window_reset_at := COALESCE(
      NULLIF(v_bucket ->> 'resetAt', '')::TIMESTAMPTZ,
      NULLIF(v_bucket ->> 'reset_at', '')::TIMESTAMPTZ,
      p_now + make_interval(secs => GREATEST(COALESCE(NULLIF(v_bucket ->> 'windowMs', '')::INTEGER, 3600000), 1000) / 1000)
    );

    IF v_bucket_key = '' OR v_max_attempts IS NULL OR v_max_attempts < 1 THEN
      RETURN jsonb_build_object(
        'action', 'block',
        'code', 'mail_invalid_budget_bucket',
        'reason', 'Budget bucket is missing a key or max.',
        'idempotency_key', p_idempotency_key
      );
    END IF;

    INSERT INTO public.mail_abuse_budget_counters (
      bucket_key_hash,
      scope,
      event_type,
      window_started_at,
      window_reset_at,
      used_count,
      last_idempotency_key,
      created_at,
      updated_at
    )
    VALUES (
      v_bucket_key,
      v_scope,
      v_bucket_event_type,
      p_now,
      v_window_reset_at,
      0,
      NULL,
      p_now,
      p_now
    )
    ON CONFLICT (bucket_key_hash) DO NOTHING;

    SELECT used_count INTO v_used_count
    FROM public.mail_abuse_budget_counters
    WHERE bucket_key_hash = v_bucket_key
    FOR UPDATE;

    IF COALESCE(v_used_count, 0) >= v_max_attempts THEN
      v_block_result := jsonb_build_object(
        'action', 'block',
        'code', 'mail_budget_exceeded:' || v_scope,
        'reason', 'Mail sending budget exceeded.',
        'idempotency_key', p_idempotency_key,
        'exceeded_bucket', jsonb_build_object(
          'scope', v_scope,
          'bucket_key_hash', v_bucket_key,
          'max', v_max_attempts,
          'used', COALESCE(v_used_count, 0),
          'reset_at', v_window_reset_at
        )
      );

      RETURN v_block_result;
    END IF;
  END LOOP;

  INSERT INTO public.mail_outbox (
    event_type,
    recipient_email_hash,
    recipient_domain,
    template_key,
    locale,
    payload_redacted_json,
    idempotency_key,
    priority,
    status,
    next_attempt_at,
    guard_decision,
    created_by_user_id,
    related_entity_type,
    related_entity_id,
    created_at,
    updated_at
  )
  VALUES (
    p_event_type,
    p_recipient_email_hash,
    p_recipient_domain,
    p_template_key,
    COALESCE(NULLIF(btrim(p_locale), ''), 'zh-CN'),
    COALESCE(p_payload_redacted_json, '{}'::jsonb),
    p_idempotency_key,
    LEAST(9, GREATEST(1, COALESCE(p_priority, 5))),
    'queued',
    p_now,
    COALESCE(p_guard_decision, '{}'::jsonb),
    p_created_by_user_id,
    NULLIF(btrim(COALESCE(p_related_entity_type, '')), ''),
    NULLIF(btrim(COALESCE(p_related_entity_id, '')), ''),
    p_now,
    p_now
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    SELECT id INTO v_existing_id
    FROM public.mail_outbox
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    RETURN jsonb_build_object(
      'action', 'dedupe',
      'code', 'mail_idempotency_hit',
      'outbox_id', v_existing_id,
      'idempotency_key', p_idempotency_key
    );
  END IF;

  FOR v_bucket IN SELECT value FROM jsonb_array_elements(COALESCE(p_budget_buckets, '[]'::jsonb))
  LOOP
    v_bucket_key := btrim(COALESCE(v_bucket ->> 'bucketKeyHash', v_bucket ->> 'bucket_key_hash', ''));

    IF v_bucket_key <> '' THEN
      UPDATE public.mail_abuse_budget_counters
      SET
        used_count = used_count + 1,
        last_idempotency_key = p_idempotency_key,
        updated_at = p_now
      WHERE bucket_key_hash = v_bucket_key;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'action', 'queue',
    'code', 'mail_outbox_queued',
    'outbox_id', v_inserted_id,
    'idempotency_key', p_idempotency_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_mail_outbox_event(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  SMALLINT,
  JSONB,
  JSONB,
  UUID,
  TEXT,
  TEXT,
  TIMESTAMPTZ
) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.enqueue_mail_outbox_event(
      TEXT,
      TEXT,
      TEXT,
      TEXT,
      TEXT,
      TEXT,
      JSONB,
      SMALLINT,
      JSONB,
      JSONB,
      UUID,
      TEXT,
      TEXT,
      TIMESTAMPTZ
    ) TO service_role;
  END IF;
END $$;

COMMENT ON FUNCTION public.enqueue_mail_outbox_event(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  SMALLINT,
  JSONB,
  JSONB,
  UUID,
  TEXT,
  TEXT,
  TIMESTAMPTZ
) IS
  'Server-only mail enqueue RPC. Atomically checks hashed budget counters, inserts redacted mail_outbox rows, and returns queue/dedupe/block metadata. Does not send mail.';
