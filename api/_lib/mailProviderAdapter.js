import { randomUUID } from 'node:crypto';
import net from 'node:net';
import readline from 'node:readline';
import tls from 'node:tls';

import { hashMailIdentifier, sanitizeMailPayload } from './mailAbuseGuards.js';

function readEnvironment() {
  return globalThis.process?.env || {};
}

function parseBoolean(value, defaultValue = false) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function parseInteger(value, defaultValue, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(max, Math.max(min, parsed));
}

function normalizeProvider(value) {
  const normalized = String(value || 'stalwart').trim().toLowerCase();
  return normalized || 'stalwart';
}

function normalizeString(value, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function getAddressDomain(address) {
  const normalized = normalizeString(address, '');
  const atIndex = normalized.lastIndexOf('@');
  if (atIndex < 0 || atIndex === normalized.length - 1) {
    return '';
  }

  return normalized.slice(atIndex + 1).toLowerCase();
}

function normalizeSendingDomain({ explicitDomain, smtpHost, fromAddress }) {
  const explicit = normalizeString(explicitDomain, '');
  if (explicit) {
    return explicit;
  }

  const host = normalizeString(smtpHost, '');
  if (host) {
    return host;
  }

  return getAddressDomain(fromAddress);
}

function parseOptionalBoolean(value, defaultValue = null) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

export function getMailProviderConfigFromEnv(env = readEnvironment()) {
  const provider = normalizeProvider(env.MAIL_PROVIDER);
  const dryRun = parseBoolean(env.MAIL_WORKER_DRY_RUN, true);
  const fromAddress = normalizeString(env.MAIL_FROM_ADDRESS, 'no-reply@example.invalid');
  const stalwartSmtpPort = parseInteger(env.STALWART_SMTP_PORT, 587, { min: 1, max: 65_535 });
  const stalwartSmtpSecure = parseOptionalBoolean(env.STALWART_SMTP_SECURE, stalwartSmtpPort === 465);
  const stalwartSmtpStartTls = parseOptionalBoolean(env.STALWART_SMTP_STARTTLS, !stalwartSmtpSecure);
  const stalwartSmtpHost = normalizeString(env.STALWART_SMTP_HOST, '');

  return {
    provider,
    providerKey: dryRun ? `${provider}:dry-run` : provider,
    dryRun,
    fromAddress,
    fromName: normalizeString(env.MAIL_FROM_NAME, 'Endfield Gacha'),
    sendingDomain: normalizeSendingDomain({
      explicitDomain: env.MAIL_SENDING_DOMAIN,
      smtpHost: stalwartSmtpHost,
      fromAddress,
    }),
    timeoutMs: parseInteger(env.MAIL_PROVIDER_TIMEOUT_MS, 15_000, { min: 1_000, max: 120_000 }),
    postal: {
      apiUrl: normalizeString(env.POSTAL_API_URL, ''),
      apiKeyConfigured: Boolean(normalizeString(env.POSTAL_API_KEY, '')),
      smtpHost: normalizeString(env.POSTAL_SMTP_HOST, ''),
      smtpPort: parseInteger(env.POSTAL_SMTP_PORT, 587, { min: 1, max: 65_535 }),
      smtpUsername: normalizeString(env.POSTAL_SMTP_USERNAME, ''),
      smtpPasswordConfigured: Boolean(normalizeString(env.POSTAL_SMTP_PASSWORD, '')),
      webhookSecretConfigured: Boolean(normalizeString(env.POSTAL_WEBHOOK_SECRET, '')),
    },
    stalwart: {
      smtpHost: stalwartSmtpHost,
      smtpPort: stalwartSmtpPort,
      smtpUsername: normalizeString(env.STALWART_SMTP_USERNAME, ''),
      smtpPasswordConfigured: Boolean(normalizeString(env.STALWART_SMTP_PASSWORD, '')),
      smtpSecure: Boolean(stalwartSmtpSecure),
      smtpStartTls: Boolean(stalwartSmtpStartTls),
      smtpAllowInsecure: parseBoolean(env.STALWART_SMTP_ALLOW_INSECURE, false),
      smtpRejectUnauthorized: parseBoolean(env.STALWART_SMTP_TLS_REJECT_UNAUTHORIZED, true),
      jmapUrl: normalizeString(env.STALWART_JMAP_URL, ''),
    },
  };
}

function createDryRunMessageId(message = {}, config = {}) {
  return `dry-run-${hashMailIdentifier({
    provider: config.provider || 'mail',
    templateKey: message.templateKey || '',
    relatedEntityType: message.relatedEntityType || '',
    relatedEntityId: message.relatedEntityId || '',
    subject: message.subject || '',
  }, { prefix: 'provider_message_id' }).slice(0, 32)}`;
}

function normalizeProviderResult(rawResult = {}, config = {}) {
  const ok = rawResult.ok !== false && rawResult.accepted !== false;
  const providerKey = normalizeString(rawResult.providerKey, config.providerKey || config.provider || 'mail');

  return {
    ok,
    accepted: ok,
    dryRun: Boolean(rawResult.dryRun || config.dryRun),
    retryable: rawResult.retryable !== false,
    providerKey,
    providerMessageId: normalizeString(rawResult.providerMessageId, ''),
    code: normalizeString(rawResult.code, ok ? 'mail_provider_accepted' : 'mail_provider_failed'),
    reason: normalizeString(rawResult.reason, ok ? 'Mail provider accepted the message.' : 'Mail provider rejected the message.'),
    diagnostics: sanitizeMailPayload(rawResult.diagnostics || {}),
  };
}

function createSmtpError(code, reason, diagnostics = {}) {
  const error = new Error(reason);
  error.code = code;
  error.retryable = diagnostics.retryable !== false;
  error.diagnostics = diagnostics;
  return error;
}

function formatSmtpAddress(value) {
  if (!value || typeof value !== 'object') {
    return normalizeString(value, '');
  }

  return normalizeString(value.address, '');
}

function assertSafeSmtpAddress(value, label = 'address') {
  const normalized = normalizeString(value, '');
  if (
    !normalized
    || /[\r\n<>]/.test(normalized)
    || normalized.length > 320
    || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)
  ) {
    throw createSmtpError('smtp_message_invalid', `SMTP ${label} is invalid.`, {
      label,
      retryable: false,
    });
  }

  return normalized;
}

