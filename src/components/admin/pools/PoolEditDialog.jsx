import React from 'react';
import { X, Save, Star, Users, RotateCw, UserPlus, CheckCircle, Lock, Unlock, CheckSquare, Square } from 'lucide-react';
import DateTimePicker from '../../common/DateTimePicker';

/**
 * 角色标签组件
 */
const CharacterTag = ({ char, isInPool, isUp, isRemoved, disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-all ${
      disabled
        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
        : isInPool
          ? isUp
            ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300 font-bold ring-2 ring-orange-400'
            : isRemoved
              ? 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 line-through'
              : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700'
    }`}
    title={`${char.name}${isInPool ? ' ✓ 在池中' : ' ✗ 不在池中'}${isUp ? ' [UP]' : ''}${isRemoved ? ' [已轮换移出]' : ''}`}
  >
    {isInPool ? <CheckSquare size={12} /> : <Square size={12} />}
    {isUp && '★'}
    {char.name}
  </button>
);

/**
 * 角色分组组件
 */
const CharacterGroup = ({ stars, colorClass, label, isInPool, editingPoolId, onAddAll, onRemoveAll, renderCharTag }) => {
  if (stars.length === 0) return null;

  const inPoolCount = stars.filter(c => isInPool(c)).length;
  const allSelected = inPoolCount === stars.length;

  return (
    <div className="p-3 bg-zinc-50/50 dark:bg-zinc-800/30 rounded border border-zinc-200 dark:border-zinc-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Star size={14} className={colorClass} />
          <span className={`text-xs font-medium ${colorClass}`}>{label}</span>
          <span className="text-xs text-slate-400 dark:text-zinc-500">
            {inPoolCount}/{stars.length}
          </span>
        </div>
        {editingPoolId && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onAddAll(stars)}
              disabled={allSelected}
              className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              全选
            </button>
            <button
              onClick={() => onRemoveAll(stars)}
              disabled={inPoolCount === 0}
              className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              清空
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {stars.map(renderCharTag)}
      </div>
    </div>
  );
};

/**
 * 卡池编辑对话框
 */
const PoolEditDialog = ({
  show,
  editingPool,
  poolForm,
  setPoolForm,
  characters,
  editingPoolCharacters,
  actionLoading,
  checkUpCharacterExists,
  onSave,
  onClose,
  onToggleCharacter,
  onAddAllCharacters,
  onRemoveAllCharacters
}) => {
  if (!show) return null;

  const poolType = (poolForm.type === 'limited_character' || poolForm.type === 'limited') ? 'limited'
    : (poolForm.type === 'weapon' || poolForm.type === 'limited_weapon') ? 'weapon'
    : poolForm.type;
  const allChars = characters.filter(c => c.type === (poolType === 'weapon' ? 'weapon' : 'character'));
  const sixStars = allChars.filter(c => c.rarity === 6);
  const fiveStars = allChars.filter(c => c.rarity === 5);
  const fourStars = allChars.filter(c => c.rarity === 4);

  const isInPool = (char) => editingPoolCharacters.some(pc => pc.character_id === char.id);

  const renderCharTag = (char) => {
    const inPool = isInPool(char);
    const isUp = char.name === poolForm.up_character.trim();
    const rotationCount = char.pool_config?.limited_rotation_count || 0;
    const removesAfter = char.pool_config?.removes_after;
    const isRemoved = poolType === 'limited' && removesAfter !== null && removesAfter !== undefined && rotationCount >= removesAfter;

    return (
      <CharacterTag
        key={char.id}
        char={char}
        isInPool={inPool}
        isUp={isUp}
        isRemoved={isRemoved}
        disabled={!editingPool?.pool_id}
        onClick={() => onToggleCharacter(char, inPool)}
      />
    );
  };

  return (
    <>
      {/* 背景遮罩 */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose}></div>

      {/* 对话框 */}
      <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-4xl md:max-h-[90vh] z-50">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 h-full md:h-auto max-h-full overflow-hidden flex flex-col">
          {/* 对话框标题 */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
            <h3 className="text-lg font-bold text-slate-700 dark:text-zinc-300">
              {editingPool ? '编辑卡池' : '新增卡池'}
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              <X size={20} />
            </button>
          </div>

          {/* 表单内容 */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 左栏：基本信息 */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-600 dark:text-zinc-400 text-sm border-b border-zinc-200 dark:border-zinc-700 pb-2">
                  基本信息
                </h4>

                {/* 卡池名称 */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    卡池名称 *
                  </label>
                  <input
                    type="text"
                    value={poolForm.name}
                    onChange={(e) => setPoolForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="例如：终末序曲 - 莱万汀UP"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                  />
                </div>

                {/* 卡池类型 */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    卡池类型 *
                  </label>
                  <select
                    value={poolForm.type}
                    onChange={(e) => setPoolForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                  >
                    <option value="limited">限定角色池</option>
                    <option value="weapon">限定武器池</option>
                    <option value="standard">常驻池</option>
                  </select>
                </div>

                {/* 武器池特殊选项 */}
                {(poolForm.type === 'weapon' || poolForm.type === 'limited_weapon') && (
                  <div>
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={poolForm.is_limited_weapon}
                        onChange={(e) => setPoolForm(prev => ({ ...prev, is_limited_weapon: e.target.checked }))}
                        className="w-4 h-4"
                      />
                      是否为限定武器池（影响赠送规则）
                    </label>
                  </div>
                )}

                {/* UP 角色 */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    UP 角色/武器名称
                  </label>
                  <input
                    type="text"
                    value={poolForm.up_character}
                    onChange={(e) => setPoolForm(prev => ({ ...prev, up_character: e.target.value }))}
                    placeholder="例如：莱万汀"
                    className={`w-full px-3 py-2 border rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 ${
                      poolForm.up_character.trim() && !checkUpCharacterExists(poolForm.up_character)
                        ? 'border-amber-400 dark:border-amber-600'
                        : 'border-zinc-300 dark:border-zinc-700'
                    }`}
                  />
                  {poolForm.up_character.trim() && !checkUpCharacterExists(poolForm.up_character) && (
                    <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs">
                      <div className="flex items-start gap-2">
                        <UserPlus size={14} className="text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-amber-700 dark:text-amber-400">
                          <p className="font-medium">将自动创建新角色「{poolForm.up_character.trim()}」</p>
                          <p className="mt-0.5 opacity-80">6星 · {poolForm.type === 'weapon' ? '武器' : '角色'} · 3次轮换后移出</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {poolForm.up_character.trim() && checkUpCharacterExists(poolForm.up_character) && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <CheckCircle size={12} />
                      角色已存在
                    </div>
                  )}
                </div>

                {/* 时间范围 */}
                <div className="grid grid-cols-2 gap-3">
                  <DateTimePicker
                    label="开始时间"
                    value={poolForm.start_time}
                    onChange={(val) => setPoolForm(prev => ({ ...prev, start_time: val }))}
                    placeholder="选择开始时间"
                  />
                  <DateTimePicker
                    label="结束时间"
                    value={poolForm.end_time}
                    onChange={(val) => setPoolForm(prev => ({ ...prev, end_time: val }))}
                    placeholder="选择结束时间"
                    minDate={poolForm.start_time}
                    durationPresets={[
                      { label: '17天', days: 17 },
                      { label: '21天', days: 21 },
                      { label: '51天', days: 51 },
                    ]}
                    durationBaseTime={poolForm.start_time}
                    onDurationApply={(endDate) => {
                      const y = endDate.getFullYear();
                      const m = String(endDate.getMonth() + 1).padStart(2, '0');
                      const d = String(endDate.getDate()).padStart(2, '0');
                      const h = String(endDate.getHours()).padStart(2, '0');
                      const min = String(endDate.getMinutes()).padStart(2, '0');
                      setPoolForm(prev => ({ ...prev, end_time: `${y}-${m}-${d}T${h}:${min}` }));
                    }}
                  />
                </div>

                {/* 锁定状态 */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={poolForm.locked}
                        onChange={(e) => setPoolForm(prev => ({ ...prev, locked: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-zinc-300 dark:bg-zinc-600 rounded-full peer peer-checked:bg-amber-500 transition-colors"></div>
                      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
                    </div>
                    <div className="flex items-center gap-2">
                      {poolForm.locked ? (
                        <Lock size={16} className="text-amber-500" />
                      ) : (
                        <Unlock size={16} className="text-slate-400" />
                      )}
                      <span className="text-sm text-slate-700 dark:text-zinc-300">
                        {poolForm.locked ? '卡池已锁定' : '卡池未锁定'}
                      </span>
                    </div>
                  </label>
                  <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500 ml-[52px]">
                    锁定后用户无法删除此卡池的抽卡记录
                  </p>
                </div>

                {/* Banner URL */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    Banner 图片 URL
                  </label>
                  <input
                    type="text"
                    value={poolForm.banner_url}
                    onChange={(e) => setPoolForm(prev => ({ ...prev, banner_url: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-sm"
                  />
                </div>

                {/* 描述 */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    描述
                  </label>
                  <textarea
                    value={poolForm.description}
                    onChange={(e) => setPoolForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="卡池描述..."
                    rows={2}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 resize-none text-sm"
                  />
                </div>
              </div>

              {/* 右栏：卡池角色管理 */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-600 dark:text-zinc-400 text-sm border-b border-zinc-200 dark:border-zinc-700 pb-2 flex items-center gap-2">
                  <Users size={14} />
                  卡池角色管理
                </h4>

                <div className="space-y-3">
                  {/* 新建池子提示 */}
                  {!editingPool?.pool_id && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-400">
                      <p className="font-medium">💡 提示：请先保存卡池，然后再管理池中角色</p>
                      <p className="mt-1 opacity-80">保存后将自动选择所有可用角色</p>
                    </div>
                  )}

                  {/* 快捷操作 */}
                  {editingPool?.pool_id && allChars.length > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-zinc-100 dark:bg-zinc-800 rounded">
                      <span className="text-xs text-slate-500 dark:text-zinc-400">快捷操作：</span>
                      <button
                        onClick={() => onAddAllCharacters(allChars)}
                        className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                      >
                        全部选中
                      </button>
                      <button
                        onClick={() => onRemoveAllCharacters(allChars)}
                        className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                      >
                        全部清空
                      </button>
                      <span className="text-xs text-slate-400 dark:text-zinc-500 ml-auto">
                        已选 {editingPoolCharacters.length}/{allChars.length}
                      </span>
                    </div>
                  )}

                  {/* 按稀有度分组 */}
                  <CharacterGroup
                    stars={sixStars}
                    colorClass="text-orange-500"
                    label="6星"
                    isInPool={isInPool}
                    editingPoolId={editingPool?.pool_id}
                    onAddAll={onAddAllCharacters}
                    onRemoveAll={onRemoveAllCharacters}
                    renderCharTag={renderCharTag}
                  />
                  <CharacterGroup
                    stars={fiveStars}
                    colorClass="text-purple-500"
                    label="5星"
                    isInPool={isInPool}
                    editingPoolId={editingPool?.pool_id}
                    onAddAll={onAddAllCharacters}
                    onRemoveAll={onRemoveAllCharacters}
                    renderCharTag={renderCharTag}
                  />
                  <CharacterGroup
                    stars={fourStars}
                    colorClass="text-blue-500"
                    label="4星"
                    isInPool={isInPool}
                    editingPoolId={editingPool?.pool_id}
                    onAddAll={onAddAllCharacters}
                    onRemoveAll={onRemoveAllCharacters}
                    renderCharTag={renderCharTag}
                  />

                  {allChars.length === 0 && (
                    <p className="text-sm text-slate-400 dark:text-zinc-500 italic text-center py-4">
                      暂无{poolType === 'weapon' ? '武器' : '角色'}数据，请先在角色管理中添加
                    </p>
                  )}

                  {/* 轮换说明（限定池） */}
                  {poolType === 'limited' && allChars.length > 0 && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-700 dark:text-amber-400">
                      <div className="flex items-start gap-2">
                        <RotateCw size={14} className="shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">限定池轮换机制</p>
                          <p className="mt-1 opacity-80">
                            • 绿色 = 在池中 · 红色删除线 = 已轮换移出 · 灰色 = 不在池中
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
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

export default PoolEditDialog;
