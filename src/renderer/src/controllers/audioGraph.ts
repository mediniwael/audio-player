import { buildVoiceBoostChain, type VoiceBoostChain } from './voiceBoost';
import { useStore } from '../store';

let ctx: AudioContext | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let boostChain: VoiceBoostChain | null = null;

let active: 'bypass' | 'boost' = 'bypass';

export function ensureGraph(mediaEl: HTMLMediaElement): void {
  if (ctx) return;

  ctx = new AudioContext();
  sourceNode = ctx.createMediaElementSource(mediaEl);
  boostChain = buildVoiceBoostChain(ctx);

  const wantBoost = useStore.getState().voiceBoost;
  active = wantBoost ? 'boost' : 'bypass';

  connectActive();
}

export function setVoiceBoost(enabled: boolean): void {
  if (!ctx || !sourceNode) return;
  active = enabled ? 'boost' : 'bypass';
  connectActive();
}

export async function resumeContextIfNeeded(): Promise<void> {
  if (ctx && ctx.state === 'suspended') {
    await ctx.resume();
  }
}

export function isGraphReady(): boolean {
  return ctx !== null;
}

function connectActive(): void {
  if (!sourceNode || !ctx || !boostChain) return;
  sourceNode.disconnect();
  boostChain.output.disconnect();   // ← add this

  if (active === 'bypass') {
    sourceNode.connect(ctx.destination);
  } else {
    sourceNode.connect(boostChain.input);
    boostChain.output.connect(ctx.destination);
  }
}