import React from 'react';
import { Lock, LogIn } from 'lucide-react';
import useAuthStore from '../../stores/useAuthStore';
import { useI18n } from '../../i18n/index.js';
import {
  MobileActionButton,
  MobileGlassPanel,
  MobilePage,
  MobileStickyHeader
} from './ux/MobilePrimitives.jsx';

export default function MobileAuthRequiredView({
  title,
  description,
  eyebrow = '',
  animation = 'up'
}) {
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const { isEnglish } = useI18n();
  const tt = React.useCallback((zh, en) => (isEnglish ? en : zh), [isEnglish]);

  return (
    <MobilePage animation={animation}>
      <MobileStickyHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={description}
        icon={Lock}
      />

      <MobileGlassPanel className="mt-2 overflow-hidden">
        <div className="flex flex-col items-center px-2 py-4 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[1.6rem] border border-amber-400/30 bg-amber-500/12 text-amber-600 dark:text-endfield-yellow">
            <LogIn size={28} />
          </div>
          <h2 className="text-lg font-black tracking-wide text-slate-900 dark:text-white">
            {tt('请先登录', 'Sign In Required')}
          </h2>
          <p className="mt-2 max-w-[20rem] text-sm leading-6 text-slate-500 dark:text-zinc-400">
            {description}
          </p>
          <MobileActionButton
            onClick={openAuthModal}
            tone="primary"
            className="mt-5 min-w-[10rem] justify-center rounded-[1rem] px-4 py-3 text-sm font-black"
          >
            <span className="inline-flex items-center gap-2">
              <LogIn size={16} />
              <span>{tt('登录 / 注册', 'Sign In / Register')}</span>
            </span>
          </MobileActionButton>
        </div>
      </MobileGlassPanel>
    </MobilePage>
  );
}
