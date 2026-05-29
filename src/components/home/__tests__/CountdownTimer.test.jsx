import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import CountdownTimer from '../CountdownTimer.jsx';
import { getCharacterAvatarUrl } from '../../../utils/characterUtils.js';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('../../../i18n/index.js', () => ({
  useI18n: () => ({
    locale: 'zh-CN',
    t: (key, params = {}) => {
      const messages = {
        'countdown.system': '系统倒计时',
        'countdown.protocolStarted': '协议已启动',
        'countdown.celebrate': '庆祝',
        'countdown.day': '天',
        'countdown.hour': '时',
        'countdown.minute': '分',
        'countdown.second': '秒',
        'home.countdown.startsAt': '开启时间',
        'home.countdown.releaseAt': '发布时间',
        'home.countdown.scheduleTime': `${params.label}: ${params.time}`,
      };
      return messages[key] || key;
    },
  }),
}));

vi.mock('../../../utils/characterUtils.js', () => ({
  getCharacterAvatarUrl: vi.fn((name) => `/avatars/${name}.webp`),
}));

describe('CountdownTimer', () => {
  it('renders extra-pool featured characters as a horizontal avatar row', () => {
    render(
      <CountdownTimer
        targetDate={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()}
        title="辉光庆典 池结束倒计时"
        subTitle="CURRENT BANNER ENDING // 辉光庆典"
        featuredCharacterNames={['莱万汀', '洁尔佩塔', '艾尔黛拉', '别礼']}
      />
    );

    expect(screen.getAllByRole('img')).toHaveLength(4);
    expect(screen.getByAltText('莱万汀')).toHaveAttribute('src', '/avatars/莱万汀.webp');
    expect(screen.getByAltText('洁尔佩塔')).toHaveAttribute('src', '/avatars/洁尔佩塔.webp');
    expect(getCharacterAvatarUrl).toHaveBeenCalledWith('艾尔黛拉');
    expect(getCharacterAvatarUrl).toHaveBeenCalledWith('别礼');
  });

  it('renders the local schedule time without the old italic title style', () => {
    render(
      <CountdownTimer
        targetDate={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()}
        title="佩丽卡 池开启倒计时"
        subTitle="NEXT BANNER STARTING // 佩丽卡"
        scheduleDate="2026-05-28T04:00:00.000Z"
      />
    );

    expect(screen.getByText(/开启时间:/)).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '佩丽卡 池开启倒计时' })).not.toHaveClass('italic');
  });
});
