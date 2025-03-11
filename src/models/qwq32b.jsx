/****************************************************** 
 * LICENCE : QWQ-32B
*******************************************************/

import { useState, useEffect, useRef } from 'react';

export function getNormalSample(mean = 0, sd = 1) {
    let u = Math.random();
    let v = Math.random();
    // Box-Muller transform for normal distribution sampling
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + z * sd;
}

export function simulate(strategy, escalatorLength, escalatorSpeed, totalPeople, walkPercentage = 0, averageWalkSpeed) {
    const people = Array.from({ length: totalPeople }, (_, i) => ({
        id: i,
        walks: (strategy === '2' && Math.random() < walkPercentage / 100),
        speed: escalatorSpeed + (Math.random() <= walkPercentage / 100 ? getNormalSample(averageWalkSpeed, averageWalkSpeed * 0.3) : 0),
        positionY: 0,
    }));

    let exitedCount = 0;
    const results = { totalPeople, ...strategy };

    // Simulate over a fixed time to compare flow rates
    const simulationDuration = 60; // seconds
    const stepDelta = 0.1; // interval in seconds

    for (let elapsed = 0; elapsed < simulationDuration; elapsed += stepDelta) {
        updatePositions(people, escalatorSpeed, strategy);
        exitedCount += processExits(people, escalatorLength);
    }

    results.flowPerMinute = (totalPeople - (people.filter(p => !p.exited).length)) / simulationDuration * 60;
    return results;
}

function updatePositions(people, escalatorSpeed, strategy) {
    const walkers = people.filter(p => p.walks && !p.exited);
    const standers = people.filter(p => !p.walks && !p.exited);

    // Sort and process non-walkers first (right lane)
    standers.forEach(p => 
        p.positionY += escalatorSpeed * 0.1
    );

    if (strategy === '2') {
        // Process walkers ensuring no overtaking (left lane)
        const sortedWalkers = [...walkers].sort((a, b) => a.positionY - b.positionY);
        for (let i = 0; i < sortedWalkers.length; i++) {
            const walker = sortedWalkers[i];
            if (i === 0 || sortedWalkers[i-1].positionY >= walker.positionY) {
                // If ahead is faster, update based on their speed
                let deltaSpeed = walker.speed - escalatorSpeed;
                deltaSpeed = Math.max(deltaSpeed, 0); // cannot go backwards

                walker.positionY += (escalatorSpeed + deltaSpeed) * 0.1;
            } else {
                // Cannot overtake previous walker
                const maxPosY = sortedWalkers[i-1].positionY;
                walker.positionY = Math.min(walker.positionY, maxPosY);
            }
        }
    }
}

function processExits(people, escalatorLength) {
    let exited = 0;
    people.forEach(p => {
        if (!p.exited && p.positionY >= escalatorLength) {
            p.exited = true;
            exited++;
        }
    });
    return exited;
}

const SimulationView = ({ simulation }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        // Draw simulation using canvas context here (similar to earlier example)
    }, [simulation]);

    return (
        <div className="mt-4">
            <h3>Simulation Visualization</h3>
            <canvas 
                ref={canvasRef}
                width={600} height={250}
                className="border p-2"
            >
                Canvas not supported.
            </canvas>
        </div>
    );
};

const Controls = ({ simulation, onInputChange }) => {
    return (
        <div className="p-4 bg-white shadow rounded-lg">
            <h3 className="text-xl mb-2">Simulation Parameters</h3>
            
            {/* Escalator Inputs */}
            <div className="mb-4">
                <label htmlFor="length" className="block text-gray-700 mb-1">Escalator Length (m)</label>
                <input 
                    type="number"
                    id="length"
                    value={simulation.escalatorLength}
                    onChange={(e) => onInputChange("escalatorLength", e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                />
            </div>

            {/* Add other inputs similarly: speed, total people, strategy, etc */}

            <button 
                onClick={() => onInputChange("strategy", "1")}
                className={`px-4 py-2 mr-2 ${simulation.strategy === '1' ? 'bg-blue-500 text-white' : ''}`}
            >
                Strategy 1: All Stand
            </button>

            <button 
                onClick={() => onInputChange("strategy", "2")}
                className={`px-4 py-2 ${simulation.strategy === '2' ? 'bg-green-500 text-white' : ''}`}
            >
                Strategy 2: Left Walk, Right Stand
            </button>
        </div>
    );
};

function QwQViz() {
    const [simulationState, setSimulation] = useState({
        escalatorLength: 15,
        escalatorSpeed: 0.6,
        totalPeople: 100,
        strategy: '2',
        walkPercentage: 30,
        averageWalkSpeed: 0.2,
        running: false,
    });

    return (
        <div className="min-h-screen bg-gray-100 p-4 w-full">
            <div><em>Note : QwQ-32B (FP16) built this in one shot and was unable to do better afterwards.</em></div>
            <div className="min-h-screen p-4 bg-gray-100">
                <h1 className="text-3xl font-bold mb-6 text-center">Escalator Strategy Simulator</h1>
                
                {/* Left Column: Inputs */}
                <div className="w-full sm:w-1/2 mr-4">
                    <Controls 
                        simulation={simulationState}
                        onInputChange={(key, value) => setSimulation(prev => ({...prev, [key]: value}))} 
                    />
                </div>

                {/* Right Column: Simulation & Results */}
                <div className="w-full sm:w-1/2">
                    <SimulationView
                        simulation={simulationState}
                        run={() => {
                            // Simulate and display results here (use effect or state)
                        }}
                    />
                    { /* Add comparison stats component */ }
                </div>
            </div>
        </div>
    );
}

export default QwQViz;
