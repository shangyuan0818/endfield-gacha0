import React, { useState, useMemo } from 'react';
import {
  Search, User, Database, RefreshCw, Trash2,
  Package, BarChart3, ChevronUp, ChevronDown
} from 'lucide-react';

/**
 * 用户数据管理面板
 */
const UserDataPanel = ({
  users,
  selectedUserId,
  userPools,
  userHistory,
  userHistoryMeta,
  userDataLoading,
  expandedPools,
  actionLoading,
  onLoadUserData,
  onTogglePoolExpand,
  getUserStats,
  getPoolStats,
  getPoolRecords,
  onDeleteUserData,
  onDeletePoolRecords,
  onDeletePool
}) => {
  const [userDataSearch, setUserDataSearch] = useState('');

  const selectedUser = useMemo(() =>
    users.find(u => u.id === selectedUserId),
    [users, selectedUserId]
  );

  const stats = selectedUserId ? getUserStats() : null;
  const isHistorySampleTruncated = Boolean(userHistoryMeta?.isTruncated);
  const loadedHistoryCount = userHistoryMeta?.loadedCount || 0;
  const totalHistoryCount = userHistoryMeta?.totalCount || 0;
  const historySampleLimit = userHistoryMeta?.sampleLimit || loadedHistoryCount;

  const filteredUsersForData = useMemo(() =>
    users.filter(user =>
      user.username?.toLowerCase().includes(userDataSearch.toLowerCase()) ||
      user.email?.toLowerCase().includes(userDataSearch.toLowerCase())
    ),
    [users, userDataSearch]
  );

  return (
    <div className="space-y-4">
      {/* 用户选择区域 */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* 用户列表 */}
        <div className="lg:w-72 shrink-0">
          <div className="mb-3 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              value={userDataSearch}
              onChange={(e) => setUserDataSearch(e.target.value)}
              placeholder="搜索用户..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
            />
          </div>
          <div className="border border-zinc-200 dark:border-zinc-700 max-h-[400px] overflow-y-auto">
            {filteredUsersForData.map(user => (
              <button
                key={user.id}
                onClick={() => onLoadUserData(user.id)}
                className={`w-full text-left px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 transition-colors ${
                  selectedUserId === user.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500'
                    : 'hover:bg-slate-50 dark:hover:bg-zinc-800 border-l-4 border-l-transparent'
                }`}
              >
                <div className="font-medium text-sm text-slate-700 dark:text-zinc-300 truncate">
                  {user.username || '未设置用户名'}
                </div>
                <div className="text-xs text-slate-400 dark:text-zinc-500 truncate">
                  {user.email}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-1 py-0.5 rounded ${
                    user.role === 'super_admin' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                    user.role === 'admin' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                    'bg-slate-100 text-slate-500 dark:bg-zinc-700 dark:text-zinc-400'
                  }`}>
                    {user.role === 'super_admin' ? '超管' : user.role === 'admin' ? '管理员' : '用户'}
                  </span>
                </div>
              </button>
            ))}
            {filteredUsersForData.length === 0 && (
              <div className="p-4 text-center text-slate-400 dark:text-zinc-500 text-sm">
                未找到用户
              </div>
            )}
          </div>
        </div>

        {/* 用户数据详情 */}
        <div className="flex-1 min-w-0">
          {!selectedUserId ? (
            <div className="h-full flex items-center justify-center p-12 bg-slate-50 dark:bg-zinc-950 border border-dashed border-zinc-300 dark:border-zinc-700">
              <div className="text-center text-slate-400 dark:text-zinc-500">
                <Database size={48} className="mx-auto mb-3 opacity-50" />
                <p>请从左侧选择一个用户查看其数据</p>
              </div>
            </div>
          ) : userDataLoading ? (
            <div className="h-full flex items-center justify-center p-12">
              <RefreshCw size={24} className="animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* 用户信息卡片 */}
              <div className="p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <User size={24} />
                  <div>
                    <h4 className="font-bold text-lg">{selectedUser?.username || '未设置用户名'}</h4>
                    <p className="text-blue-100 text-sm">{selectedUser?.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3 mt-4">
                  <div className="text-center p-2 bg-white/10 rounded">
                    <div className="text-2xl font-bold">{stats?.userPoolCount || 0}</div>
                    <div className="text-xs text-blue-100">卡池</div>
                  </div>
                  <div className="text-center p-2 bg-white/10 rounded">
                    <div className="text-2xl font-bold">{stats?.totalRecordCount || 0}</div>
                    <div className="text-xs text-blue-100">记录总数</div>
                  </div>
                  <div className="text-center p-2 bg-white/10 rounded">
                    <div className="text-2xl font-bold text-yellow-300">{stats?.sixStarCount || 0}</div>
                    <div className="text-xs text-blue-100">{isHistorySampleTruncated ? '样本6星' : '6星'}</div>
                  </div>
                  <div className="text-center p-2 bg-white/10 rounded">
                    <div className="text-2xl font-bold text-purple-300">{stats?.fiveStarCount || 0}</div>
                    <div className="text-xs text-blue-100">{isHistorySampleTruncated ? '样本5星' : '5星'}</div>
                  </div>
                </div>
                {isHistorySampleTruncated && (
                  <div className="mt-3 rounded bg-amber-500/15 border border-amber-300/40 px-3 py-2 text-xs text-amber-50">
                    当前仅加载最近 {loadedHistoryCount} / 共 {totalHistoryCount} 条记录。
                    下方星级统计、卡池抽数与最近记录列表均基于已加载样本，不代表该用户全量历史。
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={onDeleteUserData}
                    disabled={actionLoading === 'purgeUserData'}
                    className="flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-none transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    {actionLoading === 'purgeUserData' ? '清理中...' : '清空该用户数据'}
                  </button>
                </div>
              </div>

              {/* 卡池列表 */}
              <div>
                <h5 className="font-bold text-slate-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
                  <Package size={16} />
                  用户创建的卡池 ({userPools.length})
                </h5>
                {userPools.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 dark:text-zinc-500 bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700">
                    该用户暂未创建任何卡池
                  </div>
                ) : (
                  <div className="space-y-2">
                    {userPools.map(pool => {
                      const poolStats = getPoolStats(pool.pool_id);
                      const isExpanded = expandedPools.has(pool.pool_id);
                      const poolRecords = getPoolRecords(pool.pool_id);

                      return (
                        <div key={pool.pool_id} className="border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                          {/* 卡池头部 */}
                          <button
                            onClick={() => onTogglePoolExpand(pool.pool_id)}
                            className="w-full text-left p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className={`text-xs px-2 py-1 rounded font-medium ${
                                pool.type === 'limited' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                pool.type === 'weapon' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              }`}>
                                {pool.type === 'limited' ? '限定' : pool.type === 'weapon' ? '武器' : '常驻'}
                              </span>
                              <span className="font-medium text-slate-700 dark:text-zinc-300">{pool.name}</span>
                              {pool.locked && (
                                <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded">
                                  已锁定
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500">
                                <span>{isHistorySampleTruncated ? `样本 ${poolStats.total} 抽` : `${poolStats.total} 抽`}</span>
                                <span className="text-yellow-600">{isHistorySampleTruncated ? `样本★${poolStats.sixStar}` : `★${poolStats.sixStar}`}</span>
                                <span className="text-purple-600">{isHistorySampleTruncated ? `样本★${poolStats.fiveStar}` : `★${poolStats.fiveStar}`}</span>
                              </div>
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                          </button>

                          {/* 卡池详情 */}
                          {isExpanded && (
                            <div className="border-t border-zinc-200 dark:border-zinc-700 p-3 bg-slate-50 dark:bg-zinc-950">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                <div className="text-center p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                                  <div className="text-lg font-bold text-yellow-600">{poolStats.sixStar}</div>
                                  <div className="text-xs text-slate-500">{isHistorySampleTruncated ? '样本6星' : '6星'}</div>
                                </div>
                                <div className="text-center p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                                  <div className="text-lg font-bold text-purple-600">{poolStats.fiveStar}</div>
                                  <div className="text-xs text-slate-500">{isHistorySampleTruncated ? '样本5星' : '5星'}</div>
                                </div>
                                <div className="text-center p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                                  <div className="text-lg font-bold text-blue-600">{poolStats.fourStar}</div>
                                  <div className="text-xs text-slate-500">{isHistorySampleTruncated ? '样本4星' : '4星'}</div>
                                </div>
                                <div className="text-center p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                                  <div className="text-lg font-bold text-slate-500">{poolStats.threeStar}</div>
                                  <div className="text-xs text-slate-500">{isHistorySampleTruncated ? '样本3星' : '3星'}</div>
                                </div>
                              </div>
                              {isHistorySampleTruncated && (
                                <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300">
                                  该卡池统计仅基于该用户最近 {historySampleLimit} 条已加载记录中的命中样本，不代表该池全量抽卡数。
                                </div>
                              )}

                              {/* 卡池级操作 */}
                              <div className="flex flex-wrap gap-2 mb-3">
                                <button
                                  onClick={() => onDeletePoolRecords(pool.pool_id)}
                                  disabled={actionLoading === `purge_records_${pool.pool_id}`}
                                  className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-none transition-colors disabled:opacity-50"
                                >
                                  <Trash2 size={14} />
                                  {actionLoading === `purge_records_${pool.pool_id}` ? '清理中...' : '清空该卡池记录'}
                                </button>
                                <button
                                  onClick={() => onDeletePool(pool.pool_id)}
                                  disabled={actionLoading === `delete_pool_${pool.pool_id}`}
                                  className="flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-none transition-colors disabled:opacity-50"
                                >
                                  <Trash2 size={14} />
                                  {actionLoading === `delete_pool_${pool.pool_id}` ? '删除中...' : '删除卡池+记录'}
                                </button>
                              </div>

                              {/* 最近记录 */}
                              {poolRecords.length > 0 && (
                                <div>
                                  <div className="text-xs text-slate-500 dark:text-zinc-500 mb-2">
                                    最近 {Math.min(poolRecords.length, 20)} 条已加载记录:
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {poolRecords.slice(0, 20).map((record, idx) => (
                                      <span
                                        key={record.record_id || idx}
                                        className={`text-xs px-1.5 py-0.5 rounded ${
                                          record.rarity === 6 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-bold' :
                                          record.rarity === 5 ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                          record.rarity === 4 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                          'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400'
                                        }`}
                                        title={`${record.rarity}星 ${record.is_standard ? '(常驻)' : ''} ${record.special_type || ''}`}
                                      >
                                        {record.rarity}★
                                        {record.is_standard && <span className="opacity-60">歪</span>}
                                        {record.special_type === 'gift' && <span className="opacity-60">礼</span>}
                                      </span>
                                    ))}
                                    {poolRecords.length > 20 && (
                                      <span className="text-xs text-slate-400 dark:text-zinc-500">
                                        +{poolRecords.length - 20} 条
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="mt-2 text-xs text-slate-400 dark:text-zinc-600">
                                创建于: {new Date(pool.created_at).toLocaleString()}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 抽卡统计 */}
              <div>
                <h5 className="font-bold text-slate-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
                  <BarChart3 size={16} />
                  {isHistorySampleTruncated ? '抽卡记录样本汇总' : '抽卡记录汇总'}
                </h5>
                <div className="p-4 bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                    <div>
                      <div className="text-2xl font-bold text-slate-700 dark:text-zinc-300">{loadedHistoryCount}</div>
                      <div className="text-xs text-slate-500">{isHistorySampleTruncated ? '已加载样本' : '总抽数'}</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-yellow-600">{userHistory.filter(h => h.rarity === 6).length}</div>
                      <div className="text-xs text-slate-500">{isHistorySampleTruncated ? '样本6星' : '6星'}</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600">{userHistory.filter(h => h.rarity === 5).length}</div>
                      <div className="text-xs text-slate-500">{isHistorySampleTruncated ? '样本5星' : '5星'}</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{userHistory.filter(h => h.rarity === 4).length}</div>
                      <div className="text-xs text-slate-500">{isHistorySampleTruncated ? '样本4星' : '4星'}</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-slate-500">{userHistory.filter(h => h.rarity === 3).length}</div>
                      <div className="text-xs text-slate-500">{isHistorySampleTruncated ? '样本3星' : '3星'}</div>
                    </div>
                  </div>
                  {userHistory.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 text-xs text-slate-500 dark:text-zinc-500">
                      {isHistorySampleTruncated && (
                        <>
                          以下出率基于最近 {loadedHistoryCount} 条已加载样本
                          {' · '}
                        </>
                      )}
                      6星出率: {((userHistory.filter(h => h.rarity === 6).length / userHistory.length) * 100).toFixed(2)}%
                      {' · '}
                      5星出率: {((userHistory.filter(h => h.rarity === 5).length / userHistory.length) * 100).toFixed(2)}%
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDataPanel;
