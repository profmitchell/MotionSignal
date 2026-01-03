
import React from 'react';
import { ChannelState, RefinementSettings } from '../types';

interface ControlsProps {
  selectedChannelId: string | null;
  channel: ChannelState | undefined;
  currentValue: number; // For visual feedback
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

const Controls: React.FC<ControlsProps> = ({ selectedChannelId, channel, currentValue, onUpdate }) => {
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
    <div className="h-full bg-zinc-900 border-l border-zinc-800 flex flex-col w-80 flex-shrink-0">
        <div className="p-4 border-b border-zinc-800">
            <h3 className="text-sm font-bold text-zinc-100 mb-4 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: channel.color }}></div>
                <span className="truncate">{channel.id.toUpperCase()}</span>
            </h3>

            {/* Signal Preview Box */}
            <div className="w-full aspect-square rounded-lg bg-zinc-950 border border-zinc-800 relative overflow-hidden mb-2">
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <span className="text-xs font-mono text-zinc-500 pointer-events-none">SIGNAL PREVIEW</span>
                </div>
                <div 
                    className="w-full h-full transition-colors duration-75"
                    style={{ 
                        backgroundColor: '#fff', 
                        opacity: Math.max(0, Math.min(1, currentValue)) 
                    }}
                />
            </div>
            <div className="text-center font-mono text-xs text-cyan-500">
                VAL: {currentValue.toFixed(3)}
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-32">
            <section className="mb-6">
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
                
                <div className="flex flex-col gap-3 mt-4">
                    <div className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            id="clip" 
                            checked={channel.settings.clip} 
                            onChange={(e) => update('clip', e.target.checked)}
                            className="rounded bg-zinc-700 border-zinc-600 text-cyan-500 focus:ring-0"
                        />
                        <label htmlFor="clip" className="text-xs text-zinc-300 font-mono">Soft Clip (0-1)</label>
                    </div>
                     <div className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            id="invert" 
                            checked={channel.settings.invert} 
                            onChange={(e) => update('invert', e.target.checked)}
                            className="rounded bg-zinc-700 border-zinc-600 text-cyan-500 focus:ring-0"
                        />
                        <label htmlFor="invert" className="text-xs text-zinc-300 font-mono">Invert Output</label>
                    </div>
                </div>
            </section>
        </div>
    </div>
  );
};

export default Controls;
