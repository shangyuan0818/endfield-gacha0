import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useI18n } from '../../i18n/index.js';

const SimpleMarkdown = lazy(() => import('../SimpleMarkdown.jsx'));

const AnnouncementContent = React.memo(function AnnouncementContent({ content }) {
  const { t } = useI18n();
  const scrollRef = useRef(null);
  const [showScrollHint, setShowScrollHint] = useState(true);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return undefined;
    }

    const checkScrollable = () => {
      setCanScroll(element.scrollHeight > element.clientHeight);
    };

    checkScrollable();

    const observer = new ResizeObserver(checkScrollable);
    observer.observe(element);

    return () => observer.disconnect();
  }, [content]);

  const handleScroll = useCallback((event) => {
    const element = event.target;
    const isAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 20;
    setShowScrollHint(!isAtBottom);
  }, []);

  return (
    <div className="px-4 pb-4">
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="pl-12 pr-4 max-h-[400px] overflow-y-auto announcement-scrollbar"
          style={{
            scrollbarWidth: 'auto',
            scrollbarColor: 'rgb(251 191 36) transparent',
          }}
        >
          <Suspense
            fallback={
              <div className="py-3 text-sm text-slate-500 dark:text-zinc-500">
                {t('common.loading')}
              </div>
            }
          >
            <SimpleMarkdown
              content={content}
              className="text-sm text-slate-700 dark:text-zinc-300"
            />
          </Suspense>
          <div className="h-8"></div>
        </div>
        {canScroll && (
          <div
            className={`absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-amber-50 dark:from-amber-900/40 to-transparent pointer-events-none flex items-end justify-center pb-1 transition-opacity duration-300 ${showScrollHint ? 'opacity-100' : 'opacity-0'}`}
          >
            <div className="flex items-center gap-1 text-amber-500 dark:text-amber-400 text-xs animate-bounce">
              <ChevronDown size={14} />
              <span className="font-medium">{t('home.announcement.scrollMore')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default AnnouncementContent;
