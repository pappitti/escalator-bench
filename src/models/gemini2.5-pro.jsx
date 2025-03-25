/****************************************************** 
 * LICENCE : GEMINI 2.5 PRO EXPERIMENTAL OUTPUT
*******************************************************/

import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- Simulation Constants ---
const MIN_PERSON_SPACING = 0.8; // meters - vertical distance people maintain
const PERSON_RADIUS_PX = 5; // For visualization
const SIMULATION_STEP_MS = 50; // Update frequency (milliseconds)
const dt = SIMULATION_STEP_MS / 1000; // Time step in seconds
const VISUALIZATION_SCALE = 5; // pixels per meter for visualization height
const ESCALATOR_WIDTH_PX = 100; // Visual width

// --- Helper Function ---
// Basic Normal Distribution sampling (Box-Muller transform)
function randomNormal(mean, stdDev) {
  let u = 0, v = 0;
  while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
  while(v === 0) v = Math.random();
  let num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
  num = num * stdDev + mean;
  return Math.max(0.1, num); // Ensure minimum walking speed
}

function SimulatorControls({ params, strategy, onParamChange, onStrategyChange, isRunning, onStart, onPause, onReset }) {
  return (
    <div className="space-y-4">
      {/* Strategy Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Strategy</label>
        <div className="flex space-x-4">
          <button
            onClick={() => onStrategyChange(1)}
            className={`px-3 py-1 rounded ${strategy === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            disabled={isRunning}
          >
            1: Stand Only
          </button>
          <button
            onClick={() => onStrategyChange(2)}
            className={`px-3 py-1 rounded ${strategy === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            disabled={isRunning}
          >
            2: Stand/Walk
          </button>
        </div>
      </div>

      {/* Escalator Variables */}
      <fieldset className="border p-3 rounded border-gray-300">
        <legend className="text-sm font-medium text-gray-700 px-1">Escalator</legend>
        <div className="space-y-2">
          <div>
            <label htmlFor="escalatorLength" className="block text-sm font-medium text-gray-700">Length (m)</label>
            <input type="number" name="escalatorLength" id="escalatorLength" value={params.escalatorLength} onChange={onParamChange} disabled={isRunning} min="5" step="1" className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"/>
          </div>
          <div>
            <label htmlFor="escalatorSpeed" className="block text-sm font-medium text-gray-700">Speed (m/s)</label>
            <input type="number" name="escalatorSpeed" id="escalatorSpeed" value={params.escalatorSpeed} onChange={onParamChange} disabled={isRunning} min="0.1" step="0.05" className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"/>
          </div>
        </div>
      </fieldset>

      {/* People Variables */}
      <fieldset className="border p-3 rounded border-gray-300">
        <legend className="text-sm font-medium text-gray-700 px-1">People</legend>
        <div className="space-y-2">
          <div>
            <label htmlFor="peopleArrivalRate" className="block text-sm font-medium text-gray-700">Arrival Rate (p/sec)</label>
            <input type="number" name="peopleArrivalRate" id="peopleArrivalRate" value={params.peopleArrivalRate} onChange={onParamChange} disabled={isRunning} min="0.1" step="0.1" className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"/>
          </div>
          {strategy === 2 && (
            <>
              <div>
                <label htmlFor="percentWalkers" className="block text-sm font-medium text-gray-700">% Walkers</label>
                <input type="number" name="percentWalkers" id="percentWalkers" value={params.percentWalkers} onChange={onParamChange} disabled={isRunning} min="0" max="100" step="1" className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"/>
              </div>
              <div>
                <label htmlFor="avgWalkingSpeed" className="block text-sm font-medium text-gray-700">Avg. Walk Speed (m/s)</label>
                <input type="number" name="avgWalkingSpeed" id="avgWalkingSpeed" value={params.avgWalkingSpeed} onChange={onParamChange} disabled={isRunning} min="0.1" step="0.05" className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"/>
              </div>
              <div>
                <label htmlFor="stdDevWalkingSpeed" className="block text-sm font-medium text-gray-700">Walk Speed Std Dev (m/s)</label>
                <input type="number" name="stdDevWalkingSpeed" id="stdDevWalkingSpeed" value={params.stdDevWalkingSpeed} onChange={onParamChange} disabled={isRunning} min="0" step="0.01" className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"/>
              </div>
            </>
          )}
        </div>
      </fieldset>

      {/* Control Buttons */}
      <div className="flex space-x-2 mt-6">
        {!isRunning ? (
          <button onClick={onStart} className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded">
            Start
          </button>
        ) : (
          <button onClick={onPause} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded">
            Pause
          </button>
        )}
        <button onClick={onReset} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded">
          Reset
        </button>
      </div>
    </div>
  );
}

