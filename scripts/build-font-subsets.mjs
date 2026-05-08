import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fontSplit } from 'cn-font-split'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const judouSourceDir = path.join(repoRoot, 'src', 'assets', 'fonts', 'judou')
const judouOutputRoot = path.join(repoRoot, 'src', 'generated', 'fonts', 'judou')
const judouFontFamily = 'Judou Sans SE UI'
const harmonySourceDir = path.join(repoRoot, 'src', 'assets', 'fonts', 'harmony')
const harmonyOutputRoot = path.join(repoRoot, 'src', 'generated', 'fonts', 'harmony')
const harmonyFontFamily = 'Harmony Sans App'
const generatedDebugArtifacts = ['index.html', 'index.proto', 'reporter.bin']

const judouFontJobs = [
  {
    key: 'regular',
    weight: '400',
    sourceFile: 'JudouSEHans-Regular.ttf'
  },
  {
    key: 'medium',
    weight: '500',
    sourceFile: 'JudouSEHans-Medium.ttf'
  },
  {
    key: 'bold',
    weight: '700',
    sourceFile: 'JudouSEHans-Bold.ttf'
  },
  {
    key: 'heavy',
    weight: '900',
    sourceFile: 'JudouSEHans-Heavy.ttf'
  }
]

const harmonyFontJobs = [
  {
    key: 'sc-medium',
    weight: '400 600',
    sourceFile: 'HarmonyOS_Sans_SC_Medium.woff2'
  },
  {
    key: 'sc-bold',
    weight: '700 900',
    sourceFile: 'HarmonyOS_Sans_SC_Bold.woff2'
  }
]

function buildMetaPath(outputRoot, key) {
  return path.join(outputRoot, key, 'build-meta.json')
}

function resultCssPath(outputRoot, key) {
  return path.join(outputRoot, key, 'result.css')
}

function hasGeneratedArtifacts(outputRoot, fontJobs) {
  return fontJobs.every(({ key }) => existsSync(resultCssPath(outputRoot, key)) && existsSync(buildMetaPath(outputRoot, key)))
}

async function cleanupGeneratedArtifacts(outDir) {
  await Promise.all(
    generatedDebugArtifacts.map(async (fileName) => {
      try {
        await rm(path.join(outDir, fileName), { force: true })
      } catch (error) {
        if (error?.code !== 'ENOENT') {
          console.warn(`[fonts] Unable to remove ${fileName} from ${path.relative(repoRoot, outDir)}: ${error.message}`)
        }
      }
    })
  )
}

async function writeBuildMeta({ outputRoot, version, family, key, weight, sourcePath, sourceBuffer }) {
  const meta = {
    version,
    family,
    key,
    weight,
    sourceFile: path.relative(repoRoot, sourcePath).replaceAll(path.sep, '/'),
    sourceHash: createHash('sha256').update(sourceBuffer).digest('hex')
  }
  await writeFile(buildMetaPath(outputRoot, key), `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
}

async function buildFontSubset({ sourceDir, outputRoot, family, version, key, weight, sourceFile }) {
  const sourcePath = path.join(sourceDir, sourceFile)
  const outDir = path.join(outputRoot, key)
  const sourceBuffer = await readFile(sourcePath)

  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  await fontSplit({
    input: new Uint8Array(sourceBuffer),
    outDir,
    css: {
      fontFamily: family,
      fontWeight: weight,
      fontStyle: 'normal',
      fontDisplay: 'swap',
      localFamily: [family],
      compress: true,
      fileName: 'result.css',
      commentBase: false,
      commentNameTable: false,
      commentUnicodes: false
    },
    languageAreas: true,
    autoSubset: true,
    reduceMins: true,
    renameOutputFont: '[hash:8].[ext]',
    testHtml: false,
    reporter: false,
    silent: true
  })

  await cleanupGeneratedArtifacts(outDir)
  await writeBuildMeta({ outputRoot, version, family, key, weight, sourcePath, sourceBuffer })
  console.log(`[fonts] Built ${key} (${weight}) from ${sourceFile}`)
}

async function prepareFontFamily({
  label,
  sourceDir,
  outputRoot,
  family,
  version,
  fontJobs,
  allowCheckedInFallback = false
}) {
  const missingSources = fontJobs.filter(({ sourceFile }) => !existsSync(path.join(sourceDir, sourceFile)))

  if (missingSources.length > 0) {
    if (allowCheckedInFallback && hasGeneratedArtifacts(outputRoot, fontJobs)) {
      console.log(
        `[fonts] Missing local ${label} source fonts (${missingSources.map(({ sourceFile }) => sourceFile).join(', ')}); using checked-in subsets.`
      )
      return
    }

    throw new Error(
      `Missing local ${label} source fonts: ${missingSources.map(({ sourceFile }) => sourceFile).join(', ')}. ` +
      'Provide the source weights locally or restore the generated subsets before running dev/build.'
    )
  }

  await mkdir(outputRoot, { recursive: true })

  for (const job of fontJobs) {
    await buildFontSubset({ sourceDir, outputRoot, family, version, ...job })
  }
}

async function main() {
  await prepareFontFamily({
    label: 'Judou',
    sourceDir: judouSourceDir,
    outputRoot: judouOutputRoot,
    family: judouFontFamily,
    version: 'judou-sans-se-wasm-v2',
    fontJobs: judouFontJobs,
    allowCheckedInFallback: true
  })

  await prepareFontFamily({
    label: 'Harmony SC',
    sourceDir: harmonySourceDir,
    outputRoot: harmonyOutputRoot,
    family: harmonyFontFamily,
    version: 'harmony-os-sans-sc-wasm-v1',
    fontJobs: harmonyFontJobs
  })
}

main().catch((error) => {
  console.error(`[fonts] ${error.message}`)
  process.exitCode = 1
})
