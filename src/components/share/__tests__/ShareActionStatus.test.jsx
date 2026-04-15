import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ShareActionStatus from '../ShareActionStatus.jsx';

vi.mock('../../../i18n/index.js', () => ({
  useI18n: () => ({
    t: (key) => ({
      'share.status.action.share': '分享',
      'share.status.action.download': '下载',
      'share.status.action.copyImage': '复制图片',
      'share.status.action.copyText': '复制文本',
      'share.status.action.default': '操作',
      'share.status.phase.running': '进行中',
      'share.status.phase.success': '已完成',
      'share.status.phase.error': '失败',
    }[key] || key),
  }),
}));

describe('ShareActionStatus', () => {
  it('renders nothing for idle feedback', () => {
    const { container } = render(
      <ShareActionStatus
        feedback={{
          phase: 'idle',
          action: null,
          message: '',
        }}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders a success status with translated labels', () => {
    render(
      <ShareActionStatus
        feedback={{
          phase: 'success',
          action: 'download',
          message: '图片已保存',
        }}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('下载');
    expect(screen.getByRole('status')).toHaveTextContent('已完成');
    expect(screen.getByRole('status')).toHaveTextContent('图片已保存');
  });
});
