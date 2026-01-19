import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, Save, X, Calendar, Link as LinkIcon, Star, Layers, Swords, Database } from 'lucide-react';
import { supabase } from '../../supabaseClient';

/**
 * 卡池管理界面
 * 超级管理员专用，用于管理所有卡池的 CRUD 操作
 */
const PoolManagement = ({ showToast }) => {
  // 数据状态
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // 搜索和筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // 编辑对话框状态
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPool, setEditingPool] = useState(null);
  const [poolForm, setPoolForm] = useState({
    name: '',
    type: 'limited',
    up_character: '',
    banner_url: '',
    description: '',
    start_time: '',
    end_time: '',
    is_limited_weapon: true
  });

  // 加载卡池列表
  useEffect(() => {
    loadPools();
  }, []);

  const loadPools = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pools')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPools(data || []);
    } catch (error) {
      showToast('加载卡池失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 过滤后的卡池列表
  const filteredPools = useMemo(() => {
    return pools.filter(pool => {
      const matchesSearch = pool.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           pool.up_character?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || pool.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [pools, searchQuery, typeFilter]);

  // 重置表单
  const resetForm = () => {
    setPoolForm({
      name: '',
      type: 'limited',
      up_character: '',
      banner_url: '',
      description: '',
      start_time: '',
      end_time: '',
      is_limited_weapon: true
    });
    setEditingPool(null);
    setShowEditDialog(false);
  };

  // 开始编辑
  const startEdit = (pool) => {
    setPoolForm({
      name: pool.name || '',
      type: pool.type || 'limited',
      up_character: pool.up_character || '',
      banner_url: pool.banner_url || '',
      description: pool.description || '',
      start_time: pool.start_time ? new Date(pool.start_time).toISOString().slice(0, 16) : '',
      end_time: pool.end_time ? new Date(pool.end_time).toISOString().slice(0, 16) : '',
      is_limited_weapon: pool.is_limited_weapon !== false
    });
    setEditingPool(pool);
    setShowEditDialog(true);
  };

  // 保存卡池
  const savePool = async () => {
    if (!supabase) return;

    // 验证必填字段
    if (!poolForm.name.trim()) {
      showToast('卡池名称不能为空', 'error');
      return;
    }

    setActionLoading('save');

    try {
      // 获取当前用户
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast('请先登录', 'error');
        return;
      }

      const poolData = {
        name: poolForm.name.trim(),
        type: poolForm.type,
        up_character: poolForm.up_character.trim() || null,
        banner_url: poolForm.banner_url.trim() || null,
        description: poolForm.description.trim() || null,
        start_time: poolForm.start_time ? new Date(poolForm.start_time).toISOString() : null,
        end_time: poolForm.end_time ? new Date(poolForm.end_time).toISOString() : null,
        is_limited_weapon: poolForm.type === 'weapon' ? poolForm.is_limited_weapon : null
      };

      if (editingPool) {
        // 更新现有卡池
        const { error } = await supabase
          .from('pools')
          .update(poolData)
          .eq('pool_id', editingPool.pool_id);

        if (error) throw error;
        showToast('卡池已更新', 'success');
      } else {
        // 创建新卡池 - 需要添加 user_id 和生成 pool_id
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const pool_id = `pool_${user.id.substring(0, 8)}_${poolForm.type}_${timestamp}_${randomStr}`;

        const newPoolData = {
          ...poolData,
          user_id: user.id,
          pool_id: pool_id,
          locked: false // 默认不锁定
        };

        const { error } = await supabase
          .from('pools')
          .insert(newPoolData);

        if (error) throw error;
        showToast('卡池已创建', 'success');
      }

      await loadPools();
      resetForm();
    } catch (error) {
      showToast('保存失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 删除卡池
  const deletePool = async (pool) => {
    if (!supabase) return;

    if (!window.confirm(`确定要删除卡池「${pool.name}」吗？此操作将删除该卡池的所有相关数据，且无法撤销。`)) {
      return;
    }

    setActionLoading(pool.pool_id);

    try {
      const { error } = await supabase
        .from('pools')
        .delete()
        .eq('pool_id', pool.pool_id);

      if (error) throw error;

      showToast('卡池已删除', 'success');
      await loadPools();
    } catch (error) {
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 获取类型图标
  const getTypeIcon = (type) => {
    switch (type) {
      case 'limited':
      case 'limited_character':
        return <Star size={14} className="text-orange-500" />;
      case 'weapon':
      case 'limited_weapon':
        return <Swords size={14} className="text-slate-500 dark:text-zinc-400" />;
      default:
        return <Layers size={14} className="text-yellow-600 dark:text-endfield-yellow" />;
    }
  };

  // 获取类型标签
  const getTypeLabel = (type) => {
    switch (type) {
      case 'limited':
      case 'limited_character':
        return '限定角色';
      case 'weapon':
      case 'limited_weapon':
        return '限定武器';
      default:
        return '常驻';
    }
  };

  // 获取类型颜色
  const getTypeColor = (type) => {
    switch (type) {
      case 'limited':
      case 'limited_character':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400';
      case 'weapon':
      case 'limited_weapon':
        return 'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400';
      default:
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-endfield-yellow';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索卡池名称或UP角色..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
        >
          <option value="all">全部类型</option>
          <option value="limited">限定角色</option>
          <option value="weapon">限定武器</option>
          <option value="standard">常驻</option>
        </select>
        <button
          onClick={() => setShowEditDialog(true)}
          className="flex items-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-none transition-colors"
        >
          <Plus size={16} />
          新增卡池
        </button>
      </div>

      {/* 统计信息 */}
      <div className="text-xs text-slate-500 dark:text-zinc-500">
        显示 {filteredPools.length} / {pools.length} 个卡池
      </div>

      {/* 卡池列表 */}
      {filteredPools.length === 0 ? (
        <div className="p-12 text-center text-slate-400 dark:text-zinc-500">
          <Database size={48} className="mx-auto mb-4 opacity-50" />
          <p>{pools.length === 0 ? '暂无卡池' : '未找到匹配的卡池'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredPools.map(pool => (
            <div
              key={pool.pool_id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              {/* Banner 图片 */}
              {pool.banner_url && (
                <div className="relative w-full h-24 overflow-hidden">
                  <img
                    src={pool.banner_url}
                    alt={pool.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                </div>
              )}

              {/* 卡池信息 */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getTypeIcon(pool.type)}
                      <h4 className="font-bold text-slate-700 dark:text-zinc-300 truncate">
                        {pool.name}
                      </h4>
                      {pool.locked && (
                        <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded">
                          已锁定
                        </span>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${getTypeColor(pool.type)}`}>
                      {getTypeLabel(pool.type)}
                    </span>
                  </div>
                </div>

                {/* UP 角色 */}
                {pool.up_character && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-slate-600 dark:text-zinc-400">
                    <Star size={12} className="text-orange-500" />
                    UP: {pool.up_character}
                  </div>
                )}

                {/* 描述 */}
                {pool.description && (
                  <p className="text-xs text-slate-500 dark:text-zinc-500 mt-2 line-clamp-2">
                    {pool.description}
                  </p>
                )}

                {/* 时间范围 */}
                {(pool.start_time || pool.end_time) && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-400 dark:text-zinc-600">
                    <Calendar size={12} />
                    {pool.start_time && new Date(pool.start_time).toLocaleDateString()}
                    {pool.start_time && pool.end_time && ' - '}
                    {pool.end_time && new Date(pool.end_time).toLocaleDateString()}
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    onClick={() => startEdit(pool)}
                    disabled={actionLoading === pool.pool_id}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-none transition-colors disabled:opacity-50"
                  >
                    <Edit2 size={12} />
                    编辑
                  </button>
                  <button
                    onClick={() => deletePool(pool)}
                    disabled={actionLoading === pool.pool_id || pool.locked}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-none transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                    {actionLoading === pool.pool_id ? '删除中...' : '删除'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑对话框 */}
      {showEditDialog && (
        <>
          {/* 背景遮罩 */}
          <div className="fixed inset-0 bg-black/50 z-40" onClick={resetForm}></div>

          {/* 对话框 */}
          <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl z-50">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 max-h-full overflow-y-auto">
              {/* 对话框标题 */}
              <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="text-lg font-bold text-slate-700 dark:text-zinc-300">
                  {editingPool ? '编辑卡池' : '新增卡池'}
                </h3>
                <button
                  onClick={resetForm}
                  className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                >
                  <X size={20} />
                </button>
              </div>

              {/* 表单内容 */}
              <div className="p-4 space-y-4">
                {/* 卡池名称 */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    卡池名称 *
                  </label>
                  <input
                    type="text"
                    value={poolForm.name}
                    onChange={(e) => setPoolForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="例如：终末序曲 - 洛可可UP"
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
                {poolForm.type === 'weapon' && (
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
                    placeholder="例如：洛可可"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                  />
                </div>

                {/* Banner URL */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-2">
                    <LinkIcon size={14} />
                    Banner 图片 URL
                  </label>
                  <input
                    type="text"
                    value={poolForm.banner_url}
                    onChange={(e) => setPoolForm(prev => ({ ...prev, banner_url: e.target.value }))}
                    placeholder="https://example.com/banner.jpg"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                  />
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                    建议使用外部图床链接（GitHub/CDN），推荐尺寸 16:9
                  </p>
                </div>

                {/* 时间范围 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      开始时间
                    </label>
                    <input
                      type="datetime-local"
                      value={poolForm.start_time}
                      onChange={(e) => setPoolForm(prev => ({ ...prev, start_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      结束时间
                    </label>
                    <input
                      type="datetime-local"
                      value={poolForm.end_time}
                      onChange={(e) => setPoolForm(prev => ({ ...prev, end_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                    />
                  </div>
                </div>

                {/* 描述 */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    描述
                  </label>
                  <textarea
                    value={poolForm.description}
                    onChange={(e) => setPoolForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="卡池描述信息..."
                    rows={3}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 resize-none"
                  />
                </div>
              </div>

              {/* 对话框操作按钮 */}
              <div className="flex items-center gap-2 p-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={savePool}
                  disabled={actionLoading === 'save'}
                  className="flex items-center gap-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-none transition-colors disabled:opacity-50"
                >
                  <Save size={16} />
                  {actionLoading === 'save' ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-none"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PoolManagement;
