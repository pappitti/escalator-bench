/****************************************************** 
 * LICENSE : CLAUDE OPUS 4 OUTPUT
*******************************************************/
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ClaudeOpus4Viz = () => {
  // Simulation parameters
  const [escalatorLength, setEscalatorLength] = useState(30); // meters
  const [escalatorSpeed, setEscalatorSpeed] = useState(0.5); // m/s
  const [numPeople, setNumPeople] = useState(100);
  const [percentWalkers, setPercentWalkers] = useState(50);
  const [avgWalkingSpeed, setAvgWalkingSpeed] = useState(0.75); // m/s relative to escalator
  const [walkingSpeedStdDev, setWalkingSpeedStdDev] = useState(0.2);
  const [arrivalRate, setArrivalRate] = useState(5); // people per second
  const [stepLength, setStepLength] = useState(0.4); // meters per step
  
  // Simulation state
  const [isRunning, setIsRunning] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [people, setPeople] = useState([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [queueLength, setQueueLength] = useState(0);
  const [flowData, setFlowData] = useState([]);
  const [strategy, setStrategy] = useState(2); // 1 or 2
  
  const animationRef = useRef();
  const canvasRef = useRef();
  const lastUpdateRef = useRef(Date.now());
  const peopleArrivedRef = useRef(0);
  const lastFlowUpdateRef = useRef(0);

  // Generate normal distribution for walking speeds
  const generateWalkingSpeed = () => {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0.1, avgWalkingSpeed + z * walkingSpeedStdDev);
  };

  // Create a new person
  const createPerson = (id, isWalker) => ({
    id,
    position: -2, // Start in queue
    isWalker: isWalker && strategy === 2,
    walkingSpeed: isWalker ? generateWalkingSpeed() : 0,
    onEscalator: false,
    completed: false,
    lane: isWalker && strategy === 2 ? 'left' : 'right',
    queuePosition: 0
  });

  // Reset simulation
  const resetSimulation = useCallback(() => {
    setIsRunning(false);
    setCurrentTime(0);
    setPeople([]);
    setCompletedCount(0);
    setQueueLength(0);
    setFlowData([]);
    peopleArrivedRef.current = 0;
    lastFlowUpdateRef.current = 0;
  }, []);

  // Initialize people
  useEffect(() => {
    if (isRunning && people.length === 0) {
      const initialPeople = [];
      for (let i = 0; i < Math.min(20, numPeople); i++) {
        const isWalker = Math.random() * 100 < percentWalkers;
        initialPeople.push(createPerson(i, isWalker));
      }
      setPeople(initialPeople);
      peopleArrivedRef.current = initialPeople.length;
    }
  }, [isRunning, people.length, numPeople, percentWalkers]);

  // Main simulation loop
  useEffect(() => {
    if (!isRunning) return;

    const animate = () => {
      const now = Date.now();
      const deltaTime = (now - lastUpdateRef.current) / 1000; // Convert to seconds
      lastUpdateRef.current = now;

      setCurrentTime(prev => prev + deltaTime);

      setPeople(prevPeople => {
        let updatedPeople = [...prevPeople];
        let newCompletedCount = 0;

        // Add new people based on arrival rate
        const peopleToAdd = Math.floor(arrivalRate * deltaTime);
        if (peopleToAdd > 0 && peopleArrivedRef.current < numPeople) {
          for (let i = 0; i < peopleToAdd && peopleArrivedRef.current < numPeople; i++) {
            const isWalker = Math.random() * 100 < percentWalkers;
            updatedPeople.push(createPerson(peopleArrivedRef.current, isWalker));
            peopleArrivedRef.current++;
          }
        }

        // Update queue positions
        const queuedPeople = updatedPeople.filter(p => !p.onEscalator && !p.completed);
        queuedPeople.sort((a, b) => a.id - b.id);
        
        if (strategy === 2) {
          const leftQueue = queuedPeople.filter(p => p.lane === 'left');
          const rightQueue = queuedPeople.filter(p => p.lane === 'right');
          
          leftQueue.forEach((person, index) => {
            person.queuePosition = index;
          });
          
          rightQueue.forEach((person, index) => {
            person.queuePosition = index;
          });
        } else {
          queuedPeople.forEach((person, index) => {
            person.queuePosition = Math.floor(index / 2);
          });
        }

        // Check who can board the escalator
        const onEscalator = updatedPeople.filter(p => p.onEscalator && !p.completed);
        const canBoard = {
          left: true,
          right: true
        };

        // Check if boarding positions are occupied
        if (strategy === 2) {
          const leftLaneBottom = onEscalator.filter(p => p.lane === 'left' && p.position < stepLength);
          const rightLaneBottom = onEscalator.filter(p => p.lane === 'right' && p.position < stepLength);
          
          if (leftLaneBottom.length > 0) canBoard.left = false;
          if (rightLaneBottom.length > 0) canBoard.right = false;
        } else {
          const bottomPeople = onEscalator.filter(p => p.position < stepLength);
          if (bottomPeople.length >= 2) {
            canBoard.left = false;
            canBoard.right = false;
          }
        }

        // Update positions
        updatedPeople = updatedPeople.map(person => {
          if (person.completed) return person;

          // Try to board escalator
          if (!person.onEscalator && person.queuePosition === 0) {
            if (strategy === 2) {
              if ((person.lane === 'left' && canBoard.left) || 
                  (person.lane === 'right' && canBoard.right)) {
                person.onEscalator = true;
                person.position = 0;
              }
            } else {
              if (canBoard.right || canBoard.left) {
                person.onEscalator = true;
                person.position = 0;
                if (canBoard.right) {
                  canBoard.right = false;
                } else {
                  canBoard.left = false;
                }
              }
            }
          }

          // Move on escalator
          if (person.onEscalator) {
            let speed = escalatorSpeed;
            
            if (person.isWalker) {
              // Check for blocking
              const aheadPeople = onEscalator.filter(p => 
                p.lane === person.lane && 
                p.position > person.position && 
                p.position < person.position + stepLength * 2
              );
              
              if (aheadPeople.length === 0) {
                speed += person.walkingSpeed;
              }
            }
            
            person.position += speed * deltaTime;

            // Check if completed
            if (person.position >= escalatorLength) {
              person.completed = true;
              newCompletedCount++;
            }
          }

          return person;
        });

        // Update completed count
        setCompletedCount(prev => prev + newCompletedCount);
        
        // Update queue length
        const currentQueueLength = updatedPeople.filter(p => !p.onEscalator && !p.completed).length;
        setQueueLength(currentQueueLength);

        return updatedPeople;
      });

      // Update flow data every second
      setCurrentTime(time => {
        if (Math.floor(time) > lastFlowUpdateRef.current) {
          lastFlowUpdateRef.current = Math.floor(time);
          setFlowData(prev => {
            const newData = [...prev];
            if (newData.length > 60) newData.shift(); // Keep last 60 seconds
            
            const recentCompleted = completedCount;
            const flowRate = newData.length > 0 
              ? (recentCompleted - (newData[newData.length - 1]?.completed || 0)) * 60
              : 0;
            
            newData.push({
              time: Math.floor(time),
              completed: recentCompleted,
              flowRate: flowRate,
              queueLength: queueLength
            });
            
            return newData;
          });
        }
        return time;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, escalatorSpeed, escalatorLength, arrivalRate, numPeople, percentWalkers, avgWalkingSpeed, walkingSpeedStdDev, stepLength, strategy, completedCount, queueLength]);

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
    const escalatorStartX = 100;
    const escalatorEndX = width - 50;
    const escalatorWidth = escalatorEndX - escalatorStartX;
    const escalatorY = height / 2;
    const laneHeight = 40;

    // Escalator outline
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.strokeRect(escalatorStartX, escalatorY - laneHeight, escalatorWidth, laneHeight * 2);

    // Lane divider for strategy 2
    if (strategy === 2) {
      ctx.strokeStyle = '#9CA3AF';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(escalatorStartX, escalatorY);
      ctx.lineTo(escalatorEndX, escalatorY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw queue area
    ctx.fillStyle = '#F3F4F6';
    ctx.fillRect(0, escalatorY - laneHeight, escalatorStartX, laneHeight * 2);

    // Labels
    ctx.fillStyle = '#374151';
    ctx.font = '12px sans-serif';
    ctx.fillText('Queue', 30, escalatorY - laneHeight - 10);
    ctx.fillText('Escalator', escalatorStartX + escalatorWidth / 2 - 30, escalatorY - laneHeight - 10);

    if (strategy === 2) {
      ctx.fillText('Walk', escalatorStartX + 10, escalatorY - 10);
      ctx.fillText('Stand', escalatorStartX + 10, escalatorY + 20);
    }

    // Draw people
    people.forEach(person => {
      if (person.completed) return;

      let x, y;
      
      if (!person.onEscalator) {
        // In queue
        const queueOffset = person.queuePosition * 15;
        x = escalatorStartX - 20 - queueOffset;
        y = person.lane === 'left' ? escalatorY - laneHeight / 2 : escalatorY + laneHeight / 2;
      } else {
        // On escalator
        const progress = person.position / escalatorLength;
        x = escalatorStartX + progress * escalatorWidth;
        y = person.lane === 'left' ? escalatorY - laneHeight / 2 : escalatorY + laneHeight / 2;
      }

      // Draw person
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = person.isWalker ? '#3B82F6' : '#10B981';
      ctx.fill();
    });

    // Draw completion counter
    ctx.fillStyle = '#374151';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Completed: ${completedCount}`, escalatorEndX - 100, 30);
  }, [people, strategy, completedCount, escalatorLength]);

  // Calculate statistics
  const avgFlowRate = flowData.length > 5 
    ? flowData.slice(-5).reduce((sum, d) => sum + d.flowRate, 0) / 5 
    : 0;

  const theoreticalMaxFlow = strategy === 1 
    ? (2 / stepLength) * escalatorSpeed * 60 
    : ((1 / stepLength) * escalatorSpeed + (percentWalkers / 100) * (1 / stepLength) * (escalatorSpeed + avgWalkingSpeed)) * 60;

  return (
    <div className="container mx-auto p-4">
      <div><em>Note : one-shot from Claude Opus 4 </em></div>
      <div className="flex h-screen bg-gray-50">
        
        {/* Left Column - Controls */}
        <div className="w-1/3 p-6 bg-white shadow-lg overflow-y-auto">
          <h2 className="text-2xl font-bold mb-6">Escalator Simulator</h2>
          
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Strategy</h3>
            <select 
              value={strategy} 
              onChange={(e) => {
                setStrategy(Number(e.target.value));
                resetSimulation();
              }}
              className="w-full p-2 border rounded"
            >
              <option value={1}>Strategy 1: Everyone Stands (2 per step)</option>
              <option value={2}>Strategy 2: Stand Right, Walk Left</option>
            </select>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Escalator Variables</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Length (meters)</label>
              <input
                type="number"
                value={escalatorLength}
                onChange={(e) => setEscalatorLength(Number(e.target.value))}
                className="w-full p-2 border rounded"
                min="10"
                max="100"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Speed (m/s)</label>
              <input
                type="number"
                value={escalatorSpeed}
                onChange={(e) => setEscalatorSpeed(Number(e.target.value))}
                className="w-full p-2 border rounded"
                min="0.1"
                max="1"
                step="0.1"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Step Length (meters)</label>
              <input
                type="number"
                value={stepLength}
                onChange={(e) => setStepLength(Number(e.target.value))}
                className="w-full p-2 border rounded"
                min="0.3"
                max="0.6"
                step="0.05"
              />
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">People Parameters</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Total People</label>
              <input
                type="number"
                value={numPeople}
                onChange={(e) => setNumPeople(Number(e.target.value))}
                className="w-full p-2 border rounded"
                min="10"
                max="500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Arrival Rate (people/second)</label>
              <input
                type="number"
                value={arrivalRate}
                onChange={(e) => setArrivalRate(Number(e.target.value))}
                className="w-full p-2 border rounded"
                min="0.5"
                max="20"
                step="0.5"
              />
            </div>
            
            {strategy === 2 && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">% Walking</label>
                  <input
                    type="number"
                    value={percentWalkers}
                    onChange={(e) => setPercentWalkers(Number(e.target.value))}
                    className="w-full p-2 border rounded"
                    min="0"
                    max="100"
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Avg Walking Speed (m/s)</label>
                  <input
                    type="number"
                    value={avgWalkingSpeed}
                    onChange={(e) => setAvgWalkingSpeed(Number(e.target.value))}
                    className="w-full p-2 border rounded"
                    min="0.1"
                    max="2"
                    step="0.1"
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Walking Speed Std Dev</label>
                  <input
                    type="number"
                    value={walkingSpeedStdDev}
                    onChange={(e) => setWalkingSpeedStdDev(Number(e.target.value))}
                    className="w-full p-2 border rounded"
                    min="0"
                    max="0.5"
                    step="0.05"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {isRunning ? '⏸' : '▶'}
              {isRunning ? 'Pause' : 'Start'}
            </button>
            
            <button
              onClick={resetSimulation}
              className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              ↻ Reset
            </button>
          </div>
        </div>

        {/* Right Column - Visualization */}
        <div className="flex-1 p-6">
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">Simulation</h3>
            <canvas
              ref={canvasRef}
              width={800}
              height={200}
              className="border rounded bg-white w-full"
            />
            <div className="mt-2 flex gap-4 text-sm">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                Walkers
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                Standers
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-lg font-semibold mb-3">Statistics</h3>
              <div className="space-y-2">
                <p>Time: {currentTime.toFixed(1)}s</p>
                <p>Completed: {completedCount} / {numPeople}</p>
                <p>Queue Length: {queueLength}</p>
                <p>Avg Flow Rate: {avgFlowRate.toFixed(1)} people/min</p>
                <p>Theoretical Max: {theoreticalMaxFlow.toFixed(1)} people/min</p>
                <p>Efficiency: {theoreticalMaxFlow > 0 ? ((avgFlowRate / theoreticalMaxFlow) * 100).toFixed(1) : 0}%</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-lg font-semibold mb-3">Flow Rate Over Time</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={flowData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="flowRate" 
                    stroke="#3B82F6" 
                    name="Flow Rate (people/min)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaudeOpus4Viz;