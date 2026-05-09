import { execFile } from 'node:child_process'
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = path.join(repoRoot, 'artifacts', 'perf-report.json')
const MiB = 1024 * 1024

const KEY_PATHS = [
  'src',
  'src/assets',
  'src/generated',
  'supabase',
  'supabase/manual',
  'api',
  'public',
  'dist',
  '.vercel',
  '.git',
]

const WALK_IGNORE = new Set([
  'node_modules',
  '.git',
  '.vercel',
  'dist',
  'coverage',
  'test-results',
])

const DIST_BUDGETS = {
  jsWarningMiB: 0.5,
  cssWarningMiB: 0.5,
  totalAssetsWarningMiB: 35,
}

function formatMiB(bytes) {
  return Number((bytes / MiB).toFixed(2))
}

async function pathSize(targetPath, ignoreNames = new Set()) {
  let entry
  try {
    entry = await stat(targetPath)
  } catch {
    return 0
  }

  if (!entry.isDirectory()) {
    return entry.size
  }

  let total = 0
  const entries = await readdir(targetPath, { withFileTypes: true })
  for (const child of entries) {
    if (ignoreNames.has(child.name)) {
      continue
    }

    total += await pathSize(path.join(targetPath, child.name), ignoreNames)
  }

  return total
}

async function listFiles(targetPath) {
  let entry
  try {
    entry = await stat(targetPath)
  } catch {
    return []
  }

  if (!entry.isDirectory()) {
    return [{ path: targetPath, size: entry.size }]
  }

  const files = []
  const entries = await readdir(targetPath, { withFileTypes: true })
  for (const child of entries) {
    const childPath = path.join(targetPath, child.name)
    if (child.isDirectory()) {
      files.push(...await listFiles(childPath))
    } else if (child.isFile()) {
      const childStat = await stat(childPath)
      files.push({ path: childPath, size: childStat.size })
    }
  }

  return files
}

async function gitTrackedFiles() {
  try {
    const { stdout } = await execFileAsync('git', ['ls-files', '-z'], {
      cwd: repoRoot,
      maxBuffer: 20 * MiB,
    })
    return stdout.split('\0').filter(Boolean)
  } catch {
    return []
  }
}

async function buildTrackedFileSummary() {
  const files = await gitTrackedFiles()
  const records = []
  let total = 0

  for (const filePath of files) {
    try {
      const fileStat = await stat(path.join(repoRoot, filePath))
      total += fileStat.size
      records.push({
        path: filePath.replaceAll('\\', '/'),
        size: fileStat.size,
        sizeMiB: formatMiB(fileStat.size),
      })
    } catch {
      // A staged deletion can appear in git ls-files before the next commit.
    }
  }

  records.sort((a, b) => b.size - a.size)
  return {
    count: records.length,
    sizeMiB: formatMiB(total),
    largest: records.slice(0, 20),
  }
}

async function buildPathSummary() {
  const rows = []
  for (const relativePath of KEY_PATHS) {
    rows.push({
      path: relativePath,
      sizeMiB: formatMiB(await pathSize(path.join(repoRoot, relativePath))),
    })
  }

  rows.push({
    path: 'repo_without_local_caches',
    sizeMiB: formatMiB(await pathSize(repoRoot, WALK_IGNORE)),
  })

  rows.sort((a, b) => b.sizeMiB - a.sizeMiB)
  return rows
}

async function buildDistSummary() {
  const distAssetsPath = path.join(repoRoot, 'dist', 'assets')
  const files = (await listFiles(distAssetsPath))
    .map(file => ({
      path: path.relative(repoRoot, file.path).replaceAll('\\', '/'),
      size: file.size,
      sizeMiB: formatMiB(file.size),
      ext: path.extname(file.path).toLowerCase(),
    }))
    .sort((a, b) => b.size - a.size)

  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  const warnings = files.filter(file => (
    (file.ext === '.js' && file.sizeMiB > DIST_BUDGETS.jsWarningMiB) ||
    (file.ext === '.css' && file.sizeMiB > DIST_BUDGETS.cssWarningMiB)
  ))

  return {
    totalAssetsMiB: formatMiB(totalSize),
    largest: files.slice(0, 25).map(({ path: filePath, sizeMiB, ext }) => ({ path: filePath, sizeMiB, ext })),
    warnings: warnings.map(({ path: filePath, sizeMiB, ext }) => ({ path: filePath, sizeMiB, ext })),
    budget: DIST_BUDGETS,
  }
}

async function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    paths: await buildPathSummary(),
    trackedFiles: await buildTrackedFileSummary(),
    dist: await buildDistSummary(),
  }

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log('Performance budget report')
  console.log(`- tracked files: ${report.trackedFiles.count}, ${report.trackedFiles.sizeMiB} MiB`)
  console.log(`- dist assets: ${report.dist.totalAssetsMiB} MiB`)
  console.log(`- report: ${path.relative(repoRoot, outputPath)}`)
  console.log('')
  console.log('Largest tracked files:')
  for (const file of report.trackedFiles.largest.slice(0, 10)) {
    console.log(`  ${String(file.sizeMiB).padStart(7)} MiB  ${file.path}`)
  }
  console.log('')
  console.log('Largest dist assets:')
  for (const file of report.dist.largest.slice(0, 10)) {
    console.log(`  ${String(file.sizeMiB).padStart(7)} MiB  ${file.path}`)
  }

  if (report.dist.warnings.length > 0) {
    console.log('')
    console.log('Budget warnings:')
    for (const file of report.dist.warnings) {
      console.log(`  ${file.sizeMiB} MiB ${file.ext} ${file.path}`)
    }
  }
}

main().catch((error) => {
  console.error(`[perf] ${error?.message || error}`)
  process.exitCode = 1
})
