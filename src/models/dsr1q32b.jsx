/****************************************************** 
 * LICENCE : DEEPSEEK R1 QWEN2.5-32B
*******************************************************/

import React, { useEffect, useState } from 'react';

function EscalatorVisualization({ people, escalatorLength }) {
  const canvasRef = React.useRef(null);

  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size
      canvas.width = escalatorLength * 10;
      canvas.height = 400;

      // Draw steps
      ctx.fillStyle = '#e5e7eb';
      for (let i = 0; i < escalatorLength; i++) {
          ctx.fillRect(i * 10, 300 - (i % 2) * 5, 10, 5);
      }

      // Draw people
      people.forEach(person => {
          ctx.fillStyle = person.isWalking ? '#3b82f6' : '#ef4444';
          ctx.beginPath();
          ctx.arc((person.position * 10), 300 - (person.isWalking ? 5 : -5), 3, 0, Math.PI * 2);
          ctx.fill();
      });
  }, [people, escalatorLength]);

  return (
      <canvas ref={canvasRef} className="w-full h-96 rounded-lg border" />
  );
}

function DeepseekR1Qwen32BViz() {
  const [escalatorLength, setEscalatorLength] = useState(100);
  const [escalatorSpeed, setEscalatorSpeed] = useState(5);
  const [numPeople, setNumPeople] = useState(20);
  const [walkersPercentage, setWalkersPercentage] = useState(50);
  const [avgWalkerSpeed, setAvgWalkerSpeed] = useState(3);
  const [simulating, setSimulating] = useState(false);
  const [stats, setStats] = useState({ strategy1Count: 0, strategy2Count: 0 });
  const [people, setPeople] = useState([]);

  // Initialize people array
  useEffect(() => {
      if (numPeople > 0 && !simulating) {
          let newPeople = [];
          for (let i = 0; i < numPeople; i++) {
              newPeople.push({
                  id: i,
                  position: 0,
                  isWalking: Math.random() * 100 < walkersPercentage,
                  speed: avgWalkerSpeed + (Math.random() - 0.5)
              });
          }
          setPeople(newPeople);
      }
  }, [numPeople, simulating, walkersPercentage, avgWalkerSpeed]);

  // Simulation loop
  useEffect(() => {
      if (!simulating) return;

      const animationId = requestAnimationFrame(function animate(timestamp) {
          setPeople(prevPeople => {
              let updatedPeople = prevPeople.map(person => {
                  let totalSpeed = escalatorSpeed;
                  if (person.isWalking) {
                      totalSpeed += person.speed;
                  }

                  // Collision detection
                  if (person.isWalking) {
                      const collisionDetected = prevPeople.some(otherPerson => 
                          otherPerson.id !== person.id && 
                          !otherPerson.isWalking &&
                          otherPerson.position > person.position &&
                          otherPerson.position < person.position + totalSpeed
                      );

                      if (collisionDetected) {
                          return { ...person, position: Math.min(...prevPeople.filter(p => p.id !== person.id).map(p => p.position)) };
                      }
                  }

                  const newPos = person.position + totalSpeed;

                  return {
                      ...person,
                      position: newPos > escalatorLength ? 
                          escalatorLength : 
                          newPos
                  };
              });

              // Count completed people and update stats
              const completed = updatedPeople.filter(p => p.position === escalatorLength).length;
              setStats(prev => ({
                  strategy1Count: prev.strategy1Count + (walkersPercentage === 0 ? completed : 0),
                  strategy2Count: prev.strategy2Count + (walkersPercentage > 0 ? completed : 0)
              }));

              return updatedPeople.filter(p => p.position < escalatorLength);
          });

          if (simulating) {
              requestAnimationFrame(animate);
          }
      });

      return () => cancelAnimationFrame(animationId);
  }, [simulating, escalatorSpeed, avgWalkerSpeed]);

  // Controls and UI
  const handleSimulationToggle = () => {
      setSimulating(!simulating);
      if (!simulating) {
          // Reset people when starting a new simulation
          setPeople([]);
          setStats({ strategy1Count: 0, strategy2Count: 0 });
      }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <div><em>Note : DeepSeek-R1-Distill-Qwen-32B-GGUF (Q8_0) built this in three shots </em></div>
      <div className="flex gap-4 p-6">
          {/* Left column */}
          <div className="w-1/3 space-y-4">
              <h2 className="text-xl font-bold">Inputs</h2>
              <div className="space-y-2">
                  <label>Escalator Length: {escalatorLength}</label>
                  <input 
                      type="range" 
                      min="50" 
                      max="200" 
                      value={escalatorLength}
                      onChange={(e) => setEscalatorLength(Number(e.target.value))}
                  />
                  
                  <label>Escalator Speed: {escalatorSpeed}</label>
                  <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      value={escalatorSpeed}
                      onChange={(e) => setEscalatorSpeed(Number(e.target.value))}
                  />
                  
                  <label>Number of People: {numPeople}</label>
                  <input 
                      type="range" 
                      min="1" 
                      max="50" 
                      value={numPeople}
                      onChange={(e) => setNumPeople(Number(e.target.value))}
                  />
                  
                  <label>Walking Percentage: {walkersPercentage}%</label>
                  <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={walkersPercentage}
                      onChange={(e) => setWalkersPercentage(Number(e.target.value))}
                  />
                  
                  <label>Average Walker Speed: {avgWalkerSpeed}</label>
                  <input 
                      type="range" 
                      min="1" 
                      max="5" 
                      value={avgWalkerSpeed}
                      onChange={(e) => setAvgWalkerSpeed(Number(e.target.value))}
                  />
              </div>

              <button 
                  onClick={handleSimulationToggle}
                  className={`px-4 py-2 rounded ${
                      simulating ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                  }`}
              >
                  {simulating ? 'Stop' : 'Start'}
              </button>
              
              <button 
                  onClick={() => {
                      setPeople([]);
                      setStats({ strategy1Count: 0, strategy2Count: 0 });
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                  Reset
              </button>
          </div>

          {/* Right column */}
          <div className="w-2/3 space-y-4">
              <h2 className="text-xl font-bold">Visualization</h2>
              <EscalatorVisualization 
                  people={people} 
                  escalatorLength={escalatorLength}
              />
              
              <h2 className="text-xl font-bold">Statistics</h2>
              <div className="space-y-2">
                  <p>Strategy 1: {stats.strategy1Count} people</p>
                  <p>Strategy 2: {stats.strategy2Count} people</p>
              </div>
          </div>
      </div>
    </div>
  );
}


export default DeepseekR1Qwen32BViz;
