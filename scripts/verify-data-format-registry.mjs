import assert from 'node:assert/strict';

import {
  detectImportFormat,
  listSupportedExportFormats,
  listSupportedImportFormats,
} from '../src/utils/dataFormatRegistry.js';
import { validateAndNormalizeImportData } from '../src/utils/dataImport.js';

const currentPayload = {
  formatId: 'internal_json_v3',
  schemaVersion: '3.0.0',
  exportTime: '2026-03-21T08:00:00.000Z',
  pools: [
    { id: 'special_1_0_1', name: '限定测试池', type: 'limited' },
  ],
  history: [
    {
      id: 1001,
      poolId: 'special_1_0_1',
      name: '测试角色',
      rarity: 6,
      isStandard: false,
      timestamp: '2026-03-21T08:00:00.000Z',
    },
  ],
};

const legacyPayload = {
  pools: [
    { pool_id: 'special_1_0_1', name: '限定测试池', type: 'limited_character' },
  ],
  history: [
    {
      record_id: 1002,
      pool_id: 'special_1_0_1',
      item_name: '旧版角色',
      rarity: 5,
      is_standard: false,
      timestamp: '2026-03-21T08:01:00.000Z',
    },
  ],
};

assert.equal(detectImportFormat(currentPayload)?.id, 'internal_json_v3', '当前导出格式应识别为 internal_json_v3');
assert.equal(detectImportFormat(legacyPayload)?.id, 'internal_json_legacy', '旧版 payload 应识别为 internal_json_legacy');
assert.ok(listSupportedImportFormats().some(format => format.id === 'internal_json_v3'), '应列出当前 JSON 导入格式');
assert.ok(listSupportedImportFormats().some(format => format.id === 'internal_json_legacy'), '应列出旧版 JSON 导入格式');
assert.ok(listSupportedExportFormats().some(format => format.id === 'internal_csv_flat'), '应列出 CSV 导出格式');

const validation = validateAndNormalizeImportData(currentPayload);
assert.equal(validation.valid, true, '当前 JSON payload 应可通过校验');
assert.equal(validation.normalizedData.sourceFormatId, 'internal_json_v3', '校验结果应保留来源格式 ID');

console.log('FEAT-021 data format registry verification passed');
