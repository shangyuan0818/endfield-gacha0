import https from 'node:https';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOfficialBotConfig } from '../config.js';
import { processTelegramUpdate, sendTelegramMessage, splitTelegramText } from '../adapters/telegram.js';

describe('telegram adapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('splits long text into multiple Telegram-safe chunks', () => {
    const text = [
      '第一段',
      'A'.repeat(2500),
      'B'.repeat(2500),
    ].join('\n');

    const chunks = splitTelegramText(text, 3900);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 3900)).toBe(true);
    expect(chunks.join('\n').replace(/\n+/g, '\n')).toContain('第一段');
  });

  it('sends long message chunks in order and keeps inline keyboard on the last chunk', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 1 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendTelegramMessage({
      token: 'token',
      chatId: '1001',
      text: ['第一段', 'A'.repeat(2500), 'B'.repeat(2500)].join('\n'),
      replyToMessageId: 88,
      replyMarkup: { inline_keyboard: [[{ text: '按钮', callback_data: 'test' }]] },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);

    expect(firstBody.reply_to_message_id).toBe(88);
    expect(firstBody.reply_markup).toBeUndefined();
    expect(secondBody.reply_markup).toEqual({ inline_keyboard: [[{ text: '按钮', callback_data: 'test' }]] });
    expect(secondBody.reply_to_message_id).toBeUndefined();
  });

  it('drops invalid inline keyboard buttons before sending', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 1 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendTelegramMessage({
      token: 'token',
      chatId: '1001',
      text: '测试按钮',
      replyMarkup: {
        inline_keyboard: [
          [
            { text: '无效按钮', callback_data: null },
            { text: '有效按钮', callback_data: 'valid-callback' },
          ],
        ],
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.reply_markup).toEqual({
      inline_keyboard: [[{ text: '有效按钮', callback_data: 'valid-callback' }]],
    });
  });

  it('reads Telegram proxy from scoped env before generic proxy env', () => {
    const config = createOfficialBotConfig({
      provider: 'telegram',
      env: {
        OFFICIAL_BOT_BASE_URL: 'https://example.com',
        OFFICIAL_BOT_PUBLIC_API_KEY: 'public-key',
        OFFICIAL_BOT_VERIFIER_SECRET: 'secret',
        TELEGRAM_OFFICIAL_BOT_TOKEN: 'telegram-token',
        TELEGRAM_OFFICIAL_BOT_PROXY_URL: 'http://127.0.0.1:7890',
        HTTPS_PROXY: 'http://127.0.0.1:8888',
      },
    });

    expect(config.telegram.proxyUrl).toBe('http://127.0.0.1:7890');
  });

  it('uses an HTTPS request path instead of global fetch when proxyUrl is provided', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const requestMock = vi.spyOn(https, 'request').mockImplementation((url, options, callback) => {
      expect(String(url)).toBe('https://api.telegram.org/bottoken/sendMessage');
      expect(options.agent).toBeTruthy();
      expect(options.headers).toMatchObject({ 'Content-Type': 'application/json' });

      const listeners = new Map();
      const request = {
        on: vi.fn((event, handler) => {
          listeners.set(event, handler);
          return request;
        }),
        write: vi.fn((payload) => {
          expect(JSON.parse(String(payload))).toMatchObject({ chat_id: '1001', text: '代理测试' });
        }),
        end: vi.fn(() => {
          const response = {
            statusCode: 200,
            setEncoding: vi.fn(),
            on: vi.fn((event, handler) => {
              if (event === 'data') {
                handler('{"ok":true,"result":{"message_id":1}}');
              }
              if (event === 'end') {
                handler();
              }
              return response;
            }),
          };
          callback(response);
        }),
        destroy: vi.fn((error) => listeners.get('error')?.(error)),
      };
      return request;
    });

    await sendTelegramMessage({
      token: 'token',
      chatId: '1001',
      text: '代理测试',
      proxyUrl: 'http://127.0.0.1:7890',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('does not block callback media replies when Telegram acknowledgement is already expired', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (String(url).endsWith('/answerCallbackQuery')) {
        return {
          ok: false,
          json: async () => ({
            ok: false,
            description: 'Bad Request: query is too old and response timeout expired or query ID is invalid',
          }),
        };
      }

      if (String(url).endsWith('/sendPhoto')) {
        return {
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 2 } }),
        };
      }

      throw new Error(`Unexpected Telegram method: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const logger = { info: vi.fn(), error: vi.fn() };
    const router = {
      handleCallback: vi.fn().mockResolvedValue({
        media: {
          kind: 'photo',
          buffer: Buffer.from('png-data'),
          mimeType: 'image/png',
          fileName: 'share.png',
          caption: '分享图',
        },
      }),
    };

    await processTelegramUpdate({
      update: {
        update_id: 100,
        callback_query: {
          id: 'expired-callback',
          data: 'share|p.test',
          from: { id: 1001, username: 'tester' },
          message: {
            message_id: 20,
            chat: { id: 1001, type: 'private' },
          },
        },
      },
      config: {
        telegram: {
          token: 'token',
        },
      },
      router,
      logger,
    });

    expect(router.handleCallback).toHaveBeenCalledWith(expect.objectContaining({
      callbackId: 'expired-callback',
      data: 'share|p.test',
    }));
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      'https://api.telegram.org/bottoken/answerCallbackQuery',
      'https://api.telegram.org/bottoken/sendPhoto',
    ]);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Telegram callback acknowledgement failed'));
  });
});
