/**
 * 批量编辑对话框组件
 *
 * @version 1.0.0
 * @date 2026-02-04
 */

import React from 'react';
import { Save, X, Package } from 'lucide-react';

/**
 * 批量编辑对话框
 */
const BatchEditDialog = ({
  show,
  selectedCount,
  batchEditForm,
  setBatchEditForm,
  actionLoading,
  onExecute,
  onClose
}) => {
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
              批量编辑 ({selectedCount} 项)
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
            {/* 提示信息 */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm">
              <p className="text-blue-700 dark:text-blue-300">
                💡 只有勾选的选项才会被修改，未勾选的选项将保持原值不变
              </p>
            </div>

            {/* 限定状态设置 */}
            <div className="border border-zinc-200 dark:border-zinc-700 rounded p-4">
              <h4 className="text-sm font-bold text-slate-700 dark:text-zinc-300 mb-3">
                限定状态
              </h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="radio"
                    name="is_limited"
                    checked={batchEditForm.is_limited === null}
                    onChange={() => setBatchEditForm(prev => ({ ...prev, is_limited: null }))}
                    className="w-4 h-4"
                  />
                  不修改（保持原值）
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="radio"
                    name="is_limited"
                    checked={batchEditForm.is_limited === true}
                    onChange={() => setBatchEditForm(prev => ({ ...prev, is_limited: true }))}
                    className="w-4 h-4"
                  />
                  <span className="px-2 py-0.5 rounded text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                    设为限定
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="radio"
                    name="is_limited"
                    checked={batchEditForm.is_limited === false}
                    onChange={() => setBatchEditForm(prev => ({ ...prev, is_limited: false }))}
                    className="w-4 h-4"
                  />
                  <span className="px-2 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                    设为常驻
                  </span>
                </label>
              </div>
            </div>

            {/* 卡池配置 */}
            <div className="border border-zinc-200 dark:border-zinc-700 rounded p-4">
              <h4 className="text-sm font-bold text-slate-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                <Package size={16} />
                卡池配置
              </h4>

              {/* 限定池 */}
              <PoolTypeSection
                label="限定池"
                colorClass="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                poolType="limited"
                value={batchEditForm.pools.limited}
                onChange={(value) => setBatchEditForm(prev => ({
                  ...prev,
                  pools: { ...prev.pools, limited: value }
                }))}
              />

              {/* 常驻池 */}
              <PoolTypeSection
                label="常驻池"
                colorClass="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
                poolType="standard"
                value={batchEditForm.pools.standard}
                onChange={(value) => setBatchEditForm(prev => ({
                  ...prev,
                  pools: { ...prev.pools, standard: value }
                }))}
              />

              {/* 武器池 */}
              <PoolTypeSection
                label="武器池"
                colorClass="bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400"
                poolType="weapon"
                value={batchEditForm.pools.weapon}
                onChange={(value) => setBatchEditForm(prev => ({
                  ...prev,
                  pools: { ...prev.pools, weapon: value }
                }))}
                isLast
              />
            </div>

            {/* 预览将要修改的内容 */}
            <div className="p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-xs">
              <p className="font-medium text-slate-700 dark:text-zinc-300 mb-2">将要执行的操作：</p>
              <ul className="space-y-1 text-slate-600 dark:text-zinc-400">
                {batchEditForm.is_limited !== null && (
                  <li>• 限定状态 → {batchEditForm.is_limited ? '限定' : '常驻'}</li>
                )}
                {batchEditForm.pools.limited === true && <li>• 添加到限定池</li>}
                {batchEditForm.pools.limited === false && <li>• 从限定池移除</li>}
                {batchEditForm.pools.standard === true && <li>• 添加到常驻池</li>}
                {batchEditForm.pools.standard === false && <li>• 从常驻池移除</li>}
                {batchEditForm.pools.weapon === true && <li>• 添加到武器池</li>}
                {batchEditForm.pools.weapon === false && <li>• 从武器池移除</li>}
                {batchEditForm.is_limited === null &&
                 batchEditForm.pools.limited === null &&
                 batchEditForm.pools.standard === null &&
                 batchEditForm.pools.weapon === null && (
                  <li className="text-slate-400 dark:text-zinc-500 italic">暂无修改项</li>
                )}
              </ul>
            </div>
          </div>

          {/* 对话框操作按钮 */}
          <div className="flex items-center gap-2 p-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              onClick={onExecute}
              disabled={actionLoading === 'batch-edit'}
              className="flex items-center gap-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-none transition-colors disabled:opacity-50"
            >
              <Save size={16} />
              {actionLoading === 'batch-edit' ? '保存中...' : '保存修改'}
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

/**
 * 卡池类型配置区块
 */
const PoolTypeSection = ({ label, colorClass, poolType, value, onChange, isLast = false }) => (
  <div className={isLast ? '' : 'mb-4'}>
    <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
      <span className={`px-2 py-0.5 rounded text-xs ${colorClass}`}>
        {label}
      </span>
    </label>
    <div className="space-y-2 ml-4">
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300 cursor-pointer">
        <input
          type="radio"
          name={`pool_${poolType}`}
          checked={value === null}
          onChange={() => onChange(null)}
          className="w-4 h-4"
        />
        不修改
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300 cursor-pointer">
        <input
          type="radio"
          name={`pool_${poolType}`}
          checked={value === true}
          onChange={() => onChange(true)}
          className="w-4 h-4"
        />
        添加到{label}
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300 cursor-pointer">
        <input
          type="radio"
          name={`pool_${poolType}`}
          checked={value === false}
          onChange={() => onChange(false)}
          className="w-4 h-4"
        />
        从{label}移除
      </label>
    </div>
  </div>
);

export default BatchEditDialog;
