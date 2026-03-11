import { ChevronDown, History } from 'lucide-react';
import CharacterStats from './CharacterStats';

const SimulatorHistoryPanel = ({
  expandedTenPulls,
  historyGroups,
  onToggleTenPull,
  poolType,
  pullHistory
}) => (
  <div className="flex flex-col gap-4">
    <div className="flex flex-col h-[400px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-950">
        <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <History size={14} /> 抽卡记录
        </h3>
        <span className="text-xs font-mono text-slate-400">共 {pullHistory.length} 抽</span>
      </div>
      <div className="flex-1 overflow-y-auto p-0 scrollbar-thin min-h-0">
        {pullHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-zinc-600 opacity-50 p-8">
            <div className="w-12 h-1 bg-zinc-700 mb-2 rotate-45" />
            <p className="text-xs">暂无数据</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {historyGroups.map((group, groupIndex) => {
              if (group.type === 'tenPull') {
                const isExpanded = expandedTenPulls.has(group.id);
                const sixStarCount = group.pulls.filter((pull) => pull.rarity === 6).length;
                const fiveStarCount = group.pulls.filter((pull) => pull.rarity === 5).length;
                const hasHighRarity = sixStarCount > 0 || fiveStarCount > 0;
                const isFreePull = group.pulls[0]?.isFreePull;
                const isInfoBookPull = group.pulls[0]?.isInfoBookPull;

                return (
                  <div key={`group-${group.id}`}>
                    <button
                      onClick={() => onToggleTenPull(group.id)}
                      className="w-full p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-2 group"
                    >
                      <div className="w-1 h-6 shrink-0 bg-blue-500" />
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-xs font-bold text-blue-500 flex items-center gap-2">
                          <span>十连</span>
                          {isInfoBookPull && (
                            <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded border border-amber-200 dark:border-amber-700">
                              情报书
                            </span>
                          )}
                          {isFreePull && (
                            <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded border border-blue-200 dark:border-blue-700">
                              免费
                            </span>
                          )}
                          {hasHighRarity && (
                            <span className="text-[10px] font-normal">
                              {sixStarCount > 0 && <span className="text-endfield-yellow">{sixStarCount}×6★</span>}
                              {sixStarCount > 0 && fiveStarCount > 0 && <span className="text-slate-400 mx-1">·</span>}
                              {fiveStarCount > 0 && <span className="text-amber-400">{fiveStarCount}×5★</span>}
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-slate-400 dark:text-zinc-500 font-mono">
                          第 {group.startPullNumber} - {group.startPullNumber + 9} 抽
                          {isInfoBookPull && <span className="ml-2 text-amber-600 dark:text-amber-400">（计入保底 · 不消耗玉）</span>}
                          {isFreePull && <span className="ml-2 text-blue-500">（不计入保底）</span>}
                        </div>
                      </div>
                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {isExpanded && (
                      <div className="bg-zinc-50 dark:bg-zinc-950 divide-y divide-zinc-100 dark:divide-zinc-800">
                        {group.pulls.map((record, index) => {
                          let rarityColor = 'text-slate-400';
                          let bgColor = 'bg-slate-200 dark:bg-zinc-700';
                          let rarityLabel = `${record.rarity}★`;

                          if (record.rarity === 6) {
                            if (record.isUp) {
                              rarityColor = 'text-endfield-yellow bg-black/90 px-1 rounded-sm inline-block';
                              bgColor = 'bg-endfield-yellow';
                              rarityLabel = 'UP 6★';
                            } else {
                              rarityColor = 'text-red-400';
                              bgColor = 'bg-red-500';
                              rarityLabel = '常驻 6★';
                            }
                          } else if (record.rarity === 5) {
                            rarityColor = 'text-amber-400';
                            bgColor = 'bg-amber-500';
                          } else if (record.rarity === 4) {
                            rarityColor = 'text-purple-400';
                            bgColor = 'bg-purple-500';
                          }

                          return (
                            <div key={`${record.timestamp}-${index}`} className="p-2 pl-6 flex items-center gap-2">
                              <div className={`w-0.5 h-5 ${bgColor} shrink-0`} />
                              <div className="flex-1 min-w-0">
                                <div className={`text-[11px] font-bold ${rarityColor} flex items-center gap-2`}>
                                  <span>{rarityLabel}</span>
                                  {record.isInfoBookPull && (
                                    <span className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[9px] font-bold rounded border border-amber-200 dark:border-amber-700">
                                      情报书
                                    </span>
                                  )}
                                  {record.isFreePull && (
                                    <span className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-[9px] font-bold rounded border border-blue-200 dark:border-blue-700">
                                      免费
                                    </span>
                                  )}
                                  {record.characterName && (
                                    <span className="text-[9px] font-normal text-slate-600 dark:text-zinc-400 truncate">
                                      {record.characterName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const record = group;
              let rarityColor = 'text-slate-400';
              let bgColor = 'bg-slate-200 dark:bg-zinc-700';
              let rarityLabel = `${record.rarity}★`;

              if (record.rarity === 6) {
                if (record.isUp) {
                  rarityColor = 'text-endfield-yellow';
                  bgColor = 'bg-endfield-yellow';
                  rarityLabel = 'UP 6★';
                } else {
                  rarityColor = 'text-red-400';
                  bgColor = 'bg-red-500';
                  rarityLabel = '常驻 6★';
                }
              } else if (record.rarity === 5) {
                rarityColor = 'text-amber-400';
                bgColor = 'bg-amber-500';
              } else if (record.rarity === 4) {
                rarityColor = 'text-purple-400';
                bgColor = 'bg-purple-500';
              }

              return (
                <div key={`${record.timestamp}-${groupIndex}`} className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-2 group">
                  <div className={`w-1 h-6 ${bgColor} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-bold ${rarityColor} flex items-center gap-2`}>
                      <span>{rarityLabel}</span>
                      {record.isInfoBookPull && (
                        <span className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[9px] font-bold rounded border border-amber-200 dark:border-amber-700">
                          情报书
                        </span>
                      )}
                      {record.isFreePull && (
                        <span className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-[9px] font-bold rounded border border-blue-200 dark:border-blue-700">
                          免费
                        </span>
                      )}
                      {record.characterName && (
                        <span className="text-[10px] font-normal text-slate-600 dark:text-zinc-400 truncate">
                          {record.characterName}
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-slate-400 dark:text-zinc-500 font-mono">
                      第 {record.pullNumber} 抽
                      {record.isInfoBookPull && <span className="ml-2 text-amber-600 dark:text-amber-400">（情报书）</span>}
                      {record.isFreePull && <span className="ml-2 text-blue-500">（免费）</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>

    <CharacterStats
      pullHistory={pullHistory}
      poolType={poolType}
    />
  </div>
);

export default SimulatorHistoryPanel;
