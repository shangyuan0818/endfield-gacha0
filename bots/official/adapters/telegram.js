import https from 'node:https';
import { HttpsProxyAgent } from 'https-proxy-agent';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_TELEGRAM_TEXT_LENGTH = 3900;
const TELEGRAM_REQUEST_TIMEOUT_MS = 35000;

function buildTelegramBaseUrl(token) {
  return `https://api.telegram.org/bot${token}`;
}

function buildProxyAgent(proxyUrl) {
  const normalizedProxyUrl = String(proxyUrl || '').trim();
  return normalizedProxyUrl ? new HttpsProxyAgent(normalizedProxyUrl) : undefined;
}

function getNetworkErrorMessage(error) {
  const reason = error?.cause?.code || error?.code || error?.cause?.message || error?.message || 'fetch failed';
  return String(reason);
}

function parseJsonPayload(rawBody) {
  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}

function requestTelegramViaHttps({ url, methodName, headers, body, agent }) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: 'POST',
      agent,
      headers,
      timeout: TELEGRAM_REQUEST_TIMEOUT_MS,
    }, (response) => {
      let rawBody = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        rawBody += chunk;
      });
      response.on('end', () => {
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode || 0,
          json: async () => parseJsonPayload(rawBody),
        });
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error(`Telegram API ${methodName} request timeout`));
    });
    request.on('error', reject);

    if (body) {
      request.write(body);
    }
    request.end();
  });
}