function sanitizeHeader(value) {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function needsEncodedWord(value) {
  return /[^\x20-\x7E]/.test(String(value ?? ''));
}

function encodeHeaderValue(value) {
  const normalized = sanitizeHeader(value);
  if (!normalized || !needsEncodedWord(normalized)) {
    return normalized;
  }

  return `=?UTF-8?B?${Buffer.from(normalized, 'utf8').toString('base64')}?=`;
}

function quoteDisplayName(value) {
  const normalized = sanitizeHeader(value);
  if (!normalized) {
    return '';
  }

  if (needsEncodedWord(normalized)) {
    return encodeHeaderValue(normalized);
  }

  return `"${normalized.replace(/(["\\])/g, '\\$1')}"`;
}

function formatFromHeader(from) {
  const address = formatSmtpAddress(from);
  const name = from && typeof from === 'object' ? quoteDisplayName(from.name) : '';
  return name ? `${name} <${address}>` : address;
}

function encodeQuotedPrintableLine(line) {
  const bytes = Buffer.from(String(line ?? ''), 'utf8');
  let encoded = '';

  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];
    const isTrailingWhitespace = index === bytes.length - 1 && (byte === 0x09 || byte === 0x20);
    let token = '';

    if (!isTrailingWhitespace && (byte === 0x09 || byte === 0x20)) {
      token = String.fromCharCode(byte);
    } else if (byte >= 0x21 && byte <= 0x7e && byte !== 0x3d) {
      token = String.fromCharCode(byte);
    } else {
      token = `=${byte.toString(16).toUpperCase().padStart(2, '0')}`;
    }

    const lastLineBreakIndex = encoded.lastIndexOf('\r\n');
    const currentLineLength = lastLineBreakIndex >= 0
      ? encoded.length - lastLineBreakIndex - 2
      : encoded.length;

    if (currentLineLength > 0 && currentLineLength + token.length > 75) {
      encoded += '=\r\n';
    }

    encoded += token;
  }

  return encoded;
}

function encodeQuotedPrintableText(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, '\r\n')
    .split('\r\n')
    .map(encodeQuotedPrintableLine)
    .join('\r\n');
}

function dotStuff(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, '\r\n')
    .split('\r\n')
    .map((line) => (line.startsWith('.') ? `.${line}` : line))
    .join('\r\n');
}

