import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  buildAutomationAuditReport,
  buildManualReviewBundle,
  formatAutomationAuditReport,
  loadJobRecords,
  parseAutomationCliArgs,
  writeJsonArtifact,
} from './lib/opsAutomationCore.mjs';
import { OPS_AUTOMATION_JOBS, getOpsAutomationJob } from './lib/opsAutomationJobRegistry.mjs';

function printUsage(io = console) {
  io.log('用法:');
  io.log('  node scripts/run-ops-automation.mjs --list');
  io.log('  node scripts/run-ops-automation.mjs --job <jobId> --current <current.json> --incoming <incoming.json> [--dry-run] [--write-json <report.json>] [--write-bundle <bundle.json>] [--source-tag <tag>] [--source-url <url>]');
  io.log('');
  io.log('说明:');
  io.log('  - 默认模式为 dry-run；传入 --apply 仅改变审计标记，不会自动写库');
  io.log('  - --write-bundle 会额外输出供人工审核/发布的完整审计包');
}

function printJobList(io = console) {
  io.log('# 可用运营自动化任务');
  OPS_AUTOMATION_JOBS.forEach((job) => {
    io.log(`- ${job.id}: ${job.label} (${job.entityLabel} / ${job.sourceLabel})`);
  });
}

export async function runOpsAutomation(argv = process.argv.slice(2), io = console) {
  const args = parseAutomationCliArgs(argv);

  if (args.list) {
    printJobList(io);
    return;
  }

  if (!args.jobId || !args.currentPath || !args.incomingPath) {
    printUsage(io);
    throw new Error('缺少必填参数: --job / --current / --incoming');
  }

  const job = getOpsAutomationJob(args.jobId);
  if (!job) {
    throw new Error(`未知任务: ${args.jobId}`);
  }

  const [currentRecords, incomingRecords] = await Promise.all([
    loadJobRecords(args.currentPath, 'current'),
    loadJobRecords(args.incomingPath, 'incoming'),
  ]);

  const auditReport = buildAutomationAuditReport({
    job,
    currentRecords,
    incomingRecords,
    dryRun: args.dryRun,
    sourceMeta: args.sourceMeta,
  });

  io.log(formatAutomationAuditReport(auditReport));

  if (args.writeJsonPath) {
    await writeJsonArtifact(args.writeJsonPath, auditReport);
    io.log(`\n已写出审计报告: ${path.resolve(args.writeJsonPath)}`);
  }

  if (args.writeBundlePath) {
    const bundle = buildManualReviewBundle({
      job,
      currentRecords,
      incomingRecords,
      dryRun: args.dryRun,
      sourceMeta: args.sourceMeta,
    });
    await writeJsonArtifact(args.writeBundlePath, bundle);
    io.log(`已写出人工审核包: ${path.resolve(args.writeBundlePath)}`);
  }
}

const isDirectRun = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
  runOpsAutomation().catch((error) => {
    console.error('[run-ops-automation] 执行失败:', error);
    process.exitCode = 1;
  });
}
