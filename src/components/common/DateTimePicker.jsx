import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Clock, ChevronLeft, ChevronRight, X, Timer } from 'lucide-react';

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];

const QUICK_TIMES = [
  { label: '10:00', h: 10, m: 0 },
  { label: '11:00', h: 11, m: 0 },
  { label: '16:00', h: 16, m: 0 },
  { label: '18:00', h: 18, m: 0 },
  { label: '23:59', h: 23, m: 59 },
];

/**
 * 日期时间选择器 - 日历与时间同屏显示
 */
const DateTimePicker = ({
  value,
  onChange,
  label,
  placeholder = '选择日期时间',
  showClearButton = true,
  minDate = null,
  maxDate = null,
  durationPresets = null,
  durationBaseTime = null,
  onDurationApply = null,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => (value ? new Date(value) : new Date()));
  const [hourInput, setHourInput] = useState('');
  const [minuteInput, setMinuteInput] = useState('');
  const containerRef = useRef(null);
  const panelRef = useRef(null);

  const currentDate = value ? new Date(value) : null;
  const selYear = currentDate?.getFullYear();
  const selMonth = currentDate?.getMonth();
  const selDay = currentDate?.getDate();
  const selHour = currentDate?.getHours() ?? 10;
  const selMinute = currentDate?.getMinutes() ?? 0;

  // 同步输入框
  useEffect(() => {
    setHourInput(String(selHour).padStart(2, '0'));
    setMinuteInput(String(selMinute).padStart(2, '0'));
  }, [selHour, selMinute]);

  // 点击外部关闭（portal 元素不在 containerRef 内，需同时检测）
  useEffect(() => {
    const handler = (e) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 面板定位：基于触发元素的 getBoundingClientRect 计算 fixed 位置
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, dropUp: false });
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropUp = spaceBelow < 420;
      setPanelPos({
        top: dropUp ? rect.top : rect.bottom + 4,
        left: rect.left,
        dropUp,
      });
    }
  }, [isOpen]);

  const fmt = (d) => {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${da}T${h}:${mi}`;
  };

  const emitDate = useCallback((year, month, day, hour, minute) => {
    onChange(fmt(new Date(year, month, day, hour, minute)));
  }, [onChange]);

  const handleSelectDate = (day) => {
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    emitDate(y, m, day, selHour, selMinute);
  };

  const handleTimeCommit = (h, m) => {
    if (!currentDate) {
      const today = new Date();
      emitDate(today.getFullYear(), today.getMonth(), today.getDate(), h, m);
    } else {
      emitDate(selYear, selMonth, selDay, h, m);
    }
  };

  const handleHourBlur = () => {
    let h = parseInt(hourInput, 10);
    if (isNaN(h) || h < 0) h = 0;
    if (h > 23) h = 23;
    setHourInput(String(h).padStart(2, '0'));
    handleTimeCommit(h, selMinute);
  };

  const handleMinuteBlur = () => {
    let m = parseInt(minuteInput, 10);
    if (isNaN(m) || m < 0) m = 0;
    if (m > 59) m = 59;
    setMinuteInput(String(m).padStart(2, '0'));
    handleTimeCommit(selHour, m);
  };

  const handleDurationClick = (days) => {
    if (!durationBaseTime || !onDurationApply) return;
    const base = new Date(durationBaseTime);
    if (isNaN(base.getTime())) return;
    const end = new Date(base);
    end.setDate(end.getDate() + days);
    onDurationApply(end);
  };

  // 日历生成
  const generateDays = () => {
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDay = new Date(y, m, 1).getDay();
    const prevDays = new Date(y, m, 0).getDate();
    const days = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: prevDays - i, current: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(y, m, i);
      let disabled = false;
      if (minDate && date < new Date(new Date(minDate).setHours(0, 0, 0, 0))) disabled = true;
      if (maxDate && date > new Date(new Date(maxDate).setHours(23, 59, 59, 999))) disabled = true;
      days.push({
        day: i,
        current: true,
        selected: selYear === y && selMonth === m && selDay === i,
        today: new Date().toDateString() === date.toDateString(),
        disabled,
      });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, current: false });
    }
    return days;
  };

  const displayValue = currentDate
    ? currentDate.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">
          {label}
        </label>
      )}

      {/* 输入框 */}
      <div
        className={`relative group cursor-pointer border transition-colors ${
          isOpen
            ? 'border-red-400 dark:border-red-500 ring-1 ring-red-400/30'
            : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600'
        } bg-white dark:bg-zinc-900`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <input
          type="text"
          readOnly
          value={displayValue}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2 bg-transparent text-slate-700 dark:text-zinc-200 cursor-pointer text-sm outline-none"
        />
        <Calendar size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
        {showClearButton && value && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* 快捷时长按钮 */}
      {durationPresets && durationPresets.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {durationPresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={!durationBaseTime}
              onClick={() => handleDurationClick(preset.days)}
              className="px-2 py-0.5 text-[11px] bg-zinc-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 text-slate-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title={durationBaseTime ? `从开始时间 +${preset.days} 天` : '请先设置开始时间'}
            >
              <Timer size={10} className="inline mr-0.5 -mt-px" />+{preset.days}天
            </button>
          ))}
        </div>
      )}

      {/* 弹出面板 - Portal 到 body 避免被父容器 overflow 裁剪 */}
      {isOpen && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: panelPos.dropUp ? undefined : panelPos.top,
            bottom: panelPos.dropUp ? (window.innerHeight - panelPos.top + 4) : undefined,
            left: panelPos.left,
          }}
          className="z-[9999] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-xl shadow-black/10 dark:shadow-black/30 w-[340px]"
        >
          {/* 日历区域 */}
          <div className="p-3 pb-2">
            {/* 月份导航 */}
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))}
                className="w-7 h-7 flex items-center justify-center text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">
                {viewDate.getFullYear()} · {MONTH_NAMES[viewDate.getMonth()]}
              </span>
              <button
                type="button"
                onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))}
                className="w-7 h-7 flex items-center justify-center text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* 星期标题 */}
            <div className="grid grid-cols-7 mb-0.5">
              {WEEK_DAYS.map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-slate-400 dark:text-zinc-600 py-1 uppercase">{d}</div>
              ))}
            </div>

            {/* 日期网格 */}
            <div className="grid grid-cols-7 gap-px">
              {generateDays().map((d, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={!d.current || d.disabled}
                  onClick={() => d.current && !d.disabled && handleSelectDate(d.day)}
                  className={`
                    w-full aspect-square text-xs font-medium transition-all relative
                    ${!d.current ? 'text-zinc-200 dark:text-zinc-800' : ''}
                    ${d.current && !d.selected && !d.disabled ? 'text-slate-600 dark:text-zinc-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400' : ''}
                    ${d.selected ? 'bg-red-500 text-white font-bold shadow-sm shadow-red-500/30' : ''}
                    ${d.today && !d.selected ? 'ring-1 ring-inset ring-red-300 dark:ring-red-700' : ''}
                    ${d.disabled ? 'text-zinc-200 dark:text-zinc-800 cursor-not-allowed' : ''}
                  `}
                >
                  {d.day}
                </button>
              ))}
            </div>

            {/* 快捷日期 */}
            <div className="flex gap-1.5 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              {[
                { label: '今天', offset: 0 },
                { label: '明天', offset: 1 },
                { label: '后天', offset: 2 },
              ].map(({ label: lbl, offset }) => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + offset);
                    setViewDate(d);
                    emitDate(d.getFullYear(), d.getMonth(), d.getDate(), selHour, selMinute);
                  }}
                  className="flex-1 py-1 text-[11px] font-medium text-slate-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* 分隔线 */}
          <div className="border-t border-zinc-100 dark:border-zinc-800" />

          {/* 时间区域 */}
          <div className="p-3 pt-2">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={13} className="text-slate-400 dark:text-zinc-500" />
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">时间</span>
            </div>

            {/* 时分输入 */}
            <div className="flex items-center gap-2 mb-2.5">
              <div className="flex items-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={hourInput}
                  onChange={(e) => setHourInput(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  onBlur={handleHourBlur}
                  onKeyDown={(e) => e.key === 'Enter' && handleHourBlur()}
                  className="w-10 text-center py-1.5 text-lg font-bold font-mono bg-transparent text-slate-700 dark:text-zinc-200 outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-lg font-bold text-slate-300 dark:text-zinc-600 select-none">:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={minuteInput}
                  onChange={(e) => setMinuteInput(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  onBlur={handleMinuteBlur}
                  onKeyDown={(e) => e.key === 'Enter' && handleMinuteBlur()}
                  className="w-10 text-center py-1.5 text-lg font-bold font-mono bg-transparent text-slate-700 dark:text-zinc-200 outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              {/* 快捷时间 */}
              <div className="flex flex-wrap gap-1 flex-1">
                {QUICK_TIMES.map(qt => (
                  <button
                    key={qt.label}
                    type="button"
                    onClick={() => {
                      handleTimeCommit(qt.h, qt.m);
                      setHourInput(String(qt.h).padStart(2, '0'));
                      setMinuteInput(String(qt.m).padStart(2, '0'));
                    }}
                    className={`px-1.5 py-0.5 text-[11px] font-mono transition-colors ${
                      selHour === qt.h && selMinute === qt.m
                        ? 'bg-red-500 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400'
                    }`}
                  >
                    {qt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 确认按钮 */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full py-1.5 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors tracking-wide"
            >
              确定
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DateTimePicker;
