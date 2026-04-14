import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PoolMechanicsCard from '../../components/home/PoolMechanicsCard.jsx';
import usePoolStore from '../../stores/usePoolStore';
import { getCurrentUpPoolInfo } from '../../utils/poolTimeUtils.js';
import { getMobilePathForTab } from '../../constants/appRoutes.js';
import { useI18n } from '../../i18n/index.js';

function BackButton({ onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label="Back" className="touch-feedback inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 transition-colors">
      <ArrowLeft size={16} />
    </button>
  );
}

function MobileMechanicsView() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const pools = usePoolStore((state) => state.pools);
  const [now, setNow] = useState(new Date());
  const [isOpen, setIsOpen] = useState(true);
  const poolsArray = useMemo(() => (Array.isArray(pools) ? pools : []), [pools]);
  const currentUpInfo = useMemo(() => getCurrentUpPoolInfo(poolsArray, now), [poolsArray, now]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden px-4 pb-20 slide-up-enter scroll-smooth w-full bg-ef-light dark:bg-ef-dark">
      <div className="py-4 flex items-center gap-3 sticky top-0 bg-white/90 dark:bg-ef-dark/90 backdrop-blur-md z-20 border-b border-zinc-200 dark:border-zinc-800/50 -mx-4 px-4 mb-4">
         <BackButton onClick={() => navigate(getMobilePathForTab('home'))} />
         <h1 className="text-xl font-black tracking-widest text-slate-900 dark:text-white">{t('home.poolMechanics.title')}</h1>
      </div>

      <PoolMechanicsCard currentUpInfo={currentUpInfo} isOpen={isOpen} onToggle={() => setIsOpen((value) => !value)} />
    </div>
  );
}

export default MobileMechanicsView;
