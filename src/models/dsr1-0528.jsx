/****************************************************** 
 * LICENCE : DEEPSEEK R1 OUTPUT (SERVED VIA HYPERBOLIC)
*******************************************************/

import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const DSR10528Viz = () => {
  // Input states
  const [escalatorLength, setEscalatorLength] = useState(100);
  const [escalatorSpeed, setEscalatorSpeed] = useState(0.5);
  const [totalPeople, setTotalPeople] = useState(200);
  const [walkingPercentage, setWalkingPercentage] = useState(30);
  const [avgWalkingSpeed, setAvgWalkingSpeed] = useState(0.8);
  const [stdDev, setStdDev] = useState(0.2);
  const [strategy, setStrategy] = useState(1);
  
  // Simulation states
  const [simulation, setSimulation] = useState({
    running: false,
    time: 0,
    people: [],
    queue: [],
    transported: 0,
    stats: { strategy1: null, strategy2: null }
  });
  
  const animationRef = useRef(null);
  const lastTimeRef = useRef(0);

  // Generate normal distribution for walking speeds
  const generateWalkingSpeed = () => {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    const speed = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return Math.max(0.1, avgWalkingSpeed + speed * stdDev);
  };

  // Initialize simulation
  const initSimulation = () => {
    const queue = Array.from({ length: totalPeople }, (_, i) => ({
      id: i,
      position: -5 - Math.floor(i / 2),
      lane: strategy === 1 ? null : i % 2 === 0 ? 'right' : 'left',
      walkingSpeed: strategy === 1 ? 0 : 
                   i % 2 < walkingPercentage / 100 ? generateWalkingSpeed() : 0,
      status: 'waiting'
    }));

    setSimulation({
      running: true,
      time: 0,
      people: [],
      queue,
      transported: 0,
      stats: simulation.stats
    });

    lastTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(updateSimulation);
  };

  // Main simulation loop
  const updateSimulation = (timestamp) => {
    const deltaTime = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;

    setSimulation(prev => {
      let { people, queue, transported, time, stats } = prev;
      time += deltaTime;

      // Update people on escalator
      const updatedPeople = people.map(person => {
        const speed = escalatorSpeed + (person.lane === 'left' ? person.walkingSpeed : 0);
        const newPosition = person.position + speed * deltaTime;
        
        // Handle blocking on left lane
        if (person.lane === 'left') {
          const personAhead = people.find(p => 
            p.lane === 'left' && 
            p.position > person.position &&
            p.position < person.position + 1
          );
          if (personAhead) return { ...person, position: person.position + escalatorSpeed * deltaTime };
        }
        
        return { ...person, position: newPosition };
      });

      // Move people who reached the top
      const arrived = updatedPeople.filter(p => p.position >= escalatorLength);
      const stillMoving = updatedPeople.filter(p => p.position < escalatorLength);
      const newTransported = transported + arrived.length;

      // Add new people to escalator
      const newQueue = [...queue];
      const newPeople = [...stillMoving];
      let addedCount = 0;

      while (newQueue.length > 0 && addedCount < 2) {
        const nextPerson = newQueue[0];
        const laneOccupied = newPeople.some(p => 
          Math.abs(p.position) < 1 && 
          (strategy === 1 || p.lane === nextPerson.lane)
        );

        if (!laneOccupied) {
          newPeople.push({
            ...newQueue.shift(),
            position: 0,
            status: 'moving'
          });
          addedCount++;
        } else {
          break;
        }
      }

      // Update queue positions
      const updatedQueue = newQueue.map((person, i) => ({
        ...person,
        position: -5 - Math.floor(i / (strategy === 1 ? 2 : 1))
      }));

      // Stop condition
      let running = true;
      if (newQueue.length === 0 && newPeople.length === 0) {
        running = false;
        const flowRate = newTransported / time;
        stats = {
          ...stats,
          [`strategy${strategy}`]: {
            totalTime: time,
            peopleTransported: newTransported,
            flowRate: flowRate * 60 // people per minute
          }
        };
      }

      return {
        running,
        time,
        people: newPeople,
        queue: updatedQueue,
        transported: newTransported,
        stats
      };
    });

    if (simulation.running) {
      animationRef.current = requestAnimationFrame(updateSimulation);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Reset simulation
  const resetSimulation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setSimulation({
      running: false,
      time: 0,
      people: [],
      queue: [],
      transported: 0,
      stats: simulation.stats
    });
  };

  // Prepare data for chart
  const chartData = [
    {
      name: 'Strategy 1',
      'Flow Rate': simulation.stats.strategy1?.flowRate || 0,
    },
    {
      name: 'Strategy 2',
      'Flow Rate': simulation.stats.strategy2?.flowRate || 0,
    }
  ];

  return (
    <div className="flex flex-col md:flex-row gap-8 p-4 max-w-6xl mx-auto">
      {/* Left Column - Inputs */}
      <div className="w-full md:w-1/3 space-y-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Escalator Variables</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Escalator Length (steps)
              </label>
              <input
                type="range"
                min="50"
                max="200"
                value={escalatorLength}
                onChange={(e) => setEscalatorLength(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-center">{escalatorLength}</div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Escalator Speed (steps/s)
              </label>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={escalatorSpeed}
                onChange={(e) => setEscalatorSpeed(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-center">{escalatorSpeed.toFixed(1)}</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">People Variables</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Total People
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={totalPeople}
                onChange={(e) => setTotalPeople(Number(e.target.value))}
                className="w-full p-2 border rounded"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Walking Percentage
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={walkingPercentage}
                onChange={(e) => setWalkingPercentage(Number(e.target.value))}
                className="w-full"
                disabled={strategy === 1}
              />
              <div className="text-center">{walkingPercentage}%</div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Avg Walking Speed (steps/s)
              </label>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={avgWalkingSpeed}
                onChange={(e) => setAvgWalkingSpeed(Number(e.target.value))}
                className="w-full"
                disabled={strategy === 1}
              />
              <div className="text-center">{avgWalkingSpeed.toFixed(1)}</div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Speed Variation
              </label>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.05"
                value={stdDev}
                onChange={(e) => setStdDev(Number(e.target.value))}
                className="w-full"
                disabled={strategy === 1}
              />
              <div className="text-center">{stdDev.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Simulation Controls</h2>
          <div className="flex flex-col space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Strategy
              </label>
              <div className="flex space-x-4">
                <button
                  className={`px-4 py-2 rounded flex-1 ${
                    strategy === 1 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                  onClick={() => setStrategy(1)}
                >
                  Strategy 1 (Stand Only)
                </button>
                <button
                  className={`px-4 py-2 rounded flex-1 ${
                    strategy === 2 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                  onClick={() => setStrategy(2)}
                >
                  Strategy 2 (Walk + Stand)
                </button>
              </div>
            </div>
            
            <div className="flex space-x-3 pt-2">
              <button
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:bg-gray-400"
                onClick={initSimulation}
                disabled={simulation.running}
              >
                Start Simulation
              </button>
              <button
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700"
                onClick={resetSimulation}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Visualization & Results */}
      <div className="w-full md:w-2/3 space-y-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Simulation</h2>
          <div className="border-2 border-gray-300 rounded-lg h-96 relative overflow-hidden">
            {/* Escalator Visualization */}
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-32 h-full bg-gradient-to-r from-gray-200 to-gray-300">
              {/* Escalator steps */}
              {Array.from({ length: Math.floor(escalatorLength / 5) }).map((_, i) => (
                <div 
                  key={i}
                  className="absolute w-full h-0.5 bg-gray-400"
                  style={{ bottom: `${(i * 5) / escalatorLength * 100}%` }}
                />
              ))}
              
              {/* People on escalator */}
              {simulation.people.map(person => (
                <div
                  key={person.id}
                  className={`absolute w-3 h-3 rounded-full ${
                    person.lane === 'left' ? 'bg-blue-500' : 
                    person.lane === 'right' ? 'bg-green-500' : 'bg-gray-700'
                  }`}
                  style={{
                    left: person.lane === 'left' ? '25%' : '75%',
                    bottom: `${(person.position / escalatorLength) * 100}%`,
                    transform: 'translateX(-50%)'
                  }}
                />
              ))}
            </div>
            
            {/* Queue visualization */}
            <div className="absolute bottom-0 left-0 right-0">
              {simulation.queue.map((person, index) => (
                <div
                  key={person.id}
                  className={`absolute w-3 h-3 rounded-full ${
                    strategy === 1 ? 'bg-gray-700' : 
                    person.lane === 'left' ? 'bg-blue-300' : 'bg-green-300'
                  }`}
                  style={{
                    left: strategy === 1 ? '50%' : person.lane === 'left' ? '25%' : '75%',
                    bottom: '0%',
                    transform: `translate(${
                      strategy === 1 ? '-50%' : '-50%'
                    }, ${-person.position * 5}px)`
                  }}
                />
              ))}
            </div>
            
            {/* Top indicator */}
            <div className="absolute top-0 left-0 right-0 text-center p-2 bg-gray-800 text-white">
              Top (Transported: {simulation.transported})
            </div>
          </div>
          
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div className="bg-gray-100 p-3 rounded">
              <div className="text-sm text-gray-600">Simulation Time</div>
              <div className="text-xl font-bold">{simulation.time.toFixed(1)}s</div>
            </div>
            <div className="bg-gray-100 p-3 rounded">
              <div className="text-sm text-gray-600">People Transported</div>
              <div className="text-xl font-bold">{simulation.transported}</div>
            </div>
            <div className="bg-gray-100 p-3 rounded">
              <div className="text-sm text-gray-600">Flow Rate</div>
              <div className="text-xl font-bold">
                {simulation.stats[`strategy${strategy}`]?.flowRate
                  ? `${simulation.stats[`strategy${strategy}`].flowRate.toFixed(1)}/min` 
                  : '0/min'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Strategy Comparison</h2>
          <div className="h-64">
            <BarChart
              width={600}
              height={250}
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis label={{ value: 'People per minute', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Flow Rate" fill="#8884d8" />
            </BarChart>
          </div>
          
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded border border-blue-200">
              <h3 className="font-bold text-lg text-blue-800 mb-2">Strategy 1 (Stand Only)</h3>
              {simulation.stats.strategy1 ? (
                <>
                  <p>Total Time: {simulation.stats.strategy1.totalTime.toFixed(1)}s</p>
                  <p>People Transported: {simulation.stats.strategy1.peopleTransported}</p>
                  <p className="font-bold">
                    Flow Rate: {simulation.stats.strategy1.flowRate.toFixed(1)} people/min
                  </p>
                </>
              ) : (
                <p>No data available</p>
              )}
            </div>
            
            <div className="bg-green-50 p-4 rounded border border-green-200">
              <h3 className="font-bold text-lg text-green-800 mb-2">Strategy 2 (Walk + Stand)</h3>
              {simulation.stats.strategy2 ? (
                <>
                  <p>Total Time: {simulation.stats.strategy2.totalTime.toFixed(1)}s</p>
                  <p>People Transported: {simulation.stats.strategy2.peopleTransported}</p>
                  <p className="font-bold">
                    Flow Rate: {simulation.stats.strategy2.flowRate.toFixed(1)} people/min
                  </p>
                </>
              ) : (
                <p>No data available</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DSR10528Viz;