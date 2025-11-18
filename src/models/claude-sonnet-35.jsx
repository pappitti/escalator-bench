/****************************************************** 
 * LICENSE : CLAUDE OUTPUT
*******************************************************/
import React, { useState, useEffect, useRef } from 'react';

// Simulation constants
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const PERSON_RADIUS = 5;

const ClaudeSonnet35Viz = () => {
  // Simulation parameters
  const [params, setParams] = useState({
    escalatorLength: 30, // meters
    escalatorSpeed: 0.5, // meters per second
    peoplePerMinute: 60,
    walkingPercentage: 0,
    avgWalkingSpeed: 1.2, // meters per second
    walkingSpeedSD: 0.2, // standard deviation
    strategy: 1 // 1 or 2
  });

  // Simulation state
  const [people, setPeople] = useState([]);
  const [stats, setStats] = useState({
    peopleCompleted: 0,
    averageTime: 0,
    peopleWaiting: 0
  });
  const [isRunning, setIsRunning] = useState(false);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastTimeRef = useRef(Date.now());

  // Generate random walking speed from normal distribution
  const generateWalkingSpeed = () => {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    const speed = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return params.avgWalkingSpeed + speed * params.walkingSpeedSD;
  };

  // Add new person to simulation
  const addPerson = () => {
    const isWalking = params.strategy === 2 && Math.random() < params.walkingPercentage / 100;
    const walkingSpeed = isWalking ? generateWalkingSpeed() : 0;
    
    setPeople(prev => [...prev, {
      id: Date.now(),
      x: CANVAS_WIDTH / 4 + (Math.random() * CANVAS_WIDTH / 2),
      y: CANVAS_HEIGHT - PERSON_RADIUS,
      isWalking,
      walkingSpeed,
      startTime: Date.now(),
      onEscalator: false,
      lane: isWalking ? 1 : 0, // 0 for standing, 1 for walking
      progress: 0 // progress up the escalator (0 to 1)
    }]);
  };

  // Update simulation state
  const updateSimulation = () => {
    const currentTime = Date.now();
    const deltaTime = (currentTime - lastTimeRef.current) / 1000;
    lastTimeRef.current = currentTime;

    setPeople(prev => {
      const updated = prev.map(person => {
        if (!person.onEscalator) {
          // Move towards escalator base
          const targetX = CANVAS_WIDTH / 2 + (person.lane === 1 ? 20 : -20);
          const dx = (targetX - person.x) * 2 * deltaTime;
          const dy = Math.min(0, (CANVAS_HEIGHT - 100 - person.y) * 2 * deltaTime);
          
          if (Math.abs(person.x - targetX) < 5 && Math.abs(person.y - (CANVAS_HEIGHT - 100)) < 5) {
            return { ...person, onEscalator: true };
          }
          
          return {
            ...person,
            x: person.x + dx,
            y: person.y + dy
          };
        } else {
          // Move up escalator
          const speed = params.escalatorSpeed + (person.isWalking ? person.walkingSpeed : 0);
          const newProgress = person.progress + (speed * deltaTime) / params.escalatorLength;
          
          if (newProgress >= 1) {
            setStats(prev => ({
              ...prev,
              peopleCompleted: prev.peopleCompleted + 1,
              averageTime: (prev.averageTime * prev.peopleCompleted + (Date.now() - person.startTime)) / (prev.peopleCompleted + 1)
            }));
            return null;
          }
          
          return {
            ...person,
            progress: newProgress
          };
        }
      }).filter(Boolean);

      setStats(prev => ({
        ...prev,
        peopleWaiting: updated.filter(p => !p.onEscalator).length
      }));

      return updated;
    });
  };

  // Animation loop
  useEffect(() => {
    if (!isRunning) return;

    const animate = () => {
      updateSimulation();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    
    // Add new people based on rate
    const interval = setInterval(() => {
      if (Math.random() < params.peoplePerMinute / 60) {
        addPerson();
      }
    }, 1000);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      clearInterval(interval);
    };
  }, [isRunning, params]);

  // Render simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw escalator
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2 - 30, CANVAS_HEIGHT - 100);
    ctx.lineTo(CANVAS_WIDTH / 2 + 30, CANVAS_HEIGHT - 100);
    ctx.lineTo(CANVAS_WIDTH / 2 + 30, 100);
    ctx.lineTo(CANVAS_WIDTH / 2 - 30, 100);
    ctx.closePath();
    ctx.strokeStyle = '#666';
    ctx.stroke();

    // Draw people
    people.forEach(person => {
      ctx.beginPath();
      if (person.onEscalator) {
        const y = CANVAS_HEIGHT - 100 - (CANVAS_HEIGHT - 200) * person.progress;
        ctx.arc(
          CANVAS_WIDTH / 2 + (person.lane === 1 ? 20 : -20),
          y,
          PERSON_RADIUS,
          0,
          Math.PI * 2
        );
      } else {
        ctx.arc(person.x, person.y, PERSON_RADIUS, 0, Math.PI * 2);
      }
      ctx.fillStyle = person.isWalking ? '#ff0000' : '#0000ff';
      ctx.fill();
    });
  }, [people]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-start">
      <div><em>Note : Claude built this in one shot </em></div>
      <div className="flex gap-4 p-4">
        {/* Left column - Controls */}
        <div className="w-1/3 bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Simulation Controls</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Escalator Length (m)
              </label>
              <input
                type="number"
                className="w-full p-2 border rounded"
                value={params.escalatorLength}
                onChange={e => setParams(prev => ({ ...prev, escalatorLength: parseFloat(e.target.value) }))}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Escalator Speed (m/s)
              </label>
              <input
                type="number"
                className="w-full p-2 border rounded"
                value={params.escalatorSpeed}
                onChange={e => setParams(prev => ({ ...prev, escalatorSpeed: parseFloat(e.target.value) }))}
                step="0.1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                People per Minute
              </label>
              <input
                type="number"
                className="w-full p-2 border rounded"
                value={params.peoplePerMinute}
                onChange={e => setParams(prev => ({ ...prev, peoplePerMinute: parseInt(e.target.value) }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Walking Percentage
              </label>
              <input
                type="number"
                className="w-full p-2 border rounded"
                value={params.walkingPercentage}
                onChange={e => setParams(prev => ({ ...prev, walkingPercentage: parseFloat(e.target.value) }))}
                disabled={params.strategy === 1}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Strategy</label>
              <select
                className="w-full p-2 border rounded"
                value={params.strategy}
                onChange={e => setParams(prev => ({ ...prev, strategy: parseInt(e.target.value) }))}
              >
                <option value={1}>Everyone Stands</option>
                <option value={2}>Walk Left, Stand Right</option>
              </select>
            </div>

            <button
              onClick={() => setIsRunning(!isRunning)}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
            >
              {isRunning ? 'Pause' : 'Start'}
            </button>

            <button
              onClick={() => {
                setPeople([]);
                setStats({
                  peopleCompleted: 0,
                  averageTime: 0,
                  peopleWaiting: 0
                });
              }}
              className="w-full border border-gray-300 py-2 px-4 rounded hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Right column - Simulation and Stats */}
        <div className="w-2/3 space-y-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">Simulation</h2>
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="border rounded"
            />
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">Statistics</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">People Completed</p>
                <p className="text-2xl font-bold">{stats.peopleCompleted}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Average Time (s)</p>
                <p className="text-2xl font-bold">{(stats.averageTime / 1000).toFixed(1)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">People Waiting</p>
                <p className="text-2xl font-bold">{stats.peopleWaiting}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaudeSonnet35Viz;