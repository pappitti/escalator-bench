import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- Simulation Constants ---
const MIN_PERSON_SPACING = 0.8; // meters - vertical distance people maintain
const PERSON_RADIUS_PX = 5; // For visualization
const SIMULATION_STEP_MS = 50; // Update frequency (milliseconds) -> Target, actual step is dt
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
  // Ensure minimum walking speed and handle stdDev=0 case
  if (stdDev <= 0) return Math.max(0.1, mean);
  return Math.max(0.1, num);
}

// --- Simulation Core Logic Function (moved out for clarity) ---
// This function processes ONE step of the simulation (dt)
function advanceSimulationStep(
    currentTime, // The simulation time *at the end* of this step
    currentPeople,
    params,
    strategy,
    nextId, // The ID to use for the first new person in this step
    minSpacing,
    escalatorWidth,
    fixedDt
) {
    let people = [...currentPeople]; // Work on a mutable copy for this step
    let newArrivals = [];
    let exitedThisStepCount = 0;
    let totalTravelTimeExited = 0;
    let peopleExitedThisStep = []; // Store actual people who exited

    // --- 1. Arrivals ---
    const expectedArrivals = params.peopleArrivalRate * fixedDt;
    // Simple Poisson-like arrival:
    const numNewArrivals = Math.floor(expectedArrivals) + (Math.random() < (expectedArrivals % 1) ? 1 : 0);
    let currentNextId = nextId; // Use the passed-in seed

    for (let i = 0; i < numNewArrivals; i++) {
        const id = currentNextId + i;
        const wantsToWalk = strategy === 2 && Math.random() * 100 < params.percentWalkers;
        // Ensure avgWalkingSpeed and stdDevWalkingSpeed are numbers
        const avgWalkSpeed = Number(params.avgWalkingSpeed) || 0;
        const stdDevWalkSpeed = Number(params.stdDevWalkingSpeed) || 0;
        const targetSpeed = wantsToWalk ? randomNormal(avgWalkSpeed, stdDevWalkSpeed) : 0;

        newArrivals.push({
            id: id,
            state: 'WAITING',
            arrivalTime: currentTime, // Time they appeared at the queue
            x: 0,
            y: -1, // Not on escalator
            targetWalkingSpeed: targetSpeed,
            currentSpeed: 0,
            lane: wantsToWalk ? 'LEFT' : 'RIGHT',
            entryTime: -1, // Time they get on the escalator
        });
    }
    // Don't mutate nextPersonId state here, return the count

    // --- Combine existing waiting and new arrivals ---
    let waitingPeople = people.filter(p => p.state === 'WAITING');
    waitingPeople.push(...newArrivals); // Add new arrivals to the waiting pool

    let peopleOnEscalator = people.filter(p => p.state.startsWith('ON_ESCALATOR'));
    let exitedPeople = people.filter(p => p.state === 'EXITED'); // Keep track of already exited

    // --- 2. Boarding ---
    const canBoard = (lane) => {
        const peopleInLaneOrEntering = peopleOnEscalator.filter(p =>
            (strategy === 1 || p.lane === lane) && p.y < minSpacing // Check only near the entrance
        );
        const lowestPerson = peopleInLaneOrEntering.reduce((lowest, p) => (!lowest || p.y < lowest.y) ? p : lowest, null);
        // Can board if no one is near the entrance OR the lowest person is already far enough up
        return !lowestPerson || lowestPerson.y >= minSpacing;
    };

    let boardedThisStep = []; // People who successfully boarded in this step

    if (strategy === 1) {
        let boardedCount = 0;
        // Check how many slots are "available" at y=0 based on minSpacing
        const peopleAtEntry = peopleOnEscalator.filter(p => p.y < minSpacing);
        let canBoardLeft = peopleAtEntry.filter(p => p.x < escalatorWidth / 2).length === 0;
        let canBoardRight = peopleAtEntry.filter(p => p.x > escalatorWidth / 2).length === 0;

        // Prioritize filling empty slots if possible
        if (canBoardRight && waitingPeople.length > 0) {
             const personToBoard = waitingPeople.shift();
             personToBoard.state = 'ON_ESCALATOR_STAND';
             personToBoard.y = 0;
             personToBoard.currentSpeed = params.escalatorSpeed;
             personToBoard.x = escalatorWidth * 0.75; // Right side
             personToBoard.lane = 'RIGHT'; // Assign lane even in S1 for consistency
             personToBoard.entryTime = currentTime;
             boardedThisStep.push(personToBoard);
             boardedCount++;
             canBoardRight = false; // Slot filled
        }
        if (canBoardLeft && waitingPeople.length > 0) {
             const personToBoard = waitingPeople.shift();
             personToBoard.state = 'ON_ESCALATOR_STAND';
             personToBoard.y = 0;
             personToBoard.currentSpeed = params.escalatorSpeed;
             personToBoard.x = escalatorWidth * 0.25; // Left side
             personToBoard.lane = 'LEFT'; // Assign lane even in S1 for consistency
             personToBoard.entryTime = currentTime;
             boardedThisStep.push(personToBoard);
             boardedCount++;
             // canBoardLeft = false; // Slot filled
        }

    } else { // Strategy 2
        // Board Right (Standing) - Find first available stander
        const standerIndex = waitingPeople.findIndex(p => !p.targetWalkingSpeed || p.targetWalkingSpeed <= 0);
        if (standerIndex !== -1 && canBoard('RIGHT')) {
            const standerToBoard = waitingPeople.splice(standerIndex, 1)[0]; // Remove from waiting
            standerToBoard.state = 'ON_ESCALATOR_STAND';
            standerToBoard.y = 0;
            standerToBoard.currentSpeed = params.escalatorSpeed;
            standerToBoard.x = escalatorWidth * 0.75;
            standerToBoard.lane = 'RIGHT';
            standerToBoard.entryTime = currentTime;
            boardedThisStep.push(standerToBoard);
        }

        // Board Left (Walking) - Find first available walker
        const walkerIndex = waitingPeople.findIndex(p => p.targetWalkingSpeed > 0);
        if (walkerIndex !== -1 && canBoard('LEFT')) {
            const walkerToBoard = waitingPeople.splice(walkerIndex, 1)[0]; // Remove from waiting
            walkerToBoard.state = 'ON_ESCALATOR_WALK';
            walkerToBoard.y = 0;
            // Ensure targetWalkingSpeed is a number
            const walkSpeed = Number(walkerToBoard.targetWalkingSpeed) || 0;
            walkerToBoard.currentSpeed = params.escalatorSpeed + walkSpeed;
            walkerToBoard.x = escalatorWidth * 0.25;
            walkerToBoard.lane = 'LEFT';
            walkerToBoard.entryTime = currentTime;
            boardedThisStep.push(walkerToBoard);
        }
    }

    // Add newly boarded people to the escalator list for the movement phase
    peopleOnEscalator.push(...boardedThisStep);

    // --- 3. Movement & Exiting ---
    peopleOnEscalator.sort((a, b) => b.y - a.y); // Process top-down for blocking

    let peopleStillOnEscalator = []; // Build the list for the next state

    peopleOnEscalator.forEach(p => {
        if (!p.state.startsWith('ON_ESCALATOR')) return; // Safety check

        let potentialY = p.y + p.currentSpeed * fixedDt;
        let blocked = false;
        let actualSpeed = p.currentSpeed; // Speed for this step

        // Check Exit
        if (potentialY >= params.escalatorLength) {
            p.state = 'EXITED';
            p.y = params.escalatorLength;
            if (p.entryTime > 0) { // Ensure they actually boarded
               exitedThisStepCount++;
               totalTravelTimeExited += (currentTime - p.entryTime);
               peopleExitedThisStep.push(p); // Add to list for this step
            }
            // Don't add to peopleStillOnEscalator, but keep in exitedPeople
            exitedPeople.push(p);
            return; // Done processing this person
        }

        // Check Blocking (only walkers check walkers/standers ahead in their lane)
        // Standers are only blocked by the escalator speed itself.
        if (p.state === 'ON_ESCALATOR_WALK') {
            let personAhead = null;
            let minAheadDist = Infinity;

            // Find the closest person directly ahead in the same lane
            peopleOnEscalator.forEach(other => {
                // Check same lane, ahead (other.y > p.y), and actually on escalator
                if (other.id !== p.id && other.state.startsWith('ON_ESCALATOR') && other.lane === p.lane && other.y > p.y) {
                    const dist = other.y - p.y;
                    if (dist < minAheadDist) {
                        minAheadDist = dist;
                        personAhead = other;
                    }
                }
            });

            // If there's a person ahead and moving would cause collision
            if (personAhead && potentialY >= personAhead.y - minSpacing) {
                // Position slightly behind the person ahead
                p.y = Math.max(p.y, personAhead.y - minSpacing); // Ensure minimum spacing, don't move backward
                // Match the speed of the person ahead for this step
                actualSpeed = personAhead.currentSpeed;
                blocked = true;
            }
        }

        // Apply Movement
        if (!blocked) {
            p.y = potentialY;
            // Reset speed if walker was previously blocked but isn't now, or set standing speed
            if (p.state === 'ON_ESCALATOR_WALK') {
                 const walkSpeed = Number(p.targetWalkingSpeed) || 0;
                 actualSpeed = params.escalatorSpeed + walkSpeed;
            } else { // ON_ESCALATOR_STAND
                 actualSpeed = params.escalatorSpeed;
            }
        } else {
            // If blocked, we already set p.y and actualSpeed above
        }
        p.currentSpeed = actualSpeed; // Update current speed for next step's calculation
        p.y = Math.max(0, p.y); // Ensure y doesn't go negative

        peopleStillOnEscalator.push(p); // Keep this person for the next state
    });

    // --- 4. Combine lists for the final state of this step ---
    const finalPeopleList = [
        ...waitingPeople,
        ...peopleStillOnEscalator,
        ...exitedPeople // Keep exited people for stats, filtering happens in display
    ];

    // --- Return results of this step ---
    return {
        nextPeople: finalPeopleList,
        numNewArrivals: newArrivals.length,
        exitedCount: exitedThisStepCount,
        totalTravelTimeExited: totalTravelTimeExited,
    };
}


