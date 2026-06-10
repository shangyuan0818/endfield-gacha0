import React, { useEffect, useRef, useState } from 'react';
import { Send, Smile } from 'lucide-react';
import { useI18n } from '../../i18n/index.js';

const EMOJI_LIST = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂',
  '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛',
  '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
  '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔',
  '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵',
  '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕',
  '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧',
  '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓',
  '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀',
  '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙',
  '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖',
  '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
  '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
  '✨', '⭐', '🌟', '💫', '🔥', '💥', '💢', '💦', '💨', '🎉',
  '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '⚡', '☀️', '🌈'
];

function EmojiPicker({ onClose, onSelect }) {
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full left-0 mb-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-sm shadow-lg z-50 p-2 w-72"
    >
      <div className="grid grid-cols-10 gap-1 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
        {EMOJI_LIST.map((emoji, index) => (
          <button
            key={index}
            type="button"
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="w-6 h-6 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-sm transition-colors text-base"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ReplyInput({
  value,
  onChange,
  onSubmit,
  submitting,
  canUseInternalNote = false,
  publicReplyAllowed = true,
  mode = 'public',
  onModeChange,
}) {
  const { isEnglish } = useI18n();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);
  const tt = React.useCallback((zh, en) => (isEnglish ? en : zh), [isEnglish]);

  const handleEmojiSelect = (emoji) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(value + emoji);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.slice(0, start) + emoji + value.slice(end);
    onChange(newValue);

    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
      textarea.focus();
    }, 0);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
      <div className="flex flex-col gap-2">
        {canUseInternalNote && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!publicReplyAllowed}
              onClick={() => onModeChange?.('public')}
              className={`px-3 py-1.5 text-xs border transition-colors ${
                mode === 'public'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200'
                  : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'
              } disabled:opacity-40`}
            >
              {tt('公开回复', 'Public reply')}
            </button>
            <button
              type="button"
              onClick={() => onModeChange?.('internal')}
              className={`px-3 py-1.5 text-xs border transition-colors ${
                mode === 'internal'
                  ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200'
                  : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'
              }`}
            >
              {tt('内部备注', 'Internal note')}
            </button>
            {mode === 'internal' && (
              <span className="text-[11px] text-amber-700 dark:text-amber-300">
                {tt('仅管理员可见，不会通知用户。', 'Only staff can see this. Users are not notified.')}
              </span>
            )}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={
            mode === 'internal'
              ? tt('输入内部备注... (Ctrl+Enter 保存)', 'Write an internal note... (Ctrl+Enter to save)')
              : tt('输入回复内容... (Ctrl+Enter 发送)', 'Write a reply... (Ctrl+Enter to send)')
          }
          className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[60px] max-h-[120px] resize-y"
          onKeyDown={handleKeyDown}
          rows={2}
        />
        <div className="flex justify-between items-center">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-sm transition-colors"
              title={tt('插入表情', 'Insert emoji')}
            >
              <Smile size={18} />
            </button>
            {showEmojiPicker && (
              <EmojiPicker
                onSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>
          <button
            onClick={onSubmit}
            disabled={!value.trim() || submitting}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-none transition-colors disabled:opacity-50 flex items-center gap-2 text-sm whitespace-normal text-center leading-tight"
          >
            <Send size={14} />
            {submitting
              ? tt('处理中...', 'Saving...')
              : mode === 'internal'
                ? tt('保存备注', 'Save Note')
                : tt('发送', 'Send')}
          </button>
        </div>
      </div>
    </div>
  );
}
