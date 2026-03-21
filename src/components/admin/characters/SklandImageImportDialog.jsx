import React from 'react';
import { Clipboard, ExternalLink, ImagePlus, X } from 'lucide-react';
import { getSklandCatalogLabel, getSklandCatalogUrl } from '../../../constants/adminImageSources';

const SklandImageImportDialog = ({
  show,
  itemType,
  importText,
  setImportText,
  importPreview,
  actionLoading,
  onClose,
  onCopyScript,
  onImport,
}) => {
  if (!show) return null;

  const catalogUrl = getSklandCatalogUrl(itemType);
  const catalogLabel = getSklandCatalogLabel(itemType);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose}></div>
      <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-3xl z-50">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 max-h-full overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-bold text-slate-700 dark:text-zinc-300">
              从森空岛终末地WIKI批量导入{itemType === 'weapon' ? '武器' : '角色'}图片
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div className="rounded border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10 px-3 py-3 text-sm text-orange-700 dark:text-orange-300">
              这是一条浏览器侧辅助导入链，不直接服务端抓取森空岛。流程是：打开图鉴页，在控制台执行提取脚本，复制 JSON，回到这里粘贴后批量写回 `avatar_url`。也可使用 `npm run fetch:skland-images` 自动完成全流程。
            </div>

            <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-600 dark:text-zinc-400">
              <li>
                打开当前图鉴页面：
                <a
                  href={catalogUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <ExternalLink size={14} />
                  {catalogLabel}
                </a>
              </li>
              <li>在该页面按 `F12` 打开控制台。</li>
              <li>点击下方“复制提取脚本”，把脚本粘到控制台执行。</li>
              <li>回到这里，把剪贴板里的 JSON 粘贴到文本框。</li>
            </ol>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={onCopyScript}
                className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-none transition-colors"
              >
                <Clipboard size={16} />
                复制提取脚本
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                粘贴森空岛终末地WIKI导出的 JSON
              </label>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='[{"name":"汤汤","cover":"https://bbs.hycdn.cn/image/common/...png"}]'
                className="w-full min-h-[220px] px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 font-mono text-xs"
              />
            </div>

            <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3 py-3 text-sm">
              {importPreview.error ? (
                <p className="text-red-600 dark:text-red-400">{importPreview.error}</p>
              ) : (
                <div className="space-y-2 text-slate-600 dark:text-zinc-400">
                  <p>可导入记录: {importPreview.recordCount}</p>
                  <p>可匹配到当前库: {importPreview.matchCount}</p>
                  <p>名称冲突待人工处理: {importPreview.ambiguousCount}</p>
                  <p>未匹配项: {importPreview.unmatchedCount}</p>
                  {importPreview.sampleMatches.length > 0 && (
                    <div>
                      <p className="font-medium text-slate-700 dark:text-zinc-300 mb-1">示例匹配</p>
                      <ul className="space-y-1 text-xs">
                        {importPreview.sampleMatches.map((item) => (
                          <li key={`${item.id}-${item.sourceName}`}>
                            {item.sourceName} → {item.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 p-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              onClick={onImport}
              disabled={Boolean(importPreview.error) || actionLoading === 'skland-import'}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-medium rounded-none transition-colors"
            >
              <ImagePlus size={16} />
              {actionLoading === 'skland-import' ? '导入中...' : '批量写入图片'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-none"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SklandImageImportDialog;
