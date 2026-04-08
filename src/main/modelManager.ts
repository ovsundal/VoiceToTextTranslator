import { app } from 'electron'
import { existsSync, mkdirSync, renameSync, unlinkSync, statSync, createWriteStream } from 'fs'
import { join } from 'path'
import axios from 'axios'
import type { ModelSize, ModelInfo, DownloadProgress } from '../types/models'

const MODEL_META: Record<ModelSize, { label: string; fileName: string; fileSizeBytes: number; url: string }> = {
  tiny:   { label: 'Tiny (75 MB)',    fileName: 'ggml-tiny.bin',     fileSizeBytes:    75_000_000, url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin' },
  base:   { label: 'Base (142 MB)',   fileName: 'ggml-base.bin',     fileSizeBytes:   142_000_000, url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin' },
  small:  { label: 'Small (466 MB)',  fileName: 'ggml-small.bin',    fileSizeBytes:   466_000_000, url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin' },
  medium: { label: 'Medium (1.5 GB)', fileName: 'ggml-medium.bin',   fileSizeBytes: 1_500_000_000, url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin' },
  large:  { label: 'Large (3.1 GB)',  fileName: 'ggml-large-v3.bin', fileSizeBytes: 3_100_000_000, url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin' },
}

export function getModelsDir(): string {
  const dir = join(app.getPath('userData'), 'models')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function listModels(): ModelInfo[] {
  const dir = getModelsDir()
  return (Object.keys(MODEL_META) as ModelSize[]).map(size => {
    const meta = MODEL_META[size]
    const filePath = join(dir, meta.fileName)
    const downloaded = existsSync(filePath) &&
      statSync(filePath).size >= meta.fileSizeBytes * 0.99
    return {
      size,
      label: meta.label,
      fileName: meta.fileName,
      fileSizeBytes: meta.fileSizeBytes,
      downloaded,
      path: downloaded ? filePath : undefined,
    }
  })
}

export async function downloadModel(
  size: ModelSize,
  onProgress: (progress: DownloadProgress) => void
): Promise<void> {
  const meta = MODEL_META[size]
  const dir = getModelsDir()
  const finalPath = join(dir, meta.fileName)
  const tmpPath = `${finalPath}.tmp`

  const startTime = Date.now()
  let lastBytes = 0

  try {
    const response = await axios.get(meta.url, {
      responseType: 'stream',
      headers: { 'User-Agent': 'VoiceToTextTranslator/1.0' },
    })

    const totalBytes = parseInt(response.headers['content-length'] ?? '0', 10) || meta.fileSizeBytes
    const writer = createWriteStream(tmpPath)
    let bytesDownloaded = 0

    response.data.on('data', (chunk: Buffer) => {
      bytesDownloaded += chunk.length
      const elapsed = (Date.now() - startTime) / 1000
      const speedBytesPerSec = elapsed > 0 ? Math.round(bytesDownloaded / elapsed) : 0
      const percent = Math.round((bytesDownloaded / totalBytes) * 100)

      onProgress({ size, percent, bytesDownloaded, totalBytes, speedBytesPerSec, status: 'downloading' })
      lastBytes = bytesDownloaded
    })

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
      response.data.on('error', reject)
      response.data.pipe(writer)
    })

    renameSync(tmpPath, finalPath)
    onProgress({ size, percent: 100, bytesDownloaded: lastBytes, totalBytes, speedBytesPerSec: 0, status: 'complete' })
  } catch (err) {
    if (existsSync(tmpPath)) unlinkSync(tmpPath)
    const message = err instanceof Error ? err.message : String(err)
    onProgress({ size, percent: 0, bytesDownloaded: 0, totalBytes: meta.fileSizeBytes, speedBytesPerSec: 0, status: 'error', error: message })
    throw err
  }
}

export async function deleteModel(size: ModelSize): Promise<void> {
  const dir = getModelsDir()
  const fileName = MODEL_META[size].fileName
  const filePath = join(dir, fileName)
  const tmpPath = filePath + '.tmp'
  try { unlinkSync(filePath) } catch {}
  try { unlinkSync(tmpPath) } catch {}
}
