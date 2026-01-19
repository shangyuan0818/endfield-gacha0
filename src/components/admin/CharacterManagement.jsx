import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, Save, X, Link as LinkIcon, Star, User, Swords, Package } from 'lucide-react';
import { supabase } from '../../supabaseClient';

/**
 * 角色管理界面
 * 超级管理员专用，用于管理所有角色的 CRUD 操作
 */
const CharacterManagement = ({ showToast }) => {
  // 数据状态
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // 搜索和筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // 编辑对话框状态
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState(null);
  const [characterForm, setCharacterForm] = useState({
    id: '',
    name: '',
    rarity: 6,
    type: 'character',
    avatar_url: '',
    is_limited: false,
    aliases: []
  });

  // 别名输入状态
  const [aliasInput, setAliasInput] = useState('');

  // 加载角色列表
  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .order('rarity', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      setCharacters(data || []);
    } catch (error) {
      showToast('加载角色失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 过滤后的角色列表
  const filteredCharacters = useMemo(() => {
    return characters.filter(char => {
      const matchesSearch = char.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           char.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           char.aliases?.some(alias => alias.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesRarity = rarityFilter === 'all' || char.rarity === parseInt(rarityFilter);
      const matchesType = typeFilter === 'all' || char.type === typeFilter;
      return matchesSearch && matchesRarity && matchesType;
    });
  }, [characters, searchQuery, rarityFilter, typeFilter]);

  // 重置表单
  const resetForm = () => {
    setCharacterForm({
      id: '',
      name: '',
      rarity: 6,
      type: 'character',
      avatar_url: '',
      is_limited: false,
      aliases: []
    });
    setAliasInput('');
    setEditingCharacter(null);
    setShowEditDialog(false);
  };

  // 开始编辑
  const startEdit = (character) => {
    setCharacterForm({
      id: character.id || '',
      name: character.name || '',
      rarity: character.rarity || 6,
      type: character.type || 'character',
      avatar_url: character.avatar_url || '',
      is_limited: character.is_limited || false,
      aliases: character.aliases || []
    });
    setEditingCharacter(character);
    setShowEditDialog(true);
  };

  // 添加别名
  const addAlias = () => {
    const trimmedAlias = aliasInput.trim();
    if (!trimmedAlias) return;

    if (characterForm.aliases.includes(trimmedAlias)) {
      showToast('该别名已存在', 'error');
      return;
    }

    setCharacterForm(prev => ({
      ...prev,
      aliases: [...prev.aliases, trimmedAlias]
    }));
    setAliasInput('');
  };

  // 删除别名
  const removeAlias = (index) => {
    setCharacterForm(prev => ({
      ...prev,
      aliases: prev.aliases.filter((_, i) => i !== index)
    }));
  };

  // 保存角色
  const saveCharacter = async () => {
    if (!supabase) return;

    // 验证必填字段
    if (!characterForm.id.trim()) {
      showToast('角色ID不能为空', 'error');
      return;
    }
    if (!characterForm.name.trim()) {
      showToast('角色名称不能为空', 'error');
      return;
    }

    setActionLoading('save');

    try {
      const characterData = {
        id: characterForm.id.trim(),
        name: characterForm.name.trim(),
        rarity: characterForm.rarity,
        type: characterForm.type,
        avatar_url: characterForm.avatar_url.trim() || null,
        is_limited: characterForm.is_limited,
        aliases: characterForm.aliases.length > 0 ? characterForm.aliases : null
      };

      if (editingCharacter) {
        // 更新现有角色
        const { error } = await supabase
          .from('characters')
          .update(characterData)
          .eq('id', editingCharacter.id);

        if (error) throw error;
        showToast('角色已更新', 'success');
      } else {
        // 创建新角色
        const { error } = await supabase
          .from('characters')
          .insert(characterData);

        if (error) throw error;
        showToast('角色已创建', 'success');
      }

      await loadCharacters();
      resetForm();
    } catch (error) {
      showToast('保存失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 删除角色
  const deleteCharacter = async (character) => {
    if (!supabase) return;

    if (!window.confirm(`确定要删除角色「${character.name}」吗？此操作无法撤销。`)) {
      return;
    }

    setActionLoading(character.id);

    try {
      const { error } = await supabase
        .from('characters')
        .delete()
        .eq('id', character.id);

      if (error) throw error;

      showToast('角色已删除', 'success');
      await loadCharacters();
    } catch (error) {
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 获取稀有度颜色
  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 6:
        return 'text-orange-500 bg-orange-100 dark:bg-orange-900/30';
      case 5:
        return 'text-purple-500 bg-purple-100 dark:bg-purple-900/30';
      case 4:
        return 'text-blue-500 bg-blue-100 dark:bg-blue-900/30';
      case 3:
        return 'text-slate-500 bg-slate-100 dark:bg-zinc-700';
      default:
        return 'text-slate-400 bg-slate-100 dark:bg-zinc-700';
    }
  };

  // 获取类型图标
  const getTypeIcon = (type) => {
    return type === 'weapon' ? <Swords size={14} /> : <User size={14} />;
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
            placeholder="搜索角色名称、ID或别名..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>
        <select
          value={rarityFilter}
          onChange={(e) => setRarityFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
        >
          <option value="all">全部稀有度</option>
          <option value="6">6星</option>
          <option value="5">5星</option>
          <option value="4">4星</option>
          <option value="3">3星</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
        >
          <option value="all">全部类型</option>
          <option value="character">角色</option>
          <option value="weapon">武器</option>
        </select>
        <button
          onClick={() => setShowEditDialog(true)}
          className="flex items-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-none transition-colors"
        >
          <Plus size={16} />
          新增角色
        </button>
      </div>

      {/* 统计信息 */}
      <div className="text-xs text-slate-500 dark:text-zinc-500">
        显示 {filteredCharacters.length} / {characters.length} 个角色
      </div>

      {/* 角色列表 */}
      {filteredCharacters.length === 0 ? (
        <div className="p-12 text-center text-slate-400 dark:text-zinc-500">
          <Package size={48} className="mx-auto mb-4 opacity-50" />
          <p>{characters.length === 0 ? '暂无角色' : '未找到匹配的角色'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-950 text-xs text-slate-500 dark:text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">头像</th>
                <th className="px-4 py-3 text-left">角色ID</th>
                <th className="px-4 py-3 text-left">名称</th>
                <th className="px-4 py-3 text-left">稀有度</th>
                <th className="px-4 py-3 text-left">类型</th>
                <th className="px-4 py-3 text-left">别名</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredCharacters.map(char => (
                <tr key={char.id} className="hover:bg-slate-50 dark:hover:bg-zinc-950">
                  {/* 头像 */}
                  <td className="px-4 py-3">
                    {char.avatar_url ? (
                      <img
                        src={char.avatar_url}
                        alt={char.name}
                        className="w-10 h-10 rounded-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center">
                        {getTypeIcon(char.type)}
                      </div>
                    )}
                  </td>

                  {/* 角色ID */}
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-zinc-500">
                    {char.id}
                  </td>

                  {/* 名称 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700 dark:text-zinc-300">
                        {char.name}
                      </span>
                      {char.is_limited && (
                        <span className="text-xs px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded">
                          限定
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 稀有度 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: char.rarity }).map((_, i) => (
                        <Star
                          key={i}
                          size={12}
                          fill={char.rarity === 6 ? '#f97316' : char.rarity === 5 ? '#a855f7' : char.rarity === 4 ? '#3b82f6' : '#64748b'}
                          className={char.rarity === 6 ? 'text-orange-500' : char.rarity === 5 ? 'text-purple-500' : char.rarity === 4 ? 'text-blue-500' : 'text-slate-500'}
                        />
                      ))}
                    </div>
                  </td>

                  {/* 类型 */}
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400 rounded flex items-center gap-1 w-fit">
                      {getTypeIcon(char.type)}
                      {char.type === 'weapon' ? '武器' : '角色'}
                    </span>
                  </td>

                  {/* 别名 */}
                  <td className="px-4 py-3">
                    {char.aliases && char.aliases.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {char.aliases.slice(0, 3).map((alias, i) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded">
                            {alias}
                          </span>
                        ))}
                        {char.aliases.length > 3 && (
                          <span className="text-xs text-slate-400 dark:text-zinc-500">
                            +{char.aliases.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-zinc-600">-</span>
                    )}
                  </td>

                  {/* 操作 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => startEdit(char)}
                        disabled={actionLoading === char.id}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded disabled:opacity-50"
                        title="编辑"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => deleteCharacter(char)}
                        disabled={actionLoading === char.id}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50"
                        title="删除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                  {editingCharacter ? '编辑角色' : '新增角色'}
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
                {/* 角色ID */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    角色ID *
                  </label>
                  <input
                    type="text"
                    value={characterForm.id}
                    onChange={(e) => setCharacterForm(prev => ({ ...prev, id: e.target.value }))}
                    placeholder="例如：char_rococo"
                    disabled={!!editingCharacter}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 disabled:bg-slate-100 disabled:dark:bg-zinc-800"
                  />
                  {!editingCharacter && (
                    <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                      创建后无法修改，建议使用小写英文，格式：char_xxx 或 weapon_xxx
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
                    onChange={(e) => setCharacterForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="例如：洛可可"
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
                      onChange={(e) => setCharacterForm(prev => ({ ...prev, type: e.target.value }))}
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
                      onKeyPress={(e) => e.key === 'Enter' && addAlias()}
                      placeholder="输入别名后按回车添加"
                      className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                    />
                    <button
                      onClick={addAlias}
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
                            onClick={() => removeAlias(index)}
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
              </div>

              {/* 对话框操作按钮 */}
              <div className="flex items-center gap-2 p-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={saveCharacter}
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

export default CharacterManagement;
