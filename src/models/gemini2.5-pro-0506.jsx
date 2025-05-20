/****************************************************** 
 * LICENCE : GEMINI 2.5 PRO 0506 OUTPUT
*******************************************************/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const PERSON_DOT_RADIUS = 4;
const ESCALATOR_WIDTH_VISUAL = 60; // pixels for animation

// Helper for Normal Distribution
function randomNormalBM(mean, stdDev) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  num = num * stdDev + mean;
  return Math.max(0, num); // Ensure speed is not negative
}

export class EscalatorSimulator {
  constructor(config) {
      this.config = { ...this.getDefaultConfig(), ...config };
      this.reset();
  }

  getDefaultConfig() {
      return {
          escalatorLength: 20, // meters
          escalatorSpeed: 0.75, // m/s
          stepDepth: 0.4, // m (space one person/step takes front-to-back)
          
          arrivalRatePerMinute: 60, // people per minute
          percentageWalkingUp: 50, // %
          avgWalkingSpeed: 0.5, // m/s (additional speed)
          stdDevWalkingSpeed: 0.1, // m/s
          
          simulationTimeStep: 0.1, // seconds (dt)
          maxPeopleToSimulate: 200, // Stop condition for arrivals
      };
  }

  reset(newConfig) {
      if (newConfig) {
          this.config = { ...this.getDefaultConfig(), ...newConfig };
      }
      this.currentTime = 0;
      this.people = []; // All people in the system
      this.waitingQueue = [];
      this.onEscalator = [];
      this.exitedPeople = [];
      this.peopleSpawned = 0;
      
      this.stats = {
          totalExited: 0,
          queueLengthAtBottom: 0,
          avgTravelTime: 0,
          flowRatePerMinute: 0, // Calculated over a recent window
          recentExits: [], // For flow rate calculation {time, count}
      };
      this.log = []; // To store data for charts
  }

  addPersonToSystem() {
      if (this.peopleSpawned >= this.config.maxPeopleToSimulate) return;

      const id = uuidv4();
      const isWalker = this.config.percentageWalkingUp > 0 && Math.random() * 100 < this.config.percentageWalkingUp;
      let targetWalkingSpeed = 0;
      if (isWalker) {
          targetWalkingSpeed = randomNormalBM(this.config.avgWalkingSpeed, this.config.stdDevWalkingSpeed);
      }

      const person = {
          id,
          isWalker,
          targetWalkingSpeed,
          actualWalkingSpeed: 0,
          positionY: 0, // 0 = at bottom entry point
          lane: null, // 'left', 'right'
          status: 'waitingAtBottom', // waitingAtBottom, boarding, onEscalator, exited
          timeArrivedAtBottom: this.currentTime,
          timeBoardedEscalator: null,
          timeReachedTop: null,
          escalatorLanePreference: isWalker ? 'left' : 'right', // For strategy 2
      };
      this.people.push(person);
      this.waitingQueue.push(person);
      this.peopleSpawned++;
  }
  
  // Determines if a spot at the escalator entrance is free
  isBoardingSpotFree(lane) {
      // Check if anyone is in the first 'stepDepth' of the escalator in that lane
      return !this.onEscalator.some(p => 
          p.lane === lane && p.positionY < this.config.stepDepth
      );
  }

