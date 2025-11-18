/****************************************************** 
 * LICENSE : DEEPSEEK V3 OUTPUT (FP8 SERVED VIA HYPERBOLIC)
*******************************************************/

import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const DSv3Viz = () => {
  // Input states
  const [escalatorLength, setEscalatorLength] = useState(100);
  const [escalatorSpeed, setEscalatorSpeed] = useState(1);
  const [numPeople, setNumPeople] = useState(100);
  const [walkingPercentage, setWalkingPercentage] = useState(30);
  const [avgWalkingSpeed, setAvgWalkingSpeed] = useState(2);
  const [walkingSpeedStdDev, setWalkingSpeedStdDev] = useState(0.5);
  const [strategy, setStrategy] = useState(1);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationTime, setSimulationTime] = useState(0);
  
  // Simulation states
  const [people, setPeople] = useState([]);
  const [peopleAtTop, setPeopleAtTop] = useState(0);
  const [peopleAtBottom, setPeopleAtBottom] = useState(0);
  const [stats, setStats] = useState([]);
  const [comparisonData, setComparisonData] = useState([]);
  
  const animationRef = useRef();
  const lastTimeRef = useRef(0);
  const peopleGeneratedRef = useRef(0);
  const lastStatTimeRef = useRef(0);

  // Generate a random walking speed based on normal distribution
  const getRandomWalkingSpeed = () => {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    const speed = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return Math.max(0.1, avgWalkingSpeed + speed * walkingSpeedStdDev);
  };

  // Initialize simulation
  const startSimulation = () => {
    setPeople([]);
    setPeopleAtTop(0);
    setPeopleAtBottom(0);
    setStats([]);
    setSimulationTime(0);
    peopleGeneratedRef.current = 0;
    lastStatTimeRef.current = 0;
    setSimulationRunning(true);
  };

  // Stop simulation
  const stopSimulation = () => {
    setSimulationRunning(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  // Reset simulation
  const resetSimulation = () => {
    stopSimulation();
    setPeople([]);
    setPeopleAtTop(0);
    setPeopleAtBottom(0);
    setStats([]);
    setSimulationTime(0);
  };

  // Run strategy 1 simulation (no walking)
  const runStrategy1Simulation = (deltaTime) => {
    // Generate new people
    const newPeople = [];
    const peopleToGenerate = Math.min(5, numPeople - peopleGeneratedRef.current);
    
    for (let i = 0; i < peopleToGenerate; i++) {
      newPeople.push({
        id: Date.now() + i,
        position: 0,
        speed: escalatorSpeed,
        walking: false,
        lane: Math.random() < 0.5 ? 'left' : 'right',
        arrivalTime: simulationTime
      });
    }
    peopleGeneratedRef.current += peopleToGenerate;
    
    // Update existing people
    const updatedPeople = people.map(person => {
      const newPosition = person.position + person.speed * deltaTime;
      return {
        ...person,
        position: newPosition
      };
    }).filter(person => person.position < escalatorLength);
    
    // Count people who reached the top
    const arrivedPeople = people.filter(person => person.position >= escalatorLength).length;
    setPeopleAtTop(prev => prev + arrivedPeople);
    
    // Combine new and updated people
    setPeople([...updatedPeople, ...newPeople]);
    setPeopleAtBottom(newPeople.length);
  };

  // Run strategy 2 simulation (with walking)
  const runStrategy2Simulation = (deltaTime) => {
    // Generate new people
    const newPeople = [];
    const peopleToGenerate = Math.min(5, numPeople - peopleGeneratedRef.current);
    
    for (let i = 0; i < peopleToGenerate; i++) {
      const isWalker = Math.random() * 100 < walkingPercentage;
      newPeople.push({
        id: Date.now() + i,
        position: 0,
        speed: isWalker ? escalatorSpeed + getRandomWalkingSpeed() : escalatorSpeed,
        walking: isWalker,
        lane: isWalker ? 'left' : 'right',
        arrivalTime: simulationTime
      });
    }
    peopleGeneratedRef.current += peopleToGenerate;
    
    // Update existing people with collision detection
    const updatedPeople = people.map(person => {
      // Find the person directly in front in the same lane
      const personInFront = people
        .filter(p => p.lane === person.lane && p.position > person.position)
        .sort((a, b) => a.position - b.position)[0];
      
      let effectiveSpeed = person.speed;
      
      // If there's someone in front and we're moving faster, match their speed
      if (personInFront && person.speed > personInFront.speed) {
        const distance = personInFront.position - person.position;
        if (distance < 2) { // Minimum safe distance
          effectiveSpeed = personInFront.speed;
        }
      }
      
      const newPosition = person.position + effectiveSpeed * deltaTime;
      return {
        ...person,
        position: newPosition,
        effectiveSpeed
      };
    }).filter(person => person.position < escalatorLength);
    
    // Count people who reached the top
    const arrivedPeople = people.filter(person => person.position >= escalatorLength).length;
    setPeopleAtTop(prev => prev + arrivedPeople);
    
    // Combine new and updated people
    setPeople([...updatedPeople, ...newPeople]);
    setPeopleAtBottom(newPeople.length);
  };

  // Main simulation loop
  const simulate = (timestamp) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const deltaTime = (timestamp - lastTimeRef.current) / 1000; // Convert to seconds
    lastTimeRef.current = timestamp;
    
    if (simulationRunning && peopleGeneratedRef.current < numPeople) {
      setSimulationTime(prev => prev + deltaTime);
      
      if (strategy === 1) {
        runStrategy1Simulation(deltaTime);
      } else {
        runStrategy2Simulation(deltaTime);
      }
      
      // Update statistics every second
      if (simulationTime - lastStatTimeRef.current >= 1) {
        const flowRate = peopleAtTop / simulationTime * 60; // people per minute
        setStats(prev => [...prev, {
          time: Math.floor(simulationTime),
          flowRate,
          peopleAtBottom
        }]);
        lastStatTimeRef.current = simulationTime;
      }
    } else if (peopleGeneratedRef.current >= numPeople && people.length === 0) {
      // All people have been processed
      stopSimulation();
    }
    
    animationRef.current = requestAnimationFrame(simulate);
  };

  // Start/stop animation frame when simulationRunning changes
  useEffect(() => {
    if (simulationRunning) {
      animationRef.current = requestAnimationFrame(simulate);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [simulationRunning]);

  // Compare strategies
  const compareStrategies = () => {
    // Run strategy 1 simulation virtually
    const strategy1Time = escalatorLength / escalatorSpeed;
    const strategy1Flow = numPeople / (strategy1Time) * 60;
    
    // Estimate strategy 2 flow
    const walkers = numPeople * (walkingPercentage / 100);
    const standers = numPeople - walkers;
    
    // Average walking speed considering normal distribution
    const avgEffectiveWalkingSpeed = Math.min(escalatorSpeed + avgWalkingSpeed, escalatorSpeed + avgWalkingSpeed + walkingSpeedStdDev);
    
    const walkerTime = escalatorLength / (escalatorSpeed + avgEffectiveWalkingSpeed);
    const standerTime = escalatorLength / escalatorSpeed;
    
    const totalTime = Math.max(walkerTime * walkers, standerTime * standers) / Math.max(walkers, standers);
    const strategy2Flow = numPeople / totalTime * 60;
    
    setComparisonData([
      { name: 'Strategy 1', flow: strategy1Flow },
      { name: 'Strategy 2', flow: strategy2Flow }
    ]);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div><em>Note : Deepseek v3 built this in one shot </em></div>
      
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column - Inputs */}
        <div className="w-full lg:w-1/3 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Simulation Parameters</h2>
          
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Escalator Variables</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Escalator Length (steps)</label>
                <input
                  type="number"
                  min="10"
                  max="200"
                  value={escalatorLength}
                  onChange={(e) => setEscalatorLength(parseInt(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Escalator Speed (steps/second)</label>
                <input
                  type="number"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={escalatorSpeed}
                  onChange={(e) => setEscalatorSpeed(parseFloat(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">People Variables</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Number of People</label>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  value={numPeople}
                  onChange={(e) => setNumPeople(parseInt(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Percentage Walking (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={walkingPercentage}
                  onChange={(e) => setWalkingPercentage(parseInt(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  disabled={strategy === 1}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Average Walking Speed (steps/second)</label>
                <input
                  type="number"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={avgWalkingSpeed}
                  onChange={(e) => setAvgWalkingSpeed(parseFloat(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  disabled={strategy === 1}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Walking Speed Standard Deviation</label>
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={walkingSpeedStdDev}
                  onChange={(e) => setWalkingSpeedStdDev(parseFloat(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  disabled={strategy === 1}
                />
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Strategy</h3>
            <div className="flex space-x-4">
              <button
                onClick={() => setStrategy(1)}
                className={`px-4 py-2 rounded-md ${strategy === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                Strategy 1 (All Stand)
              </button>
              <button
                onClick={() => setStrategy(2)}
                className={`px-4 py-2 rounded-md ${strategy === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                Strategy 2 (Stand/Walk)
              </button>
            </div>
          </div>
          
          <div className="flex space-x-4">
            <button
              onClick={startSimulation}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              disabled={simulationRunning}
            >
              Start Simulation
            </button>
            <button
              onClick={stopSimulation}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              disabled={!simulationRunning}
            >
              Stop
            </button>
            <button
              onClick={resetSimulation}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Reset
            </button>
            <button
              onClick={compareStrategies}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              Compare
            </button>
          </div>
        </div>
        
        {/* Right Column - Visualization and Stats */}
        <div className="w-full lg:w-2/3 space-y-6">
          {/* Escalator Visualization */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Escalator Visualization</h2>
            <div className="relative h-64 border-2 border-gray-300 rounded-md overflow-hidden">
              {/* Escalator steps */}
              {Array.from({ length: Math.floor(escalatorLength / 5) }).map((_, i) => (
                <div 
                  key={i} 
                  className="absolute w-full h-1 bg-gray-200"
                  style={{ bottom: `${i * 5}px` }}
                ></div>
              ))}
              
              {/* People */}
              {people.map((person) => (
                <div
                  key={person.id}
                  className={`absolute w-3 h-3 rounded-full ${person.walking ? 'bg-blue-500' : 'bg-green-500'}`}
                  style={{
                    bottom: `${person.position}px`,
                    left: person.lane === 'left' ? '30%' : '70%',
                    transform: 'translateX(-50%)'
                  }}
                ></div>
              ))}
              
              {/* Bottom queue */}
              <div className="absolute bottom-0 left-0 right-0 h-8 flex justify-center">
                {strategy === 1 ? (
                  <div className="flex space-x-1">
                    {Array.from({ length: Math.min(10, peopleAtBottom) }).map((_, i) => (
                      <div key={i} className="w-2 h-2 bg-gray-500 rounded-full"></div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="w-1/2 flex justify-center space-x-1">
                      {Array.from({ length: Math.min(5, Math.ceil(peopleAtBottom * (walkingPercentage / 100)))}).map((_, i) => (
                        <div key={`left-${i}`} className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      ))}
                    </div>
                    <div className="w-1/2 flex justify-center space-x-1">
                      {Array.from({ length: Math.min(5, Math.floor(peopleAtBottom * (1 - walkingPercentage / 100)))}).map((_, i) => (
                        <div key={`right-${i}`} className="w-2 h-2 bg-green-500 rounded-full"></div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="bg-blue-100 p-3 rounded-md">
                <p className="text-sm text-gray-600">People at Top</p>
                <p className="text-xl font-bold">{peopleAtTop}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-md">
                <p className="text-sm text-gray-600">People at Bottom</p>
                <p className="text-xl font-bold">{peopleAtBottom}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-md">
                <p className="text-sm text-gray-600">Flow Rate</p>
                <p className="text-xl font-bold">
                  {stats.length > 0 ? Math.round(stats[stats.length - 1].flowRate) : 0} people/min
                </p>
              </div>
            </div>
          </div>
          
          {/* Statistics */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Flow Rate Over Time</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" label={{ value: 'Time (seconds)', position: 'insideBottomRight', offset: -5 }} />
                  <YAxis label={{ value: 'People per minute', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="flowRate" name="Flow Rate (people/min)" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Strategy Comparison */}
          {comparisonData.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Strategy Comparison</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis label={{ value: 'People per minute', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="flow" name="Flow Rate (people/min)" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DSv3Viz;