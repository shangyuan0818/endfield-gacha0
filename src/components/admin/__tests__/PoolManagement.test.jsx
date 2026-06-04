import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PoolManagement from '../PoolManagement.jsx';

vi.mock('../../../hooks/admin/usePools', () => ({
  usePools: vi.fn(),
}));

vi.mock('../HomeVersionTimelineManager.jsx', () => ({
  default: ({ pools }) => (
    <div data-testid="version-manager">版本时间线管理 · {pools.length} 个卡池</div>
  ),
}));

const { usePools } = await import('../../../hooks/admin/usePools');

describe('PoolManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePools.mockReturnValue({
      pools: [
        {
          pool_id: 'pool_1',
          name: '拳出无悔',
          type: 'limited',
          start_time: '2026-06-05T04:00:00.000Z',
          end_time: '2026-06-26T04:00:00.000Z',
        },
      ],
      characters: [],
      poolCharacters: {},
      filteredPools: [],
      loading: false,
      actionLoading: null,
      searchQuery: '',
      setSearchQuery: vi.fn(),
      typeFilter: 'all',
      setTypeFilter: vi.fn(),
      sortField: 'created_at',
      setSortField: vi.fn(),
      sortOrder: 'desc',
      setSortOrder: vi.fn(),
      showEditDialog: false,
      editingPool: null,
      poolForm: {},
      setPoolForm: vi.fn(),
      editingPoolCharacters: [],
      poolDraftDiff: null,
      checkUpCharacterExists: vi.fn(),
      resetForm: vi.fn(),
      startCreate: vi.fn(),
      startEdit: vi.fn(),
      handleSavePool: vi.fn(),
      handleDeletePool: vi.fn(),
      handleRecalculateIsStandard: vi.fn(),
      toggleCharacterInPool: vi.fn(),
      addAllCharactersToPool: vi.fn(),
      removeAllCharactersFromPool: vi.fn(),
    });
  });

  it('opens the version management subtab from pool management', () => {
    render(<PoolManagement showToast={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /版本管理/u }));

    expect(screen.getByTestId('version-manager')).toHaveTextContent('版本时间线管理 · 1 个卡池');
  });
});