  tick() {
      const dt = this.config.simulationTimeStep;

      // 1. Person Arrivals
      const arrivalsThisTick = (this.config.arrivalRatePerMinute / 60) * dt;
      if (Math.random() < arrivalsThisTick % 1) this.addPersonToSystem(); // Handle fractional arrivals stochastically
      for (let i = 0; i < Math.floor(arrivalsThisTick); i++) {
          this.addPersonToSystem();
      }
      
      // 2. Boarding Logic
      const availableToBoard = [...this.waitingQueue]; // Process a snapshot
      for (const person of availableToBoard) {
          if (this.config.percentageWalkingUp === 0) { // Strategy 1: Everyone stands
              // Try to board on left or right, two per "step" conceptually
              // Simpler: can two people board per step depth?
              const peopleOnFirstStep = this.onEscalator.filter(p => p.positionY < this.config.stepDepth).length;
              if (peopleOnFirstStep < 2) {
                  person.status = 'onEscalator';
                  person.timeBoardedEscalator = this.currentTime;
                  person.positionY = 0; // Start at the very beginning
                  person.isWalker = false; // Override for strategy 1
                  // Assign lane for visual separation, doesn't affect speed for S1
                  person.lane = this.onEscalator.filter(p => p.positionY < this.config.stepDepth && p.lane === 'left').length === 0 ? 'left' : 'right';
                  
                  this.onEscalator.push(person);
                  this.waitingQueue.splice(this.waitingQueue.indexOf(person), 1);
              }
          } else { // Strategy 2: Walkers left, Standers right
              const targetLane = person.isWalker ? 'left' : 'right';
              if (this.isBoardingSpotFree(targetLane)) {
                  person.status = 'onEscalator';
                  person.timeBoardedEscalator = this.currentTime;
                  person.positionY = 0;
                  person.lane = targetLane;
                  this.onEscalator.push(person);
                  this.waitingQueue.splice(this.waitingQueue.indexOf(person), 1);
              }
          }
      }

      // 3. Movement on Escalator
      this.onEscalator.sort((a, b) => (b.positionY - a.positionY)); // Sort by furthest first for collision
      
      for (const person of this.onEscalator) {
          let personInFront = null;
          if (this.config.percentageWalkingUp > 0 && person.isWalker) { // Strategy 2 walkers
               // Find closest person in front IN THE SAME LANE
              let minDistance = Infinity;
              for (const other of this.onEscalator) {
                  if (other.id !== person.id && other.lane === person.lane && other.positionY > person.positionY) {
                      const distance = other.positionY - person.positionY;
                      if (distance < minDistance) {
                          minDistance = distance;
                          personInFront = other;
                      }
                  }
              }
          } // For Strategy 1 or standers in S2, no individual walking speed considered beyond escalator.

          let travelDistance;
          if (person.isWalker && this.config.percentageWalkingUp > 0) { // Strategy 2 Walker
              person.actualWalkingSpeed = person.targetWalkingSpeed;
              if (personInFront) {
                  const safeFollowingDistance = this.config.stepDepth; // Maintain one step_depth distance
                  const distanceToFront = personInFront.positionY - person.positionY;
                  // Predicted distance to front after this tick if moving at target speed
                  const predictedGap = distanceToFront - (person.targetWalkingSpeed - personInFront.actualWalkingSpeed) * dt;

                  if (predictedGap < safeFollowingDistance) {
                      // Need to slow down. Max speed is to maintain safeFollowingDistance
                      // (pos_front - safeDist - pos_current) / dt = effective_combined_speed_diff
                      // effective_walker_speed = (pos_front - safeDist - pos_current)/dt + escalator_speed
                      // No, simpler: new_pos = personInFront.pos - safeDist. So, speed = (new_pos - current_pos)/dt - escalator_speed
                      const maxAllowedMovement = personInFront.positionY - safeFollowingDistance - person.positionY;
                      const maxAllowedWalkingSpeed = Math.max(0, maxAllowedMovement / dt);
                      person.actualWalkingSpeed = Math.min(person.targetWalkingSpeed, maxAllowedWalkingSpeed);
                  }
              }
              travelDistance = (this.config.escalatorSpeed + person.actualWalkingSpeed) * dt;
          } else { // Stander (Strategy 1 or Strategy 2 right lane)
              person.actualWalkingSpeed = 0;
              travelDistance = this.config.escalatorSpeed * dt;
          }
          person.positionY += travelDistance;
      }

      // 4. Exiting Escalator
      const stillOnEscalator = [];
      for (const person of this.onEscalator) {
          if (person.positionY >= this.config.escalatorLength) {
              person.status = 'exited';
              person.timeReachedTop = this.currentTime;
              person.positionY = this.config.escalatorLength; // Cap at top
              this.exitedPeople.push(person);
              this.stats.totalExited++;
              this.stats.recentExits.push({ time: this.currentTime, count: 1 });
          } else {
              stillOnEscalator.push(person);
          }
      }
      this.onEscalator = stillOnEscalator;

      // 5. Update Stats
      this.stats.queueLengthAtBottom = this.waitingQueue.length;
      
      // Flow rate: people exited in the last 60 seconds
      const oneMinuteAgo = this.currentTime - 60;
      this.stats.recentExits = this.stats.recentExits.filter(exit => exit.time > oneMinuteAgo);
      this.stats.flowRatePerMinute = this.stats.recentExits.length;

      if (this.exitedPeople.length > 0) {
          const totalTravelTime = this.exitedPeople.reduce((sum, p) => sum + (p.timeReachedTop - p.timeBoardedEscalator), 0);
          this.stats.avgTravelTime = totalTravelTime / this.exitedPeople.length;
      }

      // Log data for charts (e.g., every second)
      if (Math.floor(this.currentTime / 1) !== Math.floor((this.currentTime - dt) / 1)) {
           this.log.push({
              time: Math.floor(this.currentTime),
              queueLength: this.stats.queueLengthAtBottom,
              flowRate: this.stats.flowRatePerMinute,
              walkersOnEscalator: this.onEscalator.filter(p => p.isWalker).length,
              standersOnEscalator: this.onEscalator.filter(p => !p.isWalker).length,
          });
      }


      this.currentTime += dt;
      
      return {
          people: [...this.waitingQueue, ...this.onEscalator, ...this.exitedPeople], // A copy for rendering
          stats: { ...this.stats },
          log: [...this.log]
      };
  }

