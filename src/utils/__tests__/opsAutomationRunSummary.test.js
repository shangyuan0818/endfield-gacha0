import { describe, expect, it } from 'vitest';
import {
  buildOpsAutomationTriggerMessage,
  formatOpsAutomationRunSummary,
  getOpsAutomationFailureLabel,
  getOpsAutomationPresentationStatus,
  normalizeOpsAutomationAttempts,
  normalizeOpsAutomationWarnings,
} from '../opsAutomationRunSummary.js';

describe('opsAutomationRunSummary', () => {
  it('derives partial status from summary.ops', () => {
    const run = {
      status: 'success',
      summary: {
        synced: 1,
        ops: {
          presentationStatus: 'partial',
          retryCount: 1,
          durationMs: 1250,
          failureType: 'llm',
          output: {
            synced: 1,
            summaryFailed: 1,
          },
        },
      },
    };

    expect(getOpsAutomationPresentationStatus(run)).toBe('partial');
    expect(formatOpsAutomationRunSummary(run)).toContain('摘要失败 1');
    expect(formatOpsAutomationRunSummary(run)).toContain('重试 1');
    expect(formatOpsAutomationRunSummary(run)).toContain('摘要生成失败');
  });

  it('normalizes retry attempts and warnings', () => {
    const run = {
      error_message: 'final failure',
      summary: {
        warning: 'cache warning',
        ops: {
          warnings: ['source warning', 'cache warning'],
          attempts: [
            { attempt: 1, status: 'failure', retryable: true },
            { attempt: 2, status: 'success', retryable: false },
          ],
        },
      },
    };

    expect(normalizeOpsAutomationAttempts(run)).toHaveLength(2);
    expect(normalizeOpsAutomationWarnings(run)).toEqual([
      'source warning',
      'cache warning',
      'final failure',
    ]);
  });

  it('formats trigger messages without dropping legacy result fields', () => {
    const message = buildOpsAutomationTriggerMessage('pool-schedule', {
      partial: true,
      pools: {
        parsed: 2,
        created: 1,
        updated: 1,
      },
    });

    expect(message).toContain('解析 2 项');
    expect(message).toContain('新增 1 项');
    expect(message).toContain('存在部分成功项');
    expect(getOpsAutomationFailureLabel('source_fetch')).toBe('上游源失败');
  });
});
