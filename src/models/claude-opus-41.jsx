/****************************************************** 
 * LICENSE : CLAUDE OPUS 4.1 OUTPUT
*******************************************************/
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Users, TrendingUp, Clock, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ClaudeOpus41Viz = () => {
  // Simulation parameters
  const [params, setParams] = useState({
    // Escalator variables
    escalatorLength: 15, // meters
    escalatorSpeed: 0.5, // meters per second
    stepDepth: 0.4, // meters per step
    
    // People parameters
    arrivalRate: 30, // people per minute
    walkingPercentage: 40, // percentage who want to walk
    avgWalkingSpeed: 0.75, // meters per second (relative to escalator)
    walkingSpeedStdDev: 0.15, // standard deviation for walking speed
    
    // Simulation
    strategy: 2, // 1 or 2
    simulationSpeed: 10 // simulation speed multiplier
  });

  // Simulation state
  const [isRunning, setIsRunning] = useState(false);
  const [simulationTime, setSimulationTime] = useState(0);
  const [people, setPeople] = useState([]);
  const [completedPeople, setCompletedPeople] = useState([]);
  const [throughputData, setThroughputData] = useState([]);
  const [queueLength, setQueueLength] = useState({ left: 0, right: 0 });
  
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());
  const nextPersonIdRef = useRef(0);
  const lastArrivalRef = useRef(0);

  // Calculate derived values
  const stepsCount = Math.floor(params.escalatorLength / params.stepDepth);
  const stepCapacity = params.strategy === 1 ? 2 : 1; // people per step per lane

  // Generate normally distributed random number
  const gaussianRandom = (mean, stdDev) => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return num * stdDev + mean;
  };

  // Create a new person
  const createPerson = useCallback((time) => {
    const isWalker = params.strategy === 2 && Math.random() * 100 < params.walkingPercentage;
    const walkingSpeed = isWalker ? 
      Math.max(0.1, gaussianRandom(params.avgWalkingSpeed, params.walkingSpeedStdDev)) : 0;
    
    return {
      id: nextPersonIdRef.current++,
      position: -2, // Start in queue
      lane: isWalker ? 'left' : 'right',
      isWalker,
      walkingSpeed,
      startTime: time,
      onEscalator: false,
      completed: false,
      blocked: false
    };
  }, [params]);

  // Reset simulation
  const resetSimulation = () => {
    setIsRunning(false);
    setSimulationTime(0);
    setPeople([]);
    setCompletedPeople([]);
    setThroughputData([]);
    setQueueLength({ left: 0, right: 0 });
    nextPersonIdRef.current = 0;
    lastArrivalRef.current = 0;
  };

  // Update simulation
  const updateSimulation = useCallback(() => {
    const now = Date.now();
    const deltaTime = (now - lastUpdateRef.current) / 1000 * params.simulationSpeed;
    lastUpdateRef.current = now;
    
    setSimulationTime(prev => prev + deltaTime);
    
    setPeople(prevPeople => {
      let updatedPeople = [...prevPeople];
      const currentTime = simulationTime + deltaTime;
      
      // Generate new arrivals
      const timeSinceLastArrival = currentTime - lastArrivalRef.current;
      const arrivalInterval = 60 / params.arrivalRate;
      
      if (timeSinceLastArrival >= arrivalInterval) {
        updatedPeople.push(createPerson(currentTime));
        lastArrivalRef.current = currentTime;
      }
      
      // Sort people by position for blocking logic
      if (params.strategy === 2) {
        const leftLane = updatedPeople.filter(p => p.lane === 'left' && !p.completed);
        leftLane.sort((a, b) => b.position - a.position);
        
        // Check for blocking
        for (let i = 1; i < leftLane.length; i++) {
          const current = leftLane[i];
          const ahead = leftLane[i - 1];
          
          if (current.onEscalator && ahead.onEscalator) {
            const minDistance = 0.5; // minimum distance between people
            if (current.position + minDistance >= ahead.position) {
              current.blocked = true;
            } else {
              current.blocked = false;
            }
          }
        }
      }
      
      // Update positions
      updatedPeople = updatedPeople.map(person => {
        if (person.completed) return person;
        
        let newPerson = { ...person };
        
        // Check if can board escalator
        if (!newPerson.onEscalator && newPerson.position >= 0) {
          // Check if there's space on the escalator
          const sameLane = updatedPeople.filter(p => 
            p.lane === newPerson.lane && p.onEscalator && !p.completed
          );
          
          const canBoard = sameLane.every(p => p.position > 0.5);
          if (canBoard) {
            newPerson.onEscalator = true;
          }
        }
        
        // Move person
        if (newPerson.onEscalator) {
          let speed = params.escalatorSpeed;
          if (newPerson.isWalker && !newPerson.blocked) {
            speed += newPerson.walkingSpeed;
          }
          newPerson.position += speed * deltaTime;
          
          // Check if completed
          if (newPerson.position >= params.escalatorLength) {
            newPerson.completed = true;
            newPerson.completionTime = currentTime;
          }
        } else {
          // Move in queue
          const queueSpeed = 0.5; // meters per second in queue
          const targetPosition = 0;
          
          if (newPerson.position < targetPosition) {
            newPerson.position = Math.min(
              targetPosition,
              newPerson.position + queueSpeed * deltaTime
            );
          }
        }
        
        return newPerson;
      });
      
      // Move completed people to completedPeople state
      const newlyCompleted = updatedPeople.filter(p => p.completed && !prevPeople.find(pp => pp.id === p.id)?.completed);
      if (newlyCompleted.length > 0) {
        setCompletedPeople(prev => [...prev, ...newlyCompleted]);
      }
      
      // Update queue lengths
      const leftQueue = updatedPeople.filter(p => p.lane === 'left' && !p.onEscalator && !p.completed).length;
      const rightQueue = updatedPeople.filter(p => p.lane === 'right' && !p.onEscalator && !p.completed).length;
      setQueueLength({ left: leftQueue, right: rightQueue });
      
      return updatedPeople.filter(p => !p.completed);
    });
    
    // Update throughput data
    if (Math.floor(simulationTime) % 5 === 0 && Math.floor(simulationTime) !== Math.floor(simulationTime - deltaTime)) {
      setThroughputData(prev => {
        const recentCompleted = completedPeople.filter(p => 
          p.completionTime > simulationTime - 60
        ).length;
        
        return [...prev, {
          time: Math.floor(simulationTime),
          throughput: recentCompleted
        }].slice(-20);
      });
    }
  }, [params, simulationTime, completedPeople, createPerson]);

  // Draw visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw escalator
    const escalatorWidth = params.strategy === 1 ? 60 : 30;
    const escalatorStartX = width / 2 - (params.strategy === 1 ? 30 : 60);
    const escalatorStartY = height - 100;
    const escalatorEndY = 50;
    const escalatorHeight = escalatorStartY - escalatorEndY;
    
    // Draw escalator rails
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 3;
    
    if (params.strategy === 1) {
      // Single wide escalator
      ctx.strokeRect(escalatorStartX, escalatorEndY, escalatorWidth * 2, escalatorHeight);
    } else {
      // Two lanes
      ctx.strokeRect(escalatorStartX, escalatorEndY, escalatorWidth, escalatorHeight); // Left lane
      ctx.strokeRect(escalatorStartX + escalatorWidth, escalatorEndY, escalatorWidth, escalatorHeight); // Right lane
      
      // Lane separator
      ctx.strokeStyle = '#9ca3af';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(escalatorStartX + escalatorWidth, escalatorEndY);
      ctx.lineTo(escalatorStartX + escalatorWidth, escalatorStartY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Draw steps
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    const stepPixels = escalatorHeight / stepsCount;
    for (let i = 0; i <= stepsCount; i++) {
      const y = escalatorStartY - i * stepPixels;
      ctx.beginPath();
      ctx.moveTo(escalatorStartX, y);
      ctx.lineTo(escalatorStartX + escalatorWidth * (params.strategy === 1 ? 2 : 2), y);
      ctx.stroke();
    }
    
    // Draw queue areas
    ctx.fillStyle = '#f3f4f6';
    if (params.strategy === 1) {
      ctx.fillRect(escalatorStartX - 20, escalatorStartY + 10, escalatorWidth * 2 + 40, 60);
    } else {
      ctx.fillRect(escalatorStartX - 20, escalatorStartY + 10, escalatorWidth + 20, 60); // Left queue
      ctx.fillRect(escalatorStartX + escalatorWidth, escalatorStartY + 10, escalatorWidth + 20, 60); // Right queue
    }
    
    // Draw people
    people.forEach(person => {
      const x = params.strategy === 1 ? 
        escalatorStartX + escalatorWidth + (Math.random() - 0.5) * escalatorWidth :
        (person.lane === 'left' ? 
          escalatorStartX + escalatorWidth / 2 :
          escalatorStartX + escalatorWidth * 1.5);
      
      const yProgress = person.position / params.escalatorLength;
      const y = person.onEscalator ? 
        escalatorStartY - yProgress * escalatorHeight :
        escalatorStartY + 40;
      
      // Color based on status
      if (person.blocked) {
        ctx.fillStyle = '#ef4444'; // Red for blocked
      } else if (person.isWalker) {
        ctx.fillStyle = '#3b82f6'; // Blue for walkers
      } else {
        ctx.fillStyle = '#10b981'; // Green for standers
      }
      
      ctx.beginPath();
      ctx.arc(x + (Math.random() - 0.5) * 10, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Draw labels
    ctx.fillStyle = '#1f2937';
    ctx.font = '12px sans-serif';
    if (params.strategy === 2) {
      ctx.fillText('Walk', escalatorStartX + 5, escalatorEndY - 10);
      ctx.fillText('Stand', escalatorStartX + escalatorWidth + 5, escalatorEndY - 10);
    }
  }, [people, params, stepsCount]);

  // Animation loop
  useEffect(() => {
    if (isRunning) {
      const animate = () => {
        updateSimulation();
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, updateSimulation]);

  // Calculate statistics
  const avgWaitTime = completedPeople.length > 0 ?
    completedPeople.reduce((sum, p) => sum + (p.completionTime - p.startTime), 0) / completedPeople.length :
    0;
  
  const throughputPerMinute = completedPeople.filter(p => 
    p.completionTime > simulationTime - 60
  ).length;

  return (
    <div className="container mx-auto p-4">
      <div><em>Note : one-shot from Claude Opus 4.1 </em></div>
      <div className="flex h-screen bg-gray-50">
        {/* Left Column - Inputs */}
        <div className="w-1/3 bg-white shadow-lg overflow-y-auto p-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Simulation Parameters</h2>
          
          <div className="space-y-6">
            {/* Strategy Selection */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Strategy
              </label>
              <select
                value={params.strategy}
                onChange={(e) => setParams({...params, strategy: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={isRunning}
              >
                <option value={1}>Strategy 1: Everyone stands (2 per step)</option>
                <option value={2}>Strategy 2: Stand right, walk left</option>
              </select>
            </div>

            {/* Escalator Variables */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-700 flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Escalator Variables
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600">
                    Length (meters): {params.escalatorLength}m
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="30"
                    step="1"
                    value={params.escalatorLength}
                    onChange={(e) => setParams({...params, escalatorLength: parseFloat(e.target.value)})}
                    className="w-full"
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">
                    Speed (m/s): {params.escalatorSpeed}m/s
                  </label>
                  <input
                    type="range"
                    min="0.3"
                    max="0.9"
                    step="0.05"
                    value={params.escalatorSpeed}
                    onChange={(e) => setParams({...params, escalatorSpeed: parseFloat(e.target.value)})}
                    className="w-full"
                    disabled={isRunning}
                  />
                </div>
              </div>
            </div>

            {/* People Parameters */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-700 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                People Parameters
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600">
                    Arrival Rate (people/min): {params.arrivalRate}
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="120"
                    step="5"
                    value={params.arrivalRate}
                    onChange={(e) => setParams({...params, arrivalRate: parseInt(e.target.value)})}
                    className="w-full"
                    disabled={isRunning}
                  />
                </div>
                
                {params.strategy === 2 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-600">
                        Walking Percentage: {params.walkingPercentage}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={params.walkingPercentage}
                        onChange={(e) => setParams({...params, walkingPercentage: parseInt(e.target.value)})}
                        className="w-full"
                        disabled={isRunning}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600">
                        Avg Walking Speed (m/s): {params.avgWalkingSpeed}m/s
                      </label>
                      <input
                        type="range"
                        min="0.3"
                        max="1.5"
                        step="0.05"
                        value={params.avgWalkingSpeed}
                        onChange={(e) => setParams({...params, avgWalkingSpeed: parseFloat(e.target.value)})}
                        className="w-full"
                        disabled={isRunning}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600">
                        Walking Speed Std Dev: {params.walkingSpeedStdDev}
                      </label>
                      <input
                        type="range"
                        min="0.05"
                        max="0.3"
                        step="0.01"
                        value={params.walkingSpeedStdDev}
                        onChange={(e) => setParams({...params, walkingSpeedStdDev: parseFloat(e.target.value)})}
                        className="w-full"
                        disabled={isRunning}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Simulation Controls */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-700 flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                Simulation Controls
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600">
                    Simulation Speed: {params.simulationSpeed}x
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={params.simulationSpeed}
                    onChange={(e) => setParams({...params, simulationSpeed: parseInt(e.target.value)})}
                    className="w-full"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsRunning(!isRunning)}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
                  >
                    {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isRunning ? 'Pause' : 'Start'}
                  </button>
                  <button
                    onClick={resetSimulation}
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Visualization and Statistics */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-6">
            {/* Visualization */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Escalator Simulation</h3>
              <canvas
                ref={canvasRef}
                width={400}
                height={500}
                className="border border-gray-200 rounded mx-auto"
              />
              <div className="mt-4 flex justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                  <span>Standing</span>
                </div>
                {params.strategy === 2 && (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                      <span>Walking</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                      <span>Blocked</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Statistics */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Performance Metrics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded">
                  <div className="text-sm text-gray-600">Simulation Time</div>
                  <div className="text-2xl font-bold text-gray-800">
                    {Math.floor(simulationTime)}s
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded">
                  <div className="text-sm text-gray-600">Total Completed</div>
                  <div className="text-2xl font-bold text-green-600">
                    {completedPeople.length}
                  </div>
                </div>
                <div className="bg-blue-50 p-4 rounded">
                  <div className="text-sm text-gray-600">Throughput/min</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {throughputPerMinute}
                  </div>
                </div>
                <div className="bg-yellow-50 p-4 rounded">
                  <div className="text-sm text-gray-600">Avg Wait Time</div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {avgWaitTime.toFixed(1)}s
                  </div>
                </div>
              </div>
              
              {params.strategy === 2 && (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="bg-purple-50 p-4 rounded">
                    <div className="text-sm text-gray-600">Left Queue (Walk)</div>
                    <div className="text-xl font-bold text-purple-600">
                      {queueLength.left} people
                    </div>
                  </div>
                  <div className="bg-indigo-50 p-4 rounded">
                    <div className="text-sm text-gray-600">Right Queue (Stand)</div>
                    <div className="text-xl font-bold text-indigo-600">
                      {queueLength.right} people
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Throughput Chart */}
            {throughputData.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-semibold mb-4 text-gray-800">Throughput Over Time</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={throughputData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time" 
                      label={{ value: 'Time (s)', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      label={{ value: 'People/min', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="throughput" 
                      stroke="#3b82f6" 
                      name="Throughput"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Strategy Comparison */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Strategy Analysis</h3>
              <div className="space-y-3 text-sm">
                <div className="p-3 bg-gray-50 rounded">
                  <strong>Current Strategy:</strong> {params.strategy === 1 ? 
                    "Everyone stands (2 per step)" : 
                    "Stand right, walk left"}
                </div>
                <div className="p-3 bg-blue-50 rounded">
                  <strong>Theoretical Capacity:</strong> {params.strategy === 1 ?
                    `${(stepsCount * 2 * 60 / (params.escalatorLength / params.escalatorSpeed)).toFixed(0)} people/min` :
                    `${((1 - params.walkingPercentage/100) * stepsCount * 60 / (params.escalatorLength / params.escalatorSpeed) + 
                        (params.walkingPercentage/100) * stepsCount * 60 / (params.escalatorLength / (params.escalatorSpeed + params.avgWalkingSpeed))).toFixed(0)} people/min`}
                </div>
                <div className="p-3 bg-green-50 rounded">
                  <strong>Actual Performance:</strong> {throughputPerMinute} people/min 
                  ({((throughputPerMinute / params.arrivalRate) * 100).toFixed(0)}% of arrivals)
                </div>
                {simulationTime > 30 && (
                  <div className="p-3 bg-yellow-50 rounded">
                    <strong>Efficiency:</strong> {params.strategy === 2 && params.walkingPercentage > 0 ?
                      "Mixed strategy allows faster throughput for walkers but may create bottlenecks" :
                      "Standing-only maximizes capacity but increases travel time"}
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

export default ClaudeOpus41Viz;