/****************************************************** 
 * LICENCE : GEMINI 3 PRO PREVIEW OUTPUT
*******************************************************/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Play, RotateCcw, Pause, Users, Activity, ArrowUp } from 'lucide-react';

// --- Math Helpers ---

// Box-Muller transform for normal distribution
const randomNormal = (mean, stdDev) => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdDev + mean;
};

// Constants
const STEP_DEPTH = 0.4; // meters
const STANDING_GAP = 0.4; // meters (1 step per person)
const WALKING_GAP = 1.2; // meters (3 steps spacing to allow walking)
const UPDATE_INTERVAL = 1000; // Update stats every 1 second

const Gemini3ProViz = () => {
  // --- State : Inputs ---
  const [strategy, setStrategy] = useState(2); // 1: All Stand, 2: Walk/Stand
  const [escLength, setEscLength] = useState(20); // meters
  const [escSpeed, setEscSpeed] = useState(0.5); // m/s
  const [arrivalRate, setArrivalRate] = useState(60); // people per minute
  const [walkPct, setWalkPct] = useState(50); // % of people who WANT to walk
  const [avgWalkSpeed, setAvgWalkSpeed] = useState(0.8); // m/s (relative to steps)
  const [walkSpeedStdDev, setWalkSpeedStdDev] = useState(0.2); // variance

  // --- State : Simulation Status ---
  const [isRunning, setIsRunning] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [stats, setStats] = useState({
    totalExited: 0,
    avgThroughput: 0, // people per minute
    queueSize: 0,
    onEscalator: 0,
  });
  const [chartData, setChartData] = useState([]);

  // --- Refs for Simulation Engine (Mutable state for performance) ---
  const canvasRef = useRef(null);
  const requestRef = useRef();
  const engineState = useRef({
    lastFrameTime: 0,
    totalTime: 0,
    spawnTimer: 0,
    people: [], // Array of person objects
    exitedCount: 0,
    history: [],
    lastStatUpdate: 0,
  });

  // --- The Physics Engine ---
  
  const spawnPerson = () => {
    const state = engineState.current;
    
    // Determine Lane and Behavior
    let lane = 0; // 0: Left, 1: Right
    let isWalking = false;
    let speed = 0; // walking speed
    
    if (strategy === 1) {
      // Strategy 1: Everyone Stands. Fill shortest queue (or random if equal)
      // We simulate queues by checking the last person's position in that lane
      // For visual simplicity in this engine, we assign lane randomly for balance
      lane = Math.random() > 0.5 ? 1 : 0;
      isWalking = false;
    } else {
      // Strategy 2: Right Stand, Left Walk
      const wantsToWalk = Math.random() < (walkPct / 100);
      if (wantsToWalk) {
        lane = 0; // Left
        isWalking = true;
        // Assign walking speed
        speed = Math.max(0.1, randomNormal(avgWalkSpeed, walkSpeedStdDev));
      } else {
        lane = 1; // Right
        isWalking = false;
      }
    }

    // Initial Position: Negative value represents queuing area
    // Find last person in this lane in the queue
    const lastInLane = state.people.filter(p => p.lane === lane && p.pos < 0).sort((a, b) => a.pos - b.pos)[0];
    
    let startPos = -0.5; // Start just below escalator
    if (lastInLane) {
      startPos = lastInLane.pos - 0.5; // Queue up 0.5m behind
    }

    state.people.push({
      id: Math.random(),
      lane,
      isWalking,
      desiredWalkSpeed: speed,
      currentWalkSpeed: isWalking ? speed : 0,
      pos: startPos,
      color: isWalking ? '#ef4444' : '#3b82f6' // Red walker, Blue stander
    });
  };

  const updatePhysics = (dt) => {
    const state = engineState.current;
    
    // 1. Spawn Logic
    const arrivalInterval = 60 / arrivalRate; // seconds per person
    state.spawnTimer += dt;
    if (state.spawnTimer > arrivalInterval) {
      // Handle batch arrivals if rate is high
      while (state.spawnTimer > arrivalInterval) {
        spawnPerson();
        state.spawnTimer -= arrivalInterval;
      }
    }

    // 2. Movement Logic
    // Sort people by position descending (closest to top first) to handle blocking from top-down
    state.people.sort((a, b) => b.pos - a.pos);

    // Track occupancy per lane to manage collisions
    let lastPosLane0 = Infinity; // Left
    let lastPosLane1 = Infinity; // Right

    state.people.forEach(p => {
      const gapReq = p.isWalking ? WALKING_GAP : STANDING_GAP;
      const barrier = (p.lane === 0 ? lastPosLane0 : lastPosLane1) - gapReq;

      // Base speed: Escalator Speed
      // Added speed: Walk speed (if pos > 0 i.e., on escalator)
      let moveSpeed = 0;

      if (p.pos < 0) {
        // Queue logic: move to 0 if space allows
        // Speed in queue is arbitrary, let's say 1.5m/s walking to board
        moveSpeed = 1.5;
      } else {
        // On Escalator
        moveSpeed = escSpeed + (p.isWalking ? p.desiredWalkSpeed : 0);
      }

      // Calculate tentative new position
      let newPos = p.pos + moveSpeed * dt;

      // Collision Detection / Slow Down
      if (newPos > barrier) {
        newPos = barrier;
        // If blocked, actual speed effectively matches person in front
      }

      // Update Position
      p.pos = newPos;

      // Update Barriers for next person
      if (p.lane === 0) lastPosLane0 = p.pos;
      else lastPosLane1 = p.pos;
    });

    // 3. Remove Exited
    const keep = [];
    state.people.forEach(p => {
      if (p.pos >= escLength) {
        state.exitedCount++;
      } else {
        keep.push(p);
      }
    });
    state.people = keep;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Scale: Map simulation meters to pixels
    // Reserve bottom 20% for queue, top 80% for escalator
    const queueHeight = height * 0.2;
    const escDrawHeight = height * 0.8;
    const metersToPixels = escDrawHeight / escLength;

    // Draw Escalator Background
    ctx.fillStyle = '#e5e7eb'; // gray-200
    ctx.fillRect(width * 0.2, 0, width * 0.6, escDrawHeight);
    
    // Draw Lanes
    ctx.strokeStyle = '#9ca3af';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(width * 0.5, 0);
    ctx.lineTo(width * 0.5, escDrawHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw End Line
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width * 0.2, 0);
    ctx.lineTo(width * 0.8, 0);
    ctx.stroke();

    // Draw People
    engineState.current.people.forEach(p => {
      // X Calc
      const laneCenter = p.lane === 0 ? width * 0.35 : width * 0.65;
      
      // Y Calc
      // If pos < 0 (queue), map to bottom area
      // If pos > 0 (escalator), map from bottom of esc up
      let y = 0;
      if (p.pos < 0) {
        // Queue mapping: 0 is at escDrawHeight, -5 is at height
        y = escDrawHeight + Math.abs(p.pos) * 20; // Scale queue visually
      } else {
        y = escDrawHeight - (p.pos * metersToPixels);
      }

      ctx.beginPath();
      ctx.arc(laneCenter, y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = p.color;
      ctx.fill();
      
      // Draw "legs" animation if walking
      if (p.isWalking && p.pos > 0) {
         ctx.strokeStyle = '#fff';
         ctx.lineWidth = 1;
         ctx.beginPath();
         const stride = Math.sin(engineState.current.totalTime * 10) * 3;
         ctx.moveTo(laneCenter - 2, y);
         ctx.lineTo(laneCenter - 2, y + 5 + stride);
         ctx.moveTo(laneCenter + 2, y);
         ctx.lineTo(laneCenter + 2, y + 5 - stride);
         ctx.stroke();
      }
    });
  };

  const loop = (time) => {
    if (!engineState.current.lastFrameTime) engineState.current.lastFrameTime = time;
    const dt = (time - engineState.current.lastFrameTime) / 1000;
    engineState.current.lastFrameTime = time;

    if (isRunning) {
      engineState.current.totalTime += dt;
      updatePhysics(dt);
      
      // Update React Stats periodically
      if (time - engineState.current.lastStatUpdate > UPDATE_INTERVAL) {
        const mins = engineState.current.totalTime / 60;
        const flow = mins > 0 ? Math.round(engineState.current.exitedCount / mins) : 0;
        
        const newStat = {
            time: Math.floor(engineState.current.totalTime),
            flow: flow
        };

        setChartData(prev => {
            const newData = [...prev, newStat];
            if (newData.length > 30) return newData.slice(newData.length - 30);
            return newData;
        });

        setStats({
          totalExited: engineState.current.exitedCount,
          avgThroughput: flow,
          queueSize: engineState.current.people.filter(p => p.pos < 0).length,
          onEscalator: engineState.current.people.filter(p => p.pos >= 0).length,
        });
        
        setTimeElapsed(engineState.current.totalTime);
        engineState.current.lastStatUpdate = time;
      }
    }

    draw();
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [isRunning, escLength, escSpeed, strategy]); // Dependencies that might reset logic

  const handleReset = () => {
    setIsRunning(false);
    setChartData([]);
    setTimeElapsed(0);
    setStats({ totalExited: 0, avgThroughput: 0, queueSize: 0, onEscalator: 0 });
    
    engineState.current = {
      lastFrameTime: 0,
      totalTime: 0,
      spawnTimer: 0,
      people: [],
      exitedCount: 0,
      history: [],
      lastStatUpdate: 0,
    };
    // Clear canvas immediately
    const canvas = canvasRef.current;
    if(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0, canvas.width, canvas.height);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans text-gray-800">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm z-10">
        <div>
          <h1 className="text-xl font-bold text-blue-900">Escalator Flow Simulator</h1>
          <p className="text-sm text-gray-500">Comparing flow efficiency between Stand-Only and Walk/Stand strategies (one-shot by Gemini 3 Pro Preview)</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setIsRunning(!isRunning)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition ${isRunning ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-600 hover:bg-green-700'}`}
            >
                {isRunning ? <><Pause size={18} /> Pause</> : <><Play size={18} /> Start</>}
            </button>
            <button 
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-gray-700 bg-white border hover:bg-gray-50 transition"
            >
                <RotateCcw size={18} /> Reset
            </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Column: Inputs */}
        <aside className="w-full md:w-1/3 lg:w-1/4 bg-white border-r p-6 overflow-y-auto">
          
          <div className="space-y-8">
            {/* Strategy Selection */}
            <div>
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                 Strategy
              </h2>
              <div className="grid grid-cols-1 gap-2">
                <button 
                    onClick={() => setStrategy(1)}
                    className={`p-3 text-left rounded-lg border-2 transition ${strategy === 1 ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-gray-100'}`}
                >
                    <div className="font-bold text-sm">Strategy 1: Stand Only</div>
                    <div className="text-xs text-gray-500 mt-1">2 people per step. High density, passive movement.</div>
                </button>
                <button 
                    onClick={() => setStrategy(2)}
                    className={`p-3 text-left rounded-lg border-2 transition ${strategy === 2 ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-gray-100'}`}
                >
                    <div className="font-bold text-sm">Strategy 2: Walk Left, Stand Right</div>
                    <div className="text-xs text-gray-500 mt-1">Walkers on left (lower density), Standers on right.</div>
                </button>
              </div>
            </div>

            {/* Escalator Config */}
            <div>
                <h2 className="font-semibold text-gray-900 mb-3 border-b pb-2">Escalator Physics</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Length ({escLength}m)</label>
                        <input type="range" min="10" max="100" value={escLength} onChange={(e) => setEscLength(Number(e.target.value))} className="w-full accent-blue-600" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Escalator Speed ({escSpeed} m/s)</label>
                        <input type="range" min="0.2" max="1.0" step="0.1" value={escSpeed} onChange={(e) => setEscSpeed(Number(e.target.value))} className="w-full accent-blue-600" />
                    </div>
                </div>
            </div>

            {/* Crowd Config */}
            <div>
                <h2 className="font-semibold text-gray-900 mb-3 border-b pb-2">Crowd Behavior</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Arrival Rate ({arrivalRate} ppm)</label>
                        <div className="text-xs text-gray-400 mb-1">People arriving per minute</div>
                        <input type="range" min="10" max="200" value={arrivalRate} onChange={(e) => setArrivalRate(Number(e.target.value))} className="w-full accent-blue-600" />
                    </div>
                    
                    <div className={`transition-opacity duration-300 ${strategy === 1 ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Willing to Walk ({walkPct}%)</label>
                            <input type="range" min="0" max="100" value={walkPct} onChange={(e) => setWalkPct(Number(e.target.value))} className="w-full accent-blue-600" />
                        </div>
                        <div className="mt-4">
                            <label className="block text-sm text-gray-600 mb-1">Avg Walk Speed ({avgWalkSpeed} m/s)</label>
                            <input type="range" min="0.4" max="1.5" step="0.1" value={avgWalkSpeed} onChange={(e) => setAvgWalkSpeed(Number(e.target.value))} className="w-full accent-blue-600" />
                        </div>
                        <div className="mt-4">
                            <label className="block text-sm text-gray-600 mb-1">Speed Variance (Std Dev)</label>
                            <input type="range" min="0.0" max="0.5" step="0.05" value={walkSpeedStdDev} onChange={(e) => setWalkSpeedStdDev(Number(e.target.value))} className="w-full accent-blue-600" />
                        </div>
                    </div>
                </div>
            </div>

          </div>
        </aside>

        {/* Right Column: Visualization & Stats */}
        <section className="flex-1 flex flex-col bg-gray-50 relative">
          
          {/* Visualization Canvas */}
          <div className="flex-1 relative flex justify-center items-center overflow-hidden bg-white m-4 rounded-xl shadow-inner border">
             <div className="absolute top-4 left-4 z-10 bg-white/80 p-2 rounded backdrop-blur-sm text-xs text-gray-500">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500"></span> Standing
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <span className="w-3 h-3 rounded-full bg-red-500"></span> Walking
                </div>
             </div>
             
             {/* The Canvas */}
             <canvas 
                ref={canvasRef} 
                width={600} 
                height={800} 
                className="h-full w-auto object-contain"
             />
             
             {/* Overlay Info */}
             <div className="absolute bottom-4 right-4 text-right">
                <div className="text-5xl font-bold text-gray-200 select-none">{timeElapsed.toFixed(1)}s</div>
             </div>
          </div>

          {/* Statistics Panel */}
          <div className="h-64 bg-white border-t p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* KPI Cards */}
            <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg flex items-center justify-between">
                    <div>
                        <div className="text-xs text-blue-600 font-bold uppercase">Throughput</div>
                        <div className="text-2xl font-bold text-blue-900">{stats.avgThroughput} <span className="text-sm font-normal text-blue-700">ppm</span></div>
                    </div>
                    <ArrowUp className="text-blue-300" size={24} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-3 rounded-lg border">
                        <div className="text-xs text-gray-500 uppercase">In Queue</div>
                        <div className={`text-xl font-bold ${stats.queueSize > 20 ? 'text-red-600' : 'text-gray-800'}`}>{stats.queueSize}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border">
                        <div className="text-xs text-gray-500 uppercase">Exited</div>
                        <div className="text-xl font-bold text-green-600">{stats.totalExited}</div>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="md:col-span-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Flow Rate (People Exiting / min)</h3>
                <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="time" hide />
                            <YAxis width={30} style={{fontSize: '10px'}} />
                            <Tooltip />
                            <Line 
                                type="monotone" 
                                dataKey="flow" 
                                stroke="#2563eb" 
                                strokeWidth={2} 
                                dot={false}
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

          </div>

        </section>
      </main>
    </div>
  );
};

export default Gemini3ProViz;