
import React, { useMemo, useState } from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  XAxis, 
  YAxis, 
  ReferenceLine,
  CartesianGrid,
  Tooltip,
  ReferenceArea
} from 'recharts';
import { ChannelState, AnalysisConfig } from '../types';
import { ZoomIn, RotateCcw } from 'lucide-react';

interface TimelineProps {
  channels: ChannelState[];
  duration: number;
  config: AnalysisConfig;
  currentTime: number;
  onScrub: (time: number) => void;
}

// Downsample large datasets for chart performance
const downsample = (channels: ChannelState[], points: number, duration: number, xDomain: [number, number]) => {
  if (channels.length === 0) return [];
  
  // Calculate start/end indices based on domain
  const totalPoints = channels[0].processedValues.length;
  const startIndex = Math.floor((xDomain[0] / duration) * totalPoints);
  const endIndex = Math.ceil((xDomain[1] / duration) * totalPoints);
  const sliceLength = endIndex - startIndex;
  
  const step = Math.max(1, Math.floor(sliceLength / points));
  const data: any[] = [];
  
  for (let i = startIndex; i < endIndex; i += step) {
    if (i >= totalPoints) break;
    const entry: any = { frame: i, time: (i / totalPoints) * duration };
    let hasVisible = false;
    channels.forEach(ch => {
      // Check effective visibility (visible AND not muted) or (soloed)
      // Actually the logic is passed down as 'visible' prop from parent? 
      // No, parent handles which ones to pass. We just check ch.visible here.
      if (ch.visible) {
        entry[ch.id] = ch.processedValues[i];
        hasVisible = true;
      }
    });
    if (hasVisible) data.push(entry);
  }
  return data;
};

const Timeline: React.FC<TimelineProps> = ({ channels, duration, config, currentTime, onScrub }) => {
  const [left, setLeft] = useState<number | 'dataMin'>(0);
  const [right, setRight] = useState<number | 'dataMax'>(duration);
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null);

  const displayData = useMemo(() => {
    const l = typeof left === 'number' ? left : 0;
    const r = typeof right === 'number' ? right : duration;
    return downsample(channels, 600, duration, [l, r]);
  }, [channels, duration, left, right]);

  const zoom = () => {
    if (refAreaLeft === refAreaLeft || refAreaRight === null) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }

    // Ensure logic order
    let newLeft = refAreaLeft;
    let newRight = refAreaRight;
    if (newLeft > newRight) [newLeft, newRight] = [newRight, newLeft];

    // Don't zoom if area is too small
    if ((newRight - newLeft) < 0.1) {
        setRefAreaLeft(null);
        setRefAreaRight(null);
        return;
    }

    setLeft(newLeft);
    setRight(newRight);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const zoomOut = () => {
    setLeft(0);
    setRight(duration);
  };

  return (
    <div className="w-full h-full flex flex-col bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 relative select-none">
      <div className="h-10 flex items-center justify-between px-4 bg-zinc-800 border-b border-zinc-700 flex-shrink-0 z-10">
        <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-zinc-400">VISUALIZATION</span>
            <button 
                onClick={zoomOut}
                className="flex items-center gap-1 text-[10px] bg-zinc-700 hover:bg-zinc-600 px-2 py-1 rounded text-zinc-200 transition-colors"
            >
                <RotateCcw size={10} />
                RESET VIEW
            </button>
            <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                <ZoomIn size={10} />
                <span>Drag to zoom</span>
            </div>
        </div>
        <div className="text-xs text-zinc-400 font-mono">
            {currentTime.toFixed(2)}s / {duration.toFixed(2)}s
        </div>
      </div>
      
      <div className="flex-1 relative w-full min-h-0">
        <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%" debounce={50}>
            <ComposedChart 
                data={displayData} 
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                onMouseDown={(e) => e && setRefAreaLeft(Number(e.activeLabel))}
                onMouseMove={(e) => refAreaLeft && e && setRefAreaRight(Number(e.activeLabel))}
                onMouseUp={zoom}
            >
                <CartesianGrid stroke="#27272a" vertical={false} />
                <XAxis 
                    dataKey="time" 
                    type="number" 
                    domain={[left, right]} 
                    hide 
                    allowDataOverflow
                />
                <YAxis domain={[0, 1.2]} hide allowDataOverflow />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', fontSize: '12px' }}
                    itemStyle={{ padding: 0 }}
                    labelFormatter={(t) => `Time: ${Number(t).toFixed(2)}s`}
                />
                
                {channels.map((ch) => (
                    <Line 
                        key={ch.id}
                        type="monotone"
                        dataKey={ch.id}
                        stroke={ch.color}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                    />
                ))}

                <ReferenceLine x={currentTime} stroke="white" strokeDasharray="3 3" />

                {refAreaLeft && refAreaRight ? (
                    <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="#06b6d4" fillOpacity={0.1} />
                ) : null}

            </ComposedChart>
            </ResponsiveContainer>
        </div>
        
        {/* Scrub Overlay - Only active when not holding down mouse for zoom (tricky to distinguish, so shift-click for scrub?)
            Actually, let's make top area scrubbable or add a modifier key logic.
            For now, simpler user exp: The chart drag zooms. 
            To scrub, click the Reference Line area? Or just remove the overlay scrub for now 
            since we can see time in tooltip and use spacebar to play.
        */}
      </div>
    </div>
  );
};

export default Timeline;