async function requestTelegram(baseUrl, methodName, { headers, body, formData, proxyUrl } = {}) {
  const url = `${baseUrl}/${methodName}`;
  const proxyAgent = buildProxyAgent(proxyUrl);

  try {
    if (proxyAgent) {
      if (formData) {
        const formResponse = new Response(formData);
        const arrayBuffer = await formResponse.arrayBuffer();
        const multipartBody = Buffer.from(arrayBuffer);
        return requestTelegramViaHttps({
          url,
          methodName,
          agent: proxyAgent,
          headers: {
            ...Object.fromEntries(formResponse.headers),
            'Content-Length': String(multipartBody.byteLength),
          },
          body: multipartBody,
        });
      }

      return requestTelegramViaHttps({
        url,
        methodName,
        agent: proxyAgent,
        headers,
        body,
      });
    }

    return await fetch(url, {
      method: 'POST',
      headers,
      body: formData || body,
      signal: AbortSignal.timeout(TELEGRAM_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`Telegram API ${methodName} network request failed: ${getNetworkErrorMessage(error)}`);
  }
}

function getTelegramDisplayHandle(user) {
  if (!user) {
    return '';
  }

  if (user.username) {
    return `@${user.username}`;
  }

  return [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
}

async function requestTelegramJson(baseUrl, methodName, body, { proxyUrl } = {}) {
  const response = await requestTelegram(baseUrl, methodName, {
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    proxyUrl,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true) {
    throw new Error(payload?.description || `Telegram API ${methodName} failed`);
  }

  return payload.result;
}

async function requestTelegramForm(baseUrl, methodName, formData, { proxyUrl } = {}) {
  const response = await requestTelegram(baseUrl, methodName, {
    formData,
    proxyUrl,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true) {
    throw new Error(payload?.description || `Telegram API ${methodName} failed`);
  }

  return payload.result;
}

function extractMessageEnvelope(update) {
  const message = update?.message || update?.edited_message;
  if (!message?.text || !message?.chat?.id || !message?.from?.id) {
    return null;
  }

  return {
    updateId: update.update_id,
    chatId: message.chat.id,
    replyToMessageId: message.message_id,
    text: message.text,
    platformUserId: String(message.from.id),
    displayHandle: getTelegramDisplayHandle(message.from),
    isPrivateChat: message.chat.type === 'private',
  };
}

function extractCallbackEnvelope(update) {
  const callback = update?.callback_query;
  const message = callback?.message;
  if (!callback?.id || !callback?.data || !message?.chat?.id || !callback?.from?.id) {
    return null;
  }

  return {
    updateId: update.update_id,
    callbackId: callback.id,
    chatId: message.chat.id,
    replyToMessageId: message.message_id,
    data: callback.data,
    platformUserId: String(callback.from.id),
    displayHandle: getTelegramDisplayHandle(callback.from),
    isPrivateChat: message.chat.type === 'private',
  };
}

function sliceLongLine(line, maxLength) {
  const chunks = [];
  let remaining = String(line || '');

  while (remaining.length > maxLength) {
    chunks.push(remaining.slice(0, maxLength));
    remaining = remaining.slice(maxLength);
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

export function splitTelegramText(text, maxLength = MAX_TELEGRAM_TEXT_LENGTH) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [''];
  }

  if (normalized.length <= maxLength) {
    return [normalized];
  }

  const paragraphs = normalized.split('\n');
  const chunks = [];
  let currentChunk = '';

  const pushChunk = () => {
    const finalChunk = currentChunk.trim();
    if (finalChunk) {
      chunks.push(finalChunk);
    }
    currentChunk = '';
  };

  for (const paragraph of paragraphs) {
    const lines = paragraph.length > maxLength
      ? sliceLongLine(paragraph, maxLength)
      : [paragraph];

    for (const line of lines) {
      const candidate = currentChunk ? `${currentChunk}\n${line}` : line;
      if (candidate.length <= maxLength) {
        currentChunk = candidate;
        continue;
      }

      pushChunk();
      currentChunk = line;
    }
  }

  pushChunk();
  return chunks.length > 0 ? chunks : [normalized.slice(0, maxLength)];
}

function normalizeTelegramButton(button) {
  if (!button || typeof button !== 'object') {
    return null;
  }

  const text = String(button.text || '').trim();
  if (!text) {
    return null;
  }

  const url = typeof button.url === 'string' ? button.url.trim() : '';
  if (url) {
    return { text, url };
  }

  const callbackValue = button.callback_data;
  if (typeof callbackValue === 'string' && callbackValue.trim()) {
    return { text, callback_data: callbackValue };
  }

  if (typeof callbackValue === 'number' || typeof callbackValue === 'boolean') {
    return { text, callback_data: String(callbackValue) };
  }

  return null;
}

function normalizeTelegramReplyMarkup(replyMarkup) {
  const rows = replyMarkup?.inline_keyboard;
  if (!Array.isArray(rows)) {
    return undefined;
  }

  const normalizedRows = rows
    .map((row) => (
      Array.isArray(row)
        ? row.map(normalizeTelegramButton).filter(Boolean)
        : []
    ))
    .filter((row) => row.length > 0);

  if (normalizedRows.length === 0) {
    return undefined;
  }

  return {
    inline_keyboard: normalizedRows,
  };
}

export async function sendTelegramMessage({
  token,
  chatId,
  text,
  replyToMessageId,
  replyMarkup,
  proxyUrl,
}) {
  const baseUrl = buildTelegramBaseUrl(token);
  const chunks = splitTelegramText(text);
  const normalizedReplyMarkup = normalizeTelegramReplyMarkup(replyMarkup);
  let lastResult = null;

  for (let index = 0; index < chunks.length; index += 1) {
    const body = {
      chat_id: chatId,
      text: chunks[index],
      disable_web_page_preview: true,
    };

    if (index === 0 && replyToMessageId) {
      body.reply_to_message_id = replyToMessageId;
    }
    if (index === chunks.length - 1 && normalizedReplyMarkup) {
      body.reply_markup = normalizedReplyMarkup;
    }

    lastResult = await requestTelegramJson(baseUrl, 'sendMessage', body, { proxyUrl });
  }

  return lastResult;
}

export async function sendTelegramPhoto({
  token,
  chatId,
  caption,
  replyToMessageId,
  replyMarkup,
  buffer,
  fileName = 'share-card.png',
  mimeType = 'image/png',
  proxyUrl,
}) {
  const normalizedReplyMarkup = normalizeTelegramReplyMarkup(replyMarkup);
  const formData = new FormData();
  formData.set('chat_id', String(chatId));
  if (caption) {
    formData.set('caption', caption);
  }
  if (replyToMessageId) {
    formData.set('reply_to_message_id', String(replyToMessageId));
  }
  if (normalizedReplyMarkup) {
    formData.set('reply_markup', JSON.stringify(normalizedReplyMarkup));
  }
  formData.set('photo', new Blob([buffer], { type: mimeType }), fileName);

  return requestTelegramForm(buildTelegramBaseUrl(token), 'sendPhoto', formData, { proxyUrl });
}

export async function sendTelegramDocument({
  token,
  chatId,
  caption,
  replyToMessageId,
  replyMarkup,
  buffer,
  fileName = 'share-card.svg',
  mimeType = 'image/svg+xml',
  proxyUrl,
}) {
  const normalizedReplyMarkup = normalizeTelegramReplyMarkup(replyMarkup);
  const formData = new FormData();
  formData.set('chat_id', String(chatId));
  if (caption) {
    formData.set('caption', caption);
  }
  if (replyToMessageId) {
    formData.set('reply_to_message_id', String(replyToMessageId));
  }
  if (normalizedReplyMarkup) {
    formData.set('reply_markup', JSON.stringify(normalizedReplyMarkup));
  }
  formData.set('document', new Blob([buffer], { type: mimeType }), fileName);

  return requestTelegramForm(buildTelegramBaseUrl(token), 'sendDocument', formData, { proxyUrl });
}

export async function answerTelegramCallback({
  token,
  callbackId,
  text,
  showAlert = false,
  proxyUrl,
}) {
  return requestTelegramJson(buildTelegramBaseUrl(token), 'answerCallbackQuery', {
    callback_query_id: callbackId,
    text,
    show_alert: showAlert,
  }, { proxyUrl });
}

function getImmediateCallbackAckText(data) {
  const prefix = String(data || '').split('|')[0];
  if (prefix === 'share') return '正在生成分享图';
  if (prefix === 'log') return '正在导出日志';
  return '处理中';
}

async function acknowledgeTelegramCallback({
  config,
  callback,
  text,
  proxyUrl,
  logger,
}) {
  if (!callback?.callbackId) {
    return;
  }

  try {
    await answerTelegramCallback({
      token: config.telegram.token,
      callbackId: callback.callbackId,
      text,
      showAlert: false,
      proxyUrl,
    });
  } catch (error) {
    logger.error(`Telegram callback acknowledgement failed | update_id=${callback.updateId ?? 'unknown'} | ${error?.message || error}`);
  }
}

async function sendTelegramReply({
  config,
  envelope,
  reply,
  proxyUrl,
}) {
  if (!reply?.text && !reply?.media?.buffer) {
    return;
  }

  if (reply?.text) {
    await sendTelegramMessage({
      token: config.telegram.token,
      chatId: envelope.chatId,
      replyToMessageId: envelope.replyToMessageId,
      text: reply.text,
      replyMarkup: reply.media?.buffer ? undefined : reply.replyMarkup,
      proxyUrl,
    });
  }

  if (reply?.media?.buffer) {
    if (reply.media.kind === 'document') {
      await sendTelegramDocument({
        token: config.telegram.token,
        chatId: envelope.chatId,
        replyToMessageId: reply.text ? undefined : envelope.replyToMessageId,
        caption: reply.media.caption,
        replyMarkup: reply.replyMarkup,
        buffer: reply.media.buffer,
        fileName: reply.media.fileName,
        mimeType: reply.media.mimeType,
        proxyUrl,
      });
    } else {
      await sendTelegramPhoto({
        token: config.telegram.token,
        chatId: envelope.chatId,
        replyToMessageId: reply.text ? undefined : envelope.replyToMessageId,
        caption: reply.media.caption,
        replyMarkup: reply.replyMarkup,
        buffer: reply.media.buffer,
        fileName: reply.media.fileName,
        mimeType: reply.media.mimeType,
        proxyUrl,
      });
    }
  }
}

export async function processTelegramUpdate({
  update,
  config,
  router,
  logger = { info: () => {}, error: () => {} },
}) {
  const proxyUrl = config.telegram.proxyUrl;
  const message = extractMessageEnvelope(update);
  if (message) {
    const reply = await router.handleMessage(message);
    await sendTelegramReply({
      config,
      envelope: message,
      reply,
      proxyUrl,
    });
    return;
  }

  const callback = extractCallbackEnvelope(update);
  if (!callback) {
    return;
  }

  await acknowledgeTelegramCallback({
    config,
    callback,
    text: getImmediateCallbackAckText(callback.data),
    proxyUrl,
    logger,
  });

  const callbackReply = await router.handleCallback?.(callback);
  await sendTelegramReply({
    config,
    envelope: callback,
    reply: callbackReply,
    proxyUrl,
  });
}

export async function runTelegramPollingBot({
  config,
  router,
  logger = { info: () => {}, error: () => {} },
}) {
  const baseUrl = buildTelegramBaseUrl(config.telegram.token);
  const proxyUrl = config.telegram.proxyUrl;
  let offset = 0;

  for (;;) {
    try {
      const updates = await requestTelegramJson(baseUrl, 'getUpdates', {
        offset,
        timeout: config.telegram.longPollSeconds,
        allowed_updates: ['message', 'edited_message', 'callback_query'],
      }, { proxyUrl });

      for (const update of updates || []) {
        offset = Math.max(offset, Number(update.update_id || 0) + 1);
        try {
          await processTelegramUpdate({ update, config, router, logger });
        } catch (error) {
          logger.error(`Telegram update handling failed | update_id=${update?.update_id ?? 'unknown'} | ${error?.message || error}`);
        }
      }
    } catch (error) {
      logger.error('Telegram polling loop failed', error);
      await wait(config.telegram.pollIntervalMs);
    }
  }
}

export default {
  runTelegramPollingBot,
  sendTelegramMessage,
  sendTelegramPhoto,
  sendTelegramDocument,
  answerTelegramCallback,
  processTelegramUpdate,
};
