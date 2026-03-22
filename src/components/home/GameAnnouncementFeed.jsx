import React, { useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, Radio } from 'lucide-react';
import AnnouncementContent from './AnnouncementContent';

function formatPublishedAt(value) {
  if (!value) {
    return '时间未提供';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '时间未提供';
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

const GameAnnouncementFeed = React.memo(function GameAnnouncementFeed({
  announcements = [],
  maxItems = 3,
}) {
  const visibleAnnouncements = useMemo(
    () => (Array.isArray(announcements) ? announcements.slice(0, maxItems) : []),
    [announcements, maxItems],
  );
  const [expandedId, setExpandedId] = useState(() => visibleAnnouncements[0]?.source_id || null);
  const effectiveExpandedId = visibleAnnouncements.some(item => item.source_id === expandedId)
    ? expandedId
    : (visibleAnnouncements[0]?.source_id || null);

  if (visibleAnnouncements.length === 0) {
    return (
      <div className="px-4 pb-4">
        <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/30 px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">
          当前暂无已同步的游戏公告。
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
            className="border border-zinc-200/80 bg-white/70 dark:border-zinc-800 dark:bg-zinc-950/30"
          >
            <button
              type="button"
              onClick={() => setExpandedId(prev => (prev === announcement.source_id ? null : announcement.source_id))}
              className="w-full px-4 py-3 flex items-start justify-between gap-3 text-left"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  <Radio size={11} className="text-endfield-yellow" />
                  游戏公告
                </div>
                <h4 className="mt-1 font-bold text-zinc-800 dark:text-zinc-100 break-words">
                  {announcement.title}
                </h4>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span>{formatPublishedAt(announcement.published_at)}</span>
                  {announcement.summary ? <span>· {announcement.summary}</span> : null}
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`shrink-0 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            </button>

            <div className="px-4 pb-4 -mt-1">
              <a
                href={announcement.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
              >
                查看官方原文
                <ExternalLink size={12} />
              </a>
            </div>

            {isExpanded ? <AnnouncementContent content={announcement.content} /> : null}
          </div>
        );
      })}
    </div>
  );
});

export default GameAnnouncementFeed;