  // Calculate theoretical stats for Strategy 1 (everyone stands)
  getStrategy1TheoreticalStats(numPeople) {
      const { escalatorLength, escalatorSpeed, stepDepth } = this.config;
      if (escalatorSpeed === 0 || stepDepth === 0) return { flowRate: 0, timeToClear: Infinity };

      // Max people per "slice" of escalator of stepDepth length
      const peoplePerStepSlice = 2; 
      
      // Time for one step "slice" to clear the escalator
      const timePerStepSliceToBoardAndClearOnePerson = stepDepth / escalatorSpeed; // This is how often a new "slot" becomes available at the bottom

      // Max flow rate:
      // People that can be on escalator: (escalatorLength / stepDepth) * peoplePerStepSlice
      // Time for first person to exit: escalatorLength / escalatorSpeed
      // Rate at which people can board (and thus exit after a delay):
      const flowRatePerSecond = peoplePerStepSlice * escalatorSpeed / stepDepth;
      const flowRatePerMinute = flowRatePerSecond * 60;

      let timeToClearNPeople = 0;
      if (numPeople > 0) {
          // Time for the Nth person to get on and then travel the length
          // Number of "pairs" ahead of the Nth person
          const pairsAhead = Math.floor((numPeople -1) / peoplePerStepSlice);
          const timeForNthPersonToBoard = pairsAhead * timePerStepSliceToBoardAndClearOnePerson;
          const travelTimeForNthPerson = escalatorLength / escalatorSpeed;
          timeToClearNPeople = timeForNthPersonToBoard + travelTimeForNthPerson;
      }
      
      return {
          flowRatePerMinute: parseFloat(flowRatePerMinute.toFixed(2)),
          timeToClearNPeople: parseFloat(timeToClearNPeople.toFixed(2)),
          avgTravelTime: parseFloat((escalatorLength / escalatorSpeed).toFixed(2))
      };
  }
}

// Component for Input Fields
const InputField = ({ label, type = "number", value, onChange, step, min, max }) => (
  <div className="mb-3">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
          type={type}
          value={value}
          onChange={onChange}
          step={step}
          min={min}
          max={max}
          className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
      />
  </div>
);


