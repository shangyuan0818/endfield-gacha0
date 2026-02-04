/**
 * 角色/武器列表表格组件
 *
 * @version 1.0.0
 * @date 2026-02-04
 */

import React from 'react';
import { Edit2, Trash2, Star, User, Swords, Square, CheckSquare, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

/**
 * 获取稀有度颜色样式
 */
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

/**
 * 获取类型图标
 */
const getTypeIcon = (type) => {
  return type === 'weapon' ? <Swords size={14} /> : <User size={14} />;
};

/**
 * 排序图标组件
 */
const SortIcon = ({ field, sortField, sortDirection }) => {
  if (sortField !== field) {
    return <ChevronsUpDown size={14} className="text-slate-300 dark:text-zinc-600" />;
  }
  return sortDirection === 'asc'
    ? <ChevronUp size={14} className="text-blue-500" />
    : <ChevronDown size={14} className="text-blue-500" />;
};

/**
 * 角色表格组件
 */
const CharacterTable = ({
  characters,
  selectedIds,
  isAllSelected,
  actionLoading,
  sortField,
  sortDirection,
  onSort,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onEdit,
  onDelete
}) => {
  return (
    <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-zinc-950 text-xs text-slate-500 dark:text-zinc-500 uppercase">
          <tr>
            <th className="px-4 py-3 text-left w-10">
              <button
                onClick={isAllSelected ? onDeselectAll : onSelectAll}
                className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                {isAllSelected ? <CheckSquare size={18} /> : <Square size={18} />}
              </button>
            </th>
            <th className="px-4 py-3 text-left">头像</th>
            <th className="px-4 py-3 text-left">
              <button
                onClick={() => onSort('id')}
                className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
              >
                ID <SortIcon field="id" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </th>
            <th className="px-4 py-3 text-left">
              <button
                onClick={() => onSort('name')}
                className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
              >
                名称 <SortIcon field="name" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </th>
            <th className="px-4 py-3 text-left">
              <button
                onClick={() => onSort('rarity')}
                className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
              >
                稀有度 <SortIcon field="rarity" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </th>
            <th className="px-4 py-3 text-left">
              <button
                onClick={() => onSort('is_limited')}
                className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
              >
                限定 <SortIcon field="is_limited" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </th>
            <th className="px-4 py-3 text-left">可用卡池</th>
            <th className="px-4 py-3 text-right">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
          {characters.map(char => (
            <tr key={char.id} className={`hover:bg-slate-50 dark:hover:bg-zinc-950 ${selectedIds.has(char.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
              {/* 选择框 */}
              <td className="px-4 py-3">
                <button
                  onClick={() => onToggleSelect(char.id)}
                  className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                >
                  {selectedIds.has(char.id) ? <CheckSquare size={18} className="text-blue-500" /> : <Square size={18} />}
                </button>
              </td>
              {/* 头像 */}
              <td className="px-4 py-3">
                {char.avatar_url ? (
                  <img
                    src={char.avatar_url}
                    alt={char.name}
                    className="w-10 h-10 rounded object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-slate-200 dark:bg-zinc-700 flex items-center justify-center">
                    {getTypeIcon(char.type)}
                  </div>
                )}
              </td>

              {/* ID */}
              <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-zinc-500">
                {char.id}
              </td>

              {/* 名称 */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700 dark:text-zinc-200">{char.name}</span>
                  {char.aliases?.length > 0 && (
                    <span className="text-xs text-slate-400 dark:text-zinc-500">
                      ({char.aliases.join(', ')})
                    </span>
                  )}
                </div>
              </td>

              {/* 稀有度 */}
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium ${getRarityColor(char.rarity)}`}>
                  <Star size={12} />
                  {char.rarity}星
                </span>
              </td>

              {/* 限定状态 */}
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${
                  char.is_limited
                    ? 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400'
                    : 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
                }`}>
                  {char.is_limited ? '限定' : '常驻'}
                </span>
              </td>

              {/* 可用卡池 */}
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {char.pool_config?.pools?.map(pool => (
                    <span
                      key={pool}
                      className={`px-1.5 py-0.5 text-xs rounded ${
                        pool === 'limited' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                        pool === 'standard' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                        pool === 'weapon' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                        'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400'
                      }`}
                    >
                      {pool === 'limited' ? '限定池' : pool === 'standard' ? '常驻池' : pool === 'weapon' ? '武器池' : pool}
                    </span>
                  ))}
                  {(!char.pool_config?.pools || char.pool_config.pools.length === 0) && (
                    <span className="text-xs text-slate-400 dark:text-zinc-600">-</span>
                  )}
                </div>
              </td>

              {/* 操作 */}
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(char)}
                    className="p-1.5 text-slate-400 hover:text-blue-500 dark:text-zinc-500 dark:hover:text-blue-400"
                    title="编辑"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(char)}
                    disabled={actionLoading === char.id}
                    className="p-1.5 text-slate-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400"
                    title="删除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CharacterTable;