// --- Main Component ---
function Gemini25ProViz() {
  // --- Input State ---
  const [params, setParams] = useState({
    escalatorLength: 20,
    escalatorSpeed: 0.75,
    peopleArrivalRate: 1.5,
    percentWalkers: 40,
    avgWalkingSpeed: 0.6,
    stdDevWalkingSpeed: 0.15,
  });
  const [strategy, setStrategy] = useState(2);

  // --- Simulation State ---
  const [isRunning, setIsRunning] = useState(false);
  const [simulationTime, setSimulationTime] = useState(0);
  const [people, setPeople] = useState([]);
  const [nextPersonId, setNextPersonId] = useState(0);
  const [stats, setStats] = useState({ exitedCount: 0, queueSize: 0, avgTravelTime: 0, totalTravelTimeSum: 0 }); // Added sum for better avg calc
  const [strategy1Comparison, setStrategy1Comparison] = useState(null);

  // --- Refs ---
  const animationFrameRef = useRef();
  const lastUpdateTimeRef = useRef();
  const accumulatedTimeRef = useRef(0);
  // const peopleGeneratedRef = useRef(0); // Can be derived from nextPersonId if needed

  // --- Simulation Runner ---
  const runSimulation = useCallback(() => {
    if (!isRunning) return; // Exit if paused between request and execution

    const now = performance.now();
    const deltaTime = Math.min((now - (lastUpdateTimeRef.current || now)) / 1000, 0.1); // Limit delta to avoid spiral of death if tab is inactive, seconds
    lastUpdateTimeRef.current = now;
    accumulatedTimeRef.current += deltaTime;

    let numSteps = Math.floor(accumulatedTimeRef.current / dt);
    accumulatedTimeRef.current -= numSteps * dt;

    if (numSteps > 0) {
        // --- Run simulation logic outside React state setters ---
        let currentPeopleState = people; // Get current state once
        let currentSimTime = simulationTime; // Get current time once
        let currentNextId = nextPersonId; // Get current ID seed once

        let cumulativeExited = 0;
        let cumulativeTravelTime = 0;
        let cumulativeNewArrivals = 0;

        for (let i = 0; i < numSteps; i++) {
            currentSimTime += dt; // Advance time for the step being calculated

            const stepResult = advanceSimulationStep(
                currentSimTime,
                currentPeopleState,
                params,
                strategy,
                currentNextId + cumulativeNewArrivals, // Pass the correct starting ID for this step's arrivals
                MIN_PERSON_SPACING,
                ESCALATOR_WIDTH_PX,
                dt // Pass the fixed dt
            );

            // Update the state *for the next iteration*
            currentPeopleState = stepResult.nextPeople;
            cumulativeExited += stepResult.exitedCount;
            cumulativeTravelTime += stepResult.totalTravelTimeExited;
            cumulativeNewArrivals += stepResult.numNewArrivals;
        }

        // --- Update React state ONCE after all steps for this frame ---
        setPeople(currentPeopleState); // Update with the final list
        setSimulationTime(currentSimTime); // Update to the final time
        setNextPersonId(prev => prev + cumulativeNewArrivals); // Update ID counter

        if (cumulativeExited > 0) {
            setStats(prevStats => {
                const newExitedCount = prevStats.exitedCount + cumulativeExited;
                const newTotalTravelTimeSum = prevStats.totalTravelTimeSum + cumulativeTravelTime;
                const newAvgTravelTime = newExitedCount > 0 ? newTotalTravelTimeSum / newExitedCount : 0;
                // Calculate queue size from the final state
                const currentQueueSize = currentPeopleState.filter(p => p.state === 'WAITING').length;

                return {
                    exitedCount: newExitedCount,
                    queueSize: currentQueueSize, // Update queue size here
                    avgTravelTime: newAvgTravelTime,
                    totalTravelTimeSum: newTotalTravelTimeSum
                };
            });
        } else {
             // Update queue size even if no one exited
             setStats(prevStats => ({
                 ...prevStats,
                 queueSize: currentPeopleState.filter(p => p.state === 'WAITING').length
             }));
        }
    }

    // --- Request next frame ---
    animationFrameRef.current = requestAnimationFrame(runSimulation);

  }, [isRunning, params, strategy, people, simulationTime, nextPersonId]); // Add dependencies used

  // --- Control Handlers ---
  const handleParamChange = (e) => {
    const { name, value, type } = e.target;
    setParams(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleStrategyChange = (newStrategy) => {
    if (isRunning) return; // Prevent change while running
    resetSimulation();
    setStrategy(newStrategy);
  };

  const startSimulation = () => {
    if (isRunning) return;
    setIsRunning(true);
    lastUpdateTimeRef.current = performance.now(); // Set initial time
    accumulatedTimeRef.current = 0;
    // Directly call runSimulation to start the loop via requestAnimationFrame
    animationFrameRef.current = requestAnimationFrame(runSimulation);

    // Calculate Strategy 1 comparison
    setStrategy1Comparison(simulateStrategy1({ ...params }, MIN_PERSON_SPACING));
  };

  const pauseSimulation = () => {
    if (!isRunning) return;
    setIsRunning(false);
    cancelAnimationFrame(animationFrameRef.current); // Stop the loop
    lastUpdateTimeRef.current = null; // Reset last update time
  };

  const resetSimulation = () => {
    setIsRunning(false);
    cancelAnimationFrame(animationFrameRef.current);
    setSimulationTime(0);
    setPeople([]);
    setNextPersonId(0);
    setStats({ exitedCount: 0, queueSize: 0, avgTravelTime: 0, totalTravelTimeSum: 0 });
    lastUpdateTimeRef.current = null;
    accumulatedTimeRef.current = 0;
    // peopleGeneratedRef.current = 0; // Reset if using this ref
    setStrategy1Comparison(null);
  };

  // Cleanup effect
  useEffect(() => {
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, []);

  // Trigger simulation loop when isRunning changes
  useEffect(() => {
    if (isRunning) {
        // Ensure refs are reset correctly before starting
        lastUpdateTimeRef.current = performance.now();
        accumulatedTimeRef.current = 0; // Reset accumulator if needed on resume? Maybe not.
        animationFrameRef.current = requestAnimationFrame(runSimulation);
    } else {
        cancelAnimationFrame(animationFrameRef.current);
    }
    // Cleanup on unmount OR when isRunning becomes false
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isRunning, runSimulation]); // Rerun effect if isRunning or runSimulation callback changes


  // Calculate derived stats for display
  const throughputPerMinute = simulationTime > 1 ? (stats.exitedCount / simulationTime * 60) : 0; // Avoid division by zero early on

  return (
    <div className="container mx-auto p-4">
      <div><em>Note : Gemini 2.5 Pro 03-14 built this in 2 shots (UI and logic were similar in first shot but state wouldn't update between simulation steps)</em></div>
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
          {/* Make display taller */}
          <div className="flex-grow mb-4">
             <SimulatorDisplay
                people={people}
                escalatorLength={params.escalatorLength}
                visualizationScale={VISUALIZATION_SCALE}
                personRadius={PERSON_RADIUS_PX}
                escalatorWidth={ESCALATOR_WIDTH_PX}
                strategy={strategy}
              />
          </div>

          <div className="mt-auto p-4 bg-white shadow rounded"> {/* Use mt-auto to push stats to bottom */}
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

// --- Sub Components (SimulatorControls, SimulatorDisplay, simulateStrategy1) ---
// Assume these are the same as in your original code, but I'll include SimulatorDisplay
// with the corrected queue positioning logic.

function SimulatorControls({ params, strategy, onParamChange, onStrategyChange, isRunning, onStart, onPause, onReset }) {
  // ... (Same as original code) ...
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
    const escalatorLeftOffset = `calc(50% - ${escalatorWidth / 2}px)`; // Center the escalator visually

    // Filter people to display (on escalator or waiting near bottom)
    // Only show a limited number of waiting people to avoid clutter
    const peopleOnEscalator = people.filter(p => p.state.startsWith('ON_ESCALATOR'));
    const waitingPeople = people.filter(p => p.state === 'WAITING');
    const visibleWaiting = waitingPeople.slice(0, 30); // Limit visible queue dots

    const visiblePeople = [...peopleOnEscalator, ...visibleWaiting];

    return (
      // Use a wrapper div to help with relative positioning and height
      <div className="relative w-full h-full bg-gray-200 border border-gray-400 overflow-hidden">
         {/* Container for escalator and people */}
         <div className="absolute bottom-[30px] left-0 w-full" style={{ height: `${escalatorHeightPx}px`}}>
            {/* Escalator structure (visual only) */}
            <div
                className="absolute bg-gray-400"
                style={{
                left: escalatorLeftOffset,
                bottom: '0px', // Position at the bottom of its container
                width: `${escalatorWidth}px`,
                height: `${escalatorHeightPx}px`,
                }}
            >
            {/* Optional: Add lines for lanes in strategy 2 */}
                {strategy === 2 && (
                <div className="absolute w-px h-full bg-gray-500 left-1/2 top-0 transform -translate-x-1/2"></div>
                )}
            </div>

            {/* People visualization */}
            {visiblePeople.map((person, index) => {
                let displayX, displayYBase;
                const personSize = personRadius * 2;

                if (person.state.startsWith('ON_ESCALATOR')) {
                    // On the escalator - X is relative to escalator left edge
                    const escalatorContainerLeft = (window.innerWidth * 0.5) - (escalatorWidth / 2) // Approximate left edge in viewport - This is NOT robust, better to calc based on parent
                    // Let's assume X is relative to the center line for now, adjusted by lane
                    const baseX = escalatorWidth/2;
                    const laneOffset = person.lane === 'LEFT' ? -escalatorWidth * 0.25 : escalatorWidth * 0.25;
                    const visualX = (person.x || baseX) - personRadius // Use person.x calculated in boarding

                    displayX = `calc(${escalatorLeftOffset} + ${visualX}px)`;
                    displayYBase = (person.y * visualizationScale); // Y=0 is at the bottom entry point

                    // Determine color based on state/type
                    let color = 'bg-gray-700'; // Should not happen if state is correct
                    if (person.state === 'ON_ESCALATOR_STAND') color = 'bg-blue-500';
                    if (person.state === 'ON_ESCALATOR_WALK') color = 'bg-green-500';

                    return (
                        <div
                            key={person.id}
                            className={`absolute rounded-full ${color}`}
                            style={{
                                width: `${personSize}px`,
                                height: `${personSize}px`,
                                left: displayX, // Use calc for positioning relative to centered escalator
                                bottom: `${displayYBase}px`, // Y measured from bottom
                                transition: 'none' // Disable CSS transition, rely on JS updates
                            }}
                            title={`ID: ${person.id} State: ${person.state} Y: ${person.y?.toFixed(1)}`}
                        />
                        );

                } else if (person.state === 'WAITING') {
                     // Waiting in queue area below escalator
                     const queueIndex = waitingPeople.indexOf(person); // Get index within the waiting list
                     if (queueIndex >= 30) return null; // Don't render if beyond visible limit

                     const itemsPerRow = Math.floor(escalatorWidth / personSize) * 1.5; // How many dots fit roughly under escalator width
                     const queueCol = queueIndex % itemsPerRow;
                     const queueRow = Math.floor(queueIndex / itemsPerRow);

                     let queueSideOffset = 0;
                     if (strategy === 1) {
                          // Center the queue block roughly under the escalator
                          const queueBlockWidth = itemsPerRow * personSize;
                          const startOffset = (escalatorWidth - queueBlockWidth) / 2;
                          queueSideOffset = startOffset + queueCol * personSize;
                     } else { // Strategy 2 - split queue visually
                          const isWalker = person.targetWalkingSpeed > 0;
                          // Place walkers on left half, standers on right half below escalator
                          const halfWidth = escalatorWidth / 2;
                          const itemsPerHalfRow = Math.floor(halfWidth / personSize);
                          const colInLane = queueCol % itemsPerHalfRow; // Adjust column based on lane
                          if (isWalker) { // Left side
                             queueSideOffset = colInLane * personSize;
                          } else { // Right side
                             queueSideOffset = halfWidth + (colInLane * personSize);
                          }
                     }

                     displayX = `calc(${escalatorLeftOffset} + ${queueSideOffset}px)`;
                     // Position below the escalator's container (which starts 30px from bottom of main view)
                     // displayYBase places it *within* the queue area (height 30px)
                     displayYBase = - (queueRow + 1) * personSize - 2; // Position rows below base, negative Y is below escalator


                     return (
                        <div
                            key={person.id}
                            className={`absolute rounded-full bg-gray-500`} // Waiting color
                            style={{
                                width: `${personSize}px`,
                                height: `${personSize}px`,
                                left: displayX,
                                bottom: `${displayYBase}px`, // Relative to bottom of escalator container
                                transition: 'none'
                            }}
                            title={`ID: ${person.id} State: ${person.state} Waiting`}
                        />
                        );
                 }
                 return null; // Should not happen
            })}
         </div>

        {/* Queue area visual indicator */}
        <div className="absolute bottom-0 left-0 w-full h-[30px] border-t border-dashed border-gray-500 text-center text-xs text-gray-600 pt-1 bg-gray-200 z-10">
            Queue Area
            {strategy === 2 && <div className="absolute w-px h-[30px] bg-gray-500 left-1/2 bottom-0 transform -translate-x-1/2"></div>}
        </div>
      </div>
    );
}


function simulateStrategy1({ escalatorLength, escalatorSpeed }, minSpacing) {
 // ... (Same as original code) ...
  if (!escalatorSpeed || !minSpacing || escalatorSpeed <= 0 || minSpacing <=0) {
    return { throughputPerMinute: 0, travelTime: Infinity }; // Handle invalid inputs
  }

  const flowRatePerSecond = 2 * escalatorSpeed / minSpacing;
  const throughputPerMinute = flowRatePerSecond * 60;
  const travelTime = escalatorLength / escalatorSpeed;

  return {
    throughputPerMinute,
    travelTime,
  };
}

export default Gemini25ProViz;