// Basic Escalator Animation Component
const EscalatorAnimation = ({ people, escalatorLength, percentageWalkingUp }) => {
  const escalatorHeightPixels = 300; // Fixed height for visualization
  const pixelsPerMeter = escalatorHeightPixels / escalatorLength;

  const getLaneXOffset = (lane, isStrategy2) => {
      if (!isStrategy2) { // Strategy 1
          return lane === 'left' ? ESCALATOR_WIDTH_VISUAL * 0.25 : ESCALATOR_WIDTH_VISUAL * 0.75;
      }
      // Strategy 2
      return lane === 'left' ? ESCALATOR_WIDTH_VISUAL * 0.25 : ESCALATOR_WIDTH_VISUAL * 0.75;
  };
  
  const isStrategy2Active = percentageWalkingUp > 0;

  return (
      <div className="relative bg-gray-200 border border-gray-400" style={{ width: ESCALATOR_WIDTH_VISUAL + 40, height: escalatorHeightPixels + 40, margin: 'auto' }}>
          {/* Escalator Structure */}
          <div className="absolute bg-gray-400" style={{ left: 20, top: 20, width: ESCALATOR_WIDTH_VISUAL, height: escalatorHeightPixels }}>
              {isStrategy2Active && (
                   <div className="absolute bg-gray-500 h-full w-px" style={{ left: '50%', top:0 }} title="Lane Divider"></div>
              )}
          </div>

          {/* People Dots */}
          {people.map(p => {
              if (p.status === 'exited' || p.status === 'waitingAtBottom') return null; // Don't draw exited or if purely waiting
              
              const yPos = escalatorHeightPixels - (p.positionY * pixelsPerMeter); // From bottom up
              const xPos = getLaneXOffset(p.lane, isStrategy2Active);

              return (
                  <div
                      key={p.id}
                      title={`ID: ${p.id.substring(0,4)}, Speed: ${p.actualWalkingSpeed.toFixed(2)}`}
                      className={`absolute rounded-full ${p.isWalker && isStrategy2Active ? 'bg-blue-500' : 'bg-red-500'}`}
                      style={{
                          width: PERSON_DOT_RADIUS * 2,
                          height: PERSON_DOT_RADIUS * 2,
                          left: 20 + xPos - PERSON_DOT_RADIUS,
                          top: 20 + yPos - PERSON_DOT_RADIUS,
                          transition: 'top 0.1s linear, left 0.1s linear' // Smooth transitions if dt is small
                      }}
                  />
              );
          })}

          {/* Queue Visualization */}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex flex-col items-center" style={{top: escalatorHeightPixels + 25}}>
              <div className="text-xs">Queue: {people.filter(p=>p.status === 'waitingAtBottom').length}</div>
               <div className="flex mt-1">
                  {people.filter(p=>p.status === 'waitingAtBottom').slice(0,10).map((p, idx) => ( // Show first 10 in queue
                       <div key={p.id} 
                            className={`w-2 h-2 rounded-full ${p.isWalker && isStrategy2Active ? 'bg-blue-300' : 'bg-red-300'} -ml-1 border border-gray-500`}
                            title={p.isWalker ? 'Walker' : 'Stander'}
                       ></div>
                  ))}
                  {people.filter(p=>p.status === 'waitingAtBottom').length > 10 && <div className="ml-1 text-xs">...</div>}
               </div>
          </div>
      </div>
  );
};

function Gemini25Pro0506Viz() {
  const [config, setConfig] = useState({
    escalatorLength: 20,
    escalatorSpeed: 0.75,
    stepDepth: 0.4,
    arrivalRatePerMinute: 60,
    percentageWalkingUp: 50, // 0 for strategy 1
    avgWalkingSpeed: 0.5,
    stdDevWalkingSpeed: 0.1,
    maxPeopleToSimulate: 200, // How many people will arrive in total
    simulationTimeStep: 0.1,
});

const [simulationState, setSimulationState] = useState(null);
const [isRunning, setIsRunning] = useState(false);
const simulatorRef = useRef(null);
const animationFrameIdRef = useRef(null);

const [s1TheoreticalStats, setS1TheoreticalStats] = useState(null);

const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setConfig(prev => ({
        ...prev,
        [name]: type === 'number' ? parseFloat(value) : value
    }));
};

const initializeSimulator = useCallback(() => {
    if (simulatorRef.current) {
        simulatorRef.current.reset(config);
    } else {
        simulatorRef.current = new EscalatorSimulator(config);
    }
    const initialData = simulatorRef.current.tick(); // Get initial state
    setSimulationState(initialData);
    setS1TheoreticalStats(simulatorRef.current.getStrategy1TheoreticalStats(config.maxPeopleToSimulate));
}, [config]);

useEffect(() => {
    initializeSimulator(); // Initialize on mount and when config changes if not running
}, [initializeSimulator]); // config changes handled by reset button or re-init

