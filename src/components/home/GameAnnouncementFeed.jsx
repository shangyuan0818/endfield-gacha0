import React, { useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, Radio } from 'lucide-react';
import AnnouncementContent from './AnnouncementContent';
import { formatAppDateTime, useI18n } from '../../i18n/index.js';

function formatPublishedAt(value, locale, fallback) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return formatAppDateTime(date, locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }, fallback);
}

const GameAnnouncementFeed = React.memo(function GameAnnouncementFeed({
  announcements = [],
  maxItems = 3,
}) {
  const { t, locale } = useI18n();
  const visibleAnnouncements = useMemo(
    () => (Array.isArray(announcements) ? announcements.slice(0, maxItems) : []),
    [announcements, maxItems],
  );
  const [expandedId, setExpandedId] = useState(undefined);
  const effectiveExpandedId = expandedId === undefined
    ? (visibleAnnouncements[0]?.source_id || null)
    : expandedId === null
      ? null
      : (
        visibleAnnouncements.some(item => item.source_id === expandedId)
          ? expandedId
          : (visibleAnnouncements[0]?.source_id || null)
      );

  if (visibleAnnouncements.length === 0) {
    return (
      <div className="px-4 pb-4">
        <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/30 px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">
          {t('announcement.empty')}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4 space-y-3">
      {visibleAnnouncements.map((announcement) => {
        const isExpanded = effectiveExpandedId === announcement.source_id;

        return (
          <div
            key={announcement.source_id}
            className="border border-amber-200/50 bg-white/70 dark:border-amber-900/30 dark:bg-zinc-950/30"
          >
            <div className="px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  <Radio size={11} className="text-endfield-yellow" />
                  {t('home.gameAnnouncement')}
                </div>
                <div className="mt-1 flex items-start justify-between gap-3">
                  <h4 className="font-bold text-zinc-800 dark:text-zinc-100 break-words min-w-0 flex-1">
                    {announcement.title}
                  </h4>
                  {announcement.source_url ? (
                    <a
                      href={announcement.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="group inline-flex items-center gap-1 shrink-0 px-2.5 py-1 text-[11px] font-semibold border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:-translate-y-0.5 hover:shadow-sm dark:border-amber-700 dark:text-amber-300 dark:bg-amber-900/20 dark:hover:bg-amber-900/35 transition-all duration-200"
                    >
                      {t('announcement.viewSource')}
                      <ExternalLink size={12} className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </a>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span>{formatPublishedAt(announcement.published_at, locale, t('announcement.timeUnavailable'))}</span>
                  {announcement.summary ? <span>· {announcement.summary}</span> : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : announcement.source_id)}
                aria-expanded={isExpanded}
                className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
              >
                {isExpanded ? t('announcement.collapse') : t('announcement.expand')}
                <ChevronDown
                  size={15}
                  className={`text-zinc-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>
            </div>

            {isExpanded ? <AnnouncementContent content={announcement.content} /> : null}
          </div>
        );
      })}
    </div>
  );
});

export default GameAnnouncementFeed;
