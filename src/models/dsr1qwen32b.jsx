// src/App.js
import React, { useState } from 'react';

function InputControls({ 
    numPeople,
    setNumPeople,
    escalatorLength,
    setEscalatorLength,
    escalatorSpeed,
    setEscalatorSpeed,
    walkersPercentage,
    setWalkersPercentage,
    walkerSpeed,
    setWalkerSpeed
  }) {
    return (
      <div className="input-section">
        <label>
          Total People:
          <input 
            type="number" 
            value={numPeople} 
            onChange={(e) => setNumPeople(e.target.value)}
          />
        </label>
        <label>
          Escalator Length (m):
          <input 
            type="number" 
            value={escalatorLength} 
            onChange={(e) => setEscalatorLength(e.target.value)}
          />
        </label>
        <label>
          Escalator Speed (m/s):
          <input 
            type="number" 
            value={escalatorSpeed} 
            onChange={(e) => setEscalatorSpeed(e.target.value)}
          />
        </label>
        <label>
          Walking Percentage (%):
          <input 
            type="number" 
            value={walkersPercentage} 
            onChange={(e) => setWalkersPercentage(e.target.value)}
          />
        </label>
        <label>
          Walker Speed (m/s):
          <input 
            type="number" 
            value={walkerSpeed} 
            onChange={(e) => setWalkerSpeed(e.target.value)}
          />
        </label>
      </div>
    );
  }

function simulateStrategy1(numPeople, escalatorLength, escalatorSpeed) {
    const stepsNeeded = Math.ceil(numPeople / 2);
    const timePerStep = escalatorLength / escalatorSpeed;
    return stepsNeeded * timePerStep;
  }

function simulateStrategy2(numPeople, escalatorLength, escalatorSpeed, walkersPercentage, walkerSpeed) {
    const numWalkers = Math.round((numPeople * walkersPercentage) / 100);
    const numStanders = numPeople - numWalkers;
  
    // Assuming walkers and standers move simultaneously
    const timeWalkers = escalatorLength / walkerSpeed;
    const timeStanders = escalatorLength / escalatorSpeed;
  
    return Math.max(timeWalkers, timeStanders);
  }

function EscalatorVisualization({ 
    numPeople,
    escalatorLength,
    strategy
  }) {
    return (
      <div className="simulation-container">
        <h3>Escalator Visualization</h3>
        {strategy === 1 && (
          <div className="escalator">
            {/* Render steps and people for Strategy 1 */}
          </div>
        )}
        {strategy === 2 && (
          <div className="escalator">
            {/* Render walkers and standers for Strategy 2 */}
          </div>
        )}
      </div>
    );
  }

function DeepseekR1Qwen32BViz() {
    const [numPeople, setNumPeople] = useState(100);
    const [escalatorLength, setEscalatorLength] = useState(10);
    const [escalatorSpeed, setEscalatorSpeed] = useState(0.5);
    const [walkersPercentage, setWalkersPercentage] = useState(30);
    const [walkerSpeed, setWalkerSpeed] = useState(1);
    const [selectedStrategy, setSelectedStrategy] = useState(null);
    const [simulationResult, setSimulationResult] = useState(null);
  
    const handleSimulate = (strategy) => {
      if (strategy === 1) {
        const result = simulateStrategy1(numPeople, escalatorLength, escalatorSpeed);
        setSimulationResult(result);
      } else if (strategy === 2) {
        const result = simulateStrategy2(numPeople, escalatorLength, escalatorSpeed, walkersPercentage, walkerSpeed);
        setSimulationResult(result);
      }
      setSelectedStrategy(strategy);
    };
  
    return (
      <div className="App">
        <div><em>Note : DeepSeek r1 Distill Qwen2.5-32B built this in three shot (did not produce complete code in the first attempts)</em></div>
        <h1>Escalator Strategy Simulator</h1>
        <InputControls 
          numPeople={numPeople}
          setNumPeople={setNumPeople}
          escalatorLength={escalatorLength}
          setEscalatorLength={setEscalatorLength}
          escalatorSpeed={escalatorSpeed}
          setEscalatorSpeed={setEscalatorSpeed}
          walkersPercentage={walkersPercentage}
          setWalkersPercentage={setWalkersPercentage}
          walkerSpeed={walkerSpeed}
          setWalkerSpeed={setWalkerSpeed}
        />
        <div className="simulation-controls">
          <button onClick={() => handleSimulate(1)}>
            Simulate Strategy 1
          </button>
          <button onClick={() => handleSimulate(2)}>
            Simulate Strategy 2
          </button>
        </div>
        {selectedStrategy && (
          <>
            <h3>Results for Strategy {selectedStrategy}</h3>
            <p>Total Time: {simulationResult} seconds</p>
            <EscalatorVisualization 
              numPeople={numPeople}
              escalatorLength={escalatorLength}
              strategy={selectedStrategy}
            />
          </>
        )}
      </div>
    );
  }

export default DeepseekR1Qwen32BViz;
