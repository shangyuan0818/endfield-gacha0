import { handleOfficialBotSelfApi } from '../../../../_lib/officialBotApi.js';
import { fetchBotPoolLog } from '../../../../_lib/botDashboard.js';

function escapeCsvCell(value) {
  const text = String(value ?? '');
  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(log) {
  const headers = ['序号', '时间', '账号', '卡池', '池型', '物品', '稀有度', '免费十连', '赠送节点'];
  const rows = (log.rows || []).map((row) => [
    row.index,
    row.time || '',
    row.account_name,
    row.pool_name,
    row.pool_type,
    row.item_name,
    row.rarity,
    row.is_free ? '是' : '否',
    row.is_gift ? '是' : '否',
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n');
}

function buildText(log) {
  const lines = [
    `${log.account?.display_name || '未命名账号'} · ${log.pool?.display_name || '未知卡池'} · 详细日志`,
    `记录数：${log.total || 0}`,
    '',
  ];

  (log.rows || []).forEach((row) => {
    const flags = [
      row.is_free ? '免费十连' : null,
      row.is_gift ? '赠送' : null,
    ].filter(Boolean);
    lines.push(`${row.index}. ${row.time || '--'} · ${row.rarity}★ ${row.item_name}${flags.length ? ` · ${flags.join(' / ')}` : ''}`);
  });

  return lines.join('\n');
}

function buildExportPayload(log, format) {
  if (format === 'json') {
    return {
      mime_type: 'application/json; charset=utf-8',
      extension: 'json',
      content: JSON.stringify(log, null, 2),
    };
  }

  if (format === 'txt') {
    return {
      mime_type: 'text/plain; charset=utf-8',
      extension: 'txt',
      content: buildText(log),
    };
  }

  return {
    mime_type: 'text/csv; charset=utf-8',
    extension: 'csv',
    content: buildCsv(log),
  };
}

function hasPoolSelector(query = {}) {
  return Boolean(
    String(query.poolRef || '').trim()
    || String(query.poolId || '').trim()
  );
}

export default async function handler(req, res) {
  return handleOfficialBotSelfApi(req, res, {
    validateQuery: (query) => {
      if (!hasPoolSelector(query)) {
        throw {
          status: 400,
          message: 'Missing pool selector',
        };
      }
    },
    handler: async ({ adminClient, userId }) => {
      const log = await fetchBotPoolLog(adminClient, userId, {
        accountRef: req.query?.accountRef,
        poolRef: req.query?.poolRef,
        gameUid: req.query?.gameUid,
        poolId: req.query?.poolId,
      });
      if (!log) {
        throw {
          status: 404,
          message: 'Pool log not found',
        };
      }

      const format = ['json', 'txt', 'csv'].includes(String(req.query?.format || '').trim())
        ? String(req.query.format).trim()
        : 'csv';
      const file = buildExportPayload(log, format);
      const fileName = `${log.file_name}.${file.extension}`;

      return {
        account: log.account,
        pool: log.pool,
        total: log.total,
        file: {
          file_name: fileName,
          mime_type: file.mime_type,
          encoding: 'base64',
          content_base64: Buffer.from(file.content, 'utf8').toString('base64'),
        },
      };
    },
  });
}
