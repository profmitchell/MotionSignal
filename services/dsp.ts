
import { AnalysisConfig, RawChannelData, RefinementSettings } from '../types';

/**
 * Reads a File object and decodes it into an AudioBuffer
 */
export const decodeAudioFile = async (file: File): Promise<AudioBuffer> => {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  return await audioContext.decodeAudioData(arrayBuffer);
};

/**
 * Analyzes an AudioBuffer to extract motion features
 */
export const analyzeAudioBuffer = async (
  buffer: AudioBuffer,
  config: AnalysisConfig,
  sourceId: string,
  sourceName: string
): Promise<RawChannelData[]> => {
  const channelDataL = buffer.getChannelData(0);
  const channelDataR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : channelDataL;
  
  const duration = buffer.duration;
  const totalFrames = Math.ceil(duration * config.fps);
  const samplesPerFrame = Math.floor(buffer.sampleRate / config.fps);
  
  const energy = new Float32Array(totalFrames);
  const low = new Float32Array(totalFrames);
  const mid = new Float32Array(totalFrames);
  const high = new Float32Array(totalFrames);
  const brightness = new Float32Array(totalFrames);
  const width = new Float32Array(totalFrames);
  const transient = new Float32Array(totalFrames);

  // Filters state
  let lpState = 0;
  // Highpass state is derived
  const lpAlpha = 0.15; // Approx for low end
  
  for (let f = 0; f < totalFrames; f++) {
    const start = f * samplesPerFrame;
    const end = Math.min(start + samplesPerFrame, channelDataL.length);
    
    let sumSq = 0;
    let sumLow = 0;
    let sumHigh = 0;
    let sumDiff = 0; // For stereo width
    
    // Transient detection helpers
    let localMax = 0;
    let localMin = 0;

    for (let i = start; i < end; i++) {
      const sampleL = channelDataL[i];
      const sampleR = channelDataR[i];
      const mono = (sampleL + sampleR) * 0.5;

      // Stereo Width (Difference)
      const diff = Math.abs(sampleL - sampleR);
      sumDiff += diff;
      
      // Lowpass (Simple Exponential)
      lpState += (mono - lpState) * lpAlpha;
      const lowFreq = lpState;
      const highFreq = mono - lpState;
      
      sumSq += mono * mono;
      sumLow += lowFreq * lowFreq;
      sumHigh += highFreq * highFreq;
      
      if (Math.abs(mono) > localMax) localMax = Math.abs(mono);
    }

    const rms = Math.sqrt(sumSq / (end - start));
    const rmsLow = Math.sqrt(sumLow / (end - start));
    const rmsHigh = Math.sqrt(sumHigh / (end - start));
    const avgDiff = sumDiff / (end - start);

    energy[f] = Math.min(1, rms * 4);
    low[f] = Math.min(1, rmsLow * 5);
    high[f] = Math.min(1, rmsHigh * 8);
    // Mid is roughly total minus high and low overlap
    mid[f] = Math.max(0, energy[f] - (low[f] * 0.4) - (high[f] * 0.4));
    
    // Brightness: Ratio of High to Total Energy
    const totalSpec = rmsLow + rmsHigh + 0.001;
    brightness[f] = Math.min(1, (rmsHigh / totalSpec) * 2);

    // Width: Normalized difference
    width[f] = Math.min(1, avgDiff * 4);
    
    // Transient/Punch: Rate of change of energy from previous frame
    if (f > 0) {
        const delta = energy[f] - energy[f-1];
        transient[f] = delta > 0 ? Math.min(1, delta * 4) : 0;
    }
  }

  // Derived: Beat Phase
  const beatPhase = new Float32Array(totalFrames);
  const barPhase = new Float32Array(totalFrames);
  const secondsPerBeat = 60 / config.bpm;
  
  for (let f = 0; f < totalFrames; f++) {
    const time = f / config.fps;
    const beats = time / secondsPerBeat;
    beatPhase[f] = beats % 1;
    barPhase[f] = (beats / config.timeSignature) % 1;
  }

  // Prefix naming
  const prefix = sourceId === 'master' ? '' : `${sourceName}_`;

  return [
    { id: `${prefix}energy`, name: `${sourceName} Energy`, sourceId, values: energy, type: 'energy' },
    { id: `${prefix}low`, name: `${sourceName} Low`, sourceId, values: low, type: 'energy' },
    { id: `${prefix}mid`, name: `${sourceName} Mid`, sourceId, values: mid, type: 'energy' },
    { id: `${prefix}high`, name: `${sourceName} High`, sourceId, values: high, type: 'energy' },
    { id: `${prefix}transient`, name: `${sourceName} Punch`, sourceId, values: transient, type: 'rhythmic' },
    { id: `${prefix}brightness`, name: `${sourceName} Bright`, sourceId, values: brightness, type: 'creative' },
    { id: `${prefix}width`, name: `${sourceName} Width`, sourceId, values: width, type: 'creative' },
    // Only generate phase for master
    ...(sourceId === 'master' ? [
        { id: `beat_phase`, name: `Beat Phase`, sourceId, values: beatPhase, type: 'phase' },
        { id: `bar_phase`, name: `Bar Phase`, sourceId, values: barPhase, type: 'phase' },
    ] : [])
  ] as RawChannelData[];
};

/**
 * Applies refinement settings. Optimized loop.
 */
export const refineChannel = (
  raw: Float32Array,
  settings: RefinementSettings,
  bpm: number,
  fps: number
): Float32Array => {
  const result = new Float32Array(raw.length);
  let smoothed = 0;
  // Map smooth 0-1 to an alpha value.
  const alpha = 1 - Math.pow(settings.smooth, 0.5) * 0.95; 

  for (let i = 0; i < raw.length; i++) {
    let val = raw[i];

    // Gate
    if (val < settings.gate) val = 0;

    // Gain & Offset
    val = (val + settings.offset) * settings.gain;

    // Smoothing (Low pass)
    smoothed = (smoothed * (1 - alpha)) + (val * alpha);
    let final = smoothed;

    // Clip
    if (settings.clip) {
      final = Math.max(0, Math.min(1, final));
    } else {
      final = Math.max(0, final); // Always clamp bottom at 0
    }

    if (settings.invert) {
        final = 1 - final;
    }

    result[i] = final;
  }
  return result;
};
