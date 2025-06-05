/****************************************************** 
 * LICENCE : DEEPSEEK R1 OUTPUT (SERVED VIA HYPERBOLIC)
*******************************************************/

import { useState, useEffect, useRef } from 'react';

class Person {
  constructor(strategy, walkingSpeed, escalatorSpeed, lane = 0) {
    this.position = 0;
    this.strategy = strategy;
    this.lane = lane;
    this.baseSpeed = this.strategy === 2 && lane === 0 ? walkingSpeed : 0;
    this.effectiveSpeed = this.baseSpeed + escalatorSpeed;
    this.actualSpeed = this.effectiveSpeed;
  }
}

function generateNormalDistribution(mean, stdDev) {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  return Math.abs(mean + stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v));
}

function DSr1Viz() {
  const [inputs, setInputs] = useState({
    length: 100,
    speed: 1,
    peopleCount: 200,
    walkingPercentage: 30,
    avgWalkingSpeed: 1.5,
    speedStdDev: 0.3,
    strategy: 1,
  });
  
  const [stats, setStats] = useState({
    totalProcessed: 0,
    flowRate: 0,
    queueLength: 0,
  });
  
  const [simulation, setSimulation] = useState({
    running: false,
    startTime: null,
    lastUpdate: null,
    people: [],
    queue: [],
  });
  
  const canvasRef = useRef(null);
  const animationFrameId = useRef(null);

  // Simulation logic
  const updateSimulation = (timestamp) => {
    if (!simulation.running) return;
    
    const deltaTime = simulation.lastUpdate ? (timestamp - simulation.lastUpdate) / 1000 : 0;
    const escalatorCapacity = Math.floor(inputs.length / 1) * 2; // 2 people per step
    
    // Process existing people
    const newPeople = simulation.people.filter(person => {
      person.position += person.actualSpeed * deltaTime;
      return person.position < inputs.length;
    });
    
    // Process queue
    const availableSpaces = escalatorCapacity - newPeople.length;
    const peopleToAdd = Math.min(availableSpaces, simulation.queue.length);
    
    const addedPeople = Array(peopleToAdd).fill().map(() => {
      const person = simulation.queue.shift();
      if(inputs.strategy === 2) {
        const lane = person.walking ? 0 : 1;
        let speed = person.walking ? 
          generateNormalDistribution(inputs.avgWalkingSpeed, inputs.speedStdDev) : 
          0;
        return new Person(2, speed, inputs.speed, lane);
      }
      return new Person(1, 0, inputs.speed);
    });
    
    // Update stats
    const processedCount = simulation.people.length - newPeople.length;
    const newStats = {
      totalProcessed: stats.totalProcessed + processedCount,
      flowRate: processedCount / deltaTime * 60 || 0,
      queueLength: simulation.queue.length,
    };
    
    setStats(newStats);
    setSimulation(prev => ({
      ...prev,
      people: [...newPeople, ...addedPeople],
      lastUpdate: timestamp,
    }));
    
    animationFrameId.current = requestAnimationFrame(updateSimulation);
  };

  // Animation drawing
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw escalator
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(100, 0);
    ctx.lineTo(100, canvas.height);
    ctx.stroke();
    
    // Draw people
    simulation.people.forEach(person => {
      ctx.fillStyle = person.lane === 0 ? '#ff0000' : '#0000ff';
      const y = canvas.height - (person.position / inputs.length * canvas.height);
      const x = person.lane === 0 ? 50 : 150;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Draw queue
    simulation.queue.forEach((_, i) => {
      ctx.fillStyle = '#666';
      const x = inputs.strategy === 2 ? (i % 2 === 0 ? 30 : 170) : 100;
      const y = canvas.height + 10 + Math.floor(i / 2) * 10;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  useEffect(() => {
    if (simulation.running) {
      animationFrameId.current = requestAnimationFrame(updateSimulation);
    }
    return () => cancelAnimationFrame(animationFrameId.current);
  }, [simulation.running]);

  useEffect(draw, [simulation.people, simulation.queue]);

  const handleStart = () => {
    const initialQueue = Array(inputs.peopleCount).fill().map(() => ({
      walking: Math.random() * 100 < inputs.walkingPercentage,
    }));
    
    setSimulation({
      running: true,
      startTime: performance.now(),
      lastUpdate: performance.now(),
      people: [],
      queue: initialQueue,
    });
    
    setStats({
      totalProcessed: 0,
      flowRate: 0,
      queueLength: inputs.peopleCount,
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 w-full">
        <div><em>Note : r1 built this in one shot </em></div>
        <div className="flex h-screen bg-gray-100">
        {/* Left Column - Inputs */}
        <div className="w-1/3 p-4 space-y-4">
            <h2 className="text-xl font-bold">Escalator Parameters</h2>
            <div className="space-y-2">
            <label className="block">
                Length (steps):
                <input type="number" value={inputs.length} onChange={e => setInputs({...inputs, length: e.target.value})}
                className="border rounded p-1 w-full"/>
            </label>
            {/* Add other inputs similarly for speed, people count, etc. */}
            </div>
            
            <button onClick={handleStart} className="bg-blue-500 text-white px-4 py-2 rounded">
            {simulation.running ? 'Stop' : 'Start'} Simulation
            </button>
            
            <div className="mt-4">
            <h3 className="font-bold">Statistics</h3>
            <p>Processed: {stats.totalProcessed}</p>
            <p>Flow Rate: {stats.flowRate.toFixed(1)} people/min</p>
            <p>Queue: {stats.queueLength}</p>
            </div>
        </div>

        {/* Right Column - Animation */}
        <div className="w-2/3 p-4">
            <canvas 
            ref={canvasRef} 
            width={400} 
            height={600}
            className="border rounded"
            />
        </div>
        </div>
    </div>
  );
}

export default DSr1Viz;