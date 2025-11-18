/****************************************************** 
 * LICENSE : CLAUDE SONNET 4.5 OUTPUT
*******************************************************/
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const ClaudeSonnet45Viz = () => {
  // Input parameters
  const [escalatorLength, setEscalatorLength] = useState(30); // meters
  const [escalatorSpeed, setEscalatorSpeed] = useState(0.5); // m/s
  const [arrivalRate, setArrivalRate] = useState(60); // people per minute
  const [walkingPercentage, setWalkingPercentage] = useState(50); // %
  const [avgWalkSpeed, setAvgWalkSpeed] = useState(0.7); // m/s
  const [walkSpeedStdDev, setWalkSpeedStdDev] = useState(0.15); // m/s
  const [strategy, setStrategy] = useState(2); // 1 or 2
  
  // Simulation state
  const [isRunning, setIsRunning] = useState(false);
  const [simTime, setSimTime] = useState(0);
  const [people, setPeople] = useState([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [queueLength, setQueueLength] = useState(0);
  const [statsHistory, setStatsHistory] = useState([]);
  
  // Constants
  const STEP_HEIGHT = 0.4; // meters
  const PERSON_SPACING = 0.8; // meters between people on escalator
  const QUEUE_SPACING = 0.5; // meters in queue
  const SIM_SPEED = 1; // simulation speed multiplier
  const FRAME_RATE = 30; // fps
  
  const animationRef = useRef(null);
  const lastFrameTime = useRef(Date.now());
  const nextPersonId = useRef(0);
  const nextArrivalTime = useRef(0);
  
  // Generate random walking speed using Box-Muller transform for normal distribution
  const generateWalkSpeed = () => {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const speed = avgWalkSpeed + z0 * walkSpeedStdDev;
    return Math.max(0.3, Math.min(1.2, speed)); // Clamp between 0.3 and 1.2 m/s
  };
  
  // Calculate capacity
  const getCapacity = () => {
    const stepsOnEscalator = Math.floor(escalatorLength / STEP_HEIGHT);
    if (strategy === 1) {
      return stepsOnEscalator * 2; // 2 people per step
    } else {
      return stepsOnEscalator; // 1 person per step (both lanes)
    }
  };
  
  // Reset simulation
  const resetSimulation = () => {
    setIsRunning(false);
    setSimTime(0);
    setPeople([]);
    setCompletedCount(0);
    setQueueLength(0);
    setStatsHistory([]);
    nextPersonId.current = 0;
    nextArrivalTime.current = 0;
  };
  
  // Simulation loop
  useEffect(() => {
    if (!isRunning) return;
    
    const simulate = () => {
      const now = Date.now();
      const deltaTime = (now - lastFrameTime.current) / 1000 * SIM_SPEED;
      lastFrameTime.current = now;
      
      setSimTime(prev => {
        const newTime = prev + deltaTime;
        
        setPeople(prevPeople => {
          let updatedPeople = [...prevPeople];
          
          // Add new arrivals
          while (nextArrivalTime.current <= newTime) {
            const isWalker = strategy === 2 && Math.random() < (walkingPercentage / 100);
            updatedPeople.push({
              id: nextPersonId.current++,
              position: -1, // In queue
              isWalker,
              speed: isWalker ? generateWalkSpeed() : 0,
              lane: isWalker ? 'left' : 'right',
              status: 'queue'
            });
            
            const interval = 60 / arrivalRate; // seconds between arrivals
            nextArrivalTime.current += interval;
          }
          
          // Update positions
          updatedPeople = updatedPeople.map(person => {
            if (person.status === 'completed') return person;
            
            if (person.status === 'queue') {
              // Check if can board escalator
              const canBoard = canBoardEscalator(person, updatedPeople);
              if (canBoard) {
                return { ...person, position: 0, status: 'onEscalator' };
              }
              return person;
            }
            
            if (person.status === 'onEscalator') {
              // Calculate new position
              const totalSpeed = escalatorSpeed + person.speed;
              let newPos = person.position + totalSpeed * deltaTime;
              
              // Check for collision with person ahead (walkers only)
              if (person.isWalker && person.speed > 0) {
                const personAhead = findPersonAhead(person, updatedPeople);
                if (personAhead && personAhead.position < newPos + PERSON_SPACING) {
                  newPos = personAhead.position - PERSON_SPACING;
                }
              }
              
              if (newPos >= escalatorLength) {
                setCompletedCount(prev => prev + 1);
                return { ...person, position: escalatorLength, status: 'completed' };
              }
              
              return { ...person, position: newPos };
            }
            
            return person;
          });
          
          // Remove completed people after a delay
          updatedPeople = updatedPeople.filter(p => 
            p.status !== 'completed' || p.position < escalatorLength + 5
          );
          
          // Update queue length
          const queueCount = updatedPeople.filter(p => p.status === 'queue').length;
          setQueueLength(queueCount);
          
          return updatedPeople;
        });
        
        // Update stats every second
        if (Math.floor(newTime) > Math.floor(prev)) {
          setStatsHistory(prevStats => {
            const newStats = [...prevStats, {
              time: Math.floor(newTime),
              throughput: completedCount,
              queueLength: queueLength,
              flowRate: prevStats.length > 0 ? 
                (completedCount - prevStats[prevStats.length - 1].throughput) * 60 : 0
            }];
            return newStats.slice(-60); // Keep last 60 seconds
          });
        }
        
        return newTime;
      });
      
      animationRef.current = requestAnimationFrame(simulate);
    };
    
    lastFrameTime.current = Date.now();
    animationRef.current = requestAnimationFrame(simulate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, escalatorSpeed, escalatorLength, arrivalRate, walkingPercentage, 
      avgWalkSpeed, walkSpeedStdDev, strategy, completedCount, queueLength]);
  
  const canBoardEscalator = (person, allPeople) => {
    const onEscalator = allPeople.filter(p => p.status === 'onEscalator');
    
    if (strategy === 1) {
      // Strategy 1: Check if there's space at position 0
      const atStart = onEscalator.filter(p => p.position < PERSON_SPACING);
      return atStart.length < 2;
    } else {
      // Strategy 2: Check lane availability
      const inLane = onEscalator.filter(p => 
        p.lane === person.lane && p.position < PERSON_SPACING
      );
      return inLane.length === 0;
    }
  };
  
  const findPersonAhead = (person, allPeople) => {
    const ahead = allPeople.filter(p => 
      p.status === 'onEscalator' && 
      p.lane === person.lane && 
      p.position > person.position
    );
    
    if (ahead.length === 0) return null;
    return ahead.reduce((closest, p) => 
      p.position < closest.position ? p : closest
    );
  };
  
  // Visualization
  const renderEscalator = () => {
    const width = 300;
    const height = 500;
    const escalatorWidth = strategy === 1 ? 80 : 100;
    const escalatorX = (width - escalatorWidth) / 2;
    const queueX = escalatorX - 100;
    
    const queuePeople = people.filter(p => p.status === 'queue');
    const escalatorPeople = people.filter(p => p.status === 'onEscalator');
    
    return (
      <svg width={width} height={height} className="border border-gray-300 bg-gray-50">
        {/* Queue area */}
        <rect x={queueX} y={height - 100} width={80} height={80} fill="#e5e7eb" stroke="#9ca3af" />
        <text x={queueX + 5} y={height - 85} className="text-xs fill-gray-600">Queue</text>
        
        {/* Queue people */}
        {queuePeople.map((person, idx) => {
          const row = Math.floor(idx / 4);
          const col = idx % 4;
          return (
            <circle
              key={person.id}
              cx={queueX + 15 + col * 18}
              cy={height - 70 + row * 18}
              r={6}
              fill={person.isWalker ? '#3b82f6' : '#10b981'}
            />
          );
        })}
        
        {/* Escalator */}
        <rect 
          x={escalatorX} 
          y={50} 
          width={escalatorWidth} 
          height={height - 150} 
          fill="#d1d5db" 
          stroke="#6b7280" 
          strokeWidth={2}
        />
        
        {/* Lane divider for strategy 2 */}
        {strategy === 2 && (
          <>
            <line 
              x1={escalatorX + escalatorWidth / 2} 
              y1={50} 
              x2={escalatorX + escalatorWidth / 2} 
              y2={height - 100}
              stroke="#9ca3af"
              strokeWidth={2}
              strokeDasharray="5,5"
            />
            <text x={escalatorX + 10} y={70} className="text-xs fill-gray-600">Walk</text>
            <text x={escalatorX + escalatorWidth - 35} y={70} className="text-xs fill-gray-600">Stand</text>
          </>
        )}
        
        {/* People on escalator */}
        {escalatorPeople.map(person => {
          const y = height - 100 - (person.position / escalatorLength) * (height - 150);
          let x = escalatorX + escalatorWidth / 2;
          
          if (strategy === 2) {
            x = person.lane === 'left' ? 
              escalatorX + escalatorWidth * 0.25 : 
              escalatorX + escalatorWidth * 0.75;
          } else {
            // For strategy 1, alternate left/right
            const atSamePosition = escalatorPeople.filter(p => 
              Math.abs(p.position - person.position) < 0.1
            );
            const index = atSamePosition.indexOf(person);
            x = escalatorX + escalatorWidth * (index === 0 ? 0.3 : 0.7);
          }
          
          return (
            <circle
              key={person.id}
              cx={x}
              cy={y}
              r={6}
              fill={person.isWalker ? '#3b82f6' : '#10b981'}
            />
          );
        })}
        
        {/* Top exit */}
        <polygon
          points={`${escalatorX},50 ${escalatorX + escalatorWidth},50 ${escalatorX + escalatorWidth + 20},30 ${escalatorX - 20},30`}
          fill="#86efac"
          opacity={0.5}
        />
        <text x={escalatorX + 20} y={42} className="text-xs fill-gray-700">Exit</text>
      </svg>
    );
  };
  
  const avgFlowRate = statsHistory.length > 0 ? 
    statsHistory.reduce((sum, s) => sum + s.flowRate, 0) / statsHistory.length : 0;
  
  return (
    <div className="container mx-auto p-4">
      <div><em>Note : one-shot by Claude Sonnet 4.5 </em></div>
      <div className="w-full h-screen bg-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Escalator Strategy Simulator</h1>
          
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column - Inputs */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Escalator Parameters</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Length (meters): {escalatorLength}m
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="50"
                      value={escalatorLength}
                      onChange={(e) => setEscalatorLength(Number(e.target.value))}
                      className="w-full"
                      disabled={isRunning}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Speed (m/s): {escalatorSpeed.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0.3"
                      max="0.8"
                      step="0.05"
                      value={escalatorSpeed}
                      onChange={(e) => setEscalatorSpeed(Number(e.target.value))}
                      className="w-full"
                      disabled={isRunning}
                    />
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">People Parameters</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Arrival Rate (people/min): {arrivalRate}
                    </label>
                    <input
                      type="range"
                      min="20"
                      max="120"
                      value={arrivalRate}
                      onChange={(e) => setArrivalRate(Number(e.target.value))}
                      className="w-full"
                      disabled={isRunning}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Walking Percentage: {walkingPercentage}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={walkingPercentage}
                      onChange={(e) => setWalkingPercentage(Number(e.target.value))}
                      className="w-full"
                      disabled={isRunning}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Avg Walking Speed (m/s): {avgWalkSpeed.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="1.0"
                      step="0.05"
                      value={avgWalkSpeed}
                      onChange={(e) => setAvgWalkSpeed(Number(e.target.value))}
                      className="w-full"
                      disabled={isRunning}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Walking Speed Std Dev (m/s): {walkSpeedStdDev.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0.05"
                      max="0.3"
                      step="0.05"
                      value={walkSpeedStdDev}
                      onChange={(e) => setWalkSpeedStdDev(Number(e.target.value))}
                      className="w-full"
                      disabled={isRunning}
                    />
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Strategy</h2>
                
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      checked={strategy === 1}
                      onChange={() => setStrategy(1)}
                      disabled={isRunning}
                    />
                    <span>Strategy 1: Everyone stands (2 per step)</span>
                  </label>
                  
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      checked={strategy === 2}
                      onChange={() => setStrategy(2)}
                      disabled={isRunning}
                    />
                    <span>Strategy 2: Stand right, walk left</span>
                  </label>
                </div>
              </div>
              
              <div className="flex space-x-4">
                <button
                  onClick={() => setIsRunning(!isRunning)}
                  className="flex items-center space-x-2 bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
                >
                  {isRunning ? <Pause size={20} /> : <Play size={20} />}
                  <span>{isRunning ? 'Pause' : 'Start'}</span>
                </button>
                
                <button
                  onClick={resetSimulation}
                  className="flex items-center space-x-2 bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600"
                >
                  <RotateCcw size={20} />
                  <span>Reset</span>
                </button>
              </div>
            </div>
            
            {/* Right Column - Visualization & Stats */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Simulation</h2>
                
                <div className="flex justify-center mb-4">
                  {renderEscalator()}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Standing</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">Walking</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Statistics</h2>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded">
                    <div className="text-sm text-gray-600">Simulation Time</div>
                    <div className="text-2xl font-bold">{Math.floor(simTime)}s</div>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded">
                    <div className="text-sm text-gray-600">Completed</div>
                    <div className="text-2xl font-bold">{completedCount}</div>
                  </div>
                  
                  <div className="bg-yellow-50 p-4 rounded">
                    <div className="text-sm text-gray-600">Queue Length</div>
                    <div className="text-2xl font-bold">{queueLength}</div>
                  </div>
                  
                  <div className="bg-purple-50 p-4 rounded">
                    <div className="text-sm text-gray-600">Avg Flow Rate</div>
                    <div className="text-2xl font-bold">{avgFlowRate.toFixed(1)}/min</div>
                  </div>
                </div>
                
                {statsHistory.length > 5 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Flow Rate Over Time</h3>
                    <LineChart width={400} height={200} data={statsHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" label={{ value: 'Time (s)', position: 'insideBottom', offset: -5 }} />
                      <YAxis label={{ value: 'People/min', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="flowRate" stroke="#3b82f6" name="Flow Rate" />
                    </LineChart>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaudeSonnet45Viz;