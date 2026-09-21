function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

export function encodeWavPCM16(
  samples: Float32Array,
  sampleRate: number
): ArrayBuffer {
  const dataBytes = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)

  writeString(view, 0, "RIFF")
  view.setUint32(4, 36 + dataBytes, true)
  writeString(view, 8, "WAVE")
  writeString(view, 12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, "data")
  view.setUint32(40, dataBytes, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return buffer
}

export async function blobToMono16kWav(blob: Blob): Promise<ArrayBuffer> {
  const arrayBuffer = await blob.arrayBuffer()
  const audioContext = new AudioContext()

  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer)
    const source = decoded.getChannelData(0)
    const sourceRate = decoded.sampleRate
    const targetRate = 16000

    const outLength = Math.ceil((source.length * targetRate) / sourceRate)
    const out = new Float32Array(outLength)

    for (let i = 0; i < outLength; i++) {
      const pos = (i * sourceRate) / targetRate
      const index = Math.floor(pos)
      const frac = pos - index
      const s0 = source[index] ?? 0
      const s1 = source[Math.min(index + 1, source.length - 1)] ?? s0
      out[i] = s0 + (s1 - s0) * frac
    }

    return encodeWavPCM16(out, targetRate)
  } finally {
    void audioContext.close()
  }
}