/****************************************************** 
 * LICENCE : GEMINI 2.5 PRO 0605 OUTPUT
*******************************************************/

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Play, Pause, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SliderInput = ({ label, value, min, max, step, onChange, unit, disabled }) => (
  <div className="mb-4">
    <label className="block text-gray-300 text-sm font-bold mb-2">
      {label}: <span className="text-cyan-400 font-mono">{value} {unit}</span>
    </label>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-50"
    />
  </div>
);

const InputPanel = ({ params, onParamChange, isRunning }) => {
  const isStrategy1 = params.walkerPercentage === 0;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 border-b border-gray-600 pb-2">Simulation Parameters</h2>
      
      <div className="mb-6 p-4 bg-gray-700/50 rounded-lg">
        <h3 className="font-semibold text-lg mb-2 text-cyan-300">Escalator</h3>
        <SliderInput
          label="Length"
          value={params.escalatorLength}
          min="20" max="100" step="1" unit="steps"
          onChange={(e) => onParamChange('escalatorLength', e.target.value)}
          disabled={isRunning}
        />
        <SliderInput
          label="Speed"
          value={params.escalatorSpeed}
          min="0.5" max="3" step="0.1" unit="steps/s"
          onChange={(e) => onParamChange('escalatorSpeed', e.target.value)}
          disabled={isRunning}
        />
      </div>

      <div className="p-4 bg-gray-700/50 rounded-lg">
        <h3 className="font-semibold text-lg mb-2 text-cyan-300">People</h3>
        <SliderInput
          label="Total Arriving"
          value={params.totalPeople}
          min="20" max="500" step="10" unit="people"
          onChange={(e) => onParamChange('totalPeople', e.target.value)}
          disabled={isRunning}
        />
        <SliderInput
          label="Walkers Percentage"
          value={params.walkerPercentage}
          min="0" max="100" step="1" unit="%"
          onChange={(e) => onParamChange('walkerPercentage', e.target.value)}
          disabled={isRunning}
        />
        {!isStrategy1 && (
          <>
            <SliderInput
              label="Avg. Walking Speed"
              value={params.avgWalkingSpeed}
              min="1" max="5" step="0.1" unit="steps/s"
              onChange={(e) => onParamChange('avgWalkingSpeed', e.target.value)}
              disabled={isRunning}
            />
            <SliderInput
              label="Walking Speed Deviation"
              value={params.walkingSpeedStdDev}
              min="0" max="2" step="0.1" unit=""
              onChange={(e) => onParamChange('walkingSpeedStdDev', e.target.value)}
              disabled={isRunning}
            />
          </>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-4">
        {isStrategy1 
          ? "You are simulating Strategy 1 (Everyone stands). All people will use both sides of the escalator."
          : "You are simulating Strategy 2 (Walk & Stand). People will split into walking (left) and standing (right) lanes."
        }
      </p>
    </div>
  );
};

// Canvas Animation Component
const EscalatorAnimation = ({ people, params }) => {
  const canvasRef = useRef(null);
  const isStrategy1 = params.walkerPercentage === 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    // Clear canvas
    ctx.fillStyle = '#1f2937'; // bg-gray-800
    ctx.fillRect(0, 0, width, height);

    // Draw Escalator
    const escalatorYStart = height * 0.9;
    const escalatorYEnd = height * 0.1;
    const escalatorXCenter = width / 2;
    const escalatorWidth = width * 0.2;
    
    ctx.fillStyle = '#374151'; // bg-gray-700
    ctx.fillRect(escalatorXCenter - escalatorWidth / 2, escalatorYEnd, escalatorWidth, escalatorYStart - escalatorYEnd);
    
    if (!isStrategy1) {
      ctx.strokeStyle = '#4b5563'; // bg-gray-600
      ctx.beginPath();
      ctx.moveTo(escalatorXCenter, escalatorYEnd);
      ctx.lineTo(escalatorXCenter, escalatorYStart);
      ctx.stroke();
    }

    // Draw People
    people.forEach(p => {
      let x, y;
      const progressRatio = p.progress / params.escalatorLength;

      if (p.status === 'queue') {
        // Simple queue visualization
        const queueX = isStrategy1 ? escalatorXCenter : (p.lane === 'left' ? width * 0.3 : width * 0.7);
        x = queueX + (Math.random() - 0.5) * 40;
        y = height * 0.95 + (Math.random() - 0.5) * 20;
      } else if (p.status === 'escalator') {
        y = escalatorYStart - (escalatorYStart - escalatorYEnd) * progressRatio;
        if (isStrategy1) {
          x = escalatorXCenter + (p.lane === 'left' ? -escalatorWidth / 4 : escalatorWidth / 4);
        } else {
          x = p.lane === 'left' ? escalatorXCenter - escalatorWidth / 4 : escalatorXCenter + escalatorWidth / 4;
        }
      } else { // 'finished'
        return; // Don't draw finished people
      }
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = p.type === 'walker' ? '#22d3ee' : '#a78bfa'; // cyan-400 for walkers, violet-400 for standers
      ctx.fill();
    });

  }, [people, params]);

  return <canvas ref={canvasRef} width="600" height="400" className="w-full h-auto bg-gray-800 rounded-lg border border-gray-700"></canvas>;
};

