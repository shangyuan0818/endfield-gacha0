/**
 * 角色编辑对话框组件
 *
 * @version 1.1.0
 * @date 2026-02-04
 */

import React from 'react';
import { Save, X, Plus, Link as LinkIcon, Package } from 'lucide-react';

const POOL_OPTIONS = [
  {
    value: 'limited',
    label: '限定池',
    className: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  },
  {
    value: 'standard',
    label: '常驻池',
    className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
  },
  {
    value: 'weapon',
    label: '武器池',
    className: 'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400',
  },
];

/**
 * 角色编辑对话框
 */
const CharacterEditDialog = ({
  show,
  editingCharacter,
  characterForm,
  localizedNameEnOverride,
  localizedNameEnPreview,
  onLocalizedNameEnChange,
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
  if (!show) return null;

  const availablePoolOptions = POOL_OPTIONS.filter((poolOption) => (
    characterForm.type === 'weapon'
      ? poolOption.value === 'weapon'
      : poolOption.value !== 'weapon'
  ));

  return (
    <>
      {/* 背景遮罩 */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose}></div>

      {/* 对话框 */}
      <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-4xl md:max-h-[90vh] z-50">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 h-full md:h-auto max-h-full overflow-hidden flex flex-col">
          {/* 对话框标题 */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
            <div>
              <h3 className="text-lg font-bold text-slate-700 dark:text-zinc-300">
                {editingCharacter ? '编辑角色/武器' : '新增角色/武器'}
              </h3>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                卡池归属只决定候选范围；限定池轮换已改由卡池内容手动维护。
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              <X size={20} />
            </button>
          </div>

          {/* 表单内容 */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-5">
              <div className="space-y-4">
                <h4 className="font-bold text-slate-600 dark:text-zinc-400 text-sm border-b border-zinc-200 dark:border-zinc-700 pb-2">
                  基础信息
                </h4>

                {/* 角色ID */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    ID *
                  </label>
                  <input
                    type="text"
                    value={characterForm.id}
                    onChange={(e) => onCharacterIdChange(e.target.value)}
                    placeholder={characterForm.type === 'weapon' ? '例如：weapon_xxx' : '例如：char_xxx'}
                    disabled={!!editingCharacter}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 disabled:bg-slate-100 disabled:dark:bg-zinc-800"
                  />
                  {!editingCharacter && (
                    <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                      新建时会按名称自动生成稳定占位 ID；拿到官方 ID 后再统一修正。
                    </p>
                  )}
                </div>

                {/* 角色名称 */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    名称 *
                  </label>
                  <input
                    type="text"
                    value={characterForm.name}
                    onChange={(e) => onCharacterNameChange(e.target.value)}
                    placeholder={characterForm.type === 'weapon' ? '例如：协议回响' : '例如：莱万汀'}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    英文名称
                  </label>
                  <input
                    type="text"
                    value={localizedNameEnOverride}
                    onChange={(e) => onLocalizedNameEnChange(e.target.value)}
                    placeholder={localizedNameEnPreview || '例如：Rossi'}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                  />
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                    留空则使用内置映射；填写后会覆盖默认英文名。
                  </p>
                </div>

                {/* 稀有度和类型 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      稀有度 *
                    </label>
                    <select
                      value={characterForm.rarity}
                      onChange={(e) => setCharacterForm(prev => ({ ...prev, rarity: parseInt(e.target.value, 10) }))}
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
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={characterForm.is_limited}
                    onChange={(e) => setCharacterForm(prev => ({ ...prev, is_limited: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  限定角色/武器
                </label>

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
                </div>
              </div>

              <div className="space-y-4">
                {/* 别名管理 */}
                <div>
                  <h4 className="font-bold text-slate-600 dark:text-zinc-400 text-sm border-b border-zinc-200 dark:border-zinc-700 pb-2 mb-3">
                    别名
                  </h4>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={aliasInput}
                      onChange={(e) => setAliasInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && onAddAlias()}
                      placeholder="输入别名后按回车添加"
                      className="flex-1 min-w-0 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                    />
                    <button
                      onClick={onAddAlias}
                      className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-none transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  {characterForm.aliases.length > 0 ? (
                    <div className="max-h-32 overflow-y-auto flex flex-wrap gap-2 pr-1">
                      {characterForm.aliases.map((alias, index) => (
                        <div
                          key={`${alias}-${index}`}
                          className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded text-sm"
                        >
                          <span className="break-all">{alias}</span>
                          <button
                            onClick={() => onRemoveAlias(index)}
                            className="hover:text-blue-800 dark:hover:text-blue-200 shrink-0"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 dark:text-zinc-500">
                      还没有别名。
                    </p>
                  )}
                </div>

                {/* 卡池配置 */}
                <div className="border-t lg:border-t-0 border-zinc-200 dark:border-zinc-700 pt-4 lg:pt-0">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-zinc-300 mb-3 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                    <Package size={16} />
                    可出现卡池
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2">
                    {availablePoolOptions.map(poolOption => (
                      <label
                        key={poolOption.value}
                        className="flex items-center justify-between gap-3 p-2 border border-zinc-200 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-800/40 text-sm text-slate-600 dark:text-zinc-400"
                      >
                        <span className={`px-2 py-0.5 rounded text-xs ${poolOption.className}`}>
                          {poolOption.label}
                        </span>
                        <input
                          type="checkbox"
                          checked={characterForm.pool_config.pools.includes(poolOption.value)}
                          onChange={(e) => {
                            setCharacterForm(prev => {
                              const nextPools = e.target.checked
                                ? Array.from(new Set([...prev.pool_config.pools, poolOption.value]))
                                : prev.pool_config.pools.filter(p => p !== poolOption.value);

                              return {
                                ...prev,
                                pool_config: {
                                  ...prev.pool_config,
                                  pools: nextPools
                                }
                              };
                            });
                          }}
                          className="w-4 h-4"
                        />
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mt-2">
                    这里只维护候选池类型；具体 UP、附加寻访、上下架内容在卡池编辑里保存。
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 对话框操作按钮 */}
          <div className="flex items-center gap-2 p-4 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
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
