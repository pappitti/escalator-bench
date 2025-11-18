/****************************************************** 
 * LICENSE : GEMINI 2.5 Flash 0520 OUTPUT
*******************************************************/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- Constants ---
const STEP_LENGTH = 0.8; // meters, approximate length occupied by one standing person
const TIME_STEP = 0.1; // seconds, simulation granularity


const PersonDot = ({ person, escalatorLength, animationHeight }) => {
    // Map person's position (0 to escalatorLength) to CSS 'top' property (from animationHeight to 0)
    // The higher the currentPosition, the lower the 'top' value (closer to top of escalator visualization)
    const topPosition = animationHeight - (person.currentPosition / escalatorLength) * animationHeight - 8; // -8 to center dot

    // Lane position (left/right)
    const leftPosition = person.lane === 'left' ? 'calc(25% - 8px)' : 'calc(75% - 8px)'; // Assuming 50% width for each lane

    const opacity = person.currentPosition === -1 ? 0 : 1; // Hide if in queue (conceptual)

    return (
        <div
            className="person-dot absolute rounded-full shadow-md transition-transform duration-100 ease-linear" // Smooth transition for visual movement
            style={{
                backgroundColor: person.color,
                top: `${topPosition}px`,
                left: leftPosition,
                opacity: opacity, // Only show if on escalator
                transform: `translateY(${person.currentPosition === -1 ? 1000 : 0}px)`, // For initial queue people
                zIndex: Math.floor(person.currentPosition), // Higher z-index for people further up
            }}
        ></div>
    );
};

const InputForm = ({ inputs, handleInputChange, simulationRunning }) => {
    return (
        <div className="p-4 bg-gray-100 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Escalator Simulation Inputs</h2>

            <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Escalator Variables</h3>
                <label className="block mb-2">
                    Escalator Length (m):
                    <input
                        type="number"
                        name="escalatorLength"
                        value={inputs.escalatorLength}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded mt-1"
                        min="1"
                        disabled={simulationRunning}
                    />
                </label>
                <label className="block mb-2">
                    Escalator Speed (m/s):
                    <input
                        type="number"
                        name="escalatorSpeed"
                        value={inputs.escalatorSpeed}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded mt-1"
                        step="0.1"
                        min="0.1"
                        disabled={simulationRunning}
                    />
                </label>
                <label className="block mb-2">
                    Simulation Duration (seconds):
                    <input
                        type="number"
                        name="simulationDuration"
                        value={inputs.simulationDuration}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded mt-1"
                        min="10"
                        max="600"
                        disabled={simulationRunning}
                    />
                </label>
            </div>

            <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">People Inputs</h3>
                <label className="block mb-2">
                    People Arriving (per minute):
                    <input
                        type="number"
                        name="peoplePerMinuteArrival"
                        value={inputs.peoplePerMinuteArrival}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded mt-1"
                        min="10"
                        disabled={simulationRunning}
                    />
                </label>
                <label className="block mb-2">
                    Percentage of Walkers (%):
                    <input
                        type="number"
                        name="percentageWalkers"
                        value={inputs.percentageWalkers}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded mt-1"
                        min="0"
                        max="100"
                        disabled={simulationRunning}
                    />
                </label>
                <label className="block mb-2">
                    Average Walking Speed (m/s, relative to escalator):
                    <input
                        type="number"
                        name="avgWalkingSpeed"
                        value={inputs.avgWalkingSpeed}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded mt-1"
                        step="0.1"
                        min="0"
                        disabled={simulationRunning}
                    />
                </label>
                <label className="block mb-2">
                    Walking Speed Standard Deviation (m/s):
                    <input
                        type="number"
                        name="walkingSpeedStdDev"
                        value={inputs.walkingSpeedStdDev}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded mt-1"
                        step="0.01"
                        min="0"
                        disabled={simulationRunning}
                    />
                </label>
            </div>

            <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Strategy Selection</h3>
                <label className="block mb-2">
                    <input
                        type="radio"
                        name="strategy"
                        value="1"
                        checked={inputs.strategy === 1}
                        onChange={handleInputChange}
                        className="mr-2"
                        disabled={simulationRunning}
                    />
                    Strategy 1: Everyone stands (2 people/step)
                </label>
                <label className="block mb-2">
                    <input
                        type="radio"
                        name="strategy"
                        value="2"
                        checked={inputs.strategy === 2}
                        onChange={handleInputChange}
                        className="mr-2"
                        disabled={simulationRunning}
                    />
                    Strategy 2: Walkers Left, Standers Right
                </label>
            </div>
        </div>
    );
};

