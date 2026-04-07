export type ModelSize = 'tiny' | 'base' | 'small' | 'medium' | 'large'

export interface ModelInfo {
  size: ModelSize
  label: string
  fileName: string
  fileSizeBytes: number
  downloaded: boolean
  path?: string
}

export interface DownloadProgress {
  size: ModelSize
  percent: number
  bytesDownloaded: number
  totalBytes: number
  speedBytesPerSec: number
  status: 'downloading' | 'complete' | 'error'
  error?: string
}
