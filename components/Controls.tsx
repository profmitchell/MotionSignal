import React from 'react';
import { ChannelState, RefinementSettings } from '../types';

interface ControlsProps {
  selectedChannelId: string | null;
  channel: ChannelState | undefined;
  onUpdate: (id: string, settings: RefinementSettings) => void;
}

const Slider: React.FC<{ 
    label: string; 
    value: number; 
    min: number; 
    max: number; 
    step: number; 
    onChange: (val: number) => void; 
}> = ({ label, value, min, max, step, onChange }) => (
  <div className="flex flex-col space-y-1 mb-4">
    <div className="flex justify-between text-xs text-zinc-400 font-mono">
      <span>{label}</span>
      <span>{value.toFixed(2)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400"
    />
  </div>
);

const Controls: React.FC<ControlsProps> = ({ selectedChannelId, channel, onUpdate }) => {
  if (!selectedChannelId || !channel) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500 text-sm font-mono p-4 border-l border-zinc-800 bg-zinc-900/50 w-80 flex-shrink-0">
        Select a channel to refine
      </div>
    );
  }

  const update = (key: keyof RefinementSettings, value: any) => {
    onUpdate(selectedChannelId, { ...channel.settings, [key]: value });
  };

  return (
    <div className="h-full bg-zinc-900 border-l border-zinc-800 p-4 pb-32 overflow-y-auto w-80 flex-shrink-0">
        <h3 className="text-sm font-bold text-zinc-100 mb-6 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: channel.color }}></div>
            {channel.id.toUpperCase()}
        </h3>

        <div className="space-y-6">
            <section>
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Dynamics</h4>
                <Slider 
                    label="Gain" 
                    value={channel.settings.gain} 
                    min={0} max={5} step={0.1} 
                    onChange={(v) => update('gain', v)} 
                />
                <Slider 
                    label="Offset" 
                    value={channel.settings.offset} 
                    min={-1} max={1} step={0.05} 
                    onChange={(v) => update('offset', v)} 
                />
                 <Slider 
                    label="Gate Threshold" 
                    value={channel.settings.gate} 
                    min={0} max={1} step={0.01} 
                    onChange={(v) => update('gate', v)} 
                />
            </section>

            <section>
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Shaping</h4>
                <Slider 
                    label="Smooth (Attack/Release)" 
                    value={channel.settings.smooth} 
                    min={0} max={1} step={0.01} 
                    onChange={(v) => update('smooth', v)} 
                />
                
                <div className="flex items-center gap-2 mt-4">
                    <input 
                        type="checkbox" 
                        id="clip" 
                        checked={channel.settings.clip} 
                        onChange={(e) => update('clip', e.target.checked)}
                        className="rounded bg-zinc-700 border-zinc-600 text-cyan-500 focus:ring-0"
                    />
                    <label htmlFor="clip" className="text-xs text-zinc-300 font-mono">Soft Clip (0-1)</label>
                </div>
                 <div className="flex items-center gap-2 mt-2">
                    <input 
                        type="checkbox" 
                        id="invert" 
                        checked={channel.settings.invert} 
                        onChange={(e) => update('invert', e.target.checked)}
                        className="rounded bg-zinc-700 border-zinc-600 text-cyan-500 focus:ring-0"
                    />
                    <label htmlFor="invert" className="text-xs text-zinc-300 font-mono">Invert Output</label>
                </div>
            </section>

            <section>
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Rhythm</h4>
                 <Slider 
                    label="Quantize (Beat Div)" 
                    value={channel.settings.quantize} 
                    min={0} max={16} step={4} 
                    onChange={(v) => update('quantize', v)} 
                />
                <p className="text-[10px] text-zinc-500 -mt-2">0=Off, 4=1/4, 16=1/16</p>
            </section>
        </div>
    </div>
  );
};

export default Controls;