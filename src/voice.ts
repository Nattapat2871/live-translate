// Live Translate — clean up captured audio before speech recognition hears it
// Author / ผู้สร้าง: nattapat2871 (https://nattapat2871.me)
// Game audio (engines, explosions, gunfire) masks voices. This chain keeps the speech band, tames sudden
// peaks, lifts quiet talkers, and can add RNNoise (a small on-device noise-suppression model).

export interface VoiceOptions {
  filter: boolean // speech-band filter + compressor
  ai: boolean // RNNoise noise suppression
}

export interface CleanVoice {
  stream: MediaStream
  track: MediaStreamTrack
  close(): void
}

/** Returns a processed copy of `track`; the caller still owns and stops the original. */
export async function cleanVoice(track: MediaStreamTrack, opts: VoiceOptions): Promise<CleanVoice> {
  const ctx = new AudioContext({ sampleRate: 48000 }) // RNNoise assumes 48 kHz
  try {
    if (ctx.state === 'suspended') await ctx.resume()
    let node: AudioNode = ctx.createMediaStreamSource(new MediaStream([track]))
    const chain = (next: AudioNode) => {
      node.connect(next)
      node = next
    }

    let rnnoise: { destroy(): void } | undefined
    if (opts.ai) {
      // Loaded only when switched on, so the page itself stays light.
      const [lib, worklet, wasm, simd] = await Promise.all([
        import('@sapphi-red/web-noise-suppressor'),
        import('@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url'),
        import('@sapphi-red/web-noise-suppressor/rnnoise.wasm?url'),
        import('@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url'),
      ])
      const wasmBinary = await lib.loadRnnoise({ url: wasm.default, simdUrl: simd.default })
      await ctx.audioWorklet.addModule(worklet.default)
      const n = new lib.RnnoiseWorkletNode(ctx, { wasmBinary, maxChannels: 2 })
      rnnoise = n
      chain(n)
    }

    if (opts.filter) {
      for (let i = 0; i < 2; i++) {
        const hp = ctx.createBiquadFilter() // engine rumble, explosions, bass (two stages = steeper cut)
        hp.type = 'highpass'
        hp.frequency.value = 140
        hp.Q.value = 0.7
        chain(hp)
      }
      const lp = ctx.createBiquadFilter() // hiss and metallic gunfire tails above the voice range
      lp.type = 'lowpass'
      lp.frequency.value = 7000
      lp.Q.value = 0.7
      chain(lp)
      const presence = ctx.createBiquadFilter() // a little lift where consonants live
      presence.type = 'peaking'
      presence.frequency.value = 2500
      presence.Q.value = 1
      presence.gain.value = 4
      chain(presence)
      const comp = ctx.createDynamicsCompressor() // flatten gunshot peaks so quiet speech is not drowned out
      comp.threshold.value = -38
      comp.knee.value = 12
      comp.ratio.value = 10
      comp.attack.value = 0.002
      comp.release.value = 0.2
      chain(comp)
      const makeup = ctx.createGain()
      makeup.gain.value = 2.2
      chain(makeup)
    }

    const dest = ctx.createMediaStreamDestination()
    node.connect(dest)
    const out = dest.stream.getAudioTracks()[0]
    return {
      stream: dest.stream,
      track: out,
      close() {
        out.stop()
        rnnoise?.destroy()
        void ctx.close()
      },
    }
  } catch (e) {
    void ctx.close()
    throw e
  }
}

/** Audio inputs for the mic source, e.g. a virtual cable carrying only Discord. Labels appear once mic access was granted. */
export async function audioInputs(): Promise<{ id: string; label: string }[]> {
  try {
    const all = await navigator.mediaDevices.enumerateDevices()
    return all
      .filter(d => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications')
      .map(d => ({ id: d.deviceId, label: d.label }))
  } catch {
    return []
  }
}
