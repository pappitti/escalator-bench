/****************************************************** 
 * LICENSE : CLAUDE OUTPUT
*******************************************************/
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RefreshCw } from 'lucide-react';

// Normal distribution function
const generateNormalRandom = (mean, stdDev) => {
  // Box-Muller transform
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
};

// Custom Slider component
const CustomSlider = ({ min, max, step, value, onChange, className = "" }) => {
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <div className={`relative w-full h-6 ${className}`}>
      <div className="absolute w-full h-2 bg-gray-200 rounded-full top-2"></div>
      <div 
        className="absolute h-2 bg-blue-500 rounded-full top-2" 
        style={{ width: `${percentage}%` }}
      ></div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="absolute w-full h-2 opacity-0 cursor-pointer z-10"
      />
      <div 
        className="absolute h-4 w-4 bg-white border-2 border-blue-500 rounded-full -mt-1 transform -translate-y-1/4"
        style={{ left: `calc(${percentage}% - 8px)`, top: "50%" }}
      ></div>
    </div>
  );
};

// Custom Select component
const CustomSelect = ({ value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative w-full" ref={selectRef}>
      <button
        type="button"
        className="flex items-center justify-between w-full p-2 text-left bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{options.find(opt => opt.value === value)?.label || "Select..."}</span>
        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          {options.map((option) => (
            <div
              key={option.value}
              className="px-4 py-2 cursor-pointer hover:bg-blue-50"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Main app
const ClaudeSonnet37Viz = () => {
  // Simulation states
  const [strategy, setStrategy] = useState("1");
  const [running, setRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [people, setPeople] = useState([]);
  const [completedCount, setCompletedCount] = useState({ strategy1: 0, strategy2: 0 });
  const [queueLength, setQueueLength] = useState({ strategy1: 0, strategy2: 0 });
  
  // Input states
  const [escalatorLength, setEscalatorLength] = useState(50);
  const [escalatorSpeed, setEscalatorSpeed] = useState(0.5);
  const [peopleArrivalRate, setPeopleArrivalRate] = useState(1.5);
  const [percentWalking, setPercentWalking] = useState(30);
  const [walkingSpeed, setWalkingSpeed] = useState(1.2);
  const [walkingSpeedStdDev, setWalkingSpeedStdDev] = useState(0.2);
  
  // Animation references
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  // Reset the simulation
  const resetSimulation = () => {
    setRunning(false);
    setTime(0);
    setPeople([]);
    setCompletedCount({ strategy1: 0, strategy2: 0 });
    setQueueLength({ strategy1: 0, strategy2: 0 });
  };

  // Toggle simulation running state
  const toggleSimulation = () => {
    setRunning(!running);
  };

  // Generate a new person
  const generatePerson = () => {
    const isWalker = Math.random() < (percentWalking / 100);
    const speed = isWalker ? 
      generateNormalRandom(walkingSpeed, walkingSpeedStdDev) : 
      0;
    
    return {
      id: Math.random(),
      position: -1, // -1 means in queue
      side: isWalker ? 'left' : 'right',
      walkingSpeed: speed,
      lane: null, // Will be assigned when entering escalator
      enteredAt: null,
      isWalker
    };
  };

  // Run the simulation step
  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      setTime(prevTime => prevTime + 1);
      
      // Generate new people based on arrival rate
      if (Math.random() < peopleArrivalRate / 10) {
        setPeople(prevPeople => [...prevPeople, generatePerson()]);
      }
      
      // Update positions
      setPeople(prevPeople => {
        let updatedPeople = [...prevPeople];
        
        // First, update positions of people on the escalator
        updatedPeople = updatedPeople.map(person => {
          if (person.position >= 0) {
            // Person is on the escalator
            const baseSpeed = escalatorSpeed;
            const additionalSpeed = person.isWalker && strategy === "2" ? person.walkingSpeed : 0;
            
            // Check if there's someone in front of them in the same lane
            const personInFront = updatedPeople.find(p => 
              p.lane === person.lane && 
              p.position > person.position && 
              p.position < person.position + 2
            );
            
            if (personInFront && person.isWalker) {
              // Can't go faster than the person in front
              const maxSpeed = baseSpeed + (personInFront.isWalker ? personInFront.walkingSpeed : 0);
              const effectiveAdditionalSpeed = Math.min(additionalSpeed, maxSpeed - baseSpeed);
              person.position += baseSpeed + effectiveAdditionalSpeed;
            } else {
              person.position += baseSpeed + additionalSpeed;
            }
            
            // Check if the person has reached the top
            if (person.position >= escalatorLength) {
              setCompletedCount(prev => {
                return {
                  ...prev,
                  [strategy === "1" ? "strategy1" : "strategy2"]: prev[strategy === "1" ? "strategy1" : "strategy2"] + 1
                };
              });
              return null; // Remove the person
            }
          }
          return person;
        }).filter(Boolean); // Remove null entries (people who reached the top)
        
        // Next, try to move people from the queue to the escalator
        // Get people in queue
        const queuedPeople = updatedPeople.filter(p => p.position === -1);
        setQueueLength({ 
          ...queueLength, 
          [strategy === "1" ? "strategy1" : "strategy2"]: queuedPeople.length 
        });
        
        // Get people at the bottom of the escalator (position 0-1)
        const peopleAtBottom = updatedPeople.filter(p => p.position >= 0 && p.position < 2);
        
        // For strategy 1: Two people per step, regardless of walker/stander
        if (strategy === "1") {
          // Each step can have at most 2 people
          const availableSlots = 2 - peopleAtBottom.length;
          
          for (let i = 0; i < Math.min(availableSlots, queuedPeople.length); i++) {
            const personToBoard = queuedPeople[i];
            personToBoard.position = 0;
            personToBoard.enteredAt = time;
            personToBoard.lane = i % 2; // Alternate lanes
          }
        } 
        // For strategy 2: Walkers on left, standers on right
        else {
          // Check available slots on each side
          const peopleAtBottomLeft = peopleAtBottom.filter(p => p.lane === 0);
          const peopleAtBottomRight = peopleAtBottom.filter(p => p.lane === 1);
          
          const availableSlotsLeft = 1 - peopleAtBottomLeft.length;
          const availableSlotsRight = 1 - peopleAtBottomRight.length;
          
          // Move walkers to left lane if possible
          const queuedWalkers = queuedPeople.filter(p => p.isWalker);
          const queuedStanders = queuedPeople.filter(p => !p.isWalker);
          
          for (let i = 0; i < Math.min(availableSlotsLeft, queuedWalkers.length); i++) {
            const personToBoard = queuedWalkers[i];
            personToBoard.position = 0;
            personToBoard.enteredAt = time;
            personToBoard.lane = 0; // Left lane
          }
          
          // Move standers to right lane if possible
          for (let i = 0; i < Math.min(availableSlotsRight, queuedStanders.length); i++) {
            const personToBoard = queuedStanders[i];
            personToBoard.position = 0;
            personToBoard.enteredAt = time;
            personToBoard.lane = 1; // Right lane
          }
        }
        
        return updatedPeople;
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, [running, strategy, escalatorLength, escalatorSpeed, peopleArrivalRate, percentWalking, walkingSpeed, walkingSpeedStdDev, time]);

  // Draw the simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw escalator
    const escalatorWidth = width * 0.4;
    const escalatorX = width / 2 - escalatorWidth / 2;
    const escalatorHeight = height * 0.8;
    const escalatorY = height * 0.1;
    
    // Draw escalator background
    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(escalatorX, escalatorY, escalatorWidth, escalatorHeight);
    
    // Draw lane divider for strategy 2
    if (strategy === "2") {
      ctx.strokeStyle = '#9ca3af';
      ctx.beginPath();
      ctx.moveTo(escalatorX + escalatorWidth / 2, escalatorY);
      ctx.lineTo(escalatorX + escalatorWidth / 2, escalatorY + escalatorHeight);
      ctx.stroke();
    }
    
    // Draw steps
    const stepHeight = 10;
    const numSteps = Math.floor(escalatorHeight / stepHeight);
    
    ctx.fillStyle = '#9ca3af';
    for (let i = 0; i < numSteps; i++) {
      const y = escalatorY + i * stepHeight;
      ctx.fillRect(escalatorX, y, escalatorWidth, 1);
    }
    
    // Draw queue area
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(escalatorX, escalatorY + escalatorHeight, escalatorWidth, height * 0.1);
    
    if (strategy === "2") {
      ctx.strokeStyle = '#9ca3af';
      ctx.beginPath();
      ctx.moveTo(escalatorX + escalatorWidth / 2, escalatorY + escalatorHeight);
      ctx.lineTo(escalatorX + escalatorWidth / 2, height);
      ctx.stroke();
    }
    
    // Draw people
    people.forEach(person => {
      // Define positions
      let x, y;
      
      if (person.position === -1) {
        // Person in queue
        const queuedPeople = people.filter(p => p.position === -1);
        const indexInQueue = queuedPeople.indexOf(person);
        const queueRows = Math.ceil(queuedPeople.length / 4);
        const queueCols = Math.min(queuedPeople.length, 4);
        
        const rowIndex = Math.floor(indexInQueue / 4);
        const colIndex = indexInQueue % 4;
        
        if (strategy === "1") {
          x = escalatorX + (colIndex + 0.5) * (escalatorWidth / 4);
          y = escalatorY + escalatorHeight + (rowIndex + 0.5) * (height * 0.1 / queueRows);
        } else {
          // Split queue for strategy 2
          if (person.isWalker) {
            x = escalatorX + (colIndex % 2 + 0.5) * (escalatorWidth / 4);
            y = escalatorY + escalatorHeight + (rowIndex + 0.5) * (height * 0.1 / queueRows);
          } else {
            x = escalatorX + escalatorWidth / 2 + (colIndex % 2 + 0.5) * (escalatorWidth / 4);
            y = escalatorY + escalatorHeight + (rowIndex + 0.5) * (height * 0.1 / queueRows);
          }
        }
      } else {
        // Person on escalator
        const progress = person.position / escalatorLength;
        const laneWidth = escalatorWidth / (strategy === "1" ? 2 : 2);
        const laneOffset = person.lane * laneWidth;
        
        x = escalatorX + laneOffset + laneWidth / 2;
        y = escalatorY + escalatorHeight - (progress * escalatorHeight);
      }
      
      // Draw person
      ctx.fillStyle = person.isWalker ? '#3b82f6' : '#ef4444';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Continue animation
    animationRef.current = requestAnimationFrame(() => {});
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [people, strategy]);

  // Calculate stats
  const flowRate = {
    strategy1: time > 0 ? (completedCount.strategy1 / time * 600).toFixed(2) : 0,
    strategy2: time > 0 ? (completedCount.strategy2 / time * 600).toFixed(2) : 0
  };

  // UI Component
  return (
    <div className="container mx-auto p-4">
        <div><em>Note : Claude built this in one shot </em></div>
      <div className="flex flex-col md:flex-row w-full gap-4 p-4 min-h-screen">
        {/* Left Column - Inputs */}
        <div className="w-full md:w-1/3 space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-xl font-bold">Escalator Strategy Simulator</h2>
            </div>
            <div className="p-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Strategy</label>
                <CustomSelect 
                  value={strategy} 
                  onChange={setStrategy}
                  options={[
                    { value: "1", label: "Strategy 1: Everyone Stands (2 per step)" },
                    { value: "2", label: "Strategy 2: Stand Right, Walk Left" }
                  ]}
                />
              </div>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Escalator Variables</h3>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <label className="block text-sm font-medium text-gray-700">Escalator Length</label>
                        <span className="text-sm text-gray-500">{escalatorLength} units</span>
                      </div>
                      <CustomSlider 
                        min={20} 
                        max={100} 
                        step={1} 
                        value={escalatorLength} 
                        onChange={setEscalatorLength}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <label className="block text-sm font-medium text-gray-700">Escalator Speed</label>
                        <span className="text-sm text-gray-500">{escalatorSpeed} units/sec</span>
                      </div>
                      <CustomSlider 
                        min={0.1} 
                        max={1} 
                        step={0.1} 
                        value={escalatorSpeed} 
                        onChange={setEscalatorSpeed}
                      />
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">People Variables</h3>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <label className="block text-sm font-medium text-gray-700">Arrival Rate</label>
                        <span className="text-sm text-gray-500">{peopleArrivalRate} people/sec</span>
                      </div>
                      <CustomSlider 
                        min={0.1} 
                        max={3} 
                        step={0.1} 
                        value={peopleArrivalRate} 
                        onChange={setPeopleArrivalRate}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <label className="block text-sm font-medium text-gray-700">Percentage Walking</label>
                        <span className="text-sm text-gray-500">{percentWalking}%</span>
                      </div>
                      <CustomSlider 
                        min={0} 
                        max={100} 
                        step={5} 
                        value={percentWalking} 
                        onChange={setPercentWalking}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <label className="block text-sm font-medium text-gray-700">Average Walking Speed</label>
                        <span className="text-sm text-gray-500">+{walkingSpeed} units/sec</span>
                      </div>
                      <CustomSlider 
                        min={0.2} 
                        max={2} 
                        step={0.1} 
                        value={walkingSpeed} 
                        onChange={setWalkingSpeed}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <label className="block text-sm font-medium text-gray-700">Walking Speed Variation (σ)</label>
                        <span className="text-sm text-gray-500">±{walkingSpeedStdDev} units/sec</span>
                      </div>
                      <CustomSlider 
                        min={0.05} 
                        max={0.5} 
                        step={0.05} 
                        value={walkingSpeedStdDev} 
                        onChange={setWalkingSpeedStdDev}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Column - Simulation */}
        <div className="w-full md:w-2/3 space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Simulation</h2>
                <div className="flex space-x-2">
                  <button 
                    className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
                    onClick={toggleSimulation}
                  >
                    {running ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <button 
                    className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
                    onClick={resetSimulation}
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="mb-4 text-sm text-gray-500">
                Time: {(time / 10).toFixed(1)} seconds | 
                People in queue: {queueLength[strategy === "1" ? "strategy1" : "strategy2"]} | 
                People completed: {completedCount[strategy === "1" ? "strategy1" : "strategy2"]}
              </div>
              
              <div className="relative border rounded-lg bg-gray-50 overflow-hidden">
                <canvas 
                  ref={canvasRef} 
                  width={600} 
                  height={400} 
                  className="w-full h-96"
                />
              </div>
              
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <h3 className="text-md font-semibold mb-2">Strategy 1: Everyone Stands</h3>
                  <div className="text-2xl font-bold text-blue-600">
                    {flowRate.strategy1} <span className="text-sm font-normal text-gray-500">people/min</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Total completed: {completedCount.strategy1}
                  </div>
                </div>
                
                <div className="border rounded-lg p-4">
                  <h3 className="text-md font-semibold mb-2">Strategy 2: Stand Right, Walk Left</h3>
                  <div className="text-2xl font-bold text-green-600">
                    {flowRate.strategy2} <span className="text-sm font-normal text-gray-500">people/min</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Total completed: {completedCount.strategy2}
                  </div>
                </div>
              </div>
              
              <div className="mt-4 border rounded-lg p-4">
                <h3 className="text-md font-semibold mb-2">Comparison</h3>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 text-center">
                    <div className="text-xl font-bold">
                      {flowRate.strategy1 > flowRate.strategy2 ? (
                        <span className="text-blue-600">Strategy 1 Wins</span>
                      ) : flowRate.strategy2 > flowRate.strategy1 ? (
                        <span className="text-green-600">Strategy 2 Wins</span>
                      ) : (
                        <span className="text-gray-600">Equal</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {flowRate.strategy1 > flowRate.strategy2 ? (
                        <span>+{(flowRate.strategy1 - flowRate.strategy2).toFixed(2)} people/min</span>
                      ) : flowRate.strategy2 > flowRate.strategy1 ? (
                        <span>+{(flowRate.strategy2 - flowRate.strategy1).toFixed(2)} people/min</span>
                      ) : (
                        <span>No difference</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-xl font-bold">Simulation Legend</h2>
            </div>
            <div className="p-4">
              <div className="flex space-x-6">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-red-500"></div>
                  <span>Standers</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                  <span>Walkers</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaudeSonnet37Viz;