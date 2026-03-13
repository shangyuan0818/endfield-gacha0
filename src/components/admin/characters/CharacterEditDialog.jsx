/**
 * 角色编辑对话框组件
 *
 * @version 1.0.0
 * @date 2026-02-04
 */

import React, { useMemo } from 'react';
import { Save, X, Plus, Link as LinkIcon, Package, Clock3 } from 'lucide-react';
import DateTimePicker from '../../common/DateTimePicker';
import usePoolStore from '../../../stores/usePoolStore';
import { getCurrentUpPoolInfo } from '../../../utils/poolTimeUtils';
import { getLimitedCharacterPoolStatus } from '../../../utils/characterUtils';

/**
 * 角色编辑对话框
 */
const CharacterEditDialog = ({
  show,
  editingCharacter,
  characterForm,
  setCharacterForm,
  onCharacterIdChange,
  onCharacterNameChange,
  onCharacterTypeChange,
  aliasInput,
  setAliasInput,
  actionLoading,
  onSave,
  onClose,
  onAddAlias,
  onRemoveAlias
}) => {
  const pools = usePoolStore(state => state.pools);
  const poolsArray = useMemo(() => (Array.isArray(pools) ? pools : Object.values(pools || {})), [pools]);
  const currentUpInfo = useMemo(() => getCurrentUpPoolInfo(poolsArray), [poolsArray]);
  const currentPoolContext = useMemo(() => ({
    start_time: currentUpInfo?.poolData?.start_time || currentUpInfo?.startDate,
    rotation_position: currentUpInfo?.rotationPosition,
  }), [currentUpInfo]);
  const limitedStatus = useMemo(
    () => getLimitedCharacterPoolStatus({ pool_config: characterForm.pool_config }, currentPoolContext),
    [characterForm.pool_config, currentPoolContext]
  );
  const getCurrentLocalDateTimeValue = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  if (!show) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose}></div>

      {/* 对话框 */}
      <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl z-50">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 max-h-full overflow-y-auto">
          {/* 对话框标题 */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-bold text-slate-700 dark:text-zinc-300">
              {editingCharacter ? '编辑角色' : '新增角色'}
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              <X size={20} />
            </button>
          </div>

          {/* 表单内容 */}
          <div className="p-4 space-y-4">
            {/* 角色ID */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                角色ID *
              </label>
              <input
                type="text"
                value={characterForm.id}
                onChange={(e) => onCharacterIdChange(e.target.value)}
                placeholder="例如：char_rococo"
                disabled={!!editingCharacter}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 disabled:bg-slate-100 disabled:dark:bg-zinc-800"
              />
              {!editingCharacter && (
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                  新建时会按名称自动生成稳定占位 ID；如果你要手动覆盖，也请避免再使用时间戳式随机 ID
                </p>
              )}
            </div>

            {/* 角色名称 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                角色名称 *
              </label>
              <input
                type="text"
                value={characterForm.name}
                onChange={(e) => onCharacterNameChange(e.target.value)}
                placeholder="例如：莱万汀"
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
              />
            </div>

            {/* 稀有度和类型 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  稀有度 *
                </label>
                <select
                  value={characterForm.rarity}
                  onChange={(e) => setCharacterForm(prev => ({ ...prev, rarity: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                >
                  <option value={6}>6星</option>
                  <option value={5}>5星</option>
                  <option value={4}>4星</option>
                  <option value={3}>3星</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  类型 *
                </label>
                <select
                  value={characterForm.type}
                  onChange={(e) => onCharacterTypeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                >
                  <option value="character">角色</option>
                  <option value="weapon">武器</option>
                </select>
              </div>
            </div>

            {/* 是否限定 */}
            <div>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={characterForm.is_limited}
                  onChange={(e) => setCharacterForm(prev => ({ ...prev, is_limited: e.target.checked }))}
                  className="w-4 h-4"
                />
                限定角色/武器
              </label>
            </div>

            {/* 头像 URL */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-2">
                <LinkIcon size={14} />
                头像图片 URL
              </label>
              <input
                type="text"
                value={characterForm.avatar_url}
                onChange={(e) => setCharacterForm(prev => ({ ...prev, avatar_url: e.target.value }))}
                placeholder="https://example.com/avatar.jpg"
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
              />
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                建议使用外部图床链接，推荐方形图片
              </p>
            </div>

            {/* 别名管理 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                别名
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && onAddAlias()}
                  placeholder="输入别名后按回车添加"
                  className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                />
                <button
                  onClick={onAddAlias}
                  className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-none transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
              {characterForm.aliases.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {characterForm.aliases.map((alias, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded text-sm"
                    >
                      <span>{alias}</span>
                      <button
                        onClick={() => onRemoveAlias(index)}
                        className="hover:text-blue-800 dark:hover:text-blue-200"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                别名用于识别角色的其他名称（如昵称、英文名等）
              </p>
            </div>

            {/* 卡池配置 */}
            <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-4">
              <h4 className="text-sm font-bold text-slate-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                <Package size={16} />
                卡池配置
              </h4>

              {/* 可用卡池 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  可用卡池
                </label>
                <div className="flex flex-wrap gap-3">
                  {['limited', 'standard', 'weapon'].map(poolType => (
                    <label key={poolType} className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                      <input
                        type="checkbox"
                        checked={characterForm.pool_config.pools.includes(poolType)}
                        onChange={(e) => {
                          setCharacterForm(prev => {
                            const nextPools = e.target.checked
                              ? [...prev.pool_config.pools, poolType]
                              : prev.pool_config.pools.filter(p => p !== poolType);

                            return {
                              ...prev,
                              pool_config: {
                                ...prev.pool_config,
                                pools: nextPools,
                                introduced_at: poolType === 'limited' && e.target.checked && !prev.pool_config.introduced_at
                                  ? getCurrentLocalDateTimeValue()
                                  : prev.pool_config.introduced_at
                              }
                            };
                          });
                        }}
                        className="w-4 h-4"
                      />
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        poolType === 'limited' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                        poolType === 'standard' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                        'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400'
                      }`}>
                        {poolType === 'limited' ? '限定池' : poolType === 'standard' ? '常驻池' : '武器池'}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                  选择该角色/武器可以出现的卡池类型
                </p>
              </div>

              {/* 限定池专属配置 */}
              {characterForm.pool_config.pools.includes('limited') && (
                <div className="p-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/30 mb-4">
                  <h5 className="text-xs font-bold text-orange-700 dark:text-orange-400 mb-3 uppercase">
                    限定池计划配置
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DateTimePicker
                      label="首次进入限定池时间"
                      value={characterForm.pool_config.introduced_at || ''}
                      onChange={(val) => setCharacterForm(prev => ({
                        ...prev,
                        pool_config: {
                          ...prev.pool_config,
                          introduced_at: val
                        }
                      }))}
                      placeholder="留空时保存为当前时间"
                    />

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                        几次轮换后移出
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="留空=永不移出"
                        value={characterForm.pool_config.removes_after ?? ''}
                        onChange={(e) => setCharacterForm(prev => ({
                          ...prev,
                          pool_config: {
                            ...prev.pool_config,
                            removes_after: e.target.value === '' ? null : parseInt(e.target.value, 10) || null
                          }
                        }))}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
                      <Clock3 size={12} />
                      <span>
                        当前计划位次: {limitedStatus.effectiveRotationPosition}
                        {limitedStatus.removesAfter !== null ? ` / ${limitedStatus.removesAfter}` : ' / ∞'}
                      </span>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded ${
                      !limitedStatus.isIntroduced || limitedStatus.isRemoved
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                    }`}>
                      {!limitedStatus.isIntroduced
                        ? '当前限定池开始时间早于该角色首次入池时间，当前池计划中不会出现此角色'
                        : limitedStatus.isRemoved
                          ? `当前计划位次已达到 ${limitedStatus.effectiveRotationPosition}/${limitedStatus.removesAfter}，该角色按计划已移出限定池`
                          : `当前计划位次 ${limitedStatus.effectiveRotationPosition}${limitedStatus.removesAfter !== null ? `/${limitedStatus.removesAfter}` : '/∞'}，该角色仍在限定池计划中`
                      }
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-500">
                      兼容字段 `limited_rotation_count / is_active_in_limited` 已改为保存时自动派生，不再在后台手动编辑。
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 对话框操作按钮 */}
          <div className="flex items-center gap-2 p-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              onClick={onSave}
              disabled={actionLoading === 'save'}
              className="flex items-center gap-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-none transition-colors disabled:opacity-50"
            >
              <Save size={16} />
              {actionLoading === 'save' ? '保存中...' : '保存'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-none"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CharacterEditDialog;
