import React from 'react';
import { Gamepad2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';
import { getDesktopPathForTab } from '../../constants/appRoutes';
import { useI18n } from '../../i18n/index.js';

/**
 * 移动端模拟器视图 - 引导用户切换到桌面端
 * 工业风重构版 (中文)
 */
function MobileSimulatorView() {
  const navigate = useNavigate();
  const { setPreference } = useDeviceDetection();
  const { t } = useI18n();

  const handleSwitchToDesktop = () => {
    setPreference('desktop');
    navigate(getDesktopPathForTab('simulator'));
  };

  return (
    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden px-4 pb-20 slide-up-enter scroll-smooth w-full bg-ef-light dark:bg-ef-dark flex flex-col items-center justify-center text-center text-slate-500 dark:text-zinc-500">
        <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6 border border-zinc-200 dark:border-zinc-800">
            <Gamepad2 size={32} className="text-amber-600 dark:text-ef-yellow" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-widest">{t('nav.simulator')}</h2>
        <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-[200px] mb-8">{t('simulator.mobile.desc')}</p>
        <button onClick={handleSwitchToDesktop} className="w-full max-w-[240px] py-3 bg-amber-400 dark:bg-ef-yellow text-slate-900 font-bold rounded-lg shadow-sm dark:shadow-[0_0_20px_rgba(255,204,0,0.2)] transition-transform active:scale-95">
            {t('simulator.mobile.switch')}
        </button>
    </div>
  );
}

export default MobileSimulatorView;