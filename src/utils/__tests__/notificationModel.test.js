import { describe, expect, it, vi } from 'vitest';

import {
  ACTIONABLE_TOAST_DURATION_MS,
  DEFAULT_TOAST_DURATION_MS,
  buildAccountRecoveryNotification,
  buildCopyableDiagnostic,
  buildDeveloperApiReviewNotification,
  buildImportResultNotification,
  buildPublicCacheWarningNotification,
  buildTicketReplyNotification,
  clearReadDurableNotifications,
  dismissDurableNotification,
  getUnreadDurableNotificationCount,
  markAllDurableNotificationsRead,
  markDurableNotificationRead,
  normalizeNotification,
  normalizeNotificationType,
  parseStoredDurableNotifications,
  redactSensitiveDiagnostics,
  redactSensitiveText,
  upsertDurableNotification,
} from '../notificationModel.js';

describe('notificationModel', () => {
  it('keeps legacy toast calls short-lived and normalized', () => {
    const notification = normalizeNotification('保存完成', {
      type: 'success',
      title: '已保存',
    });

    expect(notification).toMatchObject({
      type: 'success',
      title: '已保存',
      message: '保存完成',
      duration: DEFAULT_TOAST_DURATION_MS,
      persistent: false,
      actions: [],
      diagnosticText: null,
    });
  });

  it('makes actionable diagnostics persistent by default', () => {
    const action = vi.fn();
    const notification = normalizeNotification({
      type: 'warning',
      title: '部分成功',
      message: '导入完成，但云同步失败',
      diagnostic: {
        phase: 'import',
        email: 'user@example.com',
        user_id: '019e4b84-88d4-7ee1-ad7d-711d40939f7a',
        url: '/api/import?token=secret-token-value&game_uid=123456',
      },
      actions: [
        { label: '查看详情', onClick: action, variant: 'primary', dismissOnClick: false },
      ],
    });

    expect(notification.duration).toBe(ACTIONABLE_TOAST_DURATION_MS);
    expect(notification.persistent).toBe(true);
    expect(notification.actions[0]).toMatchObject({
      label: '查看详情',
      onClick: action,
      variant: 'primary',
      dismissOnClick: false,
    });
    expect(notification.diagnosticText).toContain('"phase": "import"');
    expect(notification.diagnosticText).toContain('"email": "[redacted]"');
    expect(notification.diagnosticText).toContain('"user_id": "[redacted]"');
    expect(notification.diagnosticText).toContain('token=[redacted]');
    expect(notification.diagnosticText).toContain('game_uid=[redacted]');
    expect(notification.diagnosticText).not.toContain('user@example.com');
    expect(notification.diagnosticText).not.toContain('019e4b84');
    expect(notification.diagnosticText).not.toContain('secret-token-value');
  });

  it('redacts sensitive strings and nested diagnostics', () => {
    const redactedText = redactSensitiveText(
      'Authorization: Bearer abcdefghijklmnop email admin@example.com api_key=efg_secret_key_abcdef',
    );

    expect(redactedText).toContain('Bearer [redacted-token]');
    expect(redactedText).toContain('[redacted-email]');
    expect(redactedText).toContain('api_key=[redacted]');
    expect(redactedText).not.toContain('admin@example.com');
    expect(redactedText).not.toContain('abcdefghijklmnop');

    const error = new Error('failed for user_id=019e4b84-88d4-7ee1-ad7d-711d40939f7a');
    const redactedObject = redactSensitiveDiagnostics({
      token: 'raw-token',
      nested: {
        message: 'email: admin@example.com',
        error,
      },
    });

    expect(redactedObject).toMatchObject({
      token: '[redacted]',
      nested: {
        message: 'email: [redacted]',
        error: {
          name: 'Error',
        },
      },
    });
    expect(redactedObject.nested.error.message).not.toContain('019e4b84');
  });

  it('handles circular diagnostics and unknown notification types', () => {
    const circular = { phase: 'ticket' };
    circular.self = circular;

    const copyable = buildCopyableDiagnostic(circular);
    expect(copyable).toContain('"self": "[circular]"');
    expect(normalizeNotificationType('fatal')).toBe('info');
  });

  it('stores durable notifications with dedupe, read state, and expiry cleanup', () => {
    const now = new Date('2026-05-25T08:00:00.000Z');
    const later = new Date('2026-05-25T08:10:00.000Z');
    const expired = new Date('2026-05-24T08:00:00.000Z');
    const initial = upsertDurableNotification([], {
      type: 'warning',
      category: 'import',
      title: '导入部分成功',
      message: '包含 user@example.com 与 user_id=019e4b84-88d4-7ee1-ad7d-711d40939f7a',
      dedupeKey: 'import:one',
      diagnostic: {
        phase: 'import',
        token: 'raw-token',
      },
    }, { now });

    expect(initial).toHaveLength(1);
    expect(initial[0]).toMatchObject({
      type: 'warning',
      category: 'import',
      priority: 'normal',
      dedupeKey: 'import:one',
      readAt: null,
    });
    expect(initial[0].message).not.toContain('user@example.com');
    expect(initial[0].message).not.toContain('019e4b84');
    expect(initial[0].diagnosticText).toContain('"token": "[redacted]"');

    const deduped = upsertDurableNotification(initial, {
      type: 'success',
      category: 'import',
      title: '导入完成',
      message: '已恢复',
      dedupeKey: 'import:one',
    }, { now: later });
    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe(initial[0].id);
    expect(deduped[0].title).toBe('导入完成');
    expect(deduped[0].createdAt).toBe(initial[0].createdAt);
    expect(deduped[0].readAt).toBeNull();

    const readOne = markDurableNotificationRead(deduped, deduped[0].id, { now: later });
    expect(getUnreadDurableNotificationCount(readOne, { now: later })).toBe(0);

    const readAll = markAllDurableNotificationsRead([
      ...readOne,
      {
        id: 'expired',
        title: 'expired',
        message: 'expired',
        createdAt: expired.toISOString(),
        updatedAt: expired.toISOString(),
        expiresAt: expired.toISOString(),
      },
    ], { now: later });
    expect(readAll).toHaveLength(1);
    expect(readAll[0].readAt).toBeTruthy();
    expect(clearReadDurableNotifications(readAll, { now: later })).toHaveLength(0);
    expect(dismissDurableNotification(deduped, deduped[0].id, { now: later })).toHaveLength(0);

    const restored = parseStoredDurableNotifications(JSON.stringify(deduped), { now: later });
    expect(restored).toHaveLength(1);
    expect(restored[0].title).toBe('导入完成');
  });

  it('builds redacted account recovery durable notifications without account enumeration', () => {
    const notification = buildAccountRecoveryNotification({
      status: 'received',
      requestType: 'password_reset',
      deliveryChannel: 'mail_outbox',
      nextStep: 'mail_reset_queued',
      id: 'recovery-raw-id',
      email: 'user@example.com',
      outboxId: 'mail-raw-id',
    }, {
      locale: 'zh-CN',
      requestType: 'password_reset',
      now: new Date('2026-05-25T08:00:00.000Z'),
    });

    expect(notification).toMatchObject({
      type: 'info',
      category: 'account',
      priority: 'high',
      source: 'account.recovery',
    });
    expect(notification.title).toBe('账号恢复申请已接收');
    expect(notification.message).toContain('发信队列');
    expect(notification.message).not.toContain('user@example.com');
    expect(notification.diagnosticText).toContain('"phase": "account_recovery"');
    expect(notification.diagnosticText).not.toContain('recovery-raw-id');
    expect(notification.diagnosticText).not.toContain('mail-raw-id');
    expect(notification.diagnosticText).not.toContain('user@example.com');
  });

  it('builds import result notifications with redacted partial diagnostics', () => {
    const notification = buildImportResultNotification({
      status: 'partial',
      sourceFormatId: 'internal_json_v3',
      data: {
        accounts: [
          {
            gameUid: '123456789',
            nickName: 'importer@example.com',
          },
        ],
      },
      addedPools: 2,
      addedHistory: 3,
      duplicateHistory: 4,
      syncedToCloud: false,
      completedAt: '2026-05-25T08:00:00.000Z',
      error: new Error('sync failed for email user@example.com token=secret-token-value'),
    }, {
      locale: 'en-US',
      now: new Date('2026-05-25T08:00:00.000Z'),
    });

    expect(notification).toMatchObject({
      type: 'warning',
      category: 'import',
      priority: 'high',
      title: 'Import partially completed',
    });
    expect(notification.message).toContain('Added 3 record(s)');
    expect(notification.message).toContain('skipped 4 duplicate record(s)');
    expect(notification.message).toContain('UID 123****789');
    expect(notification.message).not.toContain('123456789');
    expect(notification.message).not.toContain('importer@example.com');
    expect(notification.actions[0]).toMatchObject({
      label: 'View imported data',
      href: '/dashboard',
      variant: 'primary',
    });
    expect(notification.diagnosticText).toContain('"phase": "import_partial"');
    expect(notification.diagnosticText).toContain('"account": "[redacted] · UID 123****789"');
    expect(notification.diagnosticText).toContain('"sourceFormatId": "internal_json_v3"');
    expect(notification.diagnosticText).not.toContain('user@example.com');
    expect(notification.diagnosticText).not.toContain('importer@example.com');
    expect(notification.diagnosticText).not.toContain('123456789');
    expect(notification.diagnosticText).not.toContain('secret-token-value');
  });

  it('builds developer API review notifications without leaking keys or owners', () => {
    const notification = buildDeveloperApiReviewNotification({
      status: 'active',
      clientName: 'tool user@example.com api_key=efg_secret_key_abcdef',
      clientType: 'desktop',
      hasBootstrapKey: true,
      reviewNote: 'approved',
      bootstrapKey: 'efg_bootstrap_secret_value',
      ownerUserId: '019e4b84-88d4-7ee1-ad7d-711d40939f7a',
      email: 'owner@example.com',
    }, {
      locale: 'zh-CN',
      now: new Date('2026-05-25T08:00:00.000Z'),
    });

    expect(notification).toMatchObject({
      type: 'success',
      category: 'developer-api',
      priority: 'normal',
      source: 'admin.developer-api.review',
    });
    expect(notification.diagnosticText).toContain('"phase": "developer_api_review"');
    expect(notification.diagnosticText).toContain('"hasBootstrapKey": true');
    expect(notification.diagnosticText).not.toContain('efg_bootstrap_secret_value');
    expect(notification.diagnosticText).not.toContain('019e4b84');
    expect(notification.diagnosticText).not.toContain('owner@example.com');
    expect(notification.dedupeKey).not.toContain('user@example.com');
    expect(notification.dedupeKey).not.toContain('efg_secret_key_abcdef');
  });

  it('builds ticket reply notifications with role/status diagnostics only', () => {
    const notification = buildTicketReplyNotification({
      authorRole: 'admin',
      ticketStatus: 'processing',
      createdAt: '2026-05-25T08:00:00.000Z',
      ticketId: 'ticket-raw-id',
      userId: '019e4b84-88d4-7ee1-ad7d-711d40939f7a',
      content: 'reply includes token=secret-token-value',
    }, {
      locale: 'en-US',
      now: new Date('2026-05-25T08:00:00.000Z'),
    });

    expect(notification).toMatchObject({
      type: 'success',
      category: 'ticket',
      priority: 'high',
      title: 'Ticket reply sent',
    });
    expect(notification.diagnosticText).toContain('"phase": "ticket_reply"');
    expect(notification.diagnosticText).toContain('"authorRole": "admin"');
    expect(notification.diagnosticText).toContain('"ticketStatus": "processing"');
    expect(notification.diagnosticText).not.toContain('ticket-raw-id');
    expect(notification.diagnosticText).not.toContain('secret-token-value');
    expect(notification.diagnosticText).not.toContain('019e4b84');
  });

  it('builds public cache warning notifications with redacted diagnostics', () => {
    const notification = buildPublicCacheWarningNotification({
      scope: 'stats',
      reason: 'admin',
      error: 'refresh failed for email user@example.com token=secret-token-value id=019e4b84-88d4-7ee1-ad7d-711d40939f7a',
      analyticsRefresh: {
        ok: false,
        partial: true,
        warning: 'worker failed for api_key=efg_secret_key_abcdef',
      },
    }, {
      locale: 'zh-CN',
      now: new Date('2026-05-25T08:00:00.000Z'),
    });

    expect(notification).toMatchObject({
      type: 'warning',
      category: 'cache',
      priority: 'high',
      source: 'admin.public-cache',
    });
    expect(notification.diagnosticText).toContain('"phase": "public_cache_warning"');
    expect(notification.diagnosticText).toContain('"scope": "stats"');
    expect(notification.diagnosticText).not.toContain('user@example.com');
    expect(notification.diagnosticText).not.toContain('secret-token-value');
    expect(notification.diagnosticText).not.toContain('019e4b84');
    expect(notification.diagnosticText).not.toContain('efg_secret_key_abcdef');
  });
});
