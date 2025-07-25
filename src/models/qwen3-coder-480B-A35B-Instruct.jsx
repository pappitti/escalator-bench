/****************************************************** 
 * LICENCE : QWEN3 OUTPUT (SERVED VIA HYPERBOLIC)
*******************************************************/

import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Qwen3CoderViz = () => {
  // Input states
  const [escalatorLength, setEscalatorLength] = useState(20);
  const [escalatorSpeed, setEscalatorSpeed] = useState(0.5);
  const [peopleArriving, setPeopleArriving] = useState(100);
  const [walkingPercentage, setWalkingPercentage] = useState(30);
  const [averageWalkingSpeed, setAverageWalkingSpeed] = useState(1.0);
  const [walkingSpeedStdDev, setWalkingSpeedStdDev] = useState(0.2);
  const [strategy, setStrategy] = useState(1);
  
  // Simulation states
  const [people, setPeople] = useState([]);
  const [time, setTime] = useState(0);
  const [stats, setStats] = useState({ reachedTop: 0, flowRate: 0 });
  const [history, setHistory] = useState([]);
  const animationRef = useRef();
  const startTimeRef = useRef(0);

  // Normal distribution random generator
  const normalRandom = (mean, stdDev) => {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return z * stdDev + mean;
  };

  // Initialize people
  const initializePeople = () => {
    const newPeople = [];
    for (let i = 0; i < peopleArriving; i++) {
      const isWalker = Math.random() * 100 < walkingPercentage;
      newPeople.push({
        id: i,
        position: 0,
        speed: isWalker ? Math.max(0.1, normalRandom(averageWalkingSpeed, walkingSpeedStdDev)) : 0,
        isWalker,
        reachedTop: false,
        startTime: 0
      });
    }
    setPeople(newPeople);
    setTime(0);
    setStats({ reachedTop: 0, flowRate: 0 });
    setHistory([]);
    startTimeRef.current = Date.now();
  };

  // Simulation step
  const simulateStep = () => {
    setPeople(prevPeople => {
      const updatedPeople = [...prevPeople];
      let reachedTopCount = 0;
      
      // Update positions
      updatedPeople.forEach(person => {
        if (!person.reachedTop) {
          // Strategy 1: All stand (speed = escalator speed)
          // Strategy 2: Walkers use left side, standers use right
          const effectiveSpeed = strategy === 1 
            ? escalatorSpeed 
            : (person.isWalker ? escalatorSpeed + person.speed : escalatorSpeed);
          
          person.position += effectiveSpeed;
          
          if (person.position >= escalatorLength) {
            person.reachedTop = true;
            person.position = escalatorLength;
            reachedTopCount++;
          }
        }
      });
      
      // Calculate flow rate (people per minute)
      const elapsedMinutes = (Date.now() - startTimeRef.current) / 60000;
      const flowRate = elapsedMinutes > 0 ? stats.reachedTop / elapsedMinutes : 0;
      
      setStats(prev => ({
        reachedTop: prev.reachedTop + reachedTopCount,
        flowRate: flowRate
      }));
      
      return updatedPeople;
    });
    
    setTime(prev => prev + 1);
  };

  // Animation loop
  useEffect(() => {
    if (time > 0 && stats.reachedTop < peopleArriving) {
      animationRef.current = setTimeout(() => {
        simulateStep();
      }, 100);
    }
    return () => clearTimeout(animationRef.current);
  }, [time, people, stats.reachedTop]);

  // Update history for chart
  useEffect(() => {
    if (time > 0) {
      setHistory(prev => [
        ...prev.slice(-50),
        { time, reachedTop: stats.reachedTop, flowRate: stats.flowRate }
      ]);
    }
  }, [time, stats]);

  // Reset simulation
  const handleReset = () => {
    clearTimeout(animationRef.current);
    initializePeople();
  };

  // Start simulation
  const handleStart = () => {
    startTimeRef.current = Date.now();
    setTime(1);
  };

  return (
    <div className="container mx-auto p-4">
      <div><em>Note : Gemini 2.5 Pro 06-05 built this in 1 shot</em></div>
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-6">Escalator Strategy Simulator</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Inputs */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Simulation Parameters</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Escalator Variables</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Length (m)</label>
                      <input
                        type="number"
                        value={escalatorLength}
                        onChange={(e) => setEscalatorLength(Number(e.target.value))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Speed (m/s)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={escalatorSpeed}
                        onChange={(e) => setEscalatorSpeed(Number(e.target.value))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                        min="0.1"
                      />
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium mb-2">People Variables</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">People Arriving</label>
                      <input
                        type="number"
                        value={peopleArriving}
                        onChange={(e) => setPeopleArriving(Number(e.target.value))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                        min="1"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">% Walking</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={walkingPercentage}
                        onChange={(e) => setWalkingPercentage(Number(e.target.value))}
                        className="w-full"
                      />
                      <div className="text-right text-sm text-gray-500">{walkingPercentage}%</div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Avg Walking Speed (m/s)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={averageWalkingSpeed}
                          onChange={(e) => setAverageWalkingSpeed(Number(e.target.value))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                          min="0.1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Speed Std Dev</label>
                        <input
                          type="number"
                          step="0.1"
                          value={walkingSpeedStdDev}
                          onChange={(e) => setWalkingSpeedStdDev(Number(e.target.value))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium mb-2">Strategy</h3>
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setStrategy(1)}
                      className={`px-4 py-2 rounded-md ${strategy === 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
                    >
                      Strategy 1: All Stand
                    </button>
                    <button
                      onClick={() => setStrategy(2)}
                      className={`px-4 py-2 rounded-md ${strategy === 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
                    >
                      Strategy 2: Walk Left
                    </button>
                  </div>
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={handleStart}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Start Simulation
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
            
            {/* Right Column - Visualization and Stats */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Simulation</h2>
              
              {/* Escalator Visualization */}
              <div className="mb-6">
                <div className="relative h-64 bg-gray-200 rounded-lg overflow-hidden border-2 border-gray-300">
                  {/* Escalator steps */}
                  {[...Array(10)].map((_, i) => (
                    <div 
                      key={i} 
                      className="absolute w-full h-4 border-t border-gray-400"
                      style={{ bottom: `${i * 10}%` }}
                    />
                  ))}
                  
                  {/* People visualization */}
                  {people.map(person => {
                    if (person.reachedTop) return null;
                    
                    const positionPercent = (person.position / escalatorLength) * 100;
                    const isLeftSide = strategy === 2 && person.isWalker;
                    
                    return (
                      <div
                        key={person.id}
                        className={`absolute w-4 h-4 rounded-full ${
                          person.isWalker ? 'bg-blue-500' : 'bg-red-500'
                        }`}
                        style={{
                          bottom: `${positionPercent}%`,
                          left: isLeftSide ? '25%' : '75%',
                          transform: 'translateX(-50%)'
                        }}
                      />
                    );
                  })}
                  
                  {/* Top platform */}
                  <div className="absolute top-0 left-0 right-0 h-8 bg-gray-300 flex items-center justify-center">
                    <span className="text-xs font-medium">TOP</span>
                  </div>
                  
                  {/* Bottom platform */}
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gray-300 flex items-center justify-center">
                    <span className="text-xs font-medium">BOTTOM</span>
                  </div>
                </div>
              </div>
              
              {/* Statistics */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">People Reached Top</div>
                  <div className="text-2xl font-bold">{stats.reachedTop}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Flow Rate (people/min)</div>
                  <div className="text-2xl font-bold">{stats.flowRate.toFixed(1)}</div>
                </div>
              </div>
              
              {/* Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="reachedTop" 
                      name="People Reached Top" 
                      stroke="#8884d8" 
                      activeDot={{ r: 8 }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="flowRate" 
                      name="Flow Rate (people/min)" 
                      stroke="#82ca9d" 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Qwen3CoderViz;