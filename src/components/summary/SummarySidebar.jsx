import React from 'react';
import { Cloud, Layers, Search, Star, User } from 'lucide-react';
import { useI18n } from '../../i18n/index.js';
import SidebarItem from './SidebarItem';

export default function SummarySidebar({
  dataSource,
  setDataSource,
  poolTypeFilter,
  setPoolTypeFilter,
  globalStats,
  localStats,
}) {
  const { t } = useI18n();
  const tt = (key, fallback, params = {}) => t(key, params, fallback);

  return (
    <div className="w-56 flex-shrink-0">
      <div className="bg-zinc-900 border border-zinc-800 sticky top-4">
        <div className="border-b border-zinc-800">
          <SidebarItem
            label={tt('summary.source.global', '全服数据')}
            icon={Cloud}
            isActive={dataSource === 'global' && poolTypeFilter === 'all'}
            onClick={() => {
              setDataSource('global');
              setPoolTypeFilter('all');
            }}
            count={globalStats?.totalPulls}
          />
          {dataSource === 'global' && (
            <div className="bg-zinc-950">
              <SidebarItem
                label={tt('summary.scope.extra', '附加寻访')}
                icon={Star}
                indent
                isActive={poolTypeFilter === 'extra'}
                onClick={() => {
                  setDataSource('global');
                  setPoolTypeFilter('extra');
                }}
                count={globalStats?.byType?.extra?.total}
              />
              <SidebarItem
                label={tt('summary.scope.limited', '限定角色池')}
                icon={Star}
                indent
                isActive={poolTypeFilter === 'limited'}
                onClick={() => {
                  setDataSource('global');
                  setPoolTypeFilter('limited');
                }}
                count={globalStats?.byType?.limited?.total}
              />
              <SidebarItem
                label={tt('summary.scope.standard', '常驻池')}
                icon={Layers}
                indent
                isActive={poolTypeFilter === 'standard'}
                onClick={() => {
                  setDataSource('global');
                  setPoolTypeFilter('standard');
                }}
                count={globalStats?.byType?.standard?.total}
              />
              <SidebarItem
                label={tt('summary.scope.weapon', '武器池')}
                icon={Search}
                indent
                isActive={poolTypeFilter === 'weapon'}
                onClick={() => {
                  setDataSource('global');
                  setPoolTypeFilter('weapon');
                }}
                count={globalStats?.byType?.weapon?.total}
              />
            </div>
          )}
        </div>

        <div>
          <SidebarItem
            label={tt('summary.source.local', '我的数据')}
            icon={User}
            isActive={dataSource === 'local' && poolTypeFilter === 'all'}
            onClick={() => {
              setDataSource('local');
              setPoolTypeFilter('all');
            }}
            count={localStats.total}
          />
          {dataSource === 'local' && (
            <div className="bg-zinc-950">
              <SidebarItem
                label={tt('summary.scope.extra', '附加寻访')}
                icon={Star}
                indent
                isActive={poolTypeFilter === 'extra'}
                onClick={() => {
                  setDataSource('local');
                  setPoolTypeFilter('extra');
                }}
                count={localStats.byType.extra.total}
              />
              <SidebarItem
                label={tt('summary.scope.limited', '限定角色池')}
                icon={Star}
                indent
                isActive={poolTypeFilter === 'limited'}
                onClick={() => {
                  setDataSource('local');
                  setPoolTypeFilter('limited');
                }}
                count={localStats.byType.limited.total}
              />
              <SidebarItem
                label={tt('summary.scope.standard', '常驻池')}
                icon={Layers}
                indent
                isActive={poolTypeFilter === 'standard'}
                onClick={() => {
                  setDataSource('local');
                  setPoolTypeFilter('standard');
                }}
                count={localStats.byType.standard.total}
              />
              <SidebarItem
                label={tt('summary.scope.weapon', '武器池')}
                icon={Search}
                indent
                isActive={poolTypeFilter === 'weapon'}
                onClick={() => {
                  setDataSource('local');
                  setPoolTypeFilter('weapon');
                }}
                count={localStats.byType.weapon.total}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
