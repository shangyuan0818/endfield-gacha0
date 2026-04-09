import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fontSplit } from 'cn-font-split'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = path.join(repoRoot, 'src', 'assets', 'fonts', 'judou')
const outputRoot = path.join(repoRoot, 'src', 'generated', 'fonts', 'judou')
const fontFamily = 'Judou Sans SE UI'
const generatedDebugArtifacts = ['index.html', 'index.proto', 'reporter.bin']

const fontJobs = [
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

function buildMetaPath(key) {
  return path.join(outputRoot, key, 'build-meta.json')
}

function resultCssPath(key) {
  return path.join(outputRoot, key, 'result.css')
}

function hasGeneratedArtifacts() {
  return fontJobs.every(({ key }) => existsSync(resultCssPath(key)) && existsSync(buildMetaPath(key)))
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

async function writeBuildMeta({ key, weight, sourcePath, sourceBuffer }) {
  const meta = {
    version: 'judou-sans-se-wasm-v2',
    family: fontFamily,
    key,
    weight,
    sourceFile: path.relative(repoRoot, sourcePath).replaceAll(path.sep, '/'),
    sourceHash: createHash('sha256').update(sourceBuffer).digest('hex')
  }
  await writeFile(buildMetaPath(key), `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
}

async function buildFontSubset({ key, weight, sourceFile }) {
  const sourcePath = path.join(sourceDir, sourceFile)
  const outDir = path.join(outputRoot, key)
  const sourceBuffer = await readFile(sourcePath)

  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  await fontSplit({
    input: new Uint8Array(sourceBuffer),
    outDir,
    css: {
      fontFamily,
      fontWeight: weight,
      fontStyle: 'normal',
      fontDisplay: 'swap',
      localFamily: [fontFamily],
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
  await writeBuildMeta({ key, weight, sourcePath, sourceBuffer })
  console.log(`[fonts] Built ${key} (${weight}) from ${sourceFile}`)
}

async function main() {
  const missingSources = fontJobs.filter(({ sourceFile }) => !existsSync(path.join(sourceDir, sourceFile)))

  if (missingSources.length > 0) {
    if (hasGeneratedArtifacts()) {
      console.log(
        `[fonts] Missing local Judou source fonts (${missingSources.map(({ sourceFile }) => sourceFile).join(', ')}); using checked-in subsets.`
      )
      return
    }

    throw new Error(
      `Missing local Judou source fonts: ${missingSources.map(({ sourceFile }) => sourceFile).join(', ')}. ` +
      'Provide the four source weights locally or restore the generated subsets before running dev/build.'
    )
  }

  await mkdir(outputRoot, { recursive: true })

  for (const job of fontJobs) {
    await buildFontSubset(job)
  }
}

main().catch((error) => {
  console.error(`[fonts] ${error.message}`)
  process.exitCode = 1
})