function buildRawEmailMessage(message = {}, config = {}) {
  const fromAddress = assertSafeSmtpAddress(formatSmtpAddress(message.from) || config.fromAddress, 'from address');
  const toAddress = assertSafeSmtpAddress(formatSmtpAddress(message.to || message.recipient), 'recipient address');
  const subject = encodeHeaderValue(message.subject || 'Endfield Gacha notification');
  const messageId = `<${randomUUID()}@${config.sendingDomain || fromAddress.split('@')[1] || 'localhost'}>`;
  const text = encodeQuotedPrintableText(message.text || '');
  const html = message.html ? encodeQuotedPrintableText(message.html) : '';
  const boundary = html ? `endfield-${randomUUID()}` : '';

  const headers = [
    ['From', formatFromHeader(message.from) || fromAddress],
    ['To', toAddress],
    ['Subject', subject],
    ['Date', new Date().toUTCString()],
    ['Message-ID', messageId],
    ['MIME-Version', '1.0'],
  ];

  if (html) {
    headers.push(['Content-Type', `multipart/alternative; boundary="${boundary}"`]);
    return {
      fromAddress,
      toAddress,
      messageId,
      raw: `${headers.map(([key, value]) => `${key}: ${value}`).join('\r\n')}\r\n\r\n`
        + `--${boundary}\r\n`
        + 'Content-Type: text/plain; charset=UTF-8\r\n'
        + 'Content-Transfer-Encoding: quoted-printable\r\n\r\n'
        + `${text}\r\n`
        + `--${boundary}\r\n`
        + 'Content-Type: text/html; charset=UTF-8\r\n'
        + 'Content-Transfer-Encoding: quoted-printable\r\n\r\n'
        + `${html}\r\n`
        + `--${boundary}--\r\n`,
    };
  }

  headers.push(
    ['Content-Type', 'text/plain; charset=UTF-8'],
    ['Content-Transfer-Encoding', 'quoted-printable'],
  );

  return {
    fromAddress,
    toAddress,
    messageId,
    raw: `${headers.map(([key, value]) => `${key}: ${value}`).join('\r\n')}\r\n\r\n${text}\r\n`,
  };
}

