/****************************************************** 
 * LICENCE : GEMINI 2 EXPERIMENTAL OUTPUT
*******************************************************/

import React, { useState, useEffect, useRef } from 'react';

class EscalatorSimulation {
    constructor(options) {
        // Escalator Variables
        this.escalatorLength = options.escalatorLength || 10; // in meters (example)
        this.escalatorSpeed = options.escalatorSpeed || 0.5; // in meters/second
        this.stepCapacity = 2; // Number of people per step (2 for two-wide escalator)

        // People Variables
        this.totalPeople = options.totalPeople || 100;
        this.percentWalking = options.percentWalking || 0; // 0 for strategy 1
        this.avgWalkingSpeed = options.avgWalkingSpeed || 1.5; // meters/second
        this.walkingSpeedStdDev = options.walkingSpeedStdDev || 0.2; // Standard deviation for walking speed

        // Simulation State
        this.time = 0;
        this.peopleAtBottom = []; // Array to hold people waiting
        this.peopleOnEscalator = []; // Array for people on the escalator {position, speed, isWalking}
        this.peopleReachedTop = 0;
        this.flowRate = 0; // People per minute

        // Strategy
        this.strategy = (this.percentWalking === 0) ? 1 : 2;

        // Initialize people
        this.initializePeople();
    }

    initializePeople() {
        for (let i = 0; i < this.totalPeople; i++) {
            const isWalking = Math.random() < (this.percentWalking / 100);
            const speed = isWalking ? this.generateWalkingSpeed() : this.escalatorSpeed;
            this.peopleAtBottom.push({
                id: i,
                isWalking: isWalking,
                speed: speed,
                position: 0, // Initial position at the bottom
                startTime: 0 // Time they start waiting
            });
        }
    }

    generateWalkingSpeed() {
        // Generate a random walking speed based on a normal distribution
        // (You might need a library like simple-statistics for this)
        let speed = this.gaussianRandom(this.avgWalkingSpeed, this.walkingSpeedStdDev);
        return Math.max(speed, this.escalatorSpeed); // Walking speed cannot be less than escalator speed
    }

    gaussianRandom(mean, stdDev) {
        // Simple Box-Muller transform to generate random numbers from a normal distribution
        let u = 0, v = 0;
        while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
        while (v === 0) v = Math.random();
        let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        num = num * stdDev + mean;
        return num;
    }

    boardEscalator() {
        // Strategy 1: Everyone stands
        if (this.strategy === 1) {
            while (this.peopleAtBottom.length > 0 && this.peopleOnEscalator.length < this.escalatorLength * this.stepCapacity) {
                let person = this.peopleAtBottom.shift();
                person.position = 0; // Start at the bottom of the escalator
                this.peopleOnEscalator.push(person);
            }
        }
        // Strategy 2: Walking lane
        else {
            let availableSpace = this.escalatorLength * this.stepCapacity - this.peopleOnEscalator.length;
            let numStanders = 0;
            let numWalkers = 0;
            this.peopleOnEscalator.forEach(p => {
                if (p.isWalking) {
                    numWalkers++;
                } else {
                    numStanders++;
                }
            });

            while (this.peopleAtBottom.length > 0 && availableSpace > 0) {
                let person = this.peopleAtBottom.shift();
                if (person.isWalking && numWalkers < this.escalatorLength) {
                    person.position = 0;
                    this.peopleOnEscalator.push(person);
                    numWalkers++;
                    availableSpace--;
                } else if (!person.isWalking && numStanders < this.escalatorLength) {
                    person.position = 0;
                    this.peopleOnEscalator.push(person);
                    numStanders++;
                    availableSpace--;
                } else {
                    this.peopleAtBottom.unshift(person); // Put the person back in the queue if they can't board
                    break;
                }
            }
        }
    }

    updateEscalator() {
        // Move people up the escalator
        for (let i = 0; i < this.peopleOnEscalator.length; i++) {
            let person = this.peopleOnEscalator[i];

            if (person.isWalking) {
                // Check for blocking
                let canMove = true;
                for (let j = 0; j < i; j++) {
                    let personAhead = this.peopleOnEscalator[j];
                    if (person.position + person.speed >= personAhead.position) {
                        canMove = false;
                        break;
                    }
                }
                if (canMove) {
                    person.position += person.speed;
                } else {
                    person.position += this.escalatorSpeed; // Move at escalator speed if blocked
                }
            } else {
                // Standing still, move at escalator speed
                person.position += this.escalatorSpeed;
            }

            // Check if reached top
            if (person.position >= this.escalatorLength) {
                this.peopleReachedTop++;
                this.peopleOnEscalator.splice(i, 1); // Remove from escalator
                i--; // Adjust index after removal
            }
        }
    }

