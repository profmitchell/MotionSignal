import React, { useMemo, useState } from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  XAxis, 
  YAxis, 
  ReferenceLine,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { ChannelState, AnalysisConfig } from '../types';

interface TimelineProps {
  channels: ChannelState[];
  duration: number;
  config: AnalysisConfig;
  currentTime: number;
  onScrub: (time: number) => void;
}

// Downsample large datasets for chart performance
const downsample = (channels: ChannelState[], points: number, duration: number) => {
  if (channels.length === 0) return [];
  const data: any[] = [];
  const step = Math.max(1, Math.floor(channels[0].processedValues.length / points));
  
  for (let i = 0; i < channels[0].processedValues.length; i += step) {
    const entry: any = { frame: i, time: (i / channels[0].processedValues.length) * duration };
    channels.forEach(ch => {
      if (ch.visible) {
        entry[ch.id] = ch.processedValues[i];
      }
    });
    data.push(entry);
  }
  return data;
};

const Timeline: React.FC<TimelineProps> = ({ channels, duration, config, currentTime, onScrub }) => {
  const [zoom, setZoom] = useState(1);
  
  // We want to show roughly 500-1000 points on screen for performance
  const displayData = useMemo(() => {
    return downsample(channels, 600 * zoom, duration);
  }, [channels, duration, zoom]);

  const handleChartClick = (e: any) => {
    if (e && e.activeLabel) {
       // activeLabel in Recharts is usually the X axis value (frame index here)
       // We need to convert back based on data structure
       // But clicking charts in Recharts is tricky. 
       // Better to use a container overlay for scrubbing if strict required.
       // For now, we will rely on the Tooltip to show time.
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800">
      <div className="h-8 flex items-center justify-between px-4 bg-zinc-800 border-b border-zinc-700 flex-shrink-0">
        <span className="text-xs font-mono text-zinc-400">VISUALIZATION</span>
        <div className="text-xs text-zinc-400 font-mono">
            {currentTime.toFixed(2)}s / {duration.toFixed(2)}s
        </div>
      </div>
      
      <div className="flex-1 relative min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%" debounce={50}>
          <ComposedChart 
            data={displayData} 
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            onMouseDown={(e) => e && e.activePayload && onScrub(e.activePayload[0].payload.time)}
          >
            <CartesianGrid stroke="#27272a" vertical={false} />
            <XAxis 
                dataKey="time" 
                type="number" 
                domain={[0, duration]} 
                hide 
            />
            <YAxis domain={[0, 1.2]} hide />
            <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', fontSize: '12px' }}
                itemStyle={{ padding: 0 }}
                labelFormatter={(t) => `Time: ${Number(t).toFixed(2)}s`}
            />
            
            {channels.map((ch) => (
               ch.visible && (
                <Line 
                    key={ch.id}
                    type="monotone"
                    dataKey={ch.id}
                    stroke={ch.color}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                />
               )
            ))}

            <ReferenceLine x={currentTime} stroke="white" strokeDasharray="3 3" />
          </ComposedChart>
        </ResponsiveContainer>
        
        {/* Playhead Overlay Click Capture (Simplified) */}
        <div 
            className="absolute inset-0 cursor-crosshair"
            onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const ratio = x / rect.width;
                onScrub(ratio * duration);
            }}
        />
      </div>
    </div>
  );
};

export default Timeline;