function createLineReader(socket, timeoutMs) {
  const reader = readline.createInterface({
    input: socket,
    crlfDelay: Infinity,
  });
  const iterator = reader[Symbol.asyncIterator]();
  const readNextLine = async () => {
    let timeoutId = null;
    try {
      return await Promise.race([
        iterator.next(),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(createSmtpError('smtp_timeout', 'SMTP provider timed out.', {
              retryable: true,
            }));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  return {
    async readResponse() {
      const lines = [];

      for (;;) {
        const line = await readNextLine();

        if (line.done) {
          throw createSmtpError('smtp_connection_closed', 'SMTP provider closed the connection.', {
            retryable: true,
          });
        }

        lines.push(String(line.value || ''));
        const lastLine = lines[lines.length - 1];
        if (/^\d{3} /.test(lastLine)) {
          return {
            code: Number.parseInt(lastLine.slice(0, 3), 10),
            lines,
            message: lines.join('\n'),
          };
        }
      }
    },
    close() {
      reader.close();
    },
  };
}

function assertSmtpCode(response, expectedCodes, commandName) {
  if (!expectedCodes.includes(response.code)) {
    if (commandName === 'AUTH' && response.code === 535) {
      throw createSmtpError(
        'smtp_auth_failed',
        'SMTP 认证失败：Stalwart 拒绝了当前用户名或密码。请确认 STALWART_SMTP_USERNAME 使用完整邮箱地址，并重新填写 STALWART_SMTP_PASSWORD 或应用专用密码后重新部署。',
        {
          command: commandName,
          statusCode: response.code,
          retryable: false,
        }
      );
    }

    throw createSmtpError('smtp_unexpected_reply', `SMTP ${commandName} returned ${response.code}.`, {
      command: commandName,
      statusCode: response.code,
      retryable: response.code >= 400 && response.code < 500,
    });
  }

  return response;
}

async function sendSmtpCommand(socket, reader, command, expectedCodes, commandName = command.split(' ')[0]) {
  socket.write(`${command}\r\n`);
  const response = await reader.readResponse();
  return assertSmtpCode(response, expectedCodes, commandName);
}

async function connectSmtpSocket(config) {
  const smtp = config.stalwart;
  const timeoutMs = config.timeoutMs;

  if (smtp.smtpSecure) {
    return new Promise((resolve, reject) => {
      const socket = tls.connect({
        host: smtp.smtpHost,
        port: smtp.smtpPort,
        servername: smtp.smtpHost,
        rejectUnauthorized: smtp.smtpRejectUnauthorized,
        timeout: timeoutMs,
      }, () => resolve(socket));
      socket.once('error', reject);
      socket.once('timeout', () => {
        socket.destroy();
        reject(createSmtpError('smtp_timeout', 'SMTP provider timed out while connecting.', {
          retryable: true,
        }));
      });
    });
  }

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({
      host: smtp.smtpHost,
      port: smtp.smtpPort,
      timeout: timeoutMs,
    }, () => resolve(socket));
    socket.once('error', reject);
    socket.once('timeout', () => {
      socket.destroy();
      reject(createSmtpError('smtp_timeout', 'SMTP provider timed out while connecting.', {
        retryable: true,
      }));
    });
  });
}

async function upgradeSmtpStartTls(socket, reader, config) {
  await sendSmtpCommand(socket, reader, 'STARTTLS', [220], 'STARTTLS');
  reader.close();

  return new Promise((resolve, reject) => {
    const secureSocket = tls.connect({
      socket,
      servername: config.stalwart.smtpHost,
      rejectUnauthorized: config.stalwart.smtpRejectUnauthorized,
    }, () => resolve(secureSocket));
    secureSocket.once('error', reject);
    secureSocket.once('timeout', () => {
      secureSocket.destroy();
      reject(createSmtpError('smtp_timeout', 'SMTP provider timed out during STARTTLS.', {
        retryable: true,
      }));
    });
  });
}

async function authenticateSmtp(socket, reader, config, smtpPassword) {
  const authPlain = Buffer.from(`\0${config.stalwart.smtpUsername}\0${smtpPassword}`).toString('base64');
  await sendSmtpCommand(socket, reader, `AUTH PLAIN ${authPlain}`, [235], 'AUTH');
}

async function sendViaStalwartSmtp({ message, config, smtpPassword }) {
  const smtp = config.stalwart;
  if (!smtp.smtpHost || !smtp.smtpUsername || !smtpPassword) {
    return {
      ok: false,
      accepted: false,
      retryable: false,
      providerKey: config.providerKey,
      providerMessageId: '',
      code: 'stalwart_smtp_not_configured',
      reason: 'Stalwart SMTP transport is not fully configured.',
      diagnostics: {
        smtpHostConfigured: Boolean(smtp.smtpHost),
        smtpUsernameConfigured: Boolean(smtp.smtpUsername),
        smtpPasswordConfigured: Boolean(smtpPassword),
      },
    };
  }

  if (!smtp.smtpSecure && !smtp.smtpStartTls && !smtp.smtpAllowInsecure) {
    return {
      ok: false,
      accepted: false,
      retryable: false,
      providerKey: config.providerKey,
      providerMessageId: '',
      code: 'stalwart_smtp_tls_required',
      reason: 'Stalwart SMTP transport requires TLS unless STALWART_SMTP_ALLOW_INSECURE=true.',
      diagnostics: {
        smtpPort: smtp.smtpPort,
        smtpSecure: smtp.smtpSecure,
        smtpStartTls: smtp.smtpStartTls,
      },
    };
  }

  const rawMessage = buildRawEmailMessage(message, config);
  let socket = null;
  let reader = null;

  try {
    socket = await connectSmtpSocket(config);
    reader = createLineReader(socket, config.timeoutMs);

    await reader.readResponse();
    await sendSmtpCommand(socket, reader, `EHLO ${sanitizeHeader(config.sendingDomain) || 'localhost'}`, [250], 'EHLO');

    if (smtp.smtpStartTls) {
      socket = await upgradeSmtpStartTls(socket, reader, config);
      reader = createLineReader(socket, config.timeoutMs);
      await sendSmtpCommand(socket, reader, `EHLO ${sanitizeHeader(config.sendingDomain) || 'localhost'}`, [250], 'EHLO');
    }

    await authenticateSmtp(socket, reader, config, smtpPassword);
    await sendSmtpCommand(socket, reader, `MAIL FROM:<${rawMessage.fromAddress}>`, [250], 'MAIL FROM');
    await sendSmtpCommand(socket, reader, `RCPT TO:<${rawMessage.toAddress}>`, [250, 251], 'RCPT TO');
    await sendSmtpCommand(socket, reader, 'DATA', [354], 'DATA');
    socket.write(`${dotStuff(rawMessage.raw)}\r\n.\r\n`);
    await assertSmtpCode(await reader.readResponse(), [250], 'DATA body');
    await sendSmtpCommand(socket, reader, 'QUIT', [221], 'QUIT');

    return {
      ok: true,
      accepted: true,
      retryable: false,
      providerKey: config.providerKey,
      providerMessageId: rawMessage.messageId,
      code: 'stalwart_smtp_accepted',
      reason: 'Stalwart SMTP accepted the message.',
      diagnostics: {
        smtpHost: smtp.smtpHost,
        smtpPort: smtp.smtpPort,
        smtpSecure: smtp.smtpSecure,
        smtpStartTls: smtp.smtpStartTls,
      },
    };
  } catch (error) {
    return {
      ok: false,
      accepted: false,
      retryable: error?.retryable !== false,
      providerKey: config.providerKey,
      providerMessageId: '',
      code: error?.code || 'stalwart_smtp_failed',
      reason: error?.message || 'Stalwart SMTP transport failed.',
      diagnostics: sanitizeMailPayload({
        smtpHost: smtp.smtpHost,
        smtpPort: smtp.smtpPort,
        smtpSecure: smtp.smtpSecure,
        smtpStartTls: smtp.smtpStartTls,
        errorCode: error?.code || '',
        ...error?.diagnostics,
      }),
    };
  } finally {
    reader?.close?.();
    socket?.destroy?.();
  }
}

export function createMailProviderAdapter({
  env = readEnvironment(),
  transport = null,
} = {}) {
  const config = getMailProviderConfigFromEnv(env);
  const secrets = {
    stalwartSmtpPassword: normalizeString(env.STALWART_SMTP_PASSWORD, ''),
  };

  return {
    config,
    async send(message = {}) {
      if (config.dryRun) {
        return normalizeProviderResult({
          ok: true,
          accepted: true,
          dryRun: true,
          providerKey: config.providerKey,
          providerMessageId: createDryRunMessageId(message, config),
          code: 'mail_provider_dry_run',
          reason: 'Dry-run provider accepted the message without sending.',
          diagnostics: {
            templateKey: message.templateKey || '',
            relatedEntityType: message.relatedEntityType || '',
            relatedEntityId: message.relatedEntityId || '',
          },
        }, config);
      }

      if (typeof transport === 'function') {
        const result = await transport({
          message,
          config,
        });
        return normalizeProviderResult(result, config);
      }

      if (config.provider === 'stalwart') {
        return normalizeProviderResult(await sendViaStalwartSmtp({
          message,
          config,
          smtpPassword: secrets.stalwartSmtpPassword,
        }), config);
      }

      return normalizeProviderResult({
        ok: false,
        accepted: false,
        retryable: false,
        providerKey: config.providerKey,
        providerMessageId: '',
        code: `${config.provider}_transport_unavailable`,
        reason: 'No live mail transport is configured for this provider.',
        diagnostics: {
          provider: config.provider,
          dryRun: config.dryRun,
          postalApiConfigured: Boolean(config.postal.apiUrl && config.postal.apiKeyConfigured),
          postalSmtpConfigured: Boolean(
            config.postal.smtpHost
            && config.postal.smtpUsername
            && config.postal.smtpPasswordConfigured
          ),
          postalWebhookConfigured: Boolean(config.postal.webhookSecretConfigured),
          stalwartSmtpConfigured: Boolean(
            config.stalwart.smtpHost
            && config.stalwart.smtpUsername
            && config.stalwart.smtpPasswordConfigured
          ),
          stalwartJmapConfigured: Boolean(config.stalwart.jmapUrl),
        },
      }, config);
    },
  };
}

export const __internal = {
  buildRawEmailMessage,
  createDryRunMessageId,
  encodeQuotedPrintableText,
  normalizeProviderResult,
  parseBoolean,
  parseInteger,
  sendViaStalwartSmtp,
};
