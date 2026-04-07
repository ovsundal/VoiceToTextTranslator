declare module 'audiobuffer-to-wav' {
  export default function toWav(buffer: AudioBuffer, opts?: { float32?: boolean }): ArrayBuffer
}