const runSimulationStep = useCallback(() => {
    if (!simulatorRef.current) return;

    const newState = simulatorRef.current.tick();
    setSimulationState(newState);
    
    // Stop condition: all spawned people have exited and no new people are arriving
    const noMoreArrivals = simulatorRef.current.peopleSpawned >= config.maxPeopleToSimulate;
    const queueEmpty = simulatorRef.current.waitingQueue.length === 0;
    const escalatorEmpty = simulatorRef.current.onEscalator.length === 0;

    if (noMoreArrivals && queueEmpty && escalatorEmpty && simulatorRef.current.exitedPeople.length >= config.maxPeopleToSimulate) {
        setIsRunning(false);
        console.log("Simulation finished: All spawned people exited.");
        return;
    }
    animationFrameIdRef.current = requestAnimationFrame(runSimulationStep);
}, [config.maxPeopleToSimulate]); // Add dependencies if they affect runSimulationStep


useEffect(() => {
    if (isRunning) {
        animationFrameIdRef.current = requestAnimationFrame(runSimulationStep);
    } else {
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
        }
    }
    return () => {
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
        }
    };
}, [isRunning, runSimulationStep]);

const handleStartStop = () => {
    if (!isRunning) {
      // If starting and sim is "finished", reset it before starting
      if (simulatorRef.current && simulatorRef.current.peopleSpawned >= config.maxPeopleToSimulate &&
          simulatorRef.current.waitingQueue.length === 0 &&
          simulatorRef.current.onEscalator.length === 0) {
          initializeSimulator(); 
      }
    }
    setIsRunning(!isRunning);
};

const handleReset = () => {
    setIsRunning(false);
    if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
    }
    initializeSimulator();
};

const handleStrategySelect = (walkerPercentage) => {
    setConfig(prev => ({ ...prev, percentageWalkingUp: walkerPercentage }));
    // Note: This will trigger re-initialization due to `useEffect` on `initializeSimulator`'s dependency `config`.
    // If simulation is running, you might want to stop it first or handle it differently.
    // For now, let's ensure it resets.
    setIsRunning(false); 
    // The useEffect on initializeSimulator will handle the reset.
};

