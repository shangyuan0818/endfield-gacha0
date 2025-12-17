import React, { useState, useRef } from 'react';
import { Plus, Star, Save, Trash2, FileText, ChevronDown, ChevronUp } from 'lucide-react';

const InputSection = React.memo(({ currentPool, poolStatsTotal, onAddSingle, onSubmitBatch, onDeletePool }) => {
  const [batchInput, setBatchInput] = useState(Array(10).fill({ rarity: 4, isStandard: false }));
  const [showTextMode, setShowTextMode] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textPreview, setTextPreview] = useState([]);
  const textareaRef = useRef(null);

  // 解析文本输入
  // 支持格式：4454464444,4445444454 或 4454464444/4445444454
  // 单个数字代表星级，s或歪代表6星常驻
  const parseTextInput = (text) => {
    const isLimitedOrWeapon = currentPool.type === 'limited' || currentPool.type === 'weapon';
    const groups = []; // 每组十连

    // 用逗号、分号、斜杠、换行分隔成组
    const segments = text.split(/[,，;；/\n]+/).filter(s => s.trim());

    for (const segment of segments) {
      const items = [];
      let i = 0;
      const s = segment.trim();

      while (i < s.length) {
        const char = s[i];
        const nextChar = s[i + 1] || '';

        // 6星常驻: 6s, 6歪, 6常
        if (char === '6' && (nextChar === 's' || nextChar === 'S' || nextChar === '歪' || nextChar === '常')) {
          items.push({ rarity: 6, isStandard: true });
          i += 2;
        }
        // 6星限定
        else if (char === '6') {
          items.push({ rarity: 6, isStandard: !isLimitedOrWeapon });
          i++;
        }
        // 5星
        else if (char === '5') {
          items.push({ rarity: 5, isStandard: false });
          i++;
        }
        // 4星及以下
        else if (char === '4' || char === '3') {
          items.push({ rarity: 4, isStandard: false });
          i++;
        }
        // 跳过空格和其他字符
        else {
          i++;
        }
      }

      if (items.length > 0) {
        groups.push(items);
      }
    }

    return groups;
  };

  // 处理文本变化
  const handleTextChange = (text) => {
    setTextInput(text);
    setTextPreview(parseTextInput(text));
  };

  // 快速输入按钮
  const quickInsert = (text) => {
    const newText = textInput ? textInput + ',' + text : text;
    handleTextChange(newText);
    // 聚焦到输入框
    textareaRef.current?.focus();
  };

  // 提交文本录入
  const handleTextSubmit = () => {
    if (textPreview.length === 0) return;

    const baseTime = Date.now();

    // 每组十连使用不同的时间戳（间隔1ms）
    textPreview.forEach((group, groupIndex) => {
      // 补齐到10个
      const batch = [...group];
      while (batch.length < 10) {
        batch.push({ rarity: 4, isStandard: false });
      }
      // 只取前10个
      const finalBatch = batch.slice(0, 10);

      // 传递时间偏移，确保每组有不同的时间戳
      onSubmitBatch(finalBatch, baseTime + groupIndex);
    });

    setTextInput('');
    setTextPreview([]);
  };

  const cycleBatchItem = (index) => {
    setBatchInput(prev => {
      const next = [...prev];
      const current = next[index];
      const isLimitedOrWeapon = currentPool.type === 'limited' || currentPool.type === 'weapon';

      let newItem;
      if (current.rarity === 4) {
        newItem = { rarity: 5, isStandard: false };
      } else if (current.rarity === 5) {
        if (isLimitedOrWeapon) {
          newItem = { rarity: 6, isStandard: false };
        } else {
          newItem = { rarity: 6, isStandard: true };
        }
      } else if (current.rarity === 6) {
        if (isLimitedOrWeapon && !current.isStandard) {
          newItem = { rarity: 6, isStandard: true };
        } else {
          newItem = { rarity: 4, isStandard: false };
        }
      } else {
        newItem = { rarity: 4, isStandard: false };
      }

      next[index] = newItem;
      return next;
    });
  };

  const handleSubmit = () => {
    onSubmitBatch(batchInput);
    setBatchInput(Array(10).fill({ rarity: 4, isStandard: false }));
  };

  // 计算预览总抽数
  const totalPulls = textPreview.reduce((sum, group) => sum + Math.min(group.length, 10), 0);
  // 补齐后的总抽数
  const totalPullsWithPadding = textPreview.length * 10;

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 mb-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Star size={120} />
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
        <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
          <Plus size={20} className="text-indigo-500"/>
          <span>录入数据</span>
          <span className="text-xs font-normal text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-sm">
            当前: {currentPool.name}
          </span>
        </h2>
        <div className="text-xs text-slate-400 dark:text-zinc-500">
          样本数: <span className="font-mono text-slate-600 dark:text-zinc-400 text-sm font-bold">{poolStatsTotal}</span>
        </div>
      </div>

      {/* 十连编辑器 */}
      <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-none border border-zinc-200 dark:border-zinc-800 mb-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-semibold text-slate-600 dark:text-zinc-400">十连编辑器</span>
          <span className="text-xs text-slate-400 dark:text-zinc-500 bg-white dark:bg-zinc-900 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700">点击切换星级</span>
        </div>

        <div className="flex gap-2 mb-4">
          {batchInput.map((item, idx) => (
            <button
              key={idx}
              onClick={() => cycleBatchItem(idx)}
              className={`
                flex-1 aspect-square min-w-0 rounded-none flex flex-col items-center justify-center transition-all transform active:scale-95 border-2 relative overflow-hidden
                ${item.rarity === 4 ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-400 shadow-sm' : ''}
                ${item.rarity === 5 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-600 dark:text-amber-400 shadow-sm ring-1 ring-amber-100 dark:ring-amber-800' : ''}
                ${item.rarity === 6 && !item.isStandard ? 'rainbow-bg-light rainbow-border text-fuchsia-600 dark:text-fuchsia-300 shadow-md ring-2 ring-fuchsia-100 dark:ring-fuchsia-800 rainbow-glow' : ''}
                ${item.rarity === 6 && item.isStandard ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 shadow-md ring-2 ring-red-100 dark:ring-red-800' : ''}
              `}
            >
              <Star size={16} fill={item.rarity >= 5 ? "currentColor" : "none"} className="sm:w-5 sm:h-5" />
              <span className="text-[10px] sm:text-xs font-bold mt-0.5">
                {item.rarity}星
              </span>
              {item.rarity === 6 && (
                <span className="absolute bottom-0 w-full text-[8px] sm:text-[9px] bg-black/10 dark:bg-white/10 text-center leading-3 py-0.5">
                  {item.isStandard ? '常驻' : '限定'}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          className="w-full bg-endfield-yellow text-black hover:bg-yellow-400 font-bold uppercase tracking-wider py-3 rounded-none flex items-center justify-center gap-2 transition-colors shadow-sm active:translate-y-0.5"
        >
          <Save size={18} />
          确认保存这十连
        </button>
      </div>

      {/* 文本录入模式 */}
      <div className="bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 mb-4">
        <button
          onClick={() => setShowTextMode(!showTextMode)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white dark:hover:bg-zinc-900 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-green-500" />
            <span className="text-sm font-semibold text-slate-600 dark:text-zinc-400">文本录入</span>
            <span className="text-xs text-slate-400 dark:text-zinc-500">快速输入多组十连</span>
          </div>
          {showTextMode ? (
            <ChevronUp size={16} className="text-zinc-400" />
          ) : (
            <ChevronDown size={16} className="text-zinc-400" />
          )}
        </button>

        {showTextMode && (
          <div className="px-4 pb-4 space-y-3 border-t border-zinc-200 dark:border-zinc-800 pt-3">
            {/* 格式说明 */}
            <div className="text-xs text-slate-500 dark:text-zinc-500 bg-white dark:bg-zinc-900 p-3 border border-zinc-200 dark:border-zinc-700">
              <p className="font-medium mb-2">输入格式说明：</p>
              <ul className="space-y-1 text-slate-600 dark:text-zinc-400">
                <li>• 每个数字代表星级：<code className="bg-purple-100 dark:bg-purple-900/30 px-1 rounded">4</code> <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded">5</code> <code className="bg-orange-100 dark:bg-orange-900/30 px-1 rounded">6</code></li>
                <li>• 6星常驻(歪)：<code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">6s</code> 或 <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">6歪</code></li>
                <li>• 用逗号/分号/斜杠分隔多组十连</li>
              </ul>
              <p className="mt-2 text-slate-400 dark:text-zinc-500">例如：<code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">4454464444,4445444454</code></p>
            </div>

            {/* 快速输入按钮 */}
            <div>
              <p className="text-xs text-slate-500 dark:text-zinc-500 mb-2">快速输入：</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => quickInsert('4444444444')}
                  className="px-3 py-1.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 rounded-none hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                >
                  全4星
                </button>
                <button
                  onClick={() => quickInsert('5555555555')}
                  className="px-3 py-1.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 rounded-none hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                >
                  全5星
                </button>
                <button
                  onClick={() => quickInsert('4')}
                  className="px-3 py-1.5 text-xs font-medium bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 rounded-none hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                >
                  +4
                </button>
                <button
                  onClick={() => quickInsert('5')}
                  className="px-3 py-1.5 text-xs font-medium bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 rounded-none hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                >
                  +5
                </button>
                <button
                  onClick={() => quickInsert('6')}
                  className="px-3 py-1.5 text-xs font-medium rainbow-bg-light rainbow-border text-fuchsia-600 dark:text-fuchsia-400 rounded-none hover:rainbow-glow transition-all"
                >
                  +6限
                </button>
                <button
                  onClick={() => quickInsert('6s')}
                  className="px-3 py-1.5 text-xs font-medium bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-none hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  +6歪
                </button>
              </div>
            </div>

            {/* 输入框 */}
            <textarea
              ref={textareaRef}
              value={textInput}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="例如：4454464444,4445444454"
              className="w-full h-24 p-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 text-sm font-mono rounded-none resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            {/* 预览 */}
            {textPreview.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 dark:text-zinc-500 mb-2">
                  预览：{textPreview.length} 组十连，共 {totalPulls} 抽
                  {totalPulls !== totalPullsWithPadding && (
                    <span className="text-zinc-400">（不足10抽的组将自动补齐4星）</span>
                  )}
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {textPreview.map((group, groupIdx) => (
                    <div key={groupIdx} className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-400 w-8 shrink-0">#{groupIdx + 1}</span>
                      <div className="flex gap-1">
                        {group.slice(0, 10).map((item, idx) => (
                          <div
                            key={idx}
                            className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded-none border ${
                              item.rarity === 6 && !item.isStandard
                                ? 'rainbow-bg-light rainbow-border text-fuchsia-600 dark:text-fuchsia-400'
                                : item.rarity === 6 && item.isStandard
                                  ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400'
                                  : item.rarity === 5
                                    ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400'
                                    : 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400'
                            }`}
                          >
                            {item.rarity}
                          </div>
                        ))}
                        {/* 显示需要补齐的4星 */}
                        {group.length < 10 && Array(10 - group.length).fill(0).map((_, idx) => (
                          <div
                            key={`pad-${idx}`}
                            className="w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded-none border border-dashed border-purple-200 dark:border-purple-800 text-purple-300 dark:text-purple-600"
                          >
                            4
                          </div>
                        ))}
                      </div>
                      <span className="text-[10px] text-zinc-400">({group.length}抽)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 提交按钮 */}
            <button
              onClick={handleTextSubmit}
              disabled={textPreview.length === 0}
              className={`w-full font-bold uppercase tracking-wider py-3 rounded-none flex items-center justify-center gap-2 transition-colors shadow-sm active:translate-y-0.5 ${
                textPreview.length > 0
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
              }`}
            >
              <FileText size={18} />
              录入 {textPreview.length} 组十连（{totalPullsWithPadding} 抽）
            </button>
          </div>
        )}
      </div>

      {/* 单抽快速入口 */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch">
        <div className="flex-1">
          <p className="text-xs text-slate-500 dark:text-zinc-500 mb-2 font-medium">单抽补录：</p>
          <div className="flex gap-2">
            <button onClick={() => onAddSingle(4)} className="flex-1 h-10 border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-none hover:bg-purple-100 dark:hover:bg-purple-900/40 font-bold transition-colors text-sm">
              4星
            </button>
            <button onClick={() => onAddSingle(5)} className="flex-1 h-10 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-none hover:bg-amber-100 dark:hover:bg-amber-900/40 font-bold transition-colors text-sm">
              5星
            </button>
            {currentPool.type === 'limited' || currentPool.type === 'weapon' ? (
              <>
                <button onClick={() => onAddSingle(6, false)} className="flex-1 h-10 rainbow-bg-light rainbow-border text-fuchsia-600 dark:text-fuchsia-300 rounded-none hover:rainbow-glow font-bold transition-all shadow-sm text-sm">
                  6星限定
                </button>
                <button onClick={() => onAddSingle(6, true)} className="flex-1 h-10 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-none hover:bg-red-100 dark:hover:bg-red-900/40 font-bold transition-colors shadow-sm text-sm">
                  6星常驻
                </button>
              </>
            ) : (
              <button onClick={() => onAddSingle(6, true)} className="flex-1 h-10 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-none hover:bg-red-100 dark:hover:bg-red-900/40 font-bold transition-colors shadow-sm text-sm">
                6星常驻
              </button>
            )}
          </div>
        </div>

        <div className="flex items-end">
          <button onClick={onDeletePool} className="h-10 px-4 text-xs text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 flex items-center gap-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-none transition-colors">
            <Trash2 size={14}/> 清空当前池
          </button>
        </div>
      </div>
    </section>
  );
});

export default InputSection;