const StatsDisplay = ({ completedCount, flowRate, queueLengths, totalTime, currentTime, simulationDuration }) => {

    const safeCurrentTime = currentTime ?? 0;
    const safeCompletedCount = completedCount ?? 0;
    const safeFlowRate = flowRate ?? 0;

    const queueLeft = queueLengths.left;
    const queueRight = queueLengths.right;
    const totalQueue = queueLeft + queueRight;

    return (
        <div className="p-4 bg-gray-100 rounded-lg shadow-md mt-4">
            <h2 className="text-xl font-bold mb-4">Simulation Statistics</h2>

            <p className="mb-2">
                Time Elapsed: <span className="font-semibold">{safeCurrentTime.toFixed(1)}</span> / {simulationDuration} seconds
            </p>
            <p className="mb-2">
                People Reached Top: <span className="font-semibold">{safeCompletedCount}</span>
            </p>
            <p className="mb-2">
                Current Flow Rate: <span className="font-semibold">{safeFlowRate.toFixed(2)}</span> people/min
            </p>
            <p className="mb-2">
                Queue Left (Walkers): <span className="font-semibold">{queueLeft}</span>
            </p>
            <p className="mb-2">
                Queue Right (Standers/All): <span className="font-semibold">{queueRight}</span>
            </p>
            <p className="mb-2">
                Total Queue: <span className="font-semibold">{totalQueue}</span>
            </p>
        </div>
    );
};

const ComparisonChart = ({ currentStrategyResults, strategy1Results }) => {
    // Data for the bar chart
    const data = [
        {
            name: 'Strategy 1 (Stand Still)',
            'People per Minute': strategy1Results.flow,
            'Queue Size (End)': strategy1Results.queueSize,
        },
        {
            name: `Strategy ${currentStrategyResults.strategy} (Simulated)`,
            'People per Minute': currentStrategyResults.flow,
            'Queue Size (End)': currentStrategyResults.queueLeft + currentStrategyResults.queueRight,
        },
    ];

    return (
        <div className="p-4 bg-gray-100 rounded-lg shadow-md mt-4">
            <h2 className="text-xl font-bold mb-4">Strategy Comparison</h2>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart
                    data={data}
                    margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="People per Minute" fill="#8884d8" />
                    <Bar dataKey="Queue Size (End)" fill="#82ca9d" />
                </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-sm text-gray-600">
                Strategy 1 is a deterministic calculation assuming continuous optimal flow without queuing.
            </p>
        </div>
    );
};

