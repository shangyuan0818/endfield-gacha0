import React, { useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, Radio } from 'lucide-react';
import AnnouncementContent from './AnnouncementContent';
import { formatAppDateTime, useI18n } from '../../i18n/index.js';
import { getGameAnnouncementSummary } from '../../utils/gameAnnouncementSummary.js';

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

function getAnnouncementSourceGroup(announcement = {}) {
  const sourceKind = String(announcement?.source_kind || '').toLowerCase();
  const sourceGroup = String(announcement?.source_group || '').toLowerCase();
  const sourceId = String(announcement?.source_id || '');
  const sourceUrl = String(announcement?.source_url || '');

  if (
    sourceGroup === 'game'
    || sourceKind === 'game-bulletin'
    || sourceId.startsWith('game-bulletin:')
    || sourceUrl.includes('game_bulletin')
  ) {
    return 'game';
  }

  return 'official';
}

function getGameBulletinCategoryLabel(announcement = {}, t) {
  if (getAnnouncementSourceGroup(announcement) !== 'game') {
    return null;
  }

  const category = String(announcement?.source_category || announcement?.tab || '').toLowerCase();
  if (category === 'events') return t('announcement.gameCategory.events');
  if (category === 'updates') return t('announcement.gameCategory.updates');
  if (category === 'news') return t('announcement.gameCategory.news');
  return t('announcement.gameCategory.unknown');
}

function buildAnnouncementGroups(announcements = [], maxItems = 3, t) {
  const groups = [
    { id: 'game', title: t('announcement.source.gameBulletin'), items: [] },
    { id: 'official', title: t('announcement.source.officialSite'), items: [] },
  ];

  const groupById = new Map(groups.map(group => [group.id, group]));

  for (const announcement of Array.isArray(announcements) ? announcements : []) {
    const groupId = getAnnouncementSourceGroup(announcement);
    const group = groupById.get(groupId) || groupById.get('official');
    if (group.items.length >= maxItems) {
      continue;
    }

    group.items.push(announcement);
  }

  return groups.filter(group => group.items.length > 0);
}

const GameAnnouncementFeed = React.memo(function GameAnnouncementFeed({
  announcements = [],
  maxItems = 3,
}) {
  const { t, locale } = useI18n();
  const groupedAnnouncements = useMemo(
    () => buildAnnouncementGroups(announcements, maxItems, t),
    [announcements, maxItems, t],
  );
  const visibleAnnouncements = useMemo(
    () => groupedAnnouncements.flatMap(group => group.items),
    [groupedAnnouncements],
  );
  const isHistoryFallback = visibleAnnouncements.some(announcement => announcement?.is_recent_history_fallback);
  const [expandedGroupIds, setExpandedGroupIds] = useState(() => new Set(['game']));
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

  if (groupedAnnouncements.length === 0) {
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
      {isHistoryFallback ? (
        <div className="border border-dashed border-amber-300/70 bg-amber-50/80 px-4 py-3 text-xs font-medium text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/25 dark:text-amber-300">
          {t('announcement.recentFallbackHint')}
        </div>
      ) : null}

      {groupedAnnouncements.map((group) => {
        const isGroupExpanded = expandedGroupIds.has(group.id);
        return (
          <div key={group.id} className="border border-amber-200/50 bg-white/70 dark:border-amber-900/30 dark:bg-zinc-950/30">
            <button
              type="button"
              onClick={() => setExpandedGroupIds((prev) => {
                const next = new Set(prev);
                if (next.has(group.id)) {
                  next.delete(group.id);
                } else {
                  next.add(group.id);
                }
                return next;
              })}
              aria-expanded={isGroupExpanded}
              className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  <Radio size={11} className="text-endfield-yellow" />
                  {group.title}
                </div>
                <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {t('announcement.groupCount', { count: group.items.length })}
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`shrink-0 text-zinc-400 transition-transform duration-200 ${isGroupExpanded ? 'rotate-180' : ''}`}
              />
            </button>

            {isGroupExpanded ? (
              <div className="border-t border-amber-200/40 dark:border-amber-900/30 divide-y divide-amber-100/70 dark:divide-amber-950/40">
                {group.items.map((announcement) => {
                  const isExpanded = effectiveExpandedId === announcement.source_id;
                  const summaryText = getGameAnnouncementSummary(announcement);
                  const categoryLabel = getGameBulletinCategoryLabel(announcement, t);

                  return (
                    <div key={announcement.source_id}>
                      <div className="px-4 py-3">
                        <div className="min-w-0">
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
                            {categoryLabel ? (
                              <span className="border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                                {categoryLabel}
                              </span>
                            ) : null}
                            <span>{formatPublishedAt(announcement.published_at, locale, t('announcement.timeUnavailable'))}</span>
                            {summaryText ? <span>· {summaryText}</span> : null}
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
            ) : null}
          </div>
        );
      })}
    </div>
  );
});

export default GameAnnouncementFeed;
