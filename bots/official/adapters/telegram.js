function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_TELEGRAM_TEXT_LENGTH = 3900;

function buildTelegramBaseUrl(token) {
  return `https://api.telegram.org/bot${token}`;
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

async function requestTelegramJson(baseUrl, methodName, body) {
  let response;
  try {
    response = await fetch(`${baseUrl}/${methodName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(35000),
    });
  } catch (error) {
    throw new Error(`Telegram API ${methodName} network request failed: ${error?.message || 'fetch failed'}`);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true) {
    throw new Error(payload?.description || `Telegram API ${methodName} failed`);
  }

  return payload.result;
}

async function requestTelegramForm(baseUrl, methodName, formData) {
  let response;
  try {
    response = await fetch(`${baseUrl}/${methodName}`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(35000),
    });
  } catch (error) {
    throw new Error(`Telegram API ${methodName} network request failed: ${error?.message || 'fetch failed'}`);
  }

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

    lastResult = await requestTelegramJson(baseUrl, 'sendMessage', body);
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

  return requestTelegramForm(buildTelegramBaseUrl(token), 'sendPhoto', formData);
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

  return requestTelegramForm(buildTelegramBaseUrl(token), 'sendDocument', formData);
}

export async function answerTelegramCallback({
  token,
  callbackId,
  text,
  showAlert = false,
}) {
  return requestTelegramJson(buildTelegramBaseUrl(token), 'answerCallbackQuery', {
    callback_query_id: callbackId,
    text,
    show_alert: showAlert,
  });
}

export async function runTelegramPollingBot({
  config,
  router,
  logger = { info: () => {}, error: () => {} },
}) {
  const baseUrl = buildTelegramBaseUrl(config.telegram.token);
  let offset = 0;

  for (;;) {
    try {
      const updates = await requestTelegramJson(baseUrl, 'getUpdates', {
        offset,
        timeout: config.telegram.longPollSeconds,
        allowed_updates: ['message', 'edited_message', 'callback_query'],
      });

      for (const update of updates || []) {
        offset = Math.max(offset, Number(update.update_id || 0) + 1);
        try {
          const message = extractMessageEnvelope(update);
          if (message) {
            const reply = await router.handleMessage(message);
            if (!reply?.text) {
              continue;
            }

            await sendTelegramMessage({
              token: config.telegram.token,
              chatId: message.chatId,
              replyToMessageId: message.replyToMessageId,
              text: reply.text,
              replyMarkup: reply.replyMarkup,
            });
            continue;
          }

          const callback = extractCallbackEnvelope(update);
          if (!callback) {
            continue;
          }

          const callbackReply = await router.handleCallback?.(callback);
          if (callbackReply?.ackText) {
            await answerTelegramCallback({
              token: config.telegram.token,
              callbackId: callback.callbackId,
              text: callbackReply.ackText,
              showAlert: false,
            });
          }

          if (callbackReply?.text) {
            await sendTelegramMessage({
              token: config.telegram.token,
              chatId: callback.chatId,
              replyToMessageId: callback.replyToMessageId,
              text: callbackReply.text,
              replyMarkup: callbackReply.replyMarkup,
            });
          }

          if (callbackReply?.media?.buffer) {
            if (callbackReply.media.kind === 'document') {
              await sendTelegramDocument({
                token: config.telegram.token,
                chatId: callback.chatId,
                replyToMessageId: callback.replyToMessageId,
                caption: callbackReply.media.caption,
                replyMarkup: callbackReply.replyMarkup,
                buffer: callbackReply.media.buffer,
                fileName: callbackReply.media.fileName,
                mimeType: callbackReply.media.mimeType,
              });
            } else {
              await sendTelegramPhoto({
                token: config.telegram.token,
                chatId: callback.chatId,
                replyToMessageId: callback.replyToMessageId,
                caption: callbackReply.media.caption,
                replyMarkup: callbackReply.replyMarkup,
                buffer: callbackReply.media.buffer,
                fileName: callbackReply.media.fileName,
                mimeType: callbackReply.media.mimeType,
              });
            }
          }
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
};
