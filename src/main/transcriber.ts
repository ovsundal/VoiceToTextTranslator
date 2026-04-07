import { app } from 'electron'
import { join } from 'path'
import { spawn } from 'child_process'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'

export async function transcribe(
  wavBuffer: Buffer,
  modelPath: string,
  language: 'en' | 'no'
): Promise<string> {
  const tmpPath = join(tmpdir(), `vtt-${Date.now()}.wav`)

  try {
    writeFileSync(tmpPath, wavBuffer)

    const binaryPath = app.isPackaged
      ? join(process.resourcesPath, 'whisper', 'main.exe')
      : join(__dirname, '../../resources/whisper/main.exe')

    return await new Promise<string>((resolve, reject) => {
      const proc = spawn(binaryPath, ['-m', modelPath, '-f', tmpPath, '-l', language, '-nt'])

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString()
      })

      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `whisper.cpp exited with code ${code}`))
          return
        }

        const text = stdout
          .split('\n')
          .filter((line) => !line.trimStart().startsWith('['))
          .join('\n')
          .trim()

        resolve(text)
      })

      proc.on('error', (err) => {
        reject(err)
      })
    })
  } finally {
    if (existsSync(tmpPath)) {
      unlinkSync(tmpPath)
    }
  }
}
