import toWav from 'audiobuffer-to-wav'

export async function recordAudio(): Promise<{ start: () => void; stop: () => Promise<ArrayBuffer> }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  const mediaRecorder = new MediaRecorder(stream)
  const chunks: Blob[] = []

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data)
    }
  }

  function start() {
    mediaRecorder.start()
  }

  function stop(): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())

        if (chunks.length === 0) {
          reject(new Error('No audio captured — try holding Record longer'))
          return
        }

        const blob = new Blob(chunks)
        const audioCtx = new AudioContext()

        try {
          const decoded = await audioCtx.decodeAudioData(await blob.arrayBuffer())
          const targetSampleRate = 16000
          const offlineCtx = new OfflineAudioContext(
            1,
            Math.ceil(decoded.duration * targetSampleRate),
            targetSampleRate
          )
          const source = offlineCtx.createBufferSource()
          source.buffer = decoded
          source.connect(offlineCtx.destination)
          source.start(0)
          const rendered = await offlineCtx.startRendering()
          resolve(toWav(rendered))
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Failed to process audio'))
        } finally {
          audioCtx.close()
        }
      }

      mediaRecorder.stop()
    })
  }

  return { start, stop }
}
