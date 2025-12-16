import React from 'react';
import { X, Trash2 } from 'lucide-react';

/**
 * 编辑记录弹窗组件
 * 用于修改单条抽卡记录的稀有度、是否常驻、特殊标记等
 */
const EditItemModal = React.memo(({ item, onClose, onUpdate, onDelete, poolType }) => {
  if (!item) return null;

  const isLimitedOrWeapon = poolType === 'limited' || poolType === 'weapon';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up" onClick={e => e.stopPropagation()}>
        {/* 弹窗标题 */}
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex justify-between items-center">
          <h3 className="font-bold text-slate-700 dark:text-zinc-300">编辑记录</h3>
          <button onClick={onClose} className="text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* 弹窗内容 */}
        <div className="p-6 space-y-4">
          {/* 稀有度选择 */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase mb-2">修改为</label>
            <div className="grid grid-cols-2 gap-2">
              {/* 4星按钮 */}
              <button
                onClick={() => onUpdate(item.id, { rarity: 4, isStandard: false })}
                className={`py-3 rounded-none border text-sm font-bold transition-colors ${
                  item.rarity === 4
                    ? 'bg-purple-50 border-purple-500 text-purple-700'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-950'
                }`}
              >
                4星
              </button>

              {/* 5星按钮 */}
              <button
                onClick={() => onUpdate(item.id, { rarity: 5, isStandard: false })}
                className={`py-3 rounded-none border text-sm font-bold transition-colors ${
                  item.rarity === 5
                    ? 'bg-amber-50 border-amber-500 text-amber-700'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-950'
                }`}
              >
                5星
              </button>

              {/* 6星按钮 - 限定池和武器池有两种 */}
              {isLimitedOrWeapon ? (
                <>
                  <button
                    onClick={() => onUpdate(item.id, { rarity: 6, isStandard: false })}
                    className={`py-3 rounded-none border text-sm font-bold transition-colors ${
                      item.rarity === 6 && !item.isStandard
                        ? 'bg-orange-50 border-orange-500 text-orange-700'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-950'
                    }`}
                  >
                    6星 (限定UP)
                  </button>
                  <button
                    onClick={() => onUpdate(item.id, { rarity: 6, isStandard: true })}
                    className={`py-3 rounded-none border text-sm font-bold transition-colors ${
                      item.rarity === 6 && item.isStandard
                        ? 'bg-red-50 border-red-500 text-red-700'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-950'
                    }`}
                  >
                    6星 (常驻歪)
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onUpdate(item.id, { rarity: 6, isStandard: true })}
                  className={`col-span-2 py-3 rounded-none border text-sm font-bold transition-colors ${
                    item.rarity === 6
                      ? 'bg-red-50 border-red-500 text-red-700'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-950'
                  }`}
                >
                  6星 (常驻)
                </button>
              )}
            </div>
          </div>

          {/* 特殊标记 - 仅6星显示 */}
          {item.rarity === 6 && (
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <label className="block text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase mb-2">特殊标记</label>
              <div className="flex gap-2">
                <button
                  onClick={() => onUpdate(item.id, { specialType: null })}
                  className={`flex-1 py-2 rounded-none border text-xs font-bold transition-colors ${
                    !item.specialType
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 hover:bg-slate-50 dark:hover:bg-zinc-950'
                  }`}
                >
                  正常获取
                </button>
                <button
                  onClick={() => onUpdate(item.id, { specialType: 'guaranteed' })}
                  className={`flex-1 py-2 rounded-none border text-xs font-bold transition-colors ${
                    item.specialType === 'guaranteed'
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-green-600 hover:bg-green-50'
                  }`}
                >
                  120抽保底
                </button>
                <button
                  onClick={() => onUpdate(item.id, { specialType: 'gift' })}
                  className={`flex-1 py-2 rounded-none border text-xs font-bold transition-colors ${
                    item.specialType === 'gift'
                      ? 'bg-purple-500 text-white border-purple-500'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-purple-600 hover:bg-purple-50'
                  }`}
                >
                  额外赠送
                </button>
              </div>
              {item.specialType === 'gift' && (
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
                  * "额外赠送"不占用抽数，不重置当前垫刀，不计入平均出货花费。
                </p>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex justify-between">
          <button
            onClick={() => onDelete(item.id)}
            className="text-red-500 hover:text-red-700 text-sm font-medium px-3 py-2 rounded hover:bg-red-50 transition-colors flex items-center gap-1"
          >
            <Trash2 size={16}/> 删除
          </button>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold px-6 py-2 rounded-none transition-colors shadow-sm"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
});

EditItemModal.displayName = 'EditItemModal';

export default EditItemModal;
