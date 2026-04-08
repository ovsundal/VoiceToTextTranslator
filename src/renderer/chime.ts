export function playChime(type: 'start' | 'stop'): void {
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.connect(gain)
  gain.connect(ctx.destination)

  const now = ctx.currentTime
  if (type === 'start') {
    osc.frequency.setValueAtTime(660, now)
    osc.frequency.linearRampToValueAtTime(880, now + 0.12)
  } else {
    osc.frequency.setValueAtTime(880, now)
    osc.frequency.linearRampToValueAtTime(440, now + 0.18)
  }

  gain.gain.setValueAtTime(0.18, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)

  osc.start(now)
  osc.stop(now + 0.25)
  osc.onended = () => ctx.close()
}