const EscalatorSimulator = ({ inputs, simulationRunning, onToggleSimulation, onResetSimulation }) => {
    const {
        escalatorLength,
        escalatorSpeed,
        peoplePerMinuteArrival,
        percentageWalkers,
        avgWalkingSpeed,
        walkingSpeedStdDev,
        simulationDuration,
        strategy
    } = inputs;

    // Simulation State
    const [peopleOnEscalator, setPeopleOnEscalator] = useState([]);
    const [queueLeft, setQueueLeft] = useState([]); // Walkers (Strategy 2)
    const [queueRight, setQueueRight] = useState([]); // Standers (Strategy 2) or All (Strategy 1)
    const [completedPeopleCount, setCompletedPeopleCount] = useState(0);
    const [flowRate, setFlowRate] = useState(0); // People per minute
    const [currentTime, setCurrentTime] = useState(0);
    const [lastArrivalTime, setLastArrivalTime] = useState(0);
    const personIdCounter = useRef(0); // Use ref to persist across renders

    // Simulation Results for Comparison
    const [strategy1Results, setStrategy1Results] = useState({ flow: 0, queueSize: 0 });
    const [currentStrategyResults, setCurrentStrategyResults] = useState({
        strategy: strategy,
        flow: 0,
        queueLeft: 0,
        queueRight: 0,
    });

    const animationFrameId = useRef(null);
    const lastRenderTime = useRef(0);

    const escalatorContainerRef = useRef(null);
    const [escalatorHeightPx, setEscalatorHeightPx] = useState(0);

    // --- Utility Functions ---
    const boxMullerRandom = useCallback(() => {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }, []);

    // --- Strategy 1 Deterministic Calculation ---
    // Strategy 1: Everyone stands. Max throughput is dictated by escalator speed and step capacity.
    const calculateStrategy1 = useCallback(() => {
        // Assume 2 people per step.
        // Number of steps on escalator = escalatorLength / STEP_LENGTH
        // Time for one step to clear = STEP_LENGTH / escalatorSpeed
        // People per second = 2 (people per step) / (time for one step to clear)
        //                   = 2 / (STEP_LENGTH / escalatorSpeed)
        //                   = (2 * escalatorSpeed) / STEP_LENGTH
        const flowPerSecond = (2 * escalatorSpeed) / STEP_LENGTH;
        const flowPerMinute = flowPerSecond * 60;
        // In this idealized model, if arrivals are sufficient, queue size is 0 and flow is max capacity.
        return { flow: flowPerMinute, queueSize: 0 };
    }, [escalatorSpeed, escalatorLength]);

    // --- Simulation Logic ---
    const simulateStep = useCallback((timestamp) => {
        if (!lastRenderTime.current) {
            lastRenderTime.current = timestamp;
            animationFrameId.current = requestAnimationFrame(simulateStep);
            return;
        }

        // Calculate delta time in seconds
        const deltaTime = (timestamp - lastRenderTime.current) / 1000;
        lastRenderTime.current = timestamp;

        if (currentTime.current < simulationDuration) {
            // --- 1. Arrivals ---
            const peoplePerSecondArrival = peoplePerMinuteArrival / 60;
            const timeBetweenArrivals = 1 / peoplePerSecondArrival;

            if (currentTime.current - lastArrivalTime.current >= timeBetweenArrivals) {
                const isWalker = Math.random() * 100 < percentageWalkers;
                let walkingSpeed = isWalker ? avgWalkingSpeed + (boxMullerRandom() * walkingSpeedStdDev) : 0;
                walkingSpeed = Math.max(0, walkingSpeed); // Ensure non-negative walking speed

                const newPerson = {
                    id: personIdCounter.current++,
                    type: isWalker ? 'walker' : 'stander',
                    currentPosition: -1, // -1 indicates in queue
                    desiredWalkingSpeed: walkingSpeed,
                    actualSpeed: 0, // Will be calculated when on escalator
                    arrivalTime: currentTime.current,
                    entryTime: null,
                    exitTime: null,
                    color: isWalker ? '#3B82F6' : '#10B981', // Blue for walkers, Green for standers
                    lane: 'right' // Default, will be assigned below
                };

                if (strategy === 1) { // Strategy 1: All stand, queue feeds both lanes
                    setQueueRight(prev => [...prev, newPerson]);
                } else { // Strategy 2: Walkers left, Standers right
                    if (isWalker) {
                        setQueueLeft(prev => [...prev, newPerson]);
                    } else {
                        setQueueRight(prev => [...prev, newPerson]);
                    }
                }
                setLastArrivalTime(currentTime.current);
            }

            // --- 2. Escalator Entry ---
            // Create a mutable copy of people on escalator for this tick's processing
            let currentPeopleOnEscalator = [...peopleOnEscalator];
            let currentQueueLeft = [...queueLeft];
            let currentQueueRight = [...queueRight];

            // Check if lane 0 (right) is clear (first step clear)
            const isRightLaneEntryClear = !currentPeopleOnEscalator.some(p => p.lane === 'right' && p.currentPosition < STEP_LENGTH);
            // Check if lane 1 (left) is clear
            const isLeftLaneEntryClear = !currentPeopleOnEscalator.some(p => p.lane === 'left' && p.currentPosition < STEP_LENGTH);

            if (strategy === 1) { // Strategy 1: Both lanes for standers, fed from right queue
                if (currentQueueRight.length > 0 && isRightLaneEntryClear) {
                    const person = currentQueueRight.shift();
                    person.currentPosition = 0;
                    person.entryTime = currentTime.current;
                    person.actualSpeed = escalatorSpeed;
                    person.lane = 'right';
                    currentPeopleOnEscalator.push(person);
                }
                if (currentQueueRight.length > 0 && isLeftLaneEntryClear) { // Use left lane too
                    const person = currentQueueRight.shift();
                    person.currentPosition = 0;
                    person.entryTime = currentTime.current;
                    person.actualSpeed = escalatorSpeed;
                    person.lane = 'left';
                    currentPeopleOnEscalator.push(person);
                }
            } else { // Strategy 2: Walkers left, Standers right
                if (currentQueueRight.length > 0 && isRightLaneEntryClear) {
                    const person = currentQueueRight.shift();
                    person.currentPosition = 0;
                    person.entryTime = currentTime.current;
                    person.actualSpeed = escalatorSpeed;
                    person.lane = 'right';
                    currentPeopleOnEscalator.push(person);
                }
                if (currentQueueLeft.length > 0 && isLeftLaneEntryClear) {
                    const person = currentQueueLeft.shift();
                    person.currentPosition = 0;
                    person.entryTime = currentTime.current;
                    person.actualSpeed = escalatorSpeed + person.desiredWalkingSpeed; // Walkers start at desired speed
                    person.lane = 'left';
                    currentPeopleOnEscalator.push(person);
                }
            }

            // --- 3. Update Positions & Handle Blocking ---
            // Sort people by position (from bottom to top) for collision detection
            currentPeopleOnEscalator.sort((a, b) => a.currentPosition - b.currentPosition);

            for (let i = 0; i < currentPeopleOnEscalator.length; i++) {
                const p = currentPeopleOnEscalator[i];
                let effectiveSpeed = escalatorSpeed;
                if (p.type === 'walker') {
                    effectiveSpeed += p.desiredWalkingSpeed;
                }

                let nextPersonInLane = null;
                for (let j = i + 1; j < currentPeopleOnEscalator.length; j++) {
                    if (currentPeopleOnEscalator[j].lane === p.lane) {
                        nextPersonInLane = currentPeopleOnEscalator[j];
                        break;
                    }
                }

                if (nextPersonInLane) {
                    // Maximum speed 'p' can move to avoid colliding with 'nextPersonInLane'
                    // The front of 'p' (`p.currentPosition + STEP_LENGTH`) must not pass the back of `nextPersonInLane`
                    const maxSpeedToAvoidCollision = (nextPersonInLane.currentPosition - STEP_LENGTH - p.currentPosition) / deltaTime;

                    // Apply constraints:
                    // 1. Cannot go faster than desired speed (already set in `effectiveSpeed`).
                    // 2. Cannot collide with person in front.
                    effectiveSpeed = Math.min(effectiveSpeed, Math.max(0, maxSpeedToAvoidCollision));

                    // 3. Cannot overtake person in front (i.e., effectiveSpeed <= nextPersonInLane.actualSpeed).
                    // nextPersonInLane.actualSpeed is from the previous tick, which is a common simplification.
                    effectiveSpeed = Math.min(effectiveSpeed, nextPersonInLane.actualSpeed);
                }

                // A person can't go slower than the escalator itself (unless stuck at top/bottom)
                effectiveSpeed = Math.max(escalatorSpeed, effectiveSpeed);

                p.actualSpeed = effectiveSpeed;
                p.currentPosition += p.actualSpeed * deltaTime;
            }

            // --- 4. Check for Exits ---
            let newCompletedPeople = 0;
            currentPeopleOnEscalator = currentPeopleOnEscalator.filter(p => {
                if (p.currentPosition >= escalatorLength) {
                    p.exitTime = currentTime.current;
                    newCompletedPeople++;
                    return false;
                }
                return true;
            });
            setCompletedPeopleCount(prev => prev + newCompletedPeople);

            // --- 5. Update State & Schedule Next Frame ---
            setPeopleOnEscalator(currentPeopleOnEscalator);
            setQueueLeft(currentQueueLeft);
            setQueueRight(currentQueueRight);
            setCurrentTime(prev => prev + deltaTime);

            // Calculate current flow rate (moving average or instantaneous)
            // For simplicity, let's calculate total flow over current time
            if (currentTime.current > 0) {
                setFlowRate((completedPeopleCount + newCompletedPeople) / (currentTime.current / 60));
            }

            animationFrameId.current = requestAnimationFrame(simulateStep);
        } else {
            // Simulation finished
            onToggleSimulation(false); // Stop simulation
            const finalFlow = completedPeopleCount / (simulationDuration / 60);
            setCurrentStrategyResults({
                strategy: strategy,
                flow: finalFlow,
                queueLeft: queueLeft.length,
                queueRight: queueRight.length,
            });
        }
    }, [
        escalatorLength, escalatorSpeed, peoplePerMinuteArrival, percentageWalkers,
        avgWalkingSpeed, walkingSpeedStdDev, simulationDuration, strategy, boxMullerRandom,
        peopleOnEscalator, completedPeopleCount, queueLeft, queueRight, onToggleSimulation
    ]);

    // --- Effects ---
    // Start/Pause simulation
    useEffect(() => {
        if (simulationRunning) {
            lastRenderTime.current = performance.now(); // Reset last render time on start/resume
            animationFrameId.current = requestAnimationFrame(simulateStep);
        } else {
            cancelAnimationFrame(animationFrameId.current);
        }

        // Cleanup on component unmount
        return () => {
            cancelAnimationFrame(animationFrameId.current);
        };
    }, [simulationRunning, simulateStep]);

    // Reset simulation
    useEffect(() => {
        if (!simulationRunning && currentTime === 0) { // Only reset if not running and at initial state
            setPeopleOnEscalator([]);
            setQueueLeft([]);
            setQueueRight([]);
            setCompletedPeopleCount(0);
            setFlowRate(0);
            setCurrentTime(0);
            setLastArrivalTime(0);
            personIdCounter.current = 0;
            lastRenderTime.current = 0;

            // Recalculate Strategy 1 results on reset or input change
            const s1_results = calculateStrategy1();
            setStrategy1Results(s1_results);
            setCurrentStrategyResults({
                strategy: strategy,
                flow: 0,
                queueLeft: 0,
                queueRight: 0,
            });
        }
    }, [simulationRunning, currentTime, inputs, calculateStrategy1, strategy]); // Depend on inputs for strategy 1 re-calc

    // Initialize/recalculate Strategy 1 results on component mount or inputs change
    useEffect(() => {
        const s1_results = calculateStrategy1();
        setStrategy1Results(s1_results);
    }, [calculateStrategy1, inputs]);

    // Measure escalator container height for animation scaling
    useEffect(() => {
        if (escalatorContainerRef.current) {
            setEscalatorHeightPx(escalatorContainerRef.current.clientHeight);
        }
    }, [escalatorLength]); // Re-measure if escalator length changes (though not direct pixel change, for recalculation)

    return (
        <div className="p-4">
            <div className="flex justify-center space-x-4 mb-4">
                <button
                    onClick={() => onToggleSimulation(!simulationRunning)}
                    className={`px-6 py-3 rounded-lg text-white font-bold ${simulationRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                    {simulationRunning ? 'Pause Simulation' : 'Start Simulation'}
                </button>
                <button
                    onClick={onResetSimulation}
                    className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
                >
                    Reset
                </button>
            </div>

            <div className="relative h-96 bg-gray-200 border-x-4 border-gray-400 rounded-lg overflow-hidden" ref={escalatorContainerRef}>
                {escalatorHeightPx > 0 && peopleOnEscalator.map(person => (
                    <PersonDot
                        key={person.id}
                        person={person}
                        escalatorLength={escalatorLength}
                        animationHeight={escalatorHeightPx}
                    />
                ))}
                {/* Visual representation of queues */}
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gray-300 border-t-4 border-gray-400 flex">
                    {strategy === 2 ? (
                        <>
                            <div className="flex-1 border-r-2 border-gray-400 flex flex-col justify-end items-center p-1">
                                <span className="text-sm">Walkers Queue</span>
                                <span className="font-bold">{queueLeft.length}</span>
                                <div className="absolute top-0 left-0 w-full h-full flex flex-wrap-reverse justify-center items-end overflow-hidden">
                                    {queueLeft.map(p => (
                                        <div key={p.id} className={`person-dot w-3 h-3 rounded-full ${p.color === '#3B82F6' ? 'bg-blue-500' : 'bg-green-500'} m-0.5`}></div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col justify-end items-center p-1">
                                <span className="text-sm">Standers Queue</span>
                                <span className="font-bold">{queueRight.length}</span>
                                <div className="absolute top-0 left-0 w-full h-full flex flex-wrap-reverse justify-center items-end overflow-hidden">
                                    {queueRight.map(p => (
                                        <div key={p.id} className={`person-dot w-3 h-3 rounded-full ${p.color === '#3B82F6' ? 'bg-blue-500' : 'bg-green-500'} m-0.5`}></div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col justify-end items-center p-1">
                            <span className="text-sm">Queue</span>
                            <span className="font-bold">{queueRight.length}</span>
                            <div className="absolute top-0 left-0 w-full h-full flex flex-wrap-reverse justify-center items-end overflow-hidden">
                                {queueRight.map(p => (
                                    <div key={p.id} className={`person-dot w-3 h-3 rounded-full ${p.color === '#3B82F6' ? 'bg-blue-500' : 'bg-green-500'} m-0.5`}></div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <StatsDisplay
                completedCount={completedPeopleCount}
                flowRate={flowRate}
                queueLengths={{ left: queueLeft.length, right: queueRight.length }}
                totalTime={currentTime}
                simulationDuration={simulationDuration}
            />

            <ComparisonChart
                currentStrategyResults={currentStrategyResults}
                strategy1Results={strategy1Results}
            />
        </div>
    );
};

function Gemini25Flash0520Viz() {

    const [inputs, setInputs] = useState({
        escalatorLength: 10,       // meters
        escalatorSpeed: 0.5,       // m/s
        peoplePerMinuteArrival: 100,
        percentageWalkers: 50,
        avgWalkingSpeed: 0.8,      // m/s relative to escalator
        walkingSpeedStdDev: 0.1,   // m/s
        simulationDuration: 120,   // seconds
        strategy: 2,               // 1 for stand, 2 for walk/stand
    });

    const [simulationRunning, setSimulationRunning] = useState(false);
    const [resetSimulation, setResetSimulation] = useState(false); // Trigger for EscalatorSimulator reset

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setInputs(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) : (type === 'radio' ? parseInt(value) : value),
        }));
    };

    const handleToggleSimulation = (isRunning) => {
        setSimulationRunning(isRunning);
    };

    const handleResetSimulation = () => {
        setSimulationRunning(false);
        // Force EscalatorSimulator to reset its internal state
        setResetSimulation(true);
    };

    // Effect to signal EscalatorSimulator to reset itself
    useEffect(() => {
        if (resetSimulation) {
            // Once EscalatorSimulator has picked up the reset, revert this state
            // It will reset its internal state when `currentTime` becomes 0 in its useEffect
            setResetSimulation(false);
        }
    }, [resetSimulation]);


    return (
        <div className="container mx-auto p-4">
            <div><em>Note : Gemini 2.5 Flash 05-06 built this in 2 shots (typical issue with state update through hooks)</em></div>
            <div className="min-h-screen bg-gray-50 p-6 font-sans antialiased">
                <h1 className="text-4xl font-extrabold text-center text-gray-800 mb-8">
                    Optimal Escalator Strategy Simulator
                </h1>

                <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto">
                    {/* Left Column: Inputs */}
                    <div className="lg:w-1/3">
                        <InputForm
                            inputs={inputs}
                            handleInputChange={handleInputChange}
                            simulationRunning={simulationRunning}
                        />
                    </div>

                    {/* Right Column: Simulator, Stats, Chart */}
                    <div className="lg:w-2/3">
                        <EscalatorSimulator
                            inputs={inputs}
                            simulationRunning={simulationRunning}
                            onToggleSimulation={handleToggleSimulation}
                            onResetSimulation={handleResetSimulation}
                            key={resetSimulation ? 'reset' : 'run'} // Force re-render on reset to fully clear state
                        />
                    </div>
                </div>
            </div>
        </div>
    );
   
}

export default Gemini25Flash0520Viz;