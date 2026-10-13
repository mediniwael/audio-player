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
    compressor.threshold.value = -40;
    compressor.knee.value = 6;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

  highpass.connect(presence);
  presence.connect(compressor);

  return { input: highpass, output: compressor };
}