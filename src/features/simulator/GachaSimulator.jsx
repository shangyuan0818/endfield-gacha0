import React from 'react';
import { Layers, Search, Star } from 'lucide-react';
import SimulatorResults from './SimulatorResults';
import SimulatorControls from './SimulatorControls';
import PullAnimation from './PullAnimation';
import LimitedPoolAnalysis from './LimitedPoolAnalysis';
import SimulatorToolbar from './SimulatorToolbar';
import SimulatorHistoryPanel from './SimulatorHistoryPanel';
import { useGachaSimulatorController } from './useGachaSimulatorController';

const GachaSimulator = () => {
  const {
    availableFreePulls,
    closeResetDialog,
    confirmReset,
    currentPoolObj,
    currentSimPool,
    currentSimPoolId,
    dashboardStats,
    effectivePityObj,
    expandedTenPulls,
    handleExportData,
    handleExportReport,
    handlePull,
    handleReset,
    handleShare,
    historyGroups,
    infoBookTenPullAvailable,
    isAnimating,
    lastResults,
    multipleFreeTen,
    pityInfoWithGuarantee,
    poolCharactersList,
    pullHistory,
    resetAllPools,
    resetSettings,
    setLastResults,
    setMultipleFreeTen,
    setResetAllPools,
    setResetSettings,
    setShowPoolMenu,
    setSkipAnimation,
    showPoolMenu,
    showResetConfirm,
    showToast,
    simulator,
    simulatorPools,
    skipAnimation,
    switchPool,
    toastMessage,
    toggleTenPull
  } = useGachaSimulatorController();

  return (
    <div className="flex flex-col h-full text-slate-800 dark:text-zinc-100 font-sans max-w-7xl mx-auto w-full">
      <SimulatorToolbar
        currentSimPool={currentSimPool}
        currentSimPoolId={currentSimPoolId}
        onExportData={handleExportData}
        onExportReport={handleExportReport}
        onReset={handleReset}
        onShare={handleShare}
        onSwitchPool={switchPool}
        onToggleMultipleFreeTen={() => setMultipleFreeTen(!multipleFreeTen)}
        onTogglePoolMenu={() => setShowPoolMenu(!showPoolMenu)}
        onToggleSkipAnimation={() => setSkipAnimation(!skipAnimation)}
        poolType={simulator.poolType}
        showPoolMenu={showPoolMenu}
        simulatorPools={simulatorPools}
        multipleFreeTen={multipleFreeTen}
        skipAnimation={skipAnimation}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[32fr_48fr_20fr] gap-6 mb-8 flex-1">
        <div className="space-y-4">
          <LimitedPoolAnalysis
            currentPool={currentPoolObj}
            stats={dashboardStats}
            effectivePity={effectivePityObj}
            pityInfo={pityInfoWithGuarantee}
            multipleFreeTen={multipleFreeTen}
          />
        </div>

        <div className="relative flex flex-col">
          <div className="flex-1 bg-zinc-100 dark:bg-black border border-zinc-200 dark:border-zinc-800 relative overflow-hidden flex items-center justify-center min-h-[600px]">
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle at center, #333 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }}
            />

            {isAnimating && <PullAnimation />}

            {lastResults ? (
              <div className="relative z-20 w-full h-full animate-fade-in p-4">
                <SimulatorResults results={lastResults} onClose={() => setLastResults(null)} />
              </div>
            ) : !isAnimating && (
              <div className="relative z-10 text-center transform transition-all duration-500 animate-fade-in">
                <div className="w-24 h-24 mx-auto mb-6 border-2 border-endfield-yellow rotate-45 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                  {simulator.poolType === 'limited' && <Star size={40} className="text-endfield-yellow -rotate-45" />}
                  {simulator.poolType === 'weapon' && <Search size={40} className="text-endfield-yellow -rotate-45" />}
                  {simulator.poolType === 'standard' && <Layers size={40} className="text-endfield-yellow -rotate-45" />}
                </div>

                <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter mb-2">
                  {simulator.poolType === 'limited'
                    ? 'LIMITED HEADHUNTING'
                    : simulator.poolType === 'weapon'
                      ? 'WEAPON ARSENAL'
                      : 'STANDARD HEADHUNTING'}
                </h1>
                <p className="text-sm font-mono text-endfield-yellow tracking-[0.2em] uppercase opacity-80 bg-black/80 px-2 py-1 rounded inline-block">
                  Probability Up Event
                </p>
              </div>
            )}
          </div>

          <div className="mt-4">
            <SimulatorControls
              onPullOne={() => handlePull('single')}
              onPullTen={() => handlePull('ten')}
              disabled={isAnimating || !poolCharactersList}
              jadeCost={600}
              availableFreePulls={availableFreePulls}
              infoBookTenPullAvailable={infoBookTenPullAvailable}
            />
          </div>
        </div>

        <SimulatorHistoryPanel
          expandedTenPulls={expandedTenPulls}
          historyGroups={historyGroups}
          onToggleTenPull={toggleTenPull}
          poolType={simulator.poolType}
          pullHistory={pullHistory}
        />
      </div>

      {showToast && (
        <div className="fixed bottom-8 right-8 z-50 animate-fade-in">
          <div className="bg-endfield-yellow text-black px-6 py-3 shadow-lg border-2 border-black font-bold">
            {toastMessage}
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-red-50 dark:bg-red-900/20">
              <h3 className="text-lg font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">
                重置模拟器
              </h3>
            </div>

            <div className="px-6 py-6 space-y-4">
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                {resetAllPools
                  ? '确定要重置所有类型的卡池吗？所有数据将被清空。'
                  : `确定要重置所有${currentSimPool?.type === 'limited' ? '限定角色池' : currentSimPool?.type === 'weapon' ? '武器池' : '常驻池'}吗？该类型的所有卡池数据将被清空。`}
              </p>

              <div
                onClick={() => setResetAllPools(!resetAllPools)}
                className={`
                  flex items-center gap-3 px-4 py-3 cursor-pointer transition-all border select-none
                  ${resetAllPools
                    ? 'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400'
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }
                `}
              >
                <div className={`w-4 h-4 border-2 flex items-center justify-center transition-colors ${resetAllPools ? 'border-red-500 bg-red-500' : 'border-current'}`}>
                  {resetAllPools && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold">重置所有类型的卡池</div>
                  <div className="text-xs opacity-75 mt-0.5">清空限定、武器、常驻所有类型的卡池数据</div>
                </div>
              </div>

              <div
                onClick={() => setResetSettings(!resetSettings)}
                className={`
                  flex items-center gap-3 px-4 py-3 cursor-pointer transition-all border select-none
                  ${resetSettings
                    ? 'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400'
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }
                `}
              >
                <div className={`w-4 h-4 border-2 flex items-center justify-center transition-colors ${resetSettings ? 'border-red-500 bg-red-500' : 'border-current'}`}>
                  {resetSettings && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold">重置开关设置</div>
                  <div className="text-xs opacity-75 mt-0.5">恢复"跳过动画"和"多次免费十连"为默认状态</div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-3 justify-end bg-zinc-50 dark:bg-zinc-950">
              <button
                onClick={closeResetDialog}
                className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmReset}
                className="px-4 py-2 text-sm font-bold bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: #333;
        }
      `}</style>
    </div>
  );
};

export default GachaSimulator;
