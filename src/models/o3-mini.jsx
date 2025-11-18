/****************************************************** 
 * LICENSE : OPENAI OUTPUT
*******************************************************/
import React, { useState, useEffect, useRef } from "react";

// helper: generate a normally distributed random number using Box-Muller
const randomNormal = (mean, std) => {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
};

const O3MiniViz = () => {
  // --- Simulation Parameters (inputs) ---
  const [escalatorLength, setEscalatorLength] = useState(10); // meters
  const [escalatorSpeed, setEscalatorSpeed] = useState(0.5); // m/s (for standing)
  const [totalPeople, setTotalPeople] = useState(100);
  const [percentageWalking, setPercentageWalking] = useState(0); // 0 => Strategy 1 (all stand)
  const [avgWalkingSpeed, setAvgWalkingSpeed] = useState(1.0); // m/s extra speed for walking
  const [walkingSpeedStd, setWalkingSpeedStd] = useState(0.2);

  // --- Simulation State ---
  // People waiting to board; each person has: id, type, walkingSpeed, lane, pos, and current speed.
  const [waitingQueue, setWaitingQueue] = useState([]);
  // People currently on the escalator
  const [peopleOnEscalator, setPeopleOnEscalator] = useState([]);
  // Delivered count (number that reached the top)
  const [deliveredCount, setDeliveredCount] = useState(0);
  // We'll also track simulation time (for flow statistics)
  const simulationTime = useRef(0);
  // Simulation tick interval reference
  const simulationInterval = useRef(null);
  // Time step (in seconds) for each simulation tick
  const dt = 0.1;

  // --- Initialize Simulation ---
  const initializeSimulation = () => {
    simulationTime.current = 0;
    setDeliveredCount(0);
    setPeopleOnEscalator([]);
    // Build a waiting queue of people based on totalPeople and percentage walking.
    let queue = [];
    for (let i = 0; i < totalPeople; i++) {
      // Decide type based on percentage walking.
      let type = Math.random() * 100 < percentageWalking ? "walking" : "standing";
      // For walking people, draw a walking speed from a normal distribution.
      let walkingSpeed = type === "walking" ? randomNormal(avgWalkingSpeed, walkingSpeedStd) : 0;
      // For strategy 2 (when percentageWalking > 0), assign lanes: left for walkers, right for standers.
      let lane = percentageWalking > 0 ? (type === "walking" ? "left" : "right") : null;
      // When boarding the escalator, the person’s effective speed is:
      // standing: escalatorSpeed; walking: escalatorSpeed + walkingSpeed.
      queue.push({
        id: i,
        type,
        walkingSpeed,
        lane,
        pos: 0, // position on escalator (in meters)
        speed: escalatorSpeed + (type === "walking" ? walkingSpeed : 0)
      });
    }
    setWaitingQueue(queue);
  };

  // --- Simulation Tick ---
  const simulationTick = () => {
    simulationTime.current += dt;

    // 1. Update positions on the escalator.
    setPeopleOnEscalator((prevPeople) => {
      // Work on a shallow copy
      let updatedPeople = [...prevPeople];

      if (percentageWalking > 0) {
        // Strategy 2: process two lanes separately.
        const lanes = { left: [], right: [] };
        updatedPeople.forEach((p) => {
          lanes[p.lane].push(p);
        });
        // For each lane update positions in order (front to back)
        for (let lane in lanes) {
          // Sort by position (lowest first)
          lanes[lane].sort((a, b) => a.pos - b.pos);
          for (let i = 0; i < lanes[lane].length; i++) {
            let person = lanes[lane][i];
            // Compute the target speed (base escalator speed plus extra if walking)
            let targetSpeed =
              escalatorSpeed + (person.type === "walking" ? person.walkingSpeed : 0);
            // If there is a person ahead in the same lane and they’re too close, slow down.
            if (i > 0) {
              let prevPerson = lanes[lane][i - 1];
              let gap = prevPerson.pos - person.pos;
              if (gap < 0.5) {
                targetSpeed = Math.min(targetSpeed, prevPerson.speed);
              }
            }
            person.speed = targetSpeed;
            person.pos += person.speed * dt;
          }
        }
        // Combine lanes back together
        updatedPeople = [...lanes.left, ...lanes.right];
      } else {
        // Strategy 1: everyone stands. (Single lane)
        updatedPeople.sort((a, b) => a.pos - b.pos);
        for (let i = 0; i < updatedPeople.length; i++) {
          let person = updatedPeople[i];
          let targetSpeed = escalatorSpeed;
          if (i > 0) {
            let prevPerson = updatedPeople[i - 1];
            let gap = prevPerson.pos - person.pos;
            if (gap < 0.5) {
              targetSpeed = Math.min(targetSpeed, prevPerson.speed);
            }
          }
          person.speed = targetSpeed;
          person.pos += person.speed * dt;
        }
      }
      return updatedPeople;
    });

    // 2. Remove people who reached the top.
    setPeopleOnEscalator((prevPeople) => {
      const remaining = [];
      let deliveredThisTick = 0;
      prevPeople.forEach((person) => {
        if (person.pos >= escalatorLength) {
          deliveredThisTick++;
        } else {
          remaining.push(person);
        }
      });
      if (deliveredThisTick > 0) {
        setDeliveredCount((prev) => prev + deliveredThisTick);
      }
      return remaining;
    });

    // 3. Board new people from the waiting queue.
    // We board from waitingQueue into peopleOnEscalator if the “entrance” is clear.
    setPeopleOnEscalator((prevPeople) => {
      let newPeople = [...prevPeople];

      if (percentageWalking > 0) {
        // For strategy 2, board separately for each lane if the lane’s first person is far enough
        setWaitingQueue((prevQueue) => {
          let newQueue = [...prevQueue];

          // Board one for the left lane (walkers) if available.
          const leftIndex = newQueue.findIndex((p) => p.lane === "left");
          if (leftIndex !== -1) {
            const leftLanePeople = newPeople.filter((p) => p.lane === "left");
            if (leftLanePeople.length === 0 || leftLanePeople[0].pos > 0.3) {
              newPeople.push(newQueue.splice(leftIndex, 1)[0]);
            }
          }

          // Board one for the right lane (standers) if available.
          const rightIndex = newQueue.findIndex((p) => p.lane === "right");
          if (rightIndex !== -1) {
            const rightLanePeople = newPeople.filter((p) => p.lane === "right");
            if (rightLanePeople.length === 0 || rightLanePeople[0].pos > 0.3) {
              newPeople.push(newQueue.splice(rightIndex, 1)[0]);
            }
          }
          return newQueue;
        });
      } else {
        // Strategy 1: use a combined lane.
        setWaitingQueue((prevQueue) => {
          let newQueue = [...prevQueue];
          if (newQueue.length > 0) {
            // Check how many people are at the entrance (position close to 0).
            const closePeople = newPeople.filter((p) => p.pos < 0.3).length;
            // The escalator is wide enough for 2 people per “step.”
            while (newQueue.length > 0 && closePeople < 2) {
              newPeople.push(newQueue.shift());
            }
          }
          return newQueue;
        });
      }
      return newPeople;
    });
  };

  // --- Start Simulation on Mount ---
  useEffect(() => {
    initializeSimulation();
    simulationInterval.current = setInterval(simulationTick, dt * 1000);
    return () => clearInterval(simulationInterval.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Reset Simulation Handler ---
  const resetSimulation = () => {
    clearInterval(simulationInterval.current);
    initializeSimulation();
    simulationInterval.current = setInterval(simulationTick, dt * 1000);
    setDeliveredCount(0);
  };

  return (
    <div className="w-full bg-gray-100 p-4">
      <div><em>Note : o3-mini built this in one shot </em></div>
      <div className="flex flex-row h-screen">
        {/* Left Column: Inputs and Statistics */}
        <div className="w-1/3 p-4 bg-gray-100 overflow-auto">
          <h2 className="text-2xl font-bold mb-4">Escalator Variables</h2>
          <div className="mb-4">
            <label className="block mb-1">Escalator Length (m):</label>
            <input
              type="number"
              value={escalatorLength}
              onChange={(e) => setEscalatorLength(Number(e.target.value))}
              className="border rounded p-1 w-full"
            />
          </div>
          <div className="mb-4">
            <label className="block mb-1">Escalator Speed (m/s):</label>
            <input
              type="number"
              value={escalatorSpeed}
              onChange={(e) => setEscalatorSpeed(Number(e.target.value))}
              className="border rounded p-1 w-full"
            />
          </div>
          <h2 className="text-2xl font-bold mb-4">People Input</h2>
          <div className="mb-4">
            <label className="block mb-1">Total People Arriving:</label>
            <input
              type="number"
              value={totalPeople}
              onChange={(e) => setTotalPeople(Number(e.target.value))}
              className="border rounded p-1 w-full"
            />
          </div>
          <div className="mb-4">
            <label className="block mb-1">
              Percentage Walking Up (0 = Strategy 1):
            </label>
            <input
              type="number"
              value={percentageWalking}
              onChange={(e) => setPercentageWalking(Number(e.target.value))}
              className="border rounded p-1 w-full"
            />
          </div>
          {percentageWalking > 0 && (
            <>
              <div className="mb-4">
                <label className="block mb-1">Average Walking Speed (m/s):</label>
                <input
                  type="number"
                  value={avgWalkingSpeed}
                  onChange={(e) => setAvgWalkingSpeed(Number(e.target.value))}
                  className="border rounded p-1 w-full"
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Walking Speed Std Dev:</label>
                <input
                  type="number"
                  value={walkingSpeedStd}
                  onChange={(e) => setWalkingSpeedStd(Number(e.target.value))}
                  className="border rounded p-1 w-full"
                />
              </div>
            </>
          )}
          <button
            onClick={resetSimulation}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Reset Simulation
          </button>
          <div className="mt-4">
            <h3 className="font-bold">Statistics</h3>
            <p>Delivered (top): {deliveredCount}</p>
            <p>Waiting at Bottom: {waitingQueue.length}</p>
            <p>On Escalator: {peopleOnEscalator.length}</p>
          </div>
        </div>
        {/* Right Column: Simulation Animation */}
        <div className="w-2/3 p-4 relative bg-white">
          <h2 className="text-2xl font-bold mb-4">Escalator Simulation</h2>
          <div className="relative border h-96 bg-gray-200">
            {percentageWalking > 0 ? (
              // Strategy 2: Two lanes (left for walkers, right for standers)
              <>
                {peopleOnEscalator
                  .filter((p) => p.lane === "left")
                  .map((person) => (
                    <div
                      key={person.id}
                      className="absolute w-4 h-4 bg-red-500 rounded-full"
                      style={{
                        bottom: `${(person.pos / escalatorLength) * 100}%`,
                        left: "20%"
                      }}
                    ></div>
                  ))}
                {peopleOnEscalator
                  .filter((p) => p.lane === "right")
                  .map((person) => (
                    <div
                      key={person.id}
                      className="absolute w-4 h-4 bg-blue-500 rounded-full"
                      style={{
                        bottom: `${(person.pos / escalatorLength) * 100}%`,
                        right: "20%"
                      }}
                    ></div>
                  ))}
              </>
            ) : (
              // Strategy 1: Single lane (all dots in one central column)
              peopleOnEscalator.map((person) => (
                <div
                  key={person.id}
                  className="absolute w-4 h-4 bg-green-500 rounded-full"
                  style={{
                    bottom: `${(person.pos / escalatorLength) * 100}%`,
                    left: "50%",
                    transform: "translateX(-50%)"
                  }}
                ></div>
              ))
            )}
          </div>
          <div className="mt-4">
            <h3 className="font-bold">
              Flow per Minute (approx):{" "}
              {simulationTime.current > 0
                ? (deliveredCount / (simulationTime.current / 60)).toFixed(2)
                : 0}
            </h3>
          </div>
        </div>
      </div>
    </div>
  );
};

export default O3MiniViz;