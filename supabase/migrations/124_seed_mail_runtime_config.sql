-- 124: seed runtime mail controls in site_config.
--
-- Runtime controls are lower gates only. They can pause or narrow mail flows
-- without redeploying, but they must not store SMTP credentials or bypass env
-- vars such as MAIL_OUTBOX_WORKER_ENABLED / MAIL_OUTBOX_GLOBAL_KILL_SWITCH.

INSERT INTO public.site_config (key, value, label, category, updated_at)
VALUES (
  'mail_runtime_config',
  jsonb_build_object(
    'version', 1,
    'updatedAt', now(),
    'updatedBy', null,
    'note', '',
    'events', jsonb_build_object(
      'authMailActions', null,
      'accountRecoveryOutbox', null,
      'developerApiReview', null,
      'ticketReply', null,
      'adminAlert', null
    ),
    'controls', jsonb_build_object(
      'killSwitch', null,
      'disabledEvents', jsonb_build_array(),
      'pausedDomains', jsonb_build_array()
    )
  )::text,
  '邮件运行期开关',
  'system',
  now()
)
ON CONFLICT (key) DO NOTHING;