// Main Display Component
const SimulationDisplay = ({ people, stats, strategy1Stats, params, timeElapsed }) => {
  const queueCount = people.filter(p => p.status === 'queue').length;
  const isStrategy1 = params.walkerPercentage === 0;

  return (
    <div className="flex flex-col gap-4 h-full">
      <h2 className="text-xl font-semibold border-b border-gray-600 pb-2">
        Live Simulation: <span className="text-cyan-400">{isStrategy1 ? "Strategy 1 (Everyone Stands)" : "Strategy 2 (Walk & Stand)"}</span>
      </h2>
      <EscalatorAnimation people={people} params={params} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Current Sim Stats */}
        <div className="bg-gray-700/50 p-4 rounded-lg">
          <h3 className="font-semibold text-lg mb-2 text-cyan-300">Current Strategy Stats</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p>Time Elapsed:</p><p className="font-mono text-white">{timeElapsed.toFixed(1)}s</p>
            <p>People at Top:</p><p className="font-mono text-white">{stats.finishedCount}</p>
            <p>People in Queue:</p><p className="font-mono text-white">{queueCount}</p>
            <p>Current Flow:</p><p className="font-mono text-white">{stats.currentFlow.toFixed(1)} p/min</p>
          </div>
        </div>
        
        {/* Comparison Stats */}
        {!isStrategy1 && (
           <div className="bg-gray-700/50 p-4 rounded-lg">
             <h3 className="font-semibold text-lg mb-2 text-purple-300">Comparison: Strategy 1</h3>
             <div className="grid grid-cols-2 gap-2 text-sm">
               <p>Est. Time to Clear:</p><p className="font-mono text-white">{strategy1Stats.timeToClearAll}s</p>
               <p>Est. People in Queue:</p><p className="font-mono text-white">{strategy1Stats.peopleAtBottom}</p>
               <p>Theoretical Flow:</p><p className="font-mono text-white">{strategy1Stats.flow} p/min</p>
               <p className="col-span-2 text-xs text-gray-400 mt-2">Comparison based on the same number of people and escalator settings.</p>
             </div>
           </div>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-lg mb-2 mt-4 text-cyan-300">Passenger Flow Over Time</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={stats.flowHistory} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
            <XAxis dataKey="time" stroke="#9ca3af" label={{ value: 'Time (s)', position: 'insideBottom', offset: -5, fill: '#9ca3af' }} />
            <YAxis stroke="#9ca3af" label={{ value: 'p/min', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
            <Legend />
            <Line type="monotone" dataKey="flow" name="Current Strategy Flow" stroke="#22d3ee" strokeWidth={2} dot={false} />
            {!isStrategy1 && (
              <Line type="monotone" dataKey="s1_flow" name="Strategy 1 Flow" stroke="#a78bfa" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const randomNormal = (mean, stdDev) => {
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = Math.random(); //Converting [0,1) to (0,1)
  while (u2 === 0) u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z * stdDev + mean;
};

const useEscalatorSimulation = (initialParams) => {
  const [simulationState, setSimulationState] = useState({
    isRunning: false,
    timeElapsed: 0,
    people: [],
    stats: {
      finishedCount: 0,
      currentFlow: 0,
      flowHistory: [],
    },
  });
  
  const animationFrameId = useRef(null);
  const lastUpdateTime = useRef(null);
  const simulationParams = useRef(initialParams);

  // Update params ref when props change
  useEffect(() => {
    simulationParams.current = initialParams;
  }, [initialParams]);

  const createInitialPeople = useCallback((params) => {
    const people = [];
    const walkerCount = Math.floor(params.totalPeople * (params.walkerPercentage / 100));
    
    for (let i = 0; i < params.totalPeople; i++) {
      const isWalker = i < walkerCount;
      const person = {
        id: i,
        status: 'queue', // 'queue', 'escalator', 'finished'
        type: isWalker ? 'walker' : 'stander',
        lane: 'none', // 'left', 'right', 'none'
        progress: 0, // from 0 to escalatorLength
        desiredSpeed: isWalker ? Math.max(0.5, randomNormal(params.avgWalkingSpeed, params.walkingSpeedStdDev)) : 0,
        actualSpeed: 0,
      };
      people.push(person);
    }
    return people.sort(() => Math.random() - 0.5); // Shuffle the queue
  }, []);

  const resetSimulation = useCallback((params) => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    simulationParams.current = params;
    setSimulationState({
      isRunning: false,
      timeElapsed: 0,
      people: createInitialPeople(params),
      stats: {
        finishedCount: 0,
        currentFlow: 0,
        flowHistory: [],
      },
    });
    lastUpdateTime.current = null;
  }, [createInitialPeople]);
  
  // Initialize on mount
  useEffect(() => {
    resetSimulation(initialParams);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const simulationLoop = useCallback((timestamp) => {
    if (!lastUpdateTime.current) {
      lastUpdateTime.current = timestamp;
      animationFrameId.current = requestAnimationFrame(simulationLoop);
      return;
    }

    const deltaTime = (timestamp - lastUpdateTime.current) / 1000;
    lastUpdateTime.current = timestamp;

    setSimulationState(prevState => {
      const params = simulationParams.current;
      const isStrategy1 = params.walkerPercentage === 0;
      let newPeople = [...prevState.people];
      let newFinishedCount = prevState.stats.finishedCount;

      // --- 1. Update people on escalator ---
      const peopleOnEscalator = newPeople.filter(p => p.status === 'escalator');

      // Sort by progress to handle slowdowns
      peopleOnEscalator.sort((a, b) => b.progress - a.progress); 

      const laneLeaders = { left: null, right: null };

      peopleOnEscalator.forEach(person => {
        let maxSpeed = person.desiredSpeed;
        const leader = laneLeaders[person.lane];
        if (leader) {
          // If a person is close to the one in front, they can't go faster
          const distanceToLeader = leader.progress - person.progress;
          if (distanceToLeader < 2.0) { // 2 steps buffer
            maxSpeed = Math.min(maxSpeed, leader.actualSpeed);
          }
        }
        
        person.actualSpeed = maxSpeed;
        const totalSpeed = params.escalatorSpeed + person.actualSpeed;
        person.progress += totalSpeed * deltaTime;
        
        laneLeaders[person.lane] = person;

        if (person.progress >= params.escalatorLength) {
          person.status = 'finished';
          newFinishedCount++;
        }
      });

      // --- 2. Board new people ---
      const peopleInQueue = newPeople.filter(p => p.status === 'queue');
      const nextStepAvailability = { left: true, right: true };
      
      peopleOnEscalator.forEach(p => {
        if (p.progress < 1.0) { // Person is on the first step
          nextStepAvailability[p.lane] = false;
        }
      });

      if (peopleInQueue.length > 0) {
        if (isStrategy1) {
          // Strategy 1: Fill both lanes
          if (nextStepAvailability.right) {
            const personToBoard = peopleInQueue.shift();
            if(personToBoard) {
              personToBoard.status = 'escalator';
              personToBoard.lane = 'right';
            }
          }
          if (nextStepAvailability.left) {
            const personToBoard = peopleInQueue.shift();
            if(personToBoard) {
              personToBoard.status = 'escalator';
              personToBoard.lane = 'left';
            }
          }
        } else {
          // Strategy 2: Segregated lanes
          const nextWalker = peopleInQueue.find(p => p.type === 'walker');
          const nextStander = peopleInQueue.find(p => p.type === 'stander');

          if (nextStepAvailability.left && nextWalker) {
            nextWalker.status = 'escalator';
            nextWalker.lane = 'left';
          }
          if (nextStepAvailability.right && nextStander) {
            nextStander.status = 'escalator';
            nextStander.lane = 'right';
          }
        }
      }
      
      // --- 3. Update stats ---
      const newTimeElapsed = prevState.timeElapsed + deltaTime;
      const newFlow = newTimeElapsed > 0 ? (newFinishedCount / newTimeElapsed) * 60 : 0;
      
      let newFlowHistory = prevState.stats.flowHistory;
      if (Math.floor(newTimeElapsed) > (newFlowHistory.length > 0 ? newFlowHistory[newFlowHistory.length - 1].time : 0)) {
        const s1Flow = (params.escalatorSpeed * 2) * 60;
        newFlowHistory.push({ time: Math.floor(newTimeElapsed), flow: newFlow, s1_flow: s1Flow });
      }

      if (newFinishedCount === params.totalPeople) {
        // Simulation finished
        cancelAnimationFrame(animationFrameId.current);
        lastUpdateTime.current = null;
        return {
          ...prevState,
          isRunning: false,
          people: newPeople,
          stats: {
            ...prevState.stats,
            finishedCount: newFinishedCount,
            currentFlow: newFlow,
            flowHistory: newFlowHistory,
          },
        };
      }

      return {
        ...prevState,
        timeElapsed: newTimeElapsed,
        people: newPeople,
        stats: {
          ...prevState.stats,
          finishedCount: newFinishedCount,
          currentFlow: newFlow,
          flowHistory: newFlowHistory,
        },
      };
    });

    animationFrameId.current = requestAnimationFrame(simulationLoop);
  }, []);

  const startSimulation = () => {
    if (simulationState.isRunning) return;
    setSimulationState(prev => ({ ...prev, isRunning: true }));
    lastUpdateTime.current = null; // Reset timer on start/resume
    animationFrameId.current = requestAnimationFrame(simulationLoop);
  };

  const pauseSimulation = () => {
    if (!simulationState.isRunning) return;
    setSimulationState(prev => ({ ...prev, isRunning: false }));
    cancelAnimationFrame(animationFrameId.current);
    animationFrameId.current = null;
  };

  return { simulationState, startSimulation, pauseSimulation, resetSimulation };
};

function Gemini25Pro0605Viz() {
  const [params, setParams] = useState({
    escalatorLength: 60, // in steps (e.g., 0.4m per step = 24m)
    escalatorSpeed: 1.5, // steps per second
    totalPeople: 100,
    walkerPercentage: 50, // 0 for strategy 1
    avgWalkingSpeed: 2, // steps per second
    walkingSpeedStdDev: 0.5, // standard deviation
  });

  const {
    simulationState,
    startSimulation,
    pauseSimulation,
    resetSimulation,
  } = useEscalatorSimulation(params);

  const { isRunning, timeElapsed, people, stats } = simulationState;

  const handleParamChange = useCallback((param, value) => {
    setParams(prev => ({ ...prev, [param]: Number(value) }));
  }, []);

  // Memoize strategy 1 calculation for comparison
  const strategy1Stats = useMemo(() => {
    const STEP_HEIGHT = 0.4; // meters, for context
    const effectiveEscalatorSpeed = params.escalatorSpeed * STEP_HEIGHT; // m/s
    const timePerPersonPair = 1 / params.escalatorSpeed; // seconds to free up one step
    const flow = 2 / timePerPersonPair * 60; // people per minute
    const timeToClearAll = (params.totalPeople / 2) * timePerPersonPair;
    
    return {
      flow: flow.toFixed(1),
      timeToClearAll: timeToClearAll.toFixed(1),
      peopleAtBottom: Math.max(0, params.totalPeople - Math.floor(timeElapsed / timeToClearAll * params.totalPeople)),
    };
  }, [params, timeElapsed]);

  return (
    <div className="container mx-auto p-4">
      <div><em>Note : Gemini 2.5 Pro 06-05 built this in 1 shot</em></div>
      <div className="min-h-screen bg-gray-900 text-white font-sans">
        <header className="text-center py-4 border-b border-gray-700">
          <h1 className="text-3xl font-bold text-cyan-400">Escalator Strategy Simulator</h1>
          <p className="text-gray-400">Stand Still vs. Walk & Stand</p>
        </header>

        <div className="flex flex-col lg:flex-row p-4 gap-4">
          {/* Left Column: Inputs */}
          <div className="lg:w-1/3 bg-gray-800 rounded-lg p-6 shadow-lg">
            <InputPanel
              params={params}
              onParamChange={handleParamChange}
              isRunning={isRunning}
            />
            <div className="mt-6 flex space-x-4">
              <button
                onClick={isRunning ? pauseSimulation : startSimulation}
                className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 flex items-center justify-center"
              >
                {isRunning ? <Pause className="mr-2" /> : <Play className="mr-2" />}
                {isRunning ? 'Pause' : 'Start'}
              </button>
              <button
                onClick={() => resetSimulation(params)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg transition duration-300 flex items-center justify-center"
              >
                <RefreshCw className="mr-2" />
                Reset
              </button>
            </div>
          </div>

          {/* Right Column: Simulation & Stats */}
          <div className="lg:w-2/3 bg-gray-800 rounded-lg p-6 shadow-lg">
            <SimulationDisplay 
              people={people}
              stats={stats}
              strategy1Stats={strategy1Stats}
              params={params}
              timeElapsed={timeElapsed}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Gemini25Pro0605Viz;