    calculateFlowRate() {
        // Calculate flow rate (people per minute)
        if (this.time > 0) {
            this.flowRate = (this.peopleReachedTop / this.time) * 60;
        }
    }

    update(deltaTime) {
        this.time += deltaTime;

        // Board new people if space is available
        this.boardEscalator();

        // Update escalator
        this.updateEscalator();

        // Calculate flow rate
        this.calculateFlowRate();
    }

    // ... (Other methods for resetting, etc.)
}

function Gemini2Viz() {
    // State variables for inputs
    const [escalatorLength, setEscalatorLength] = useState(20);
    const [escalatorSpeed, setEscalatorSpeed] = useState(0.5);
    const [totalPeople, setTotalPeople] = useState(100);
    const [percentWalking, setPercentWalking] = useState(0);
    const [avgWalkingSpeed, setAvgWalkingSpeed] = useState(1.34);
    const [walkingSpeedStdDev, setWalkingSpeedStdDev] = useState(0.2);

    // State for simulation
    const [simulation, setSimulation] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [time, setTime] = useState(0);
    const [peopleAtBottom, setPeopleAtBottom] = useState(0);
    const [peopleOnEscalator, setPeopleOnEscalator] = useState(0);
    const [peopleReachedTop, setPeopleReachedTop] = useState(0);
    const [flowRate, setFlowRate] = useState(0);
    const animationRef = useRef(null);

    // Initialize simulation
    useEffect(() => {
        const newSimulation = new EscalatorSimulation({
            escalatorLength,
            escalatorSpeed,
            totalPeople,
            percentWalking,
            avgWalkingSpeed,
            walkingSpeedStdDev,
        });
        setSimulation(newSimulation);
        setTime(0);
        setPeopleAtBottom(totalPeople);
        setPeopleOnEscalator(0);
        setPeopleReachedTop(0);
        setFlowRate(0);
    }, [
        escalatorLength,
        escalatorSpeed,
        totalPeople,
        percentWalking,
        avgWalkingSpeed,
        walkingSpeedStdDev,
    ]);

    // Animation loop
    useEffect(() => {
        let animationFrameId;

        const animate = () => {
            if (isRunning && simulation) {
                simulation.update(0.1); // Update simulation (adjust delta time as needed)

                // Update state variables for UI
                setTime(simulation.time);
                setPeopleAtBottom(simulation.peopleAtBottom.length);
                setPeopleOnEscalator(simulation.peopleOnEscalator.length);
                setPeopleReachedTop(simulation.peopleReachedTop);
                setFlowRate(simulation.flowRate);

                // Draw the escalator (basic visualization)
                drawEscalator();

                animationFrameId = requestAnimationFrame(animate);
            }
        };

        if (isRunning) {
            animationFrameId = requestAnimationFrame(animate);
        }

        return () => cancelAnimationFrame(animationFrameId);
    }, [isRunning, simulation]);

    // Drawing function (very basic example)
    const drawEscalator = () => {
        const canvas = animationRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        // Draw escalator steps
        ctx.strokeStyle = 'gray';
        for (let i = 0; i < escalatorLength; i++) {
            let y = canvasHeight - (i * (canvasHeight / escalatorLength));
            ctx.beginPath();
            ctx.moveTo(50, y);
            ctx.lineTo(150, y);
            ctx.stroke();
        }

        // Draw people
        if (simulation) {
            simulation.peopleOnEscalator.forEach(person => {
                let y = canvasHeight - (person.position * (canvasHeight / escalatorLength));
                ctx.fillStyle = person.isWalking ? 'blue' : 'red'; // Blue for walking, red for standing
                ctx.beginPath();
                ctx.arc(person.isWalking ? 70 : 130, y, 5, 0, 2 * Math.PI); // Adjust x-position based on walking/standing
                ctx.fill();
            });
        }
    };

    const handleStartStop = () => {
        setIsRunning(!isRunning);
    };

    const handleReset = () => {
        setIsRunning(false);
        const newSimulation = new EscalatorSimulation({
            escalatorLength,
            escalatorSpeed,
            totalPeople,
            percentWalking,
            avgWalkingSpeed,
            walkingSpeedStdDev,
        });
        setSimulation(newSimulation);
        setTime(0);
        setPeopleAtBottom(totalPeople);
        setPeopleOnEscalator(0);
        setPeopleReachedTop(0);
        setFlowRate(0);
    };

    return (
        <div className="container mx-auto p-4 flex">
            {/* Left Column: Inputs */}
            <div className="w-1/2 pr-4">
                <h2 className="text-xl font-bold mb-4">Escalator Simulation</h2>

                {/* Escalator Variables */}
                <div className="mb-4">
                    <h3 className="font-semibold mb-2">Escalator Variables</h3>
                    <div className="mb-2">
                        <label htmlFor="escalatorLength" className="block mb-1">Length (m):</label>
                        <input
                            type="number"
                            id="escalatorLength"
                            value={escalatorLength}
                            onChange={(e) => setEscalatorLength(parseFloat(e.target.value))}
                            className="w-full border border-gray-400 px-2 py-1"
                        />
                    </div>
                    <div className="mb-2">
                        <label htmlFor="escalatorSpeed" className="block mb-1">Speed (m/s):</label>
                        <input
                            type="number"
                            id="escalatorSpeed"
                            value={escalatorSpeed}
                            onChange={(e) => setEscalatorSpeed(parseFloat(e.target.value))}
                            className="w-full border border-gray-400 px-2 py-1"
                        />
                    </div>
                </div>

                {/* People Variables */}
                <div className="mb-4">
                    <h3 className="font-semibold mb-2">People Variables</h3>
                    <div className="mb-2">
                        <label htmlFor="totalPeople" className="block mb-1">Total People:</label>
                        <input
                            type="number"
                            id="totalPeople"
                            value={totalPeople}
                            onChange={(e) => setTotalPeople(parseInt(e.target.value))}
                            className="w-full border border-gray-400 px-2 py-1"
                        />
                    </div>
                    <div className="mb-2">
                        <label htmlFor="percentWalking" className="block mb-1">% Walking:</label>
                        <input
                            type="number"
                            id="percentWalking"
                            value={percentWalking}
                            onChange={(e) => setPercentWalking(parseFloat(e.target.value))}
                            className="w-full border border-gray-400 px-2 py-1"
                        />
                    </div>
                    <div className="mb-2">
                        <label htmlFor="avgWalkingSpeed" className="block mb-1">Avg. Walking Speed (m/s):</label>
                        <input
                            type="number"
                            id="avgWalkingSpeed"
                            value={avgWalkingSpeed}
                            onChange={(e) => setAvgWalkingSpeed(parseFloat(e.target.value))}
                            className="w-full border border-gray-400 px-2 py-1"
                        />
                    </div>
                    <div className="mb-2">
                        <label htmlFor="walkingSpeedStdDev" className="block mb-1">Walking Speed Std. Dev.:</label>
                        <input
                            type="number"
                            id="walkingSpeedStdDev"
                            value={walkingSpeedStdDev}
                            onChange={(e) => setWalkingSpeedStdDev(parseFloat(e.target.value))}
                            className="w-full border border-gray-400 px-2 py-1"
                        />
                    </div>
                </div>

                {/* Simulation Controls */}
                <div className="mb-4">
                    <button
                        onClick={handleStartStop}
                        className={`bg-${isRunning ? 'red' : 'green'}-500 hover:bg-${isRunning ? 'red' : 'green'}-700 text-white font-bold py-2 px-4 rounded mr-2`}
                    >
                        {isRunning ? 'Stop' : 'Start'}
                    </button>
                    <button
                        onClick={handleReset}
                        className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                    >
                        Reset
                    </button>
                </div>
            </div>

            {/* Right Column: Visualization and Statistics */}
            <div className="w-1/2">
                <div className="mb-4">
                    <canvas ref={animationRef} width="300" height="400" className="border border-gray-400"></canvas>
                </div>

                {/* Statistics */}
                <div className="mb-4">
                    <h3 className="font-semibold mb-2">Statistics</h3>
                    <p>Time: {time.toFixed(1)} s</p>
                    <p>People at Bottom: {peopleAtBottom}</p>
                    <p>People on Escalator: {peopleOnEscalator}</p>
                    <p>People Reached Top: {peopleReachedTop}</p>
                    <p>Flow Rate: {flowRate.toFixed(2)} people/min</p>
                </div>
            </div>
        </div>
    );
}

export default Gemini2Viz;