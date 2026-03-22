export const OPS_AUTOMATION_JOBS = Object.freeze([
  {
    id: 'official-announcements',
    label: '官方公告同步',
    entityLabel: '公告',
    sourceLabel: '官方公告源',
    publishStrategy: 'manual-review',
    keyField: 'source_id',
    compareFields: ['title', 'summary', 'content', 'published_at', 'version', 'source_url', 'is_active'],
    previewFields: ['title', 'version', 'published_at', 'source_url', 'is_active'],
  },
  {
    id: 'pool-schedule',
    label: '卡池轮换同步',
    entityLabel: '卡池',
    sourceLabel: '官方卡池日程源',
    publishStrategy: 'manual-review',
    keyField: 'pool_id',
    compareFields: ['name', 'type', 'start_time', 'end_time', 'up_character', 'featured_characters', 'banner_url'],
    previewFields: ['name', 'type', 'start_time', 'end_time', 'up_character'],
  },
  {
    id: 'wiki-catalog',
    label: '图鉴巡检',
    entityLabel: '角色/武器图鉴',
    sourceLabel: 'Wiki / 图鉴数据源',
    publishStrategy: 'manual-review',
    keyField: 'id',
    compareFields: ['name', 'type', 'rarity', 'avatar_url'],
    previewFields: ['name', 'type', 'rarity', 'avatar_url'],
  },
]);

export function getOpsAutomationJob(jobId) {
  return OPS_AUTOMATION_JOBS.find(job => job.id === jobId) || null;
}
