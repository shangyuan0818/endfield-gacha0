function normalizeLocale(value) {
  const normalized = String(value || 'zh-CN').trim();
  return normalized || 'zh-CN';
}

function isEnglishLocale(locale) {
  return normalizeLocale(locale).toLowerCase().startsWith('en');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function toIsoTimestamp(value = new Date()) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function buildText({
  title,
  intro,
  actionLabel,
  actionUrl,
  secondary,
  generatedAt,
}) {
  return [
    title,
    '',
    intro,
    actionUrl ? `${actionLabel}: ${actionUrl}` : '',
    secondary || '',
    '',
    `Generated at: ${toIsoTimestamp(generatedAt)}`,
  ].filter(Boolean).join('\n');
}

function buildHtml({
  title,
  preheader,
  intro,
  actionLabel,
  actionUrl,
  secondary,
  generatedAt,
}) {
  const safeActionUrl = actionUrl ? escapeHtml(actionUrl) : '';
  const safeSecondary = secondary ? escapeHtml(secondary).replace(/\n/g, '<br>') : '';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;color:#18181b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,'Noto Sans SC',sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader || intro)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #d4d4d8;">
            <tr>
              <td style="background:#18181b;border-bottom:4px solid #facc15;padding:22px 24px;color:#ffffff;">
                <div style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:#a1a1aa;">Endfield Gacha</div>
                <h1 style="margin:8px 0 0;font-size:22px;line-height:1.35;color:#ffffff;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 24px 12px;">
                <p style="margin:0;color:#3f3f46;font-size:15px;line-height:1.8;">${escapeHtml(intro)}</p>
                ${safeActionUrl ? `
                <div style="margin:24px 0;">
                  <a href="${safeActionUrl}" style="display:inline-block;background:#facc15;color:#111827;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;padding:13px 18px;border:1px solid #eab308;">${escapeHtml(actionLabel)}</a>
                </div>
                <p style="margin:0;color:#71717a;font-size:12px;line-height:1.7;word-break:break-all;">${escapeHtml(actionUrl)}</p>
                ` : ''}
                ${safeSecondary ? `<p style="margin:20px 0 0;color:#52525b;font-size:13px;line-height:1.7;">${safeSecondary}</p>` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px 24px;">
                <div style="border-top:1px solid #e4e4e7;padding-top:14px;color:#a1a1aa;font-size:11px;line-height:1.6;">
                  Generated at: ${escapeHtml(toIsoTimestamp(generatedAt))}<br>
                  This message was sent by Endfield Gacha. Do not forward account links to other people.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function getTemplateCopy(templateKey, locale) {
  const english = isEnglishLocale(locale);

  switch (templateKey) {
    case 'auth.register-confirmation':
      return english
        ? {
          subject: 'Confirm your Endfield Gacha account',
          title: 'Confirm your account',
          preheader: 'Open this link to finish creating your Endfield Gacha account.',
          intro: 'Open the confirmation link below to finish creating your Endfield Gacha account. The link is single-use and may expire.',
          actionLabel: 'Confirm account',
          secondary: 'If you did not create this account, ignore this message.',
        }
        : {
          subject: '验证你的终末地抽卡分析器账号',
          title: '验证账号邮箱',
          preheader: '打开链接完成终末地抽卡分析器账号注册。',
          intro: '请打开下方验证链接，完成终末地抽卡分析器账号注册。该链接只能使用一次，并可能在一段时间后失效。',
          actionLabel: '验证账号',
          secondary: '如果不是你本人注册，请忽略这封邮件。',
        };
    case 'auth.email-login':
      return english
        ? {
          subject: 'Sign in to Endfield Gacha',
          title: 'Sign in with email',
          preheader: 'Open this link to sign in to Endfield Gacha.',
          intro: 'Open the sign-in link below to access your Endfield Gacha account. The link is single-use and may expire.',
          actionLabel: 'Sign in',
          secondary: 'If you did not request this sign-in link, ignore this message and keep your current password.',
        }
        : {
          subject: '登录终末地抽卡分析器',
          title: '邮件登录',
          preheader: '打开链接登录终末地抽卡分析器。',
          intro: '请打开下方登录链接，进入你的终末地抽卡分析器账号。该链接只能使用一次，并可能在一段时间后失效。',
          actionLabel: '登录账号',
          secondary: '如果不是你本人请求登录，请忽略这封邮件，并继续使用当前密码。',
        };
    case 'auth.email-verification':
      return english
        ? {
          subject: 'Verify your Endfield Gacha email',
          title: 'Verify your email',
          preheader: 'Open this link to verify the email address on your Endfield Gacha account.',
          intro: 'Open the verification link below to confirm the email address on your Endfield Gacha account. The link is single-use and may expire.',
          actionLabel: 'Verify email',
          secondary: 'If you did not request this verification email, ignore this message.',
        }
        : {
          subject: '验证你的终末地抽卡分析器邮箱',
          title: '验证邮箱',
          preheader: '打开链接验证你的终末地抽卡分析器账号邮箱。',
          intro: '请打开下方验证链接，确认你的终末地抽卡分析器账号邮箱。该链接只能使用一次，并可能在一段时间后失效。',
          actionLabel: '验证邮箱',
          secondary: '如果不是你本人请求验证邮箱，请忽略这封邮件。',
        };
    case 'auth.email-change-current':
      return english
        ? {
          subject: 'Confirm your Endfield Gacha email change',
          title: 'Confirm from current email',
          preheader: 'Confirm that you want to change the email address on your Endfield Gacha account.',
          intro: 'A request was made to change the email address on your Endfield Gacha account. Open this link from your current mailbox to approve the change.',
          actionLabel: 'Approve email change',
          secondary: 'If you did not request this change, ignore this message and change your password.',
        }
        : {
          subject: '确认更换终末地抽卡分析器邮箱',
          title: '从当前邮箱确认',
          preheader: '确认你要更换终末地抽卡分析器账号邮箱。',
          intro: '你的终末地抽卡分析器账号发起了邮箱更换申请。请在当前邮箱中打开此链接，同意本次更换。',
          actionLabel: '同意更换邮箱',
          secondary: '如果不是你本人操作，请忽略这封邮件，并尽快修改密码。',
        };
    case 'auth.email-change-new':
      return english
        ? {
          subject: 'Verify your new Endfield Gacha email',
          title: 'Verify new email',
          preheader: 'Confirm that this mailbox should become your Endfield Gacha account email.',
          intro: 'Open this link to confirm that this mailbox should become the new email address on your Endfield Gacha account.',
          actionLabel: 'Verify new email',
          secondary: 'If you did not request this change, ignore this message.',
        }
        : {
          subject: '验证新的终末地抽卡分析器邮箱',
          title: '验证新邮箱',
          preheader: '确认此邮箱将作为你的终末地抽卡分析器账号邮箱。',
          intro: '请打开下方链接，确认此邮箱将作为你的终末地抽卡分析器账号邮箱。当前邮箱和新邮箱都确认后，系统才会完成更换。',
          actionLabel: '验证新邮箱',
          secondary: '如果不是你本人操作，请忽略这封邮件。',
        };
    case 'auth.password-reset':
      return english
        ? {
          subject: 'Reset your Endfield Gacha password',
          title: 'Reset your password',
          preheader: 'Open this link to reset your Endfield Gacha password.',
          intro: 'A password reset was requested for your Endfield Gacha account. Open the link below to continue.',
          actionLabel: 'Reset password',
          secondary: 'If you did not request this, ignore this message and keep using the current password.',
        }
        : {
          subject: '重置你的终末地抽卡分析器密码',
          title: '重置密码',
          preheader: '打开链接重置你的终末地抽卡分析器密码。',
          intro: '你的终末地抽卡分析器账号收到了密码重置申请。请打开下方链接继续。',
          actionLabel: '重置密码',
          secondary: '如果不是你本人操作，请忽略这封邮件，并继续使用当前密码。',
        };
    case 'developer-api.review':
      return english
        ? {
          subject: 'Endfield Gacha developer API review update',
          title: 'Developer API review update',
          preheader: 'Your developer API application has been reviewed.',
          intro: 'Your developer API application has been reviewed. Open the settings page to check the current status and next steps.',
          actionLabel: 'Open settings',
          secondary: 'If you did not submit a developer API application, contact the site administrator.',
        }
        : {
          subject: '终末地抽卡分析器开发者 API 审核结果',
          title: '开发者 API 审核结果',
          preheader: '你的开发者 API 申请已有审核结果。',
          intro: '你的开发者 API 申请已有审核结果。请打开设置页查看当前状态和后续操作。',
          actionLabel: '查看设置',
          secondary: '如果不是你本人提交了开发者 API 申请，请联系站点管理员。',
        };
    case 'ticket.reply':
      return english
        ? {
          subject: 'Endfield Gacha ticket reply',
          title: 'Ticket reply',
          preheader: 'Your ticket has a new reply.',
          intro: 'Your ticket has a new reply. Open the tickets page to view the conversation and current status.',
          actionLabel: 'Open tickets',
          secondary: 'Do not reply with passwords, tokens, or private account secrets.',
        }
        : {
          subject: '终末地抽卡分析器工单有新回复',
          title: '工单有新回复',
          preheader: '你的工单收到了一条新回复。',
          intro: '你的工单收到了一条新回复。请打开工单页查看对话和当前状态。',
          actionLabel: '查看工单',
          secondary: '请不要在工单回复中发送密码、Token 或账号私密凭据。',
        };
    case 'admin.alert':
      return english
        ? {
          subject: 'Endfield Gacha admin alert',
          title: 'Admin alert',
          preheader: 'An admin alert needs review.',
          intro: 'An admin alert needs review. Open the admin panel to inspect the current state.',
          actionLabel: 'Open admin panel',
          secondary: 'This alert contains only redacted diagnostics.',
        }
        : {
          subject: '终末地抽卡分析器管理员告警',
          title: '管理员告警',
          preheader: '有一条管理员告警需要处理。',
          intro: '有一条管理员告警需要处理。请打开后台面板查看当前状态。',
          actionLabel: '打开后台',
          secondary: '此告警只包含脱敏诊断信息。',
        };
    case 'admin.mail-smoke-test':
      return english
        ? {
          subject: 'Endfield Gacha mail delivery test',
          title: 'Mail delivery test',
          preheader: 'This is a controlled mail delivery test from Endfield Gacha.',
          intro: 'This is a controlled mail delivery test from Endfield Gacha.',
          actionLabel: '',
          secondary: 'If you did not request this test, contact the site administrator.',
        }
        : {
          subject: '终末地抽卡分析器邮件投递测试',
          title: '邮件投递测试',
          preheader: '这是一封来自终末地抽卡分析器的受控邮件投递测试。',
          intro: '这是一封来自终末地抽卡分析器的受控邮件投递测试。',
          actionLabel: '',
          secondary: '如果不是你请求了这次测试，请联系站点管理员。',
        };
    default:
      return english
        ? {
          subject: 'Endfield Gacha notification',
          title: 'Endfield Gacha notification',
          preheader: 'You have a new Endfield Gacha notification.',
          intro: 'You have a new Endfield Gacha notification.',
          actionLabel: 'Open',
          secondary: '',
        }
        : {
          subject: '终末地抽卡分析器通知',
          title: '终末地抽卡分析器通知',
          preheader: '你收到了一条终末地抽卡分析器通知。',
          intro: '你收到了一条终末地抽卡分析器通知。',
          actionLabel: '打开',
          secondary: '',
        };
  }
}

export function renderMailTemplate({
  templateKey,
  locale = 'zh-CN',
  actionUrl = '',
  generatedAt = new Date(),
  overrides = {},
} = {}) {
  const copy = {
    ...getTemplateCopy(templateKey, locale),
    ...overrides,
  };
  const title = copy.title || copy.subject || 'Endfield Gacha';
  const intro = copy.intro || stripHtml(copy.html || '');
  const actionLabel = copy.actionLabel || (isEnglishLocale(locale) ? 'Open' : '打开');
  const text = copy.text || buildText({
    title,
    intro,
    actionLabel,
    actionUrl,
    secondary: copy.secondary,
    generatedAt,
  });
  const html = copy.html || buildHtml({
    title,
    preheader: copy.preheader,
    intro,
    actionLabel,
    actionUrl,
    secondary: copy.secondary,
    generatedAt,
  });

  return {
    subject: copy.subject || title,
    text,
    html,
  };
}

export const __internal = {
  buildHtml,
  buildText,
  escapeHtml,
  getTemplateCopy,
  stripHtml,
};
