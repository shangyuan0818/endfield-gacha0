import {
  AlertCircle,
  Bug,
  CheckCircle2,
  Clock,
  Database,
  HelpCircle,
  Lightbulb,
  MoreHorizontal,
  X,
  XCircle,
} from 'lucide-react';
import { getAppLocale, isEnglishLocale } from '../../i18n/index.js';

const TICKET_TYPE_META = {
  bug: {
    labelZh: 'Bug反馈',
    labelEn: 'Bug',
    icon: Bug,
    color: 'text-red-500 bg-red-50 border-red-200'
  },
  feature: {
    labelZh: '功能建议',
    labelEn: 'Feature',
    icon: Lightbulb,
    color: 'text-amber-500 bg-amber-50 border-amber-200'
  },
  question: {
    labelZh: '使用咨询',
    labelEn: 'Question',
    icon: HelpCircle,
    color: 'text-blue-500 bg-blue-50 border-blue-200'
  },
  data_issue: {
    labelZh: '数据问题',
    labelEn: 'Data',
    icon: Database,
    color: 'text-purple-500 bg-purple-50 border-purple-200'
  },
  other: {
    labelZh: '其他',
    labelEn: 'Other',
    icon: MoreHorizontal,
    color: 'text-slate-500 bg-slate-50 border-slate-200'
  }
};

const TICKET_STATUS_META = {
  pending: { labelZh: '待处理', labelEn: 'Pending', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  processing: { labelZh: '处理中', labelEn: 'In Progress', icon: AlertCircle, color: 'text-blue-600 bg-blue-50' },
  resolved: { labelZh: '已解决', labelEn: 'Resolved', icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
  rejected: { labelZh: '已拒绝', labelEn: 'Rejected', icon: XCircle, color: 'text-red-600 bg-red-50' },
  closed: { labelZh: '已关闭', labelEn: 'Closed', icon: X, color: 'text-slate-600 bg-slate-50' }
};

const PRIORITY_META = {
  low: { labelZh: '低', labelEn: 'Low', color: 'bg-slate-100 text-slate-600' },
  medium: { labelZh: '中', labelEn: 'Medium', color: 'bg-blue-100 text-blue-600' },
  high: { labelZh: '高', labelEn: 'High', color: 'bg-orange-100 text-orange-600' },
  urgent: { labelZh: '紧急', labelEn: 'Urgent', color: 'bg-red-100 text-red-600' }
};

function localizeConfigMap(metaMap, locale = getAppLocale()) {
  const english = isEnglishLocale(locale);

  return Object.fromEntries(
    Object.entries(metaMap).map(([key, value]) => [
      key,
      {
        ...value,
        label: english ? value.labelEn : value.labelZh
      }
    ])
  );
}

export function getTicketTypes(locale = getAppLocale()) {
  return localizeConfigMap(TICKET_TYPE_META, locale);
}

export function getTicketStatus(locale = getAppLocale()) {
  return localizeConfigMap(TICKET_STATUS_META, locale);
}

export function getTicketPriorities(locale = getAppLocale()) {
  return localizeConfigMap(PRIORITY_META, locale);
}
