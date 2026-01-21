import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';

/**
 * 专用日期时间选择器组件
 * 提供更好的用户体验来选择日期和时间
 */
const DateTimePicker = ({ 
  value, 
  onChange, 
  label, 
  placeholder = '选择日期时间',
  showClearButton = true,
  minDate = null,
  maxDate = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState('date'); // 'date' | 'time'
  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(value);
    return new Date();
  });
  
  const containerRef = useRef(null);
  
  // 解析当前值
  const currentDate = value ? new Date(value) : null;
  const selectedYear = currentDate?.getFullYear();
  const selectedMonth = currentDate?.getMonth();
  const selectedDay = currentDate?.getDate();
  const selectedHour = currentDate?.getHours() ?? 10;
  const selectedMinute = currentDate?.getMinutes() ?? 0;
  
  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // 获取月份的天数
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };
  
  // 获取月份第一天是星期几
  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };
  
  // 生成日历网格
  const generateCalendarDays = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    
    // 上个月的日期（填充）
    const prevMonthDays = getDaysInMonth(year, month - 1);
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, isCurrentMonth: false, isPrev: true });
    }
    
    // 当前月的日期
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      let isDisabled = false;
      if (minDate && date < new Date(minDate)) isDisabled = true;
      if (maxDate && date > new Date(maxDate)) isDisabled = true;
      
      days.push({ 
        day: i, 
        isCurrentMonth: true, 
        isSelected: selectedYear === year && selectedMonth === month && selectedDay === i,
        isToday: new Date().toDateString() === date.toDateString(),
        isDisabled
      });
    }
    
    // 下个月的日期（填充）
    const remainingDays = 42 - days.length; // 6行 x 7天
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ day: i, isCurrentMonth: false, isNext: true });
    }
    
    return days;
  };
  
  // 选择日期
  const handleSelectDate = (day, isCurrentMonth) => {
    if (!isCurrentMonth) return;
    
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const hour = selectedHour;
    const minute = selectedMinute;
    
    const newDate = new Date(year, month, day, hour, minute);
    onChange(formatDateTimeLocal(newDate));
    setViewMode('time');
  };
  
  // 选择时间
  const handleSelectTime = (hour, minute) => {
    if (!currentDate) {
      // 如果还没选日期，使用今天
      const today = new Date();
      const newDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, minute);
      onChange(formatDateTimeLocal(newDate));
    } else {
      const newDate = new Date(
        selectedYear, 
        selectedMonth, 
        selectedDay, 
        hour, 
        minute
      );
      onChange(formatDateTimeLocal(newDate));
    }
  };
  
  // 格式化为 datetime-local 格式
  const formatDateTimeLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };
  
  // 格式化显示值
  const formatDisplayValue = () => {
    if (!currentDate) return '';
    return currentDate.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // 月份名称
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  
  // 快捷时间选项
  const quickTimes = [
    { label: '10:00', hour: 10, minute: 0 },
    { label: '11:00', hour: 11, minute: 0 },
    { label: '12:00', hour: 12, minute: 0 },
    { label: '16:00', hour: 16, minute: 0 },
    { label: '18:00', hour: 18, minute: 0 },
    { label: '20:00', hour: 20, minute: 0 },
    { label: '23:59', hour: 23, minute: 59 },
  ];
  
  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
          {label}
        </label>
      )}
      
      {/* 输入框 */}
      <div className="relative">
        <input
          type="text"
          readOnly
          value={formatDisplayValue()}
          placeholder={placeholder}
          onClick={() => setIsOpen(!isOpen)}
          className="w-full pl-10 pr-8 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 cursor-pointer text-sm"
        />
        <Calendar 
          size={16} 
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" 
        />
        {showClearButton && value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            <X size={14} />
          </button>
        )}
      </div>
      
      {/* 下拉选择器 */}
      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-lg rounded-sm w-72">
          {/* 模式切换标签 */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setViewMode('date')}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-sm font-medium transition-colors ${
                viewMode === 'date' 
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' 
                  : 'text-slate-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <Calendar size={14} />
              日期
            </button>
            <button
              type="button"
              onClick={() => setViewMode('time')}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-sm font-medium transition-colors ${
                viewMode === 'time' 
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' 
                  : 'text-slate-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <Clock size={14} />
              时间
            </button>
          </div>
          
          {viewMode === 'date' ? (
            <div className="p-3">
              {/* 月份导航 */}
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="font-medium text-slate-700 dark:text-zinc-300">
                  {viewDate.getFullYear()}年 {monthNames[viewDate.getMonth()]}
                </span>
                <button
                  type="button"
                  onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              
              {/* 星期标题 */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {weekDays.map(day => (
                  <div key={day} className="text-center text-xs font-medium text-slate-400 dark:text-zinc-500 py-1">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* 日期网格 */}
              <div className="grid grid-cols-7 gap-1">
                {generateCalendarDays().map((day, index) => (
                  <button
                    key={index}
                    type="button"
                    disabled={!day.isCurrentMonth || day.isDisabled}
                    onClick={() => handleSelectDate(day.day, day.isCurrentMonth)}
                    className={`
                      w-8 h-8 text-sm rounded transition-colors
                      ${!day.isCurrentMonth ? 'text-zinc-300 dark:text-zinc-700 cursor-default' : ''}
                      ${day.isCurrentMonth && !day.isSelected && !day.isDisabled ? 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300' : ''}
                      ${day.isSelected ? 'bg-red-500 text-white font-medium' : ''}
                      ${day.isToday && !day.isSelected ? 'ring-1 ring-red-400' : ''}
                      ${day.isDisabled ? 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed' : ''}
                    `}
                  >
                    {day.day}
                  </button>
                ))}
              </div>
              
              {/* 快捷按钮 */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    setViewDate(today);
                    handleSelectDate(today.getDate(), true);
                  }}
                  className="flex-1 py-1.5 text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded transition-colors"
                >
                  今天
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    setViewDate(tomorrow);
                    handleSelectDate(tomorrow.getDate(), true);
                  }}
                  className="flex-1 py-1.5 text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded transition-colors"
                >
                  明天
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3">
              {/* 当前选择的时间 */}
              <div className="text-center mb-3">
                <span className="text-2xl font-bold text-slate-700 dark:text-zinc-300">
                  {String(selectedHour).padStart(2, '0')}:{String(selectedMinute).padStart(2, '0')}
                </span>
              </div>
              
              {/* 快捷时间 */}
              <div className="mb-3">
                <p className="text-xs text-slate-500 dark:text-zinc-500 mb-2">常用时间</p>
                <div className="flex flex-wrap gap-1.5">
                  {quickTimes.map(qt => (
                    <button
                      key={qt.label}
                      type="button"
                      onClick={() => handleSelectTime(qt.hour, qt.minute)}
                      className={`px-2.5 py-1 text-xs rounded transition-colors ${
                        selectedHour === qt.hour && selectedMinute === qt.minute
                          ? 'bg-red-500 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300'
                      }`}
                    >
                      {qt.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* 小时选择 */}
              <div className="mb-3">
                <p className="text-xs text-slate-500 dark:text-zinc-500 mb-2">小时</p>
                <div className="grid grid-cols-6 gap-1">
                  {Array.from({ length: 24 }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelectTime(i, selectedMinute)}
                      className={`py-1 text-xs rounded transition-colors ${
                        selectedHour === i
                          ? 'bg-red-500 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300'
                      }`}
                    >
                      {String(i).padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* 分钟选择 */}
              <div>
                <p className="text-xs text-slate-500 dark:text-zinc-500 mb-2">分钟</p>
                <div className="grid grid-cols-6 gap-1">
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSelectTime(selectedHour, m)}
                      className={`py-1 text-xs rounded transition-colors ${
                        selectedMinute === m
                          ? 'bg-red-500 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300'
                      }`}
                    >
                      {String(m).padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* 确认按钮 */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full mt-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded transition-colors"
              >
                确定
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DateTimePicker;

