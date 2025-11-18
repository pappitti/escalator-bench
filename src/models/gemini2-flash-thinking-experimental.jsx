/****************************************************** 
 * LICENSE : GEMINI 2.0 FLASH THINKING EXPERIMENTAL OUTPUT
*******************************************************/

import React, { useState, useEffect, useRef } from 'react';

const InputPanel = ({
    escalatorLength,
    setEscalatorLength,
    escalatorSpeed,
    setEscalatorSpeed,
    numPeople,
    setNumPeople,
    walkingPercentage,
    setWalkingPercentage,
    avgWalkingSpeed,
    setAvgWalkingSpeed,
    walkingSpeedDistribution,
    setWalkingSpeedDistribution,
    strategy,
    setStrategy
}) => {
    return (
        <div className="p-4 space-y-4">
            <h2 className="text-xl font-bold">Inputs</h2>
            <div>
                <h3 className="font-semibold">Escalator Variables</h3>
                <div className="space-y-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Escalator Length (steps)</label>
                        <input
                            type="number"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            value={escalatorLength}
                            onChange={(e) => setEscalatorLength(parseInt(e.target.value, 10))}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Escalator Speed (steps/second)</label>
                        <input
                            type="number"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            value={escalatorSpeed}
                            onChange={(e) => setEscalatorSpeed(parseFloat(e.target.value))}
                        />
                    </div>
                </div>
            </div>
            <div>
                <h3 className="font-semibold">People Input</h3>
                <div className="space-y-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Number of People Arriving</label>
                        <input
                            type="number"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            value={numPeople}
                            onChange={(e) => setNumPeople(parseInt(e.target.value, 10))}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Percentage Walking (%)</label>
                        <input
                            type="number"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            value={walkingPercentage}
                            onChange={(e) => setWalkingPercentage(parseFloat(e.target.value))}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Average Walking Speed (steps/second)</label>
                        <input
                            type="number"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            value={avgWalkingSpeed}
                            onChange={(e) => setAvgWalkingSpeed(parseFloat(e.target.value))}
                        />
                    </div>
                    {/*  For simplicity, let's skip distribution for now, or just use stdDev input if needed */}
                    {/* <div>
                        <label className="block text-sm font-medium text-gray-700">Walking Speed Std Dev (steps/second)</label>
                        <input
                            type="number"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            value={walkingSpeedDistribution}
                            onChange={(e) => setWalkingSpeedDistribution(parseFloat(e.target.value))}
                        />
                    </div> */}
                </div>
            </div>
            <div>
                <h3 className="font-semibold">Strategy</h3>
                <select
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    value={strategy}
                    onChange={(e) => setStrategy(parseInt(e.target.value, 10))}
                >
                    <option value={1}>Strategy 1: Everyone Stands</option>
                    <option value={2}>Strategy 2: Stand/Walk</option>
                </select>
            </div>
        </div>
    );
};

