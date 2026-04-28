import React from 'react';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AnnouncementContent from '../../components/home/AnnouncementContent.jsx';
import GameAnnouncementFeed from '../../components/home/GameAnnouncementFeed.jsx';
import { useAppStore } from '../../stores';
import { getMobilePathForTab } from '../../constants/appRoutes.js';
import { useI18n } from '../../i18n/index.js';
import { getLocalizedAnnouncementContent, getLocalizedAnnouncementTitle } from '../../utils/announcementLocale.js';
import {
  getAnnouncementSeverityMeta,
  getAnnouncementTypeLabel,
  splitSiteAnnouncements
} from '../../utils/announcementMeta.js';

function BackButton({ onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label="Back" className="touch-feedback inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 transition-colors">
      <ArrowLeft size={16} />
    </button>
  );
}

function MobileAnnouncementsView() {
  const navigate = useNavigate();
  const { t, formatDateTime, locale } = useI18n();
  const announcements = useAppStore((state) => state.announcements);
  const gameAnnouncements = useAppStore((state) => state.gameAnnouncements);
  const { temporary: temporaryAnnouncements, updates: updateAnnouncements } = splitSiteAnnouncements(announcements);
  const latestAnnouncement = updateAnnouncements?.[0] || null;
  const localizedAnnouncementTitle = getLocalizedAnnouncementTitle(latestAnnouncement, locale) || t('announcement.empty');
  const localizedAnnouncementContent = getLocalizedAnnouncementContent(latestAnnouncement, locale);

  return (
    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden px-4 pb-20 slide-up-enter scroll-smooth w-full bg-ef-light dark:bg-ef-dark">
      <div className="py-4 flex items-center gap-3 sticky top-0 bg-white/90 dark:bg-ef-dark/90 backdrop-blur-md z-20 border-b border-zinc-200 dark:border-zinc-800/50 -mx-4 px-4 mb-4">
         <BackButton onClick={() => navigate(getMobilePathForTab('home'))} />
         <h1 className="text-xl font-black tracking-widest text-slate-900 dark:text-white">{t('home.siteAnnouncement')}</h1>
      </div>
      
      {temporaryAnnouncements.map((announcement) => {
        const severityMeta = getAnnouncementSeverityMeta(announcement.severity, locale);
        return (
          <div key={announcement.id} className={`rounded-xl border ${severityMeta.card} p-4 mb-4 shadow-sm`}>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold ${severityMeta.badge}`}>
                <AlertTriangle size={11} />
                {getAnnouncementTypeLabel('temporary', locale)}
              </span>
              <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${severityMeta.badge}`}>
                {severityMeta.displayLabel}
              </span>
            </div>
            <div className="text-lg font-black mb-2">{getLocalizedAnnouncementTitle(announcement, locale)}</div>
            <div className="text-[11px] opacity-70 mb-4">{formatDateTime(announcement.updated_at || announcement.created_at, { includeYear: false }, t('common.timeUnknown'))}</div>
            <div className="pt-4 border-t border-current/20 text-sm prose prose-invert max-w-none">
              <AnnouncementContent content={getLocalizedAnnouncementContent(announcement, locale)} />
            </div>
          </div>
        );
      })}

      {latestAnnouncement ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-gradient-to-r from-amber-50 dark:from-amber-950/20 to-transparent p-4 mb-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="px-2 py-0.5 rounded-sm bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 text-[10px] font-bold">{getAnnouncementTypeLabel('update', locale)}</span>
            {latestAnnouncement.version ? <span className="px-2 py-0.5 rounded-sm bg-zinc-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-[10px] font-bold font-mono">v{latestAnnouncement.version}</span> : null}
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white mb-2">{localizedAnnouncementTitle}</div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-500 mb-4">{formatDateTime(latestAnnouncement.updated_at || latestAnnouncement.created_at, { includeYear: false }, t('common.timeUnknown'))}</div>
          <div className="pt-4 border-t border-amber-200 dark:border-amber-800/30 text-sm text-slate-700 dark:text-zinc-300 prose prose-invert max-w-none">
            <AnnouncementContent content={localizedAnnouncementContent} />
          </div>
        </div>
      ) : temporaryAnnouncements.length === 0 ? (
        <div className="text-sm text-slate-400 dark:text-zinc-500 text-center py-10">{t('announcement.empty')}</div>
      ) : null}
      
      <div className="rounded-xl border border-orange-200 dark:border-orange-800/30 bg-gradient-to-r from-orange-50 dark:from-orange-950/20 to-transparent p-4 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-0.5 rounded-sm bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 text-[10px] font-bold">{t('home.gameAnnouncement')}</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-500">{t('home.fromOfficialSite')}</span>
        </div>
        <div className="border-t border-orange-200 dark:border-orange-800/30 pt-4">
           <GameAnnouncementFeed announcements={gameAnnouncements} maxItems={12} />
        </div>
      </div>
    </div>
  );
}

export default MobileAnnouncementsView;
