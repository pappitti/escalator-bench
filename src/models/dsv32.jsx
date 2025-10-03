/****************************************************** 
 * LICENCE : DEEPSEEK V3.2 OUTPUT (SERVED VIA OFFICIAL DS API)
*******************************************************/

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

const DSv32Viz = () => {
  // State for input parameters
  const [escalatorLength, setEscalatorLength] = useState(20);
  const [escalatorSpeed, setEscalatorSpeed] = useState(1);
  const [peopleArrivalRate, setPeopleArrivalRate] = useState(100);
  const [walkingPercentage, setWalkingPercentage] = useState(30);
  const [averageWalkingSpeed, setAverageWalkingSpeed] = useState(2);
  const [walkingSpeedStdDev, setWalkingSpeedStdDev] = useState(0.5);
  const [strategy, setStrategy] = useState(2);
  
  // Simulation state
  const [simulation, setSimulation] = useState({
    running: false,
    time: 0,
    people: [],
    waitingQueue: [],
    completedPeople: 0,
    flowRate: 0,
    stats: []
  });
  
  const animationRef = useRef(null);
  const lastTimeRef = useRef(0);

  // Generate random walking speed from normal distribution
  const generateWalkingSpeed = useCallback(() => {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    const normal = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return Math.max(0.1, averageWalkingSpeed + normal * walkingSpeedStdDev);
  }, [averageWalkingSpeed, walkingSpeedStdDev]);

  // Add new people to the queue
  const addNewPeople = useCallback((currentTime) => {
    const interval = 60 / peopleArrivalRate; // seconds between arrivals
    const newPeopleCount = Math.floor(currentTime / interval) - 
                          Math.floor((currentTime - 0.016) / interval);
    
    if (newPeopleCount > 0) {
      const newPeople = Array.from({ length: newPeopleCount }, (_, i) => {
        const wantsToWalk = Math.random() * 100 < walkingPercentage;
        return {
          id: Date.now() + i,
          position: -1, // -1 means in queue
          speed: wantsToWalk ? generateWalkingSpeed() : 0,
          wantsToWalk,
          queuePosition: simulation.waitingQueue.length + i,
          startTime: currentTime,
          endTime: null
        };
      });
      
      setSimulation(prev => ({
        ...prev,
        waitingQueue: [...prev.waitingQueue, ...newPeople]
      }));
    }
  }, [peopleArrivalRate, walkingPercentage, generateWalkingSpeed, simulation.waitingQueue.length]);

  // Move people from queue to escalator
  const movePeopleToEscalator = useCallback(() => {
    if (simulation.waitingQueue.length === 0) return;

    setSimulation(prev => {
      const newPeople = [...prev.people];
      const newQueue = [...prev.waitingQueue];
      
      // Strategy 1: Everyone stands
      if (strategy === 1) {
        const availableSpots = Math.max(0, 2 * escalatorLength - newPeople.length);
        const peopleToAdd = Math.min(availableSpots, newQueue.length);
        
        for (let i = 0; i < peopleToAdd; i++) {
          const person = { ...newQueue[i], position: 0 };
          newPeople.push(person);
        }
        newQueue.splice(0, peopleToAdd);
      } 
      // Strategy 2: Separate lanes
      else {
        const standingSpots = Math.max(0, escalatorLength - newPeople.filter(p => !p.wantsToWalk).length);
        const walkingSpots = Math.max(0, escalatorLength - newPeople.filter(p => p.wantsToWalk).length);
        
        let standingAdded = 0;
        let walkingAdded = 0;
        
        for (let i = 0; i < newQueue.length; i++) {
          if (newQueue[i].wantsToWalk && walkingAdded < walkingSpots) {
            newPeople.push({ ...newQueue[i], position: 0 });
            walkingAdded++;
            newQueue.splice(i, 1);
            i--;
          } else if (!newQueue[i].wantsToWalk && standingAdded < standingSpots) {
            newPeople.push({ ...newQueue[i], position: 0 });
            standingAdded++;
            newQueue.splice(i, 1);
            i--;
          }
        }
      }
      
      return {
        ...prev,
        people: newPeople,
        waitingQueue: newQueue
      };
    });
  }, [strategy, escalatorLength, simulation.people, simulation.waitingQueue]);

  // Update people positions
  const updatePeoplePositions = useCallback((deltaTime) => {
    setSimulation(prev => {
      const newPeople = prev.people.map(person => {
        // Calculate effective speed (escalator speed + walking speed)
        const effectiveSpeed = escalatorSpeed + person.speed;
        let newPosition = person.position + effectiveSpeed * deltaTime;
        
        // Check for collisions (people can't overtake)
        const peopleAhead = prev.people.filter(p => 
          p.position > person.position && p.position < newPosition
        );
        
        if (peopleAhead.length > 0) {
          newPosition = Math.min(...peopleAhead.map(p => p.position));
        }
        
        return { ...person, position: newPosition };
      });
      
      // Remove people who reached the top and count them
      const completed = newPeople.filter(person => person.position >= escalatorLength);
      const remainingPeople = newPeople.filter(person => person.position < escalatorLength);
      
      const newCompletedCount = prev.completedPeople + completed.length;
      
      // Update stats every second
      const newStats = [...prev.stats];
      const currentSecond = Math.floor(prev.time);
      if (newStats.length <= currentSecond) {
        newStats.length = currentSecond + 1;
        newStats[currentSecond] = newStats[currentSecond] || 0;
      }
      newStats[currentSecond] += completed.length;
      
      return {
        ...prev,
        people: remainingPeople,
        completedPeople: newCompletedCount,
        flowRate: completed.length / deltaTime * 60, // people per minute
        stats: newStats
      };
    });
  }, [escalatorLength, escalatorSpeed]);

  // Main animation loop
  const animate = useCallback((currentTime) => {
    if (!lastTimeRef.current) lastTimeRef.current = currentTime;
    const deltaTime = (currentTime - lastTimeRef.current) / 1000;
    lastTimeRef.current = currentTime;
    
    if (deltaTime > 0.1) return; // Skip large time jumps
    
    setSimulation(prev => ({ ...prev, time: prev.time + deltaTime }));
    
    addNewPeople(simulation.time);
    movePeopleToEscalator();
    updatePeoplePositions(deltaTime);
    
    if (simulation.running) {
      animationRef.current = requestAnimationFrame(animate);
    }
  }, [simulation.running, simulation.time, addNewPeople, movePeopleToEscalator, updatePeoplePositions]);

  // Control simulation
  const startSimulation = () => {
    setSimulation(prev => ({ ...prev, running: true }));
    lastTimeRef.current = 0;
    animationRef.current = requestAnimationFrame(animate);
  };

  const stopSimulation = () => {
    setSimulation(prev => ({ ...prev, running: false }));
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  const resetSimulation = () => {
    stopSimulation();
    setSimulation({
      running: false,
      time: 0,
      people: [],
      waitingQueue: [],
      completedPeople: 0,
      flowRate: 0,
      stats: []
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Prepare chart data
  const chartData = simulation.stats.map((count, second) => ({
    time: second,
    flow: count * 60 // Convert to people per minute
  })).slice(-60); // Last 60 seconds

  return (
    <div className="container mx-auto p-4">
      <div><em>Note : one-shot by Deepseek v3.2 </em></div>
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">Escalator Strategy Simulator</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Inputs */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Escalator Variables</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Escalator Length (meters): {escalatorLength}
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="50"
                      step="1"
                      value={escalatorLength}
                      onChange={(e) => setEscalatorLength(Number(e.target.value))}
                      className="w-full"
                      disabled={simulation.running}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Escalator Speed (m/s): {escalatorSpeed}
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.1"
                      value={escalatorSpeed}
                      onChange={(e) => setEscalatorSpeed(Number(e.target.value))}
                      className="w-full"
                      disabled={simulation.running}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">People Variables</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Arrival Rate (people/minute): {peopleArrivalRate}
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="300"
                      step="10"
                      value={peopleArrivalRate}
                      onChange={(e) => setPeopleArrivalRate(Number(e.target.value))}
                      className="w-full"
                      disabled={simulation.running}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Strategy
                    </label>
                    <select
                      value={strategy}
                      onChange={(e) => setStrategy(Number(e.target.value))}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      disabled={simulation.running}
                    >
                      <option value={1}>Strategy 1: Everyone stands</option>
                      <option value={2}>Strategy 2: Walk left, stand right</option>
                    </select>
                  </div>
                  
                  {strategy === 2 && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Walking Percentage: {walkingPercentage}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={walkingPercentage}
                          onChange={(e) => setWalkingPercentage(Number(e.target.value))}
                          className="w-full"
                          disabled={simulation.running}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Average Walking Speed (m/s): {averageWalkingSpeed}
                        </label>
                        <input
                          type="range"
                          min="0.5"
                          max="4"
                          step="0.1"
                          value={averageWalkingSpeed}
                          onChange={(e) => setAverageWalkingSpeed(Number(e.target.value))}
                          className="w-full"
                          disabled={simulation.running}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Walking Speed Variation: {walkingSpeedStdDev}
                        </label>
                        <input
                          type="range"
                          min="0.1"
                          max="2"
                          step="0.1"
                          value={walkingSpeedStdDev}
                          onChange={(e) => setWalkingSpeedStdDev(Number(e.target.value))}
                          className="w-full"
                          disabled={simulation.running}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Simulation Controls</h2>
                <div className="flex space-x-4">
                  {!simulation.running ? (
                    <button
                      onClick={startSimulation}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md transition-colors"
                    >
                      Start Simulation
                    </button>
                  ) : (
                    <button
                      onClick={stopSimulation}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-md transition-colors"
                    >
                      Stop Simulation
                    </button>
                  )}
                  <button
                    onClick={resetSimulation}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-md transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Visualization and Statistics */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Escalator Animation</h2>
                
                <div className="border-2 border-gray-300 rounded-lg p-4 bg-gray-50">
                  {/* Queue visualization */}
                  <div className="mb-4">
                    <h3 className="text-sm font-medium mb-2">Waiting Queue: {simulation.waitingQueue.length} people</h3>
                    <div className="flex flex-wrap gap-1 min-h-8">
                      {simulation.waitingQueue.slice(0, 50).map(person => (
                        <div
                          key={person.id}
                          className={`w-3 h-3 rounded-full ${
                            person.wantsToWalk ? 'bg-blue-500' : 'bg-green-500'
                          }`}
                          title={person.wantsToWalk ? 'Walker' : 'Standing'}
                        />
                      ))}
                      {simulation.waitingQueue.length > 50 && (
                        <span className="text-xs text-gray-500">+{simulation.waitingQueue.length - 50} more</span>
                      )}
                    </div>
                  </div>

                  {/* Escalator visualization */}
                  <div className="relative h-64 border-2 border-gray-400 rounded bg-gradient-to-b from-gray-200 to-gray-300">
                    {/* Escalator steps */}
                    {Array.from({ length: escalatorLength }, (_, i) => (
                      <div
                        key={i}
                        className="absolute w-full h-1 border-t border-gray-400"
                        style={{ bottom: `${(i / escalatorLength) * 100}%` }}
                      />
                    ))}
                    
                    {/* Strategy lanes */}
                    {strategy === 2 && (
                      <>
                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-red-500"></div>
                        <div className="absolute left-1/4 text-xs text-red-500">Walk</div>
                        <div className="absolute right-1/4 text-xs text-green-500">Stand</div>
                      </>
                    )}
                    
                    {/* People on escalator */}
                    {simulation.people.map(person => {
                      const bottomPosition = (person.position / escalatorLength) * 100;
                      const laneOffset = strategy === 2 ? 
                        (person.wantsToWalk ? 'left-1/4' : 'right-1/4') : 
                        'left-1/2';
                      
                      return (
                        <div
                          key={person.id}
                          className={`absolute w-3 h-3 rounded-full transform -translate-x-1/2 ${
                            person.wantsToWalk ? 'bg-blue-500' : 'bg-green-500'
                          } ${laneOffset}`}
                          style={{ bottom: `${Math.min(100, bottomPosition)}%` }}
                        />
                      );
                    })}
                  </div>
                  
                  <div className="mt-2 text-sm text-gray-600">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span>Standing</span>
                      </div>
                      {strategy === 2 && (
                        <div className="flex items-center space-x-1">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          <span>Walking</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Statistics</h2>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{simulation.completedPeople}</div>
                    <div className="text-sm text-gray-600">Total Completed</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {Math.round(simulation.flowRate)}/min
                    </div>
                    <div className="text-sm text-gray-600">Current Flow Rate</div>
                  </div>
                </div>

                <h3 className="text-lg font-medium mb-3">Flow Rate Over Time</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" label={{ value: 'Time (seconds)', position: 'insideBottom', offset: -5 }} />
                      <YAxis label={{ value: 'People per minute', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="flow" stroke="#8884d8" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Simulation Information</h2>
                <div className="space-y-2 text-sm text-gray-600">
                  <p><strong>Simulation Time:</strong> {simulation.time.toFixed(1)} seconds</p>
                  <p><strong>People on Escalator:</strong> {simulation.people.length}</p>
                  <p><strong>People in Queue:</strong> {simulation.waitingQueue.length}</p>
                  <p><strong>Strategy:</strong> {strategy === 1 ? 'Everyone stands' : 'Walk left, stand right'}</p>
                  {strategy === 2 && (
                    <p><strong>Walking Percentage:</strong> {walkingPercentage}%</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default DSv32Viz;