return (
  <div className="container mx-auto p-4">
    <div><em>Note : Gemini 2.5 Pro 05-06 built this in 1 shot</em></div>
    <div className="min-h-screen bg-gray-100 p-4">
      
        <header className="mb-6">
            <h1 className="text-3xl font-bold text-center text-gray-800">Escalator Strategy Simulator</h1>
        </header>

        <div className="flex flex-col md:flex-row gap-6">
            {/* Left Column: Inputs */}
            <div className="md:w-1/3 bg-white p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Inputs</h2>
                
                <div className="mb-4">
                    <button onClick={() => handleStrategySelect(0)} className={`w-1/2 py-2 px-4 rounded-l-md ${config.percentageWalkingUp === 0 ? 'bg-indigo-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>Strategy 1 (Stand)</button>
                    <button onClick={() => handleStrategySelect(50)} className={`w-1/2 py-2 px-4 rounded-r-md ${config.percentageWalkingUp > 0 ? 'bg-indigo-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>Strategy 2 (Walk/Stand)</button>
                </div>

                <h3 className="text-lg font-medium mb-2 text-gray-600">Escalator Variables</h3>
                <InputField label="Escalator Length (m)" name="escalatorLength" value={config.escalatorLength} onChange={handleInputChange} step="1" min="5"/>
                <InputField label="Escalator Speed (m/s)" name="escalatorSpeed" value={config.escalatorSpeed} onChange={handleInputChange} step="0.05" min="0.1"/>
                <InputField label="Step Depth (m)" name="stepDepth" value={config.stepDepth} onChange={handleInputChange} step="0.05" min="0.2"/>

                <h3 className="text-lg font-medium mt-4 mb-2 text-gray-600">People Variables</h3>
                <InputField label="Arrival Rate (people/min)" name="arrivalRatePerMinute" value={config.arrivalRatePerMinute} onChange={handleInputChange} step="5" min="1"/>
                <InputField label="Max People to Simulate" name="maxPeopleToSimulate" value={config.maxPeopleToSimulate} onChange={handleInputChange} step="10" min="10"/>
                
                {config.percentageWalkingUp > 0 && (
                    <>
                        <InputField 
                            label={`Percentage Walking Up (${config.percentageWalkingUp}%)`} 
                            type="range" 
                            name="percentageWalkingUp" 
                            value={config.percentageWalkingUp} 
                            onChange={handleInputChange} 
                            min="1" max="100" step="1" 
                        />
                        <InputField label="Avg. Walking Speed (m/s, additional)" name="avgWalkingSpeed" value={config.avgWalkingSpeed} onChange={handleInputChange} step="0.1" min="0.1"/>
                        <InputField label="Std. Dev. Walking Speed (m/s)" name="stdDevWalkingSpeed" value={config.stdDevWalkingSpeed} onChange={handleInputChange} step="0.05" min="0"/>
                    </>
                )}
                 <InputField label="Simulation Timestep (s)" name="simulationTimeStep" value={config.simulationTimeStep} onChange={handleInputChange} step="0.01" min="0.01"/>


                <div className="mt-6 flex space-x-3">
                    <button onClick={handleStartStop} className={`py-2 px-4 rounded-md font-semibold ${isRunning ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'} text-white`}>
                        {isRunning ? 'Pause' : 'Start'}
                    </button>
                    <button onClick={handleReset} className="py-2 px-4 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-md">
                        Reset
                    </button>
                </div>
            </div>

            {/* Right Column: Animation & Stats */}
            <div className="md:w-2/3 bg-white p-6 rounded-lg shadow-lg">
                <div className="flex flex-col xl:flex-row gap-4">
                    <div className="xl:w-1/3 flex flex-col items-center">
                         <h2 className="text-xl font-semibold mb-4 text-gray-700 text-center">Animation</h2>
                        {simulationState && (
                            <EscalatorAnimation
                                people={simulationState.people}
                                escalatorLength={config.escalatorLength}
                                percentageWalkingUp={config.percentageWalkingUp}
                            />
                        )}
                        <div className="mt-2 text-sm text-gray-600">Time: {simulationState?.currentTime?.toFixed(1) || 0}s</div>
                    </div>
                    <div className="xl:w-2/3">
                        <h2 className="text-xl font-semibold mb-4 text-gray-700">Statistics (Current Sim)</h2>
                        {simulationState && (
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <p><strong>People at Top:</strong> {simulationState.stats.totalExited}</p>
                                <p><strong>Queue at Bottom:</strong> {simulationState.stats.queueLengthAtBottom}</p>
                                <p><strong>Flow (last min):</strong> {simulationState.stats.flowRatePerMinute.toFixed(1)} p/min</p>
                                <p><strong>Avg. Travel Time:</strong> {simulationState.stats.avgTravelTime.toFixed(2)} s</p>
                                <p><strong>Walkers on Escalator:</strong> {simulationState.log.length > 0 ? simulationState.log[simulationState.log.length-1].walkersOnEscalator : 0}</p>
                                <p><strong>Standers on Escalator:</strong> {simulationState.log.length > 0 ? simulationState.log[simulationState.log.length-1].standersOnEscalator : 0}</p>
                            </div>
                        )}
                         <h3 className="text-lg font-semibold mt-6 mb-2 text-gray-700">Theoretical Strategy 1 (All Stand)</h3>
                        {s1TheoreticalStats && (
                            <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-3 rounded">
                                <p><strong>Max Flow:</strong> {s1TheoreticalStats.flowRatePerMinute} p/min</p>
                                <p><strong>Avg. Travel Time:</strong> {s1TheoreticalStats.avgTravelTime} s</p>
                                <p><strong>Time to Clear {config.maxPeopleToSimulate} People:</strong> {s1TheoreticalStats.timeToClearNPeople} s</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-8">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Simulation Log Chart</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={simulationState?.log}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" unit="s" />
                            <YAxis yAxisId="left" label={{ value: 'Count', angle: -90, position: 'insideLeft' }}/>
                            <YAxis yAxisId="right" orientation="right" label={{ value: 'Flow (p/min)', angle: -90, position: 'insideRight' }}/>
                            <Tooltip />
                            <Legend />
                            <Line yAxisId="left" type="monotone" dataKey="queueLength" stroke="#8884d8" name="Queue Length" dot={false} />
                            <Line yAxisId="left" type="monotone" dataKey="walkersOnEscalator" stroke="#82ca9d" name="Walkers on Escalator" dot={false} />
                            <Line yAxisId="left" type="monotone" dataKey="standersOnEscalator" stroke="#ffc658" name="Standers on Escalator" dot={false} />
                            <Line yAxisId="right" type="monotone" dataKey="flowRate" stroke="#ca8282" name="Flow Rate (p/min)" dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    </div>
  </div>
);

}

export default Gemini25Pro0506Viz;