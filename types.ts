export interface AudioFile {
  id: string;
  file: File;
  name: string;
  type: 'master' | 'stem';
  duration: number;
  sampleRate: number;
  channels: number;
  buffer?: AudioBuffer;
}

export interface AnalysisConfig {
  fps: number;
  bpm: number;
  timeSignature: number; // e.g. 4 for 4/4
}

export interface RawChannelData {
  id: string;
  name: string;
  sourceId: string; // 'master' or stem ID
  values: Float32Array; // 0-1 values
  type: 'energy' | 'frequency' | 'rhythmic' | 'phase' | 'creative';
}

export interface RefinementSettings {
  gain: number; // 0 to 5
  offset: number; // -1 to 1
  smooth: number; // 0 to 1 (alpha)
  gate: number; // 0 to 1
  clip: boolean;
  invert: boolean;
  quantize: number; // 0 (off), 4, 8, 16
}

export interface ChannelState {
  id: string;
  settings: RefinementSettings;
  processedValues: Float32Array; // Cached processed result
  visible: boolean;
  color: string;
}

export interface ProjectData {
  config: AnalysisConfig;
  rawChannels: RawChannelData[];
  channelStates: Record<string, ChannelState>;
  events: {
    kicks: number[];
    snares: number[];
  }
}
