
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { 
  AudioFile, 
  AnalysisConfig, 
  ChannelState, 
  RefinementSettings, 
  RawChannelData 
} from './types';
import { DEFAULT_CONFIG, DEFAULT_REFINEMENT, COLORS } from './constants';
import { decodeAudioFile, analyzeAudioBuffer, refineChannel } from './services/dsp';
import Timeline from './components/Timeline';
import Controls from './components/Controls';
import { Upload, Music, Settings, Download, Play, Pause, Activity, FileJson, FileCode } from 'lucide-react';

export default function App() {
  const [view, setView] = useState<'import' | 'analyze' | 'refine'>('import');
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [config, setConfig] = useState<AnalysisConfig>(DEFAULT_CONFIG);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);

  // Refinement State
  const [rawChannels, setRawChannels] = useState<RawChannelData[]>([]);
  const [channelStates, setChannelStates] = useState<ChannelState[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false); // Visualization play only, no audio
  const playReqRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: AudioFile[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        newFiles.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          name: file.name,
          type: files.length === 0 ? 'master' : 'stem',
          duration: 0,
          sampleRate: 0,
          channels: 0
        });
      }
      setFiles([...files, ...newFiles]);
    }
  };

  const startAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalyzeProgress(0);
    const results: RawChannelData[] = [];
    
    try {
      for (let i = 0; i < files.length; i++) {
        setAnalyzeProgress(((i) / files.length) * 50);
        const f = files[i];
        const buffer = await decodeAudioFile(f.file);
        
        f.duration = buffer.duration;
        f.sampleRate = buffer.sampleRate;
        f.channels = buffer.numberOfChannels;
        f.buffer = buffer; 
        
        setAnalyzeProgress(((i + 0.5) / files.length) * 100);
        const channels = await analyzeAudioBuffer(buffer, config, f.type === 'master' ? 'master' : f.id, f.name.replace('.wav', ''));
        results.push(...channels);
      }
      
      setRawChannels(results);
      
      const initialStates: ChannelState[] = results.map((raw, idx) => ({
        id: raw.id,
        settings: { ...DEFAULT_REFINEMENT },
        processedValues: raw.values,
        visible: true,
        mute: false,
        solo: false,
        color: COLORS[idx % COLORS.length]
      }));
      setChannelStates(initialStates);
      setSelectedChannelId(results[0]?.id);
      
      setAnalyzeProgress(100);
      setTimeout(() => setView('refine'), 500);
    } catch (err) {
      console.error(err);
      alert("Error analyzing audio. Check console.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateRefinement = useCallback((id: string, settings: RefinementSettings) => {
    setChannelStates(prev => prev.map(ch => {
      if (ch.id === id) {
        const raw = rawChannels.find(r => r.id === id);
        if (!raw) return ch;
        const processed = refineChannel(raw.values, settings, config.bpm, config.fps);
        return { ...ch, settings, processedValues: processed };
      }
      return ch;
    }));
  }, [rawChannels, config]);

  const toggleChannelState = (id: string, key: 'visible' | 'mute' | 'solo') => {
    setChannelStates(prev => {
        // Handle Exclusive Solo Logic? Or additive? Additive is more DAW-like usually.
        // Let's keep it simple.
        return prev.map(ch => ch.id === id ? { ...ch, [key]: !ch[key] } : ch);
    });
  };

  // Compute actual visible channels based on Mute/Solo
  const visibleChannels = useMemo(() => {
    const anySolo = channelStates.some(ch => ch.solo);
    return channelStates.map(ch => {
        // If the eye is off, it's off.
        if (!ch.visible) return { ...ch, visible: false };

        // If any channel is soloed
        if (anySolo) {
            return { ...ch, visible: ch.solo };
        }
        
        // Otherwise check mute
        return { ...ch, visible: !ch.mute };
    });
  }, [channelStates]);

  // Current value for the "Signal Preview" box
  const currentSignalValue = useMemo(() => {
    if (!selectedChannelId) return 0;
    const ch = channelStates.find(c => c.id === selectedChannelId);
    if (!ch) return 0;
    const frame = Math.floor(currentTime * config.fps);
    if (frame >= 0 && frame < ch.processedValues.length) {
        return ch.processedValues[frame];
    }
    return 0;
  }, [selectedChannelId, currentTime, channelStates, config.fps]);


  useEffect(() => {
    const animate = (time: number) => {
      if (lastTimeRef.current !== undefined) {
        const delta = (time - lastTimeRef.current) / 1000;
        setCurrentTime(prev => {
            const next = prev + delta;
            const maxDur = Math.max(...files.map(f => f.duration || 0)) || 10;
            return next > maxDur ? 0 : next;
        });
      }
      lastTimeRef.current = time;
      if (isPlaying) {
        playReqRef.current = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) {
        lastTimeRef.current = performance.now();
        playReqRef.current = requestAnimationFrame(animate);
    } else {
        cancelAnimationFrame(playReqRef.current!);
    }
    return () => cancelAnimationFrame(playReqRef.current!);
  }, [isPlaying, files]);

  const exportData = () => {
    if (!channelStates.length) return;
    const jsonName = `motion_data_${config.bpm}bpm.json`;
    
    // 1. JSON Export
    const exportObj = {
        metadata: {
            fps: config.fps,
            bpm: config.bpm,
            duration: rawChannels[0].values.length / config.fps,
            createdAt: new Date().toISOString(),
            generator: "MotionSignal v1.0"
        },
        channels: {} as Record<string, number[]>
    };

    channelStates.forEach(ch => {
        exportObj.channels[ch.id] = Array.from(ch.processedValues).map(v => Number(v.toFixed(4)));
    });

    const blob = new Blob([JSON.stringify(exportObj)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = jsonName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // 2. ExtendScript (.jsx) Export
    setTimeout(() => {
        let script = `
        {
            app.beginUndoGroup("Create Motion Controller");
            
            // 1. Find JSON Footage Item
            var proj = app.project;
            var jsonItem = null;
            
            // Check selection first
            if (proj.selection.length > 0) {
                if (proj.selection[0].name.indexOf(".json") !== -1) {
                    jsonItem = proj.selection[0];
                }
            }
            
            if (!jsonItem) {
                // Try to find by name
                for (var i = 1; i <= proj.numItems; i++) {
                    if (proj.item(i).name === "${jsonName}") {
                        jsonItem = proj.item(i);
                        break;
                    }
                }
            }
            
            if (!jsonItem) {
                alert("Please import and select '${jsonName}' in the project bin before running this script.");
            } else {
                // 2. Get/Create Comp
                var comp = proj.activeItem;
                if (!comp || !(comp instanceof CompItem)) {
                    // Create a comp if none active
                    comp = proj.items.addComp("Motion Data Comp", 1920, 1080, 1, ${rawChannels[0].values.length / config.fps}, ${config.fps});
                    comp.openInViewer();
                }
                
                // 3. Create Controller
                var controllerName = "MOTION_CONTROLLER";
                var layer = comp.layers.addNull();
                layer.name = controllerName;
                layer.label = 11; // Orange label
                
                // 4. Add Sliders & Expressions
        `;

        channelStates.forEach(ch => {
            script += `
                var s = layer.Effects.addProperty("ADBE Slider Control");
                s.name = "${ch.id}";
                s.property(1).expression = 'try { footage("' + jsonItem.name + '").sourceData.channels["${ch.id}"][timeToFrames(time)] * 100 } catch(e) { 0; }';
            `;
        });

        script += `
            }
            app.endUndoGroup();
        }
        `;

        const scriptBlob = new Blob([script], { type: 'text/javascript' });
        const scriptUrl = URL.createObjectURL(scriptBlob);
        const sa = document.createElement('a');
        sa.href = scriptUrl;
        sa.download = "Create_AE_Controller.jsx";
        document.body.appendChild(sa);
        sa.click();
        document.body.removeChild(sa);
        URL.revokeObjectURL(scriptUrl);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans">
        {/* Header */}
        <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950 flex-shrink-0">
            <div className="flex items-center gap-2">
                <Activity className="text-cyan-500" size={20} />
                <h1 className="font-bold tracking-tight text-lg">MotionSignal</h1>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
                <span>FPS: {config.fps}</span>
                <span>BPM: {config.bpm}</span>
            </div>
        </header>

        {/* Views */}
        <main className="flex-1 overflow-hidden relative">
            
            {view === 'import' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 space-y-8 animate-in fade-in duration-500">
                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold text-white">Import Audio</h2>
                        <p className="text-zinc-500">Drag WAV master and stems here to begin.</p>
                    </div>
                    
                    <div className="relative group">
                        <input 
                            type="file" 
                            multiple 
                            accept="audio/wav,audio/mp3"
                            onChange={handleFileUpload} 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="w-96 h-64 border-2 border-dashed border-zinc-700 rounded-2xl flex flex-col items-center justify-center space-y-4 group-hover:border-cyan-500 group-hover:bg-zinc-900 transition-colors">
                            <Upload className="text-zinc-600 group-hover:text-cyan-500" size={48} />
                            <span className="text-sm font-mono text-zinc-500">Drop files or click to browse</span>
                        </div>
                    </div>

                    {files.length > 0 && (
                        <div className="w-96 space-y-2">
                            {files.map(f => (
                                <div key={f.id} className="flex items-center justify-between p-3 bg-zinc-900 rounded border border-zinc-800">
                                    <div className="flex items-center gap-3">
                                        <Music size={16} className="text-zinc-500" />
                                        <span className="text-sm truncate w-48">{f.name}</span>
                                    </div>
                                    <span className="text-[10px] uppercase font-bold text-zinc-600 bg-zinc-950 px-2 py-1 rounded">{f.type}</span>
                                </div>
                            ))}
                            <button 
                                onClick={() => setView('analyze')}
                                className="w-full mt-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded shadow-lg shadow-cyan-900/20 transition-all"
                            >
                                Next: Configure Analysis
                            </button>
                        </div>
                    )}
                </div>
            )}

            {view === 'analyze' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 space-y-8 animate-in fade-in slide-in-from-right-10 duration-500">
                    <div className="w-96 bg-zinc-900 border border-zinc-800 p-6 rounded-xl space-y-6">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Settings className="text-cyan-500" size={20} />
                            Configuration
                        </h2>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-mono text-zinc-400 mb-1">Target FPS</label>
                                <input 
                                    type="number" 
                                    value={config.fps} 
                                    onChange={(e) => setConfig({...config, fps: parseInt(e.target.value)})}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white focus:border-cyan-500 outline-none"
                                />
                                <p className="text-[10px] text-zinc-600 mt-1">Match your AE Comp FPS (usually 24, 30, or 60)</p>
                            </div>
                            <div>
                                <label className="block text-xs font-mono text-zinc-400 mb-1">BPM</label>
                                <input 
                                    type="number" 
                                    value={config.bpm} 
                                    onChange={(e) => setConfig({...config, bpm: parseInt(e.target.value)})}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white focus:border-cyan-500 outline-none"
                                />
                            </div>
                        </div>

                        {isAnalyzing ? (
                             <div className="space-y-2">
                                <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden">
                                    <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${analyzeProgress}%` }}></div>
                                </div>
                                <p className="text-center text-xs text-zinc-500 animate-pulse">Analyzing audio dynamics...</p>
                             </div>
                        ) : (
                            <button 
                                onClick={startAnalysis}
                                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded"
                            >
                                Run Analysis
                            </button>
                        )}
                    </div>
                </div>
            )}

            {view === 'refine' && (
                <div className="absolute inset-0 flex flex-row animate-in fade-in duration-700">
                    {/* Sidebar Channels */}
                    <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col min-h-0 z-20">
                        <div className="p-4 border-b border-zinc-800">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Channels</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {channelStates.map(ch => (
                                <div 
                                    key={ch.id}
                                    onClick={() => setSelectedChannelId(ch.id)}
                                    className={`
                                        flex items-center gap-2 p-2 rounded cursor-pointer transition-colors group
                                        ${selectedChannelId === ch.id ? 'bg-zinc-800 ring-1 ring-zinc-700' : 'hover:bg-zinc-800/50'}
                                    `}
                                >
                                    <div 
                                        className={`w-3 h-3 rounded-full border border-zinc-950 shadow-sm flex-shrink-0 cursor-pointer`}
                                        style={{ backgroundColor: ch.color }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleChannelState(ch.id, 'visible');
                                        }}
                                    >
                                        {!ch.visible && <div className="w-full h-full bg-zinc-950 rounded-full opacity-80" />}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-medium truncate ${selectedChannelId === ch.id ? 'text-zinc-100' : 'text-zinc-400'}`}>
                                            {ch.id}
                                        </p>
                                    </div>

                                    {/* Mute / Solo Buttons */}
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); toggleChannelState(ch.id, 'mute'); }}
                                            className={`text-[9px] w-4 h-4 rounded flex items-center justify-center font-bold ${ch.mute ? 'bg-red-500/20 text-red-500' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}
                                        >
                                            M
                                        </button>
                                        <button 
                                             onClick={(e) => { e.stopPropagation(); toggleChannelState(ch.id, 'solo'); }}
                                            className={`text-[9px] w-4 h-4 rounded flex items-center justify-center font-bold ${ch.solo ? 'bg-yellow-500/20 text-yellow-500' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}
                                        >
                                            S
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Main Area */}
                    <div className="flex-1 flex flex-col bg-zinc-950 min-w-0 min-h-0">
                        {/* Toolbar */}
                        <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-950 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setIsPlaying(!isPlaying)}
                                    className="p-2 hover:bg-zinc-800 rounded-full text-zinc-200 transition-colors"
                                >
                                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                                </button>
                                <span className="text-xs font-mono text-zinc-500 ml-2">SPACE to toggle</span>
                            </div>
                            <button 
                                onClick={exportData}
                                className="flex items-center gap-2 px-4 py-1.5 bg-cyan-900/30 text-cyan-400 border border-cyan-900/50 rounded hover:bg-cyan-900/50 transition-colors text-sm font-medium"
                            >
                                <Download size={16} />
                                Export JSON + Script
                            </button>
                        </div>

                        {/* Visualizer */}
                        <div className="flex-1 p-4 overflow-hidden relative min-h-0">
                            {rawChannels.length > 0 && (
                                <Timeline 
                                    channels={visibleChannels} 
                                    duration={files.reduce((acc, f) => Math.max(acc, f.duration), 0)}
                                    config={config}
                                    currentTime={currentTime}
                                    onScrub={setCurrentTime}
                                />
                            )}
                        </div>
                    </div>

                    {/* Right Controls */}
                    <Controls 
                        selectedChannelId={selectedChannelId} 
                        channel={channelStates.find(c => c.id === selectedChannelId)}
                        currentValue={currentSignalValue}
                        onUpdate={updateRefinement}
                    />
                </div>
            )}

        </main>
    </div>
  );
}