const Simulator = ({
    escalatorLength,
    escalatorSpeed,
    numPeople,
    walkingPercentage,
    avgWalkingSpeed,
    walkingSpeedDistribution,
    strategy
}) => {
    const canvasRef = useRef(null);
    const [peopleOnEscalator, setPeopleOnEscalator] = useState([]);
    const [peopleAtBottom, setPeopleAtBottom] = useState([]);
    const [peopleReachedTop, setPeopleReachedTop] = useState(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = 300; // Adjust as needed
        canvas.height = 400; // Adjust as needed

        const stepHeight = canvas.height / escalatorLength;
        const stepWidth = canvas.width;
        const personRadius = 5;

        let animationFrameId;

        const drawEscalator = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'gray';
            for (let i = 0; i < escalatorLength; i++) {
                ctx.fillRect(0, canvas.height - (i + 1) * stepHeight, stepWidth, stepHeight);
            }
        };

        const drawPeople = () => {
            peopleOnEscalator.forEach(person => {
                ctx.beginPath();
                ctx.arc(person.x, person.y, personRadius, 0, 2 * Math.PI);
                ctx.fillStyle = person.isWalking ? 'blue' : 'red'; // Different color for walkers
                ctx.fill();
            });
            peopleAtBottom.forEach((_, index) => { // Just showing number at bottom for now, adjust as needed
                ctx.beginPath();
                ctx.arc(20 + index * 15, canvas.height - 10, personRadius, 0, 2 * Math.PI);
                ctx.fillStyle = 'green';
                ctx.fill();
            });
        };

        const updateSimulation = (time) => {
            // ** Simulation Logic will go here **
            // 1. Handle new people arriving at the bottom (initially just add all at start)
            // 2. Move people on escalator
            // 3. Check for people reaching the top
            // 4. Add new people to escalator from bottom queue if space

            // --- Placeholder logic for initial setup ---
            if (peopleOnEscalator.length < numPeople && peopleAtBottom.length < numPeople ) { // Initial load for testing
                setPeopleAtBottom(prev => [...prev, {}]) // Add people to bottom queue initially
            }


            setPeopleOnEscalator(prevPeople => {
                return prevPeople.map(person => {
                    let newY = person.y - escalatorSpeed * 10; // Move up based on speed (adjust multiplier for visual speed)
                    if (newY < 0) { // Reached the top
                        setPeopleReachedTop(topCount => topCount + 1);
                        return null; // Remove person
                    }
                    return { ...person, y: newY };
                }).filter(person => person !== null); // Filter out removed people
            });

            // Add people from bottom queue to escalator if space at bottom step
            if (peopleAtBottom.length > 0 && peopleOnEscalator.length < escalatorLength * 2) { // Basic space check, refine logic later
                const newPerson = {
                    x: stepWidth / 2, // Center of step
                    y: canvas.height - stepHeight / 2, // Bottom step center
                    stepIndex: 0,
                    isWalking: Math.random() * 100 < walkingPercentage, // Determine if walking based on percentage
                    speed: escalatorSpeed // Base speed
                };
                setPeopleOnEscalator(prevPeople => [...prevPeople, newPerson]);
                setPeopleAtBottom(prevPeopleAtBottom => prevPeopleAtBottom.slice(1)); // Remove from bottom queue
            }


            drawEscalator();
            drawPeople();
            animationFrameId = requestAnimationFrame(updateSimulation);
        };


        const initializeSimulation = () => {
            setPeopleOnEscalator([]);
            setPeopleAtBottom([]);
            setPeopleReachedTop(0);
            for (let i = 0; i < numPeople; i++) {
                setPeopleAtBottom(prev => [...prev, {}]); // Initial people at bottom
            }
        };

        initializeSimulation(); // Initialize when inputs change or on mount


        animationFrameId = requestAnimationFrame(updateSimulation);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [escalatorLength, escalatorSpeed, numPeople, walkingPercentage, avgWalkingSpeed, walkingSpeedDistribution, strategy]); // Re-run effect if inputs change

    return (
        <div>
            <canvas ref={canvasRef} className="border border-black"></canvas>
            <p>People Reached Top: {peopleReachedTop}</p>
            {/* Add statistics display here later */}
        </div>
    );
};

const Statistics = ({ peopleReachedTop }) => {
    return (
        <div className="p-4">
            <h2 className="text-xl font-bold">Statistics</h2>
            <p>People Reached Top: {peopleReachedTop}</p>
            {/* Add more stats here */}
        </div>
    );
};

function Gemini2FlashThinkingExpViz() {
    const [escalatorLength, setEscalatorLength] = useState(20);
    const [escalatorSpeed, setEscalatorSpeed] = useState(0.5);
    const [numPeople, setNumPeople] = useState(50);
    const [walkingPercentage, setWalkingPercentage] = useState(50);
    const [avgWalkingSpeed, setAvgWalkingSpeed] = useState(1.0);
    const [walkingSpeedDistribution, setWalkingSpeedDistribution] = useState(0.2); // Not actively used yet
    const [strategy, setStrategy] = useState(2); // Strategy 2 by default
    const [peopleReachedTop, setPeopleReachedTop] = useState(0); // To pass to statistics (example)

    return (
        <div className="container mx-auto p-4">
            <div><em>Note : Gemini 2.0 Flash Thinking Experimental built this in one shot </em></div>
            <h1 className="text-2xl font-bold mb-4">Escalator Strategy Simulator</h1>
            <div className="flex">
                <div className="w-1/4 p-4">
                    <InputPanel
                        escalatorLength={escalatorLength} setEscalatorLength={setEscalatorLength}
                        escalatorSpeed={escalatorSpeed} setEscalatorSpeed={setEscalatorSpeed}
                        numPeople={numPeople} setNumPeople={setNumPeople}
                        walkingPercentage={walkingPercentage} setWalkingPercentage={setWalkingPercentage}
                        avgWalkingSpeed={avgWalkingSpeed} setAvgWalkingSpeed={setAvgWalkingSpeed}
                        walkingSpeedDistribution={walkingSpeedDistribution} setWalkingSpeedDistribution={setWalkingSpeedDistribution}
                        strategy={strategy} setStrategy={setStrategy}
                    />
                </div>
                <div className="w-3/4 p-4">
                    <Simulator
                        escalatorLength={escalatorLength}
                        escalatorSpeed={escalatorSpeed}
                        numPeople={numPeople}
                        walkingPercentage={walkingPercentage}
                        avgWalkingSpeed={avgWalkingSpeed}
                        walkingSpeedDistribution={walkingSpeedDistribution}
                        strategy={strategy}
                        setPeopleReachedTop={setPeopleReachedTop} // Example of passing state back, not ideal but for demonstration
                    />
                    {/* <Statistics peopleReachedTop={peopleReachedTop} /> */} {/*  Statistics can be integrated into Simulator or separate */}
                </div>
            </div>
        </div>
    );
}

export default Gemini2FlashThinkingExpViz;