function SimulatorDisplay({ people, escalatorLength, visualizationScale, personRadius, escalatorWidth, strategy }) {
  const escalatorHeightPx = escalatorLength * visualizationScale;

  // Filter people to display (on escalator or waiting near bottom)
  const visiblePeople = people.filter(p => p.state.startsWith('ON_ESCALATOR') || p.state === 'WAITING');

  return (
    <div className="relative w-full bg-gray-200 border border-gray-400 overflow-hidden" style={{ height: `${escalatorHeightPx + 60}px` }}>
      {/* Escalator structure (visual only) */}
      <div
        className="absolute bg-gray-400"
        style={{
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: '30px', // Space for queue area
          width: `${escalatorWidth}px`,
          height: `${escalatorHeightPx}px`,
        }}
      >
       {/* Optional: Add lines for lanes in strategy 2 */}
        {strategy === 2 && (
          <div className="absolute w-px h-full bg-gray-500 left-1/2 top-0"></div>
        )}
      </div>

      {/* People visualization */}
      {visiblePeople.map((person, index) => {
        let displayX, displayY;
        const personSize = personRadius * 2;

        if (person.state.startsWith('ON_ESCALATOR')) {
          // On the escalator
          displayX = (person.x || escalatorWidth / 2) - personRadius + (window.innerWidth - escalatorWidth)/2 ; // Center escalator roughly
          displayY = escalatorHeightPx - (person.y * visualizationScale) + 30 - personRadius; // Y=0 is at the bottom entry point
        } else {
          // Waiting in queue (simple horizontal layout below escalator)
           const queuePosition = index % 15; // Limit visible queue dots
           const queueRow = Math.floor(index / 15);
           if (strategy === 1) {
               displayX = (window.innerWidth / 2) - (7 * personSize) + (queuePosition * personSize) - personRadius;
           } else { // Strategy 2 - split queue visually
               const isWalker = person.targetWalkingSpeed > 0;
               const sideOffset = isWalker ? -escalatorWidth * 0.3 : escalatorWidth * 0.3;
               const basePos = (window.innerWidth / 2) + sideOffset;
                displayX = basePos - (4 * personSize) + (queuePosition * personSize) - personRadius; // Adjust index based on lane if needed
           }
           displayY = escalatorHeightPx + 35 + (queueRow * personSize) - personRadius;
        }

        // Determine color based on state/type
        let color = 'bg-gray-500'; // Default/Waiting
        if (person.state === 'ON_ESCALATOR_STAND') color = 'bg-blue-500';
        if (person.state === 'ON_ESCALATOR_WALK') color = 'bg-green-500';

        return (
          <div
            key={person.id}
            className={`absolute rounded-full ${color} transition-all duration-${SIMULATION_STEP_MS}`} // CSS transition can smooth movement slightly
            style={{
              width: `${personSize}px`,
              height: `${personSize}px`,
              left: `${displayX}px`,
              top: `${displayY}px`, // Changed from bottom for easier queue layout
              transition: `top ${dt}s linear, left ${dt}s linear` // Use JS timing mostly
            }}
            title={`ID: ${person.id} State: ${person.state} Y: ${person.y?.toFixed(1)}`}
          />
        );
      })}

       {/* Queue area visual indicator */}
       <div className="absolute bottom-0 left-0 w-full h-[30px] border-t border-dashed border-gray-500 text-center text-xs text-gray-600 pt-1">
         Queue Area
         {strategy === 2 && <div className="absolute w-px h-[30px] bg-gray-500 left-1/2 bottom-0"></div>}
       </div>
    </div>
  );
}

