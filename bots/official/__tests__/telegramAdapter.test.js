import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendTelegramMessage, splitTelegramText } from '../adapters/telegram.js';

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
});
