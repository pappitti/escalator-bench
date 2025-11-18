/****************************************************** 
 * LICENSE : CLAUDE SONNET 4 OUTPUT
*******************************************************/
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Play, Pause, RotateCcw, Users, TrendingUp } from 'lucide-react';

const ClaudeSonnet4Viz = () => {
  // Simulation parameters
  const [params, setParams] = useState({
    escalatorLength: 30, // meters
    escalatorSpeed: 0.5, // m/s
    arrivalRate: 60, // people per minute
    walkingPercentage: 50, // percentage who want to walk
    avgWalkingSpeed: 1.2, // m/s (relative to escalator)
    walkingSpeedStd: 0.3, // standard deviation
    stepLength: 0.4, // meters per step
    boardingTime: 1.5, // seconds per person to board
  });

  const [strategy, setStrategy] = useState(2); // 1 or 2
  const [isRunning, setIsRunning] = useState(false);
  const [simulationTime, setSimulationTime] = useState(0);
  const [stats, setStats] = useState({
    completed: 0,
    averageWaitTime: 0,
    throughputPerMinute: 0,
    queueLength: 0,
    escalatorOccupancy: 0
  });

  // Simulation state
  const simulationRef = useRef({
    people: [], // People in system
    queue: [], // People waiting to board
    onEscalator: [], // People on escalator
    completed: [], // People who reached top
    lastArrival: 0,
    totalWaitTime: 0,
    peopleCount: 0
  });

  const animationRef = useRef();
  const canvasRef = useRef();

  // Generate normal distributed random number
  const generateNormal = (mean, std) => {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + std * z0;
  };

  // Create a new person
  const createPerson = (arrivalTime) => ({
    id: simulationRef.current.peopleCount++,
    arrivalTime,
    boardingTime: null,
    position: 0,
    lane: null, // 0 = right (standing), 1 = left (walking)
    wantsToWalk: strategy === 2 ? Math.random() < params.walkingPercentage / 100 : false,
    walkingSpeed: generateNormal(params.avgWalkingSpeed, params.walkingSpeedStd),
    completed: false
  });

  // Reset simulation
  const resetSimulation = useCallback(() => {
    setSimulationTime(0);
    setStats({
      completed: 0,
      averageWaitTime: 0,
      throughputPerMinute: 0,
      queueLength: 0,
      escalatorOccupancy: 0
    });
    simulationRef.current = {
      people: [],
      queue: [],
      onEscalator: [],
      completed: [],
      lastArrival: 0,
      totalWaitTime: 0,
      peopleCount: 0
    };
  }, []);

  // Simulation step
  const simulateStep = useCallback((deltaTime) => {
    const sim = simulationRef.current;
    const dt = deltaTime / 1000; // Convert to seconds
    
    // Add new arrivals
    const arrivalInterval = 60 / params.arrivalRate; // seconds between arrivals
    while (simulationTime - sim.lastArrival >= arrivalInterval) {
      sim.queue.push(createPerson(simulationTime));
      sim.lastArrival += arrivalInterval;
    }

    // Board people onto escalator
    const maxSteps = Math.floor(params.escalatorLength / params.stepLength);
    const currentOccupancy = sim.onEscalator.length;
    
    if (sim.queue.length > 0 && currentOccupancy < maxSteps * (strategy === 1 ? 2 : 1)) {
      const person = sim.queue.shift();
      person.boardingTime = simulationTime;
      person.position = 0;
      
      if (strategy === 1) {
        // Strategy 1: Two people per step, all standing
        person.lane = currentOccupancy % 2;
        person.wantsToWalk = false;
      } else {
        // Strategy 2: Choose lane based on preference
        person.lane = person.wantsToWalk ? 1 : 0;
      }
      
      sim.onEscalator.push(person);
      sim.totalWaitTime += simulationTime - person.arrivalTime;
    }

    // Update positions on escalator
    sim.onEscalator.forEach(person => {
      const baseSpeed = params.escalatorSpeed;
      const walkingBonus = person.wantsToWalk && person.lane === 1 ? 
        Math.max(0, person.walkingSpeed) : 0;
      
      person.position += (baseSpeed + walkingBonus) * dt;
    });

    // Remove completed people
    sim.onEscalator = sim.onEscalator.filter(person => {
      if (person.position >= params.escalatorLength) {
        person.completed = true;
        person.completionTime = simulationTime;
        sim.completed.push(person);
        return false;
      }
      return true;
    });

    // Update statistics
    const avgWaitTime = sim.completed.length > 0 ? 
      sim.totalWaitTime / sim.completed.length : 0;
    
    const recentCompletions = sim.completed.filter(p => 
      simulationTime - p.completionTime < 60
    ).length;

    setStats({
      completed: sim.completed.length,
      averageWaitTime: avgWaitTime,
      throughputPerMinute: recentCompletions,
      queueLength: sim.queue.length,
      escalatorOccupancy: sim.onEscalator.length
    });
  }, [simulationTime, params, strategy]);

  // Animation loop
  const animate = useCallback((timestamp) => {
    if (!isRunning) return;
    
    const deltaTime = 50; // Fixed 50ms steps for consistency
    setSimulationTime(prev => prev + deltaTime / 1000);
    
    simulateStep(deltaTime);
    drawCanvas();
    
    animationRef.current = requestAnimationFrame(animate);
  }, [isRunning, simulateStep]);

  // Canvas drawing
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);
    
    // Draw escalator
    const escalatorWidth = 120;
    const escalatorX = (width - escalatorWidth) / 2;
    const escalatorHeight = height - 100;
    
    // Escalator structure
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(escalatorX, 50, escalatorWidth, escalatorHeight);
    
    // Lane divider for strategy 2
    if (strategy === 2) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(escalatorX + escalatorWidth/2, 50);
      ctx.lineTo(escalatorX + escalatorWidth/2, 50 + escalatorHeight);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Draw queue
    const queueStartY = 50 + escalatorHeight + 10;
    simulationRef.current.queue.forEach((person, i) => {
      const x = strategy === 2 && person.wantsToWalk ? 
        escalatorX + escalatorWidth * 0.75 : escalatorX + escalatorWidth * 0.25;
      const y = queueStartY + (i * 8);
      
      ctx.fillStyle = person.wantsToWalk ? '#ef4444' : '#3b82f6';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Draw people on escalator
    simulationRef.current.onEscalator.forEach(person => {
      const progress = person.position / params.escalatorLength;
      const y = 50 + escalatorHeight - (progress * escalatorHeight);
      const x = escalatorX + (person.lane === 1 ? escalatorWidth * 0.75 : escalatorWidth * 0.25);
      
      ctx.fillStyle = person.wantsToWalk ? '#ef4444' : '#3b82f6';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Labels
    ctx.fillStyle = '#374151';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    
    if (strategy === 2) {
      ctx.fillText('Stand Right', escalatorX + escalatorWidth * 0.25, 40);
      ctx.fillText('Walk Left', escalatorX + escalatorWidth * 0.75, 40);
    } else {
      ctx.fillText('All Stand', escalatorX + escalatorWidth * 0.5, 40);
    }
    
    // Stats overlay
    ctx.textAlign = 'left';
    ctx.fillText(`Time: ${(simulationTime).toFixed(1)}s`, 10, 20);
    ctx.fillText(`Queue: ${stats.queueLength}`, 10, 35);
  };

  // Control handlers
  const toggleSimulation = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    resetSimulation();
  };

  // Start animation when running
  useEffect(() => {
    if (isRunning) {
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
  }, [isRunning, animate]);

  // Initial canvas draw
  useEffect(() => {
    drawCanvas();
  }, [strategy]);

  return (
    <div className="container mx-auto p-4">
      <div><em>Note : one-shot from Claude Sonnet 4 </em></div>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Escalator Strategy Simulator
          </h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Controls */}
            <div className="space-y-6">
              {/* Strategy Selection */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Users className="mr-2" />
                  Strategy Selection
                </h2>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3">
                    <input 
                      type="radio" 
                      checked={strategy === 1}
                      onChange={() => setStrategy(1)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span>Strategy 1: Everyone stands (2 per step)</span>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input 
                      type="radio" 
                      checked={strategy === 2}
                      onChange={() => setStrategy(2)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span>Strategy 2: Stand right, walk left</span>
                  </label>
                </div>
              </div>

              {/* Escalator Parameters */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Escalator Parameters</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Length (meters): {params.escalatorLength}
                    </label>
                    <input
                      type="range"
                      min="20"
                      max="50"
                      value={params.escalatorLength}
                      onChange={(e) => setParams({...params, escalatorLength: parseInt(e.target.value)})}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Speed (m/s): {params.escalatorSpeed}
                    </label>
                    <input
                      type="range"
                      min="0.3"
                      max="1.0"
                      step="0.1"
                      value={params.escalatorSpeed}
                      onChange={(e) => setParams({...params, escalatorSpeed: parseFloat(e.target.value)})}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* People Parameters */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">People Parameters</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Arrival Rate (people/min): {params.arrivalRate}
                    </label>
                    <input
                      type="range"
                      min="30"
                      max="120"
                      value={params.arrivalRate}
                      onChange={(e) => setParams({...params, arrivalRate: parseInt(e.target.value)})}
                      className="w-full"
                    />
                  </div>
                  {strategy === 2 && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Walking Percentage: {params.walkingPercentage}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={params.walkingPercentage}
                          onChange={(e) => setParams({...params, walkingPercentage: parseInt(e.target.value)})}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Avg Walking Speed (m/s): {params.avgWalkingSpeed}
                        </label>
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.1"
                          value={params.avgWalkingSpeed}
                          onChange={(e) => setParams({...params, avgWalkingSpeed: parseFloat(e.target.value)})}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Speed Variation (std): {params.walkingSpeedStd}
                        </label>
                        <input
                          type="range"
                          min="0.1"
                          max="0.5"
                          step="0.1"
                          value={params.walkingSpeedStd}
                          onChange={(e) => setParams({...params, walkingSpeedStd: parseFloat(e.target.value)})}
                          className="w-full"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex space-x-4">
                  <button
                    onClick={toggleSimulation}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {isRunning ? <Pause className="mr-2 w-4 h-4" /> : <Play className="mr-2 w-4 h-4" />}
                    {isRunning ? 'Pause' : 'Start'}
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <RotateCcw className="mr-2 w-4 h-4" />
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Visualization & Stats */}
            <div className="space-y-6">
              {/* Animation */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Escalator Visualization</h3>
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={500}
                  className="border border-gray-300 rounded-lg w-full"
                  style={{maxWidth: '400px', height: 'auto'}}
                />
                <div className="mt-4 flex justify-center space-x-6 text-sm">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                    <span>Standing</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                    <span>Walking</span>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <TrendingUp className="mr-2" />
                  Real-time Statistics
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{stats.completed}</div>
                    <div className="text-sm text-gray-600">People Completed</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{stats.throughputPerMinute}</div>
                    <div className="text-sm text-gray-600">Throughput/min</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{stats.queueLength}</div>
                    <div className="text-sm text-gray-600">Queue Length</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{stats.averageWaitTime.toFixed(1)}s</div>
                    <div className="text-sm text-gray-600">Avg Wait Time</div>
                  </div>
                </div>
              </div>

              {/* Performance Comparison */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Strategy Comparison</h3>
                <div className="text-sm text-gray-600 mb-2">
                  Current Strategy {strategy} Performance
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Efficiency Rating:</span>
                    <span className="font-semibold">
                      {stats.throughputPerMinute > 45 ? 'High' : 
                      stats.throughputPerMinute > 30 ? 'Medium' : 'Low'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Queue Management:</span>
                    <span className="font-semibold">
                      {stats.queueLength < 5 ? 'Good' : 
                      stats.queueLength < 15 ? 'Fair' : 'Poor'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default ClaudeSonnet4Viz;