export function simulateStrategy1(params, minSpacing) {
  const { escalatorLength, escalatorSpeed, simulationTime } = params;

  if (!escalatorSpeed || !minSpacing) {
    return { throughputPerMinute: 0, travelTime: 0 };
  }

  // Capacity: How many pairs of people fit vertically? Not strictly needed for flow rate.
  // const capacityPerLane = Math.floor(escalatorLength / minSpacing);
  // const totalCapacity = capacityPerLane * 2;

  // Flow rate: How many people exit per second?
  // Time for one spot (or pair of spots) to travel the length = escalatorLength / escalatorSpeed
  // Number of spaces passing the exit point per second = escalatorSpeed / minSpacing
  // Since 2 people per "space" (step equivalent), flow rate = 2 * escalatorSpeed / minSpacing
  const flowRatePerSecond = 2 * escalatorSpeed / minSpacing;
  const throughputPerMinute = flowRatePerSecond * 60;

  // Travel Time: Simple time = distance / speed
  const travelTime = escalatorLength / escalatorSpeed;

  // Note: This ignores queue build-up and assumes the escalator is always full enough
  // to maintain max flow, and that arrival rate is sufficient.

  return {
    throughputPerMinute,
    travelTime,
  };
}


function Gemini25ProViz() {
  // --- Input State ---
  const [params, setParams] = useState({
    escalatorLength: 20, // meters
    escalatorSpeed: 0.75, // meters/second
    peopleArrivalRate: 1.5, // people/second (total)
    percentWalkers: 40, // percentage
    avgWalkingSpeed: 0.6, // meters/second (added to escalator speed)
    stdDevWalkingSpeed: 0.15, // meters/second
  });
  const [strategy, setStrategy] = useState(2); // 1 or 2

  // --- Simulation State ---
  const [isRunning, setIsRunning] = useState(false);
  const [simulationTime, setSimulationTime] = useState(0);
  const [people, setPeople] = useState([]); // Array of person objects
  const [nextPersonId, setNextPersonId] = useState(0);
  const [stats, setStats] = useState({ exitedCount: 0, queueSize: 0, avgTravelTime: 0 });
  const [strategy1Comparison, setStrategy1Comparison] = useState(null);

  // --- Refs for simulation loop ---
  const animationFrameRef = useRef();
  const lastUpdateTimeRef = useRef();
  const accumulatedTimeRef = useRef(0);
  const totalPeopleToGenerateRef = useRef(0); // To stop arrivals after a while if needed
  const peopleGeneratedRef = useRef(0);

  // --- Simulation Core Logic ---
  const runSimulationStep = useCallback(() => {
    const now = performance.now();
    const deltaTime = (now - (lastUpdateTimeRef.current || now)) / 1000; // seconds
    lastUpdateTimeRef.current = now;
    accumulatedTimeRef.current += deltaTime;

    let simulationDidUpdate = false;

    // Process discrete steps
    while (accumulatedTimeRef.current >= dt) {
      accumulatedTimeRef.current -= dt;
      setSimulationTime(prev => prev + dt);
      const currentSimTime = simulationTime + dt; // Use updated time for this step

      setPeople(prevPeople => {
        let newPeople = [...prevPeople];
        let newArrivals = [];
        let exitedThisStep = 0;
        let totalTravelTimeExited = 0;

        // 1. Arrivals
        const expectedArrivals = params.peopleArrivalRate * dt;
        const numNewArrivals = Math.floor(expectedArrivals) + (Math.random() < (expectedArrivals % 1) ? 1 : 0);

        if (peopleGeneratedRef.current < (totalPeopleToGenerateRef.current || Infinity)) {
           for (let i = 0; i < numNewArrivals && peopleGeneratedRef.current < (totalPeopleToGenerateRef.current || Infinity); i++) {
               const id = nextPersonId + i;
               const wantsToWalk = strategy === 2 && Math.random() * 100 < params.percentWalkers;
               const targetSpeed = wantsToWalk ? randomNormal(params.avgWalkingSpeed, params.stdDevWalkingSpeed) : 0;

               newArrivals.push({
                   id: id,
                   state: 'WAITING',
                   arrivalTime: currentSimTime,
                   x: 0, // Will be set on boarding
                   y: -1, // Not on escalator yet
                   targetWalkingSpeed: targetSpeed,
                   currentSpeed: 0,
                   lane: wantsToWalk ? 'LEFT' : 'RIGHT', // Default for strategy 2
                   entryTime: -1,
               });
               peopleGeneratedRef.current++;
           }
           setNextPersonId(prev => prev + newArrivals.length);
        }


        let updatedPeople = [...newPeople, ...newArrivals];
        let nextStatePeople = [];

        const peopleOnEscalator = updatedPeople.filter(p => p.state.startsWith('ON_ESCALATOR'));
        const waitingPeople = updatedPeople.filter(p => p.state === 'WAITING');
        let exitedPeople = updatedPeople.filter(p => p.state === 'EXITED');

        // 2. Boarding
        const canBoard = (lane) => {
          const peopleInLane = peopleOnEscalator.filter(p =>
            strategy === 1 || p.lane === lane
          );
          const lowestPerson = peopleInLane.reduce((lowest, p) => (!lowest || p.y < lowest.y) ? p : lowest, null);
          return !lowestPerson || lowestPerson.y >= MIN_PERSON_SPACING;
        };

        if (strategy === 1) {
          let boardedCount = 0;
          while (boardedCount < 2 && waitingPeople.length > 0 && canBoard('ANY')) {
             const personToBoard = waitingPeople.shift();
             if (personToBoard) {
                personToBoard.state = 'ON_ESCALATOR_STAND';
                personToBoard.y = 0;
                personToBoard.currentSpeed = params.escalatorSpeed;
                // Assign alternating x positions visually
                const standingOnRight = peopleOnEscalator.filter(p => p.y < MIN_PERSON_SPACING && p.x > ESCALATOR_WIDTH_PX / 2).length;
                const standingOnLeft = peopleOnEscalator.filter(p => p.y < MIN_PERSON_SPACING && p.x < ESCALATOR_WIDTH_PX / 2).length;
                 if (standingOnRight <= standingOnLeft) {
                     personToBoard.x = ESCALATOR_WIDTH_PX * 0.75; // Right side
                 } else {
                     personToBoard.x = ESCALATOR_WIDTH_PX * 0.25; // Left side
                 }
                personToBoard.lane = 'BOTH'; // Doesn't matter for movement logic in S1
                personToBoard.entryTime = currentSimTime;
                nextStatePeople.push(personToBoard);
                boardedCount++;
             }
          }
        } else { // Strategy 2
           // Board Right (Standing)
           const standerToBoard = waitingPeople.find(p => !p.targetWalkingSpeed);
           if (standerToBoard && canBoard('RIGHT')) {
               standerToBoard.state = 'ON_ESCALATOR_STAND';
               standerToBoard.y = 0;
               standerToBoard.currentSpeed = params.escalatorSpeed;
               standerToBoard.x = ESCALATOR_WIDTH_PX * 0.75; // Right lane vis
               standerToBoard.lane = 'RIGHT';
               standerToBoard.entryTime = currentSimTime;
               nextStatePeople.push(standerToBoard);
               waitingPeople.splice(waitingPeople.indexOf(standerToBoard), 1); // Remove from waiting
           }

           // Board Left (Walking)
           const walkerToBoard = waitingPeople.find(p => p.targetWalkingSpeed > 0);
           if (walkerToBoard && canBoard('LEFT')) {
               walkerToBoard.state = 'ON_ESCALATOR_WALK';
               walkerToBoard.y = 0;
               walkerToBoard.currentSpeed = params.escalatorSpeed + walkerToBoard.targetWalkingSpeed;
               walkerToBoard.x = ESCALATOR_WIDTH_PX * 0.25; // Left lane vis
               walkerToBoard.lane = 'LEFT';
               walkerToBoard.entryTime = currentSimTime;
               nextStatePeople.push(walkerToBoard);
               waitingPeople.splice(waitingPeople.indexOf(walkerToBoard), 1); // Remove from waiting
           }
        }

        // Add remaining waiting people back
        nextStatePeople.push(...waitingPeople);

        // 3. Movement & Exiting
        const activePeople = [...peopleOnEscalator, ...nextStatePeople.filter(p=> p.state.startsWith('ON_ESCALATOR'))]; // Combine those already on + just boarded
                                                                                                                    // Avoid duplicates if person boarded this step

        activePeople.sort((a, b) => b.y - a.y); // Process from top to bottom for blocking

        activePeople.forEach(p => {
           if (!p.state.startsWith('ON_ESCALATOR')) return; // Should not happen, but safeguard

           let potentialY = p.y + p.currentSpeed * dt;
           let blocked = false;

           // Check Exit
           if (potentialY >= params.escalatorLength) {
              p.state = 'EXITED';
              p.y = params.escalatorLength; // Place exactly at top for stats
              exitedThisStep++;
              totalTravelTimeExited += currentSimTime - p.entryTime;
              exitedPeople.push(p); // Add to exited list for this step processing
              return; // Stop processing this person
           }

           // Check Blocking (Strategy 2, Walkers only)
           if (p.state === 'ON_ESCALATOR_WALK') {
              let personAhead = null;
              let minAheadDist = Infinity;

              activePeople.forEach(other => {
                  if (other.id !== p.id && other.state.startsWith('ON_ESCALATOR') && other.lane === p.lane && other.y > p.y) {
                     const dist = other.y - p.y;
                     if (dist < minAheadDist) {
                         minAheadDist = dist;
                         personAhead = other;
                     }
                  }
              });


              if (personAhead && potentialY >= personAhead.y - MIN_PERSON_SPACING) {
                 p.y = Math.max(p.y, personAhead.y - MIN_PERSON_SPACING); // Don't move backward, ensure space
                 p.currentSpeed = personAhead.currentSpeed; // Match speed
                 blocked = true;
              }
           }

           // Apply Movement if not blocked differently
           if (!blocked) {
               p.y = potentialY;
               // Reset speed if walker was previously blocked but isn't now
               if (p.state === 'ON_ESCALATOR_WALK') {
                   p.currentSpeed = params.escalatorSpeed + p.targetWalkingSpeed;
               } else {
                   p.currentSpeed = params.escalatorSpeed; // Standing speed
               }
           }
            // Ensure people don't go below y=0 if something weird happens
           p.y = Math.max(0, p.y);

        });


        // Rebuild the final list for the next render, excluding those who exited this step
        const finalPeopleList = [
            ...nextStatePeople.filter(p => p.state === 'WAITING'),
            ...activePeople.filter(p => p.state.startsWith('ON_ESCALATOR')),
            ...exitedPeople // Keep exited people in the list for potential future analysis, but they won't be processed further
        ];


        // 4. Update Stats
        const currentQueueSize = finalPeopleList.filter(p => p.state === 'WAITING').length;
        const currentExitedCount = exitedPeople.length; // Total exited count

        // Calculate average travel time based *only* on people who exited *this step* to avoid recalculating
        // A more robust approach would store all travel times and average
        const avgTravelTimeThisStep = exitedThisStep > 0 ? totalTravelTimeExited / exitedThisStep : 0;

        setStats(prevStats => {
            const newExitedCount = prevStats.exitedCount + exitedThisStep;
            // Simple moving average for travel time (or just use the latest step's avg)
            // More accurate: store all exit times and calculate true average
             const newAvgTravelTime = newExitedCount > 0
               ? ((prevStats.avgTravelTime * prevStats.exitedCount) + totalTravelTimeExited) / newExitedCount
               : 0;

            return {
                exitedCount: newExitedCount,
                queueSize: currentQueueSize,
                avgTravelTime: newAvgTravelTime
            };
        });

        simulationDidUpdate = true;
        return finalPeopleList; // New state for people
      });
       // --- End of discrete step loop ---
    }


    // Request next frame if running
    if (isRunning) {
      animationFrameRef.current = requestAnimationFrame(runSimulationStep);
    }

  }, [isRunning, params, strategy, nextPersonId, simulationTime]); // Dependencies


  // --- Control Handlers ---
  const handleParamChange = (e) => {
    const { name, value, type } = e.target;
    setParams(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

   const handleStrategyChange = (newStrategy) => {
     resetSimulation(); // Reset when strategy changes
     setStrategy(newStrategy);
   };


  const startSimulation = () => {
    if (isRunning) return;
    setIsRunning(true);
    lastUpdateTimeRef.current = performance.now();
    accumulatedTimeRef.current = 0; // Reset accumulator
    animationFrameRef.current = requestAnimationFrame(runSimulationStep);
    totalPeopleToGenerateRef.current = params.peopleArrivalRate * 60 * 5; // Example: Simulate 5 mins of arrivals
    // Or: totalPeopleToGenerateRef.current = Infinity // Run indefinitely

     // Calculate Strategy 1 comparison when starting
     setStrategy1Comparison(simulateStrategy1({
       ...params,
       simulationTime: 60 // Calculate for 1 minute flow rate
     }, MIN_PERSON_SPACING));
  };

  const pauseSimulation = () => {
    if (!isRunning) return;
    setIsRunning(false);
    cancelAnimationFrame(animationFrameRef.current);
  };

  const resetSimulation = () => {
    setIsRunning(false);
    cancelAnimationFrame(animationFrameRef.current);
    setSimulationTime(0);
    setPeople([]);
    setNextPersonId(0);
    setStats({ exitedCount: 0, queueSize: 0, avgTravelTime: 0 });
    lastUpdateTimeRef.current = null;
    accumulatedTimeRef.current = 0;
    peopleGeneratedRef.current = 0;
    setStrategy1Comparison(null); // Clear comparison on reset
  };

  // Cleanup effect
  useEffect(() => {
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, []);

  // Calculate derived stats for display
  const throughputPerMinute = simulationTime > 0 ? (stats.exitedCount / simulationTime * 60) : 0;

  return (
    <div className="container mx-auto p-4">
        <div><em>Note : Gemini 2.5 Pro built this in one shot </em></div>
      <div className="flex flex-col md:flex-row min-h-screen bg-gray-100">
        {/* Left Column: Controls */}
        <div className="w-full md:w-1/3 lg:w-1/4 p-4 bg-white shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Simulation Controls</h2>
          <SimulatorControls
            params={params}
            strategy={strategy}
            onParamChange={handleParamChange}
            onStrategyChange={handleStrategyChange}
            isRunning={isRunning}
            onStart={startSimulation}
            onPause={pauseSimulation}
            onReset={resetSimulation}
          />
        </div>

        {/* Right Column: Display & Stats */}
        <div className="w-full md:w-2/3 lg:w-3/4 p-4 flex flex-col">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Simulation Display</h2>
          <SimulatorDisplay
            people={people}
            escalatorLength={params.escalatorLength}
            visualizationScale={VISUALIZATION_SCALE}
            personRadius={PERSON_RADIUS_PX}
            escalatorWidth={ESCALATOR_WIDTH_PX}
            strategy={strategy}
          />

          <div className="mt-4 p-4 bg-white shadow rounded">
            <h3 className="text-lg font-semibold mb-2 text-gray-600">Live Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                <p>Time: <span className="font-medium">{simulationTime.toFixed(1)}s</span></p>
                <p>Exited: <span className="font-medium">{stats.exitedCount}</span></p>
                <p>Queue Size: <span className="font-medium">{stats.queueSize}</span></p>
                <p>Throughput: <span className="font-medium">{throughputPerMinute.toFixed(1)} p/min</span></p>
                <p>Avg. Time: <span className="font-medium">{stats.avgTravelTime > 0 ? stats.avgTravelTime.toFixed(1) + 's' : 'N/A'}</span></p>
            </div>

            {strategy1Comparison && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-md font-semibold mb-1 text-gray-600">Strategy 1 (Stand Only) Comparison:</h4>
                  <p className="text-sm">Est. Throughput: <span className="font-medium">{strategy1Comparison.throughputPerMinute.toFixed(1)} p/min</span></p>
                  <p className="text-sm">Est. Travel Time: <span className="font-medium">{strategy1Comparison.travelTime.toFixed(1)}s</span></p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


export default Gemini25ProViz;