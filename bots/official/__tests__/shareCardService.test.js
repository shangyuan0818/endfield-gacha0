import { describe, expect, it, vi } from 'vitest';
import { EndfieldApiError } from '../endfieldApiClient.js';
import { createBotShareCardService } from '../shareCardService.js';

function createPoolDetail(overrides = {}) {
  return {
    pool: {
      display_name: '春雷动，万物生',
      ...overrides.pool,
    },
    account: {
      display_name: '老鲤船长',
      ...overrides.account,
    },
    share_payload: {
      poolName: '春雷动，万物生',
      summaryItems: [],
      ...overrides.share_payload,
    },
    timeline_sections: [
      {
        title: '春雷动，万物生',
        entries: [
          {
            stageLabel: '命中节点',
            pulls: 40,
            resultSummaryWithoutFiveStar: '命中目标 6★「庄方宜」',
          },
        ],
      },
      ...(overrides.timeline_sections || []).slice(1),
    ],
    ...overrides,
  };
}

describe('createBotShareCardService', () => {
  it('uses pool-detail timeline/share payload as the only share-card source', async () => {
    const apiClient = {
      getPoolDetail: vi.fn().mockResolvedValue(createPoolDetail()),
    };
    const renderAsset = vi.fn().mockResolvedValue({
      kind: 'photo',
      buffer: Buffer.from('png'),
      mimeType: 'image/png',
      fileName: 'share.png',
    });

    const service = createBotShareCardService({
      apiClient,
      renderAsset,
    });

    const media = await service.buildPoolShareCard({
      provider: 'telegram',
      platformUserId: '1001',
      gameUid: '1545606431',
      poolId: 'special_1',
    });

    expect(apiClient.getPoolDetail).toHaveBeenCalledWith({
      provider: 'telegram',
      platformUserId: '1001',
      gameUid: '1545606431',
      poolId: 'special_1',
    });
    expect(renderAsset).toHaveBeenCalledTimes(1);
    expect(renderAsset.mock.calls[0][0].timeline_sections.length).toBeGreaterThan(0);
    expect(renderAsset.mock.calls[0][0].share_payload).toBeTruthy();
    expect(media.kind).toBe('photo');
  });

  it('rejects share generation when timeline data is missing instead of sending a fake card', async () => {
    const apiClient = {
      getPoolDetail: vi.fn().mockResolvedValue({
        ...createPoolDetail(),
        timeline_sections: [],
      }),
    };
    const renderAsset = vi.fn();

    const service = createBotShareCardService({
      apiClient,
      renderAsset,
    });

    await expect(service.buildPoolShareCard({
      provider: 'telegram',
      platformUserId: '1001',
      gameUid: '1545606431',
      poolId: 'special_1',
    })).rejects.toMatchObject({
      status: 404,
      message: '当前卡池缺少可分享的时间线数据，请先使用网页查看。',
    });

    expect(renderAsset).not.toHaveBeenCalled();
  });

  it('surfaces renderer-unavailable errors instead of falling back to an incorrect summary card', async () => {
    const apiClient = {
      getPoolDetail: vi.fn().mockResolvedValue(createPoolDetail()),
    };
    const renderAsset = vi.fn().mockRejectedValue(
      new EndfieldApiError('分享卡渲染环境未就绪，请先使用网页分享。', { status: 503 })
    );

    const service = createBotShareCardService({
      apiClient,
      renderAsset,
    });

    await expect(service.buildPoolShareCard({
      provider: 'telegram',
      platformUserId: '1001',
      gameUid: '1545606431',
      poolId: 'special_1',
    })).rejects.toMatchObject({
      status: 503,
      message: '分享卡渲染环境未就绪，请先使用网页分享。',
    });
  });
});
