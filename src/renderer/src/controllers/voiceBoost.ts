export interface VoiceBoostChain {
  input: AudioNode;
  output: AudioNode;
}

export function buildVoiceBoostChain(ctx: AudioContext): VoiceBoostChain {
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 80;
  highpass.Q.value = 0.7;

  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 2500;
  presence.Q.value = 1.0;
  presence.gain.value = 4;

  const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -28;   // catch normal speech peaks
    compressor.knee.value      = 12;    // soft, musical transition
    compressor.ratio.value     = 4;     // gentle control, not limiting
    compressor.attack.value    = 0.006; // ~6ms — lets consonants through, catches peaks
    compressor.release.value   = 0.20;  // recovers before the next syllable

  highpass.connect(presence);
  presence.connect(compressor);

  return { input: highpass, output: compressor };
}