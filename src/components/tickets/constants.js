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

export const TICKET_TYPES = {
  bug: { label: 'Bug反馈', icon: Bug, color: 'text-red-500 bg-red-50 border-red-200' },
  feature: { label: '功能建议', icon: Lightbulb, color: 'text-amber-500 bg-amber-50 border-amber-200' },
  question: { label: '使用咨询', icon: HelpCircle, color: 'text-blue-500 bg-blue-50 border-blue-200' },
  data_issue: { label: '数据问题', icon: Database, color: 'text-purple-500 bg-purple-50 border-purple-200' },
  other: { label: '其他', icon: MoreHorizontal, color: 'text-slate-500 bg-slate-50 border-slate-200' }
};

export const TICKET_STATUS = {
  pending: { label: '待处理', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  processing: { label: '处理中', icon: AlertCircle, color: 'text-blue-600 bg-blue-50' },
  resolved: { label: '已解决', icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
  rejected: { label: '已拒绝', icon: XCircle, color: 'text-red-600 bg-red-50' },
  closed: { label: '已关闭', icon: X, color: 'text-slate-600 bg-slate-50' }
};

export const PRIORITY_CONFIG = {
  low: { label: '低', color: 'bg-slate-100 text-slate-600' },
  medium: { label: '中', color: 'bg-blue-100 text-blue-600' },
  high: { label: '高', color: 'bg-orange-100 text-orange-600' },
  urgent: { label: '紧急', color: 'bg-red-100 text-red-600' }
};
