/****************************************************** 
 * LICENSE : OPENAI OUTPUT
*******************************************************/
import React, { useState, useEffect, useRef } from 'react';

// Utility: generate random numbers from a normal distribution (Box-Muller Transform for simplicity).
function randomNormal(mean = 1, stdDev = 0.2) {
  let u = 1 - Math.random(); // Converting [0,1) to (0,1]
  let v = Math.random();
  let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdDev + mean;
}

export default function O1Viz() {
  // -----------------------------
  // 1. STATE FOR INPUTS
  // -----------------------------
  const [escalatorLength, setEscalatorLength] = useState(30);     // meters
  const [escalatorSpeed, setEscalatorSpeed] = useState(0.5);      // m/s
  const [numPeople, setNumPeople] = useState(100);
  const [pctWalking, setPctWalking] = useState(50);
  const [walkSpeedMean, setWalkSpeedMean] = useState(1.0);        // m/s
  const [walkSpeedStd, setWalkSpeedStd] = useState(0.2);          // distribution
  const [strategy, setStrategy] = useState("2");                  // default to "2"
  const [simulationRunning, setSimulationRunning] = useState(false);

  // -----------------------------
  // 2. SIMULATION STATE
  // -----------------------------
  // People array: each person has:
  // {
  //   id: number,
  //   xLane: 0 or 1  (which lane in Strategy 2? 0=left, 1=right; or 0,1 for Strategy 1, etc.)
  //   position: number (meters traveled on escalator),
  //   speed: number (their personal walking speed if they walk, else 0),
  //   reachedTop: boolean
  // }
  const [people, setPeople] = useState([]);
  const [timeElapsed, setTimeElapsed] = useState(0);

  // Statistics
  const [peopleFinished, setPeopleFinished] = useState(0);

  const requestRef = useRef(null);

  // -----------------------------
  // 3. INITIALIZE PEOPLE
  // -----------------------------
  function initializePeople() {
    const arr = [];
    const totalWalkers = Math.round((pctWalking / 100) * numPeople);

    let walkerCount = 0;
    for (let i = 0; i < numPeople; i++) {
      // Decide if this person will walk
      const willWalk = walkerCount < totalWalkers;
      if (willWalk) walkerCount++;

      const personalWalkSpeed = willWalk
        ? Math.max(0, randomNormal(walkSpeedMean, walkSpeedStd)) // ensure no negative speed
        : 0;

      // For Strategy 1, we can just assign lane = 0 or 1 arbitrarily if we want 2 wide
      // For Strategy 2, walkers = lane 0, standers = lane 1
      let xLane = 0; // default
      if (strategy === "1") {
        // Alternate lanes for strategy 1
        xLane = i % 2; 
      } else if (strategy === "2") {
        // 0 = left(walkers), 1 = right(standing)
        xLane = willWalk ? 0 : 1;
      }

      arr.push({
        id: i,
        xLane,
        position: 0,           // start below the escalator
        speed: personalWalkSpeed, 
        reachedTop: false,
      });
    }
    setPeople(arr);
    setPeopleFinished(0);
    setTimeElapsed(0);
  }

  // -----------------------------
  // 4. SIMULATION TICK
  // -----------------------------
  const tick = (deltaTime) => {
    // 1. Sort people by lane and by position to handle "no overtaking" constraint
    let newPeople = [...people];

    // We can group by lane:
    let lane0 = newPeople.filter((p) => p.xLane === 0);
    let lane1 = newPeople.filter((p) => p.xLane === 1);

    // Sort them by ascending position
    lane0.sort((a, b) => a.position - b.position);
    lane1.sort((a, b) => a.position - b.position);

    // 2. Update positions in each lane
    // Speed = escalatorSpeed + personalWalkingSpeed
    // But no overtaking => must not exceed position of person in front
    function updateLane(lane) {
      for (let i = 0; i < lane.length; i++) {
        const person = lane[i];
        if (person.reachedTop) continue;

        const baseSpeed = escalatorSpeed + person.speed; 
        let newPos = person.position + baseSpeed * deltaTime;

        // check the person in front (i-1 in sorted order)
        if (i > 0) {
          const personInFront = lane[i - 1];
          // personInFront new position after update this tick 
          // We approximate it by their old position plus baseSpeed of that front person
          let frontBaseSpeed = escalatorSpeed + personInFront.speed;
          let frontNewPos = personInFront.position + frontBaseSpeed * deltaTime;

          // We don't allow overtaking:
          if (newPos > frontNewPos - 0.5) {
            // 0.5 is a minimal spacing so they don't overlap
            newPos = frontNewPos - 0.5;
          }
        }

        // if newPos >= escalatorLength, they've reached the top
        if (newPos >= escalatorLength) {
          person.reachedTop = true;
          newPos = escalatorLength;
        }

        person.position = newPos;
      }
    }

    updateLane(lane0);
    updateLane(lane1);

    // Merge lane arrays
    newPeople = lane0.concat(lane1);

    // 3. Count how many are finished
    const finishedCount = newPeople.filter((p) => p.reachedTop).length;

    setPeople(newPeople);
    setPeopleFinished(finishedCount);
  };

  // -----------------------------
  // 5. ANIMATION LOOP
  // -----------------------------
  const animate = (time) => {
    // We'll step with a fixed dt (e.g., 0.1s) for simplicity or you can adapt from real time
    const dt = 0.1; 
    tick(dt);
    setTimeElapsed((prev) => prev + dt);

    if (peopleFinished < numPeople) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      // All people are at the top, stop animation
      setSimulationRunning(false);
      cancelAnimationFrame(requestRef.current);
    }
  };

  // -----------------------------
  // 6. HANDLE START / RESET
  // -----------------------------
  function startSimulation() {
    initializePeople();
    setSimulationRunning(true);
  }

  useEffect(() => {
    if (simulationRunning) {
      requestRef.current = requestAnimationFrame(animate);
      return () => {
        if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
        }
      };
    }
  }, [simulationRunning, peopleFinished]); // re-run when we start or reset

  // -----------------------------
  // 7. RENDER
  // -----------------------------
  // For visualization, we can map position (0 -> bottom, escalatorLength -> top)
  // We'll just show a small container with dots moving upward.
  // In strategy 2, lane 0 (walkers) is left, lane 1 is right.
  const containerHeightPx = 300; 
  const containerWidthPx = 200;

  // Helper to convert 'position on escalator' => top offset in px
  function positionToPixel(pos) {
    // position=0 => bottom, position=escalatorLength => top
    // We'll invert so top=0 is the top of the container
    // but we want the bottom of the escalator to be near containerHeightPx
    let ratio = pos / escalatorLength;
    let yPx = containerHeightPx - ratio * containerHeightPx;
    return yPx;
  }

  function laneToX(lane) {
    // For strategy 1: we have two side by side
    // For strategy 2: left (0) or right (1)
    // We'll just split containerWidthPx in half
    const laneWidth = containerWidthPx / 2;
    return lane * laneWidth + laneWidth / 2; 
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div><em>Note : o1 built this in one shot </em></div>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
        {/* LEFT COLUMN - INPUTS */}
        <div className="w-full md:w-1/3 bg-white p-4 rounded shadow">
          <h2 className="text-xl font-bold mb-4">Escalator & People Inputs</h2>
          
          {/* Escalator length */}
          <label className="block mb-2">
            <span className="text-gray-700">Escalator Length (m)</span>
            <input
              type="number"
              className="mt-1 block w-full border px-2 py-1"
              value={escalatorLength}
              onChange={(e) => setEscalatorLength(parseFloat(e.target.value))}
            />
          </label>

          {/* Escalator speed */}
          <label className="block mb-2">
            <span className="text-gray-700">Escalator Speed (m/s)</span>
            <input
              type="number"
              step="0.1"
              className="mt-1 block w-full border px-2 py-1"
              value={escalatorSpeed}
              onChange={(e) => setEscalatorSpeed(parseFloat(e.target.value))}
            />
          </label>

          {/* Number of people */}
          <label className="block mb-2">
            <span className="text-gray-700">Number of People</span>
            <input
              type="number"
              className="mt-1 block w-full border px-2 py-1"
              value={numPeople}
              onChange={(e) => setNumPeople(parseInt(e.target.value, 10))}
            />
          </label>

          {/* % walking */}
          <label className="block mb-2">
            <span className="text-gray-700">% Walking (0 = Strategy 1 scenario)</span>
            <input
              type="number"
              className="mt-1 block w-full border px-2 py-1"
              value={pctWalking}
              onChange={(e) => setPctWalking(parseFloat(e.target.value))}
            />
          </label>

          {/* Walk speed mean */}
          <label className="block mb-2">
            <span className="text-gray-700">Avg Walking Speed (m/s)</span>
            <input
              type="number"
              step="0.1"
              className="mt-1 block w-full border px-2 py-1"
              value={walkSpeedMean}
              onChange={(e) => setWalkSpeedMean(parseFloat(e.target.value))}
            />
          </label>

          {/* Walk speed std dev */}
          <label className="block mb-2">
            <span className="text-gray-700">Std. Dev of Walking Speed</span>
            <input
              type="number"
              step="0.1"
              className="mt-1 block w-full border px-2 py-1"
              value={walkSpeedStd}
              onChange={(e) => setWalkSpeedStd(parseFloat(e.target.value))}
            />
          </label>

          {/* Strategy */}
          <label className="block mb-2">
            <span className="text-gray-700">Strategy</span>
            <select
              className="mt-1 block w-full border px-2 py-1"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
            >
              <option value="1">Strategy 1: Everyone stands (two wide)</option>
              <option value="2">Strategy 2: Right stands, left walks</option>
            </select>
          </label>

          <button
            onClick={startSimulation}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
          >
            {simulationRunning ? "Restart Simulation" : "Start Simulation"}
          </button>
        </div>

        {/* RIGHT COLUMN - SIMULATION */}
        <div className="w-full md:w-2/3 flex flex-col space-y-4">
          {/* Visualization */}
          <div className="bg-white rounded shadow p-4 relative" style={{ height: containerHeightPx, width: containerWidthPx }}>
            <div className="text-sm text-gray-500 absolute top-0 left-0">
              Top
            </div>
            <div className="text-sm text-gray-500 absolute bottom-0 left-0">
              Bottom
            </div>
            {/* Render people as dots */}
            {people.map((p) => {
              if (!p.reachedTop) {
                const yPx = positionToPixel(p.position);
                const xPx = laneToX(p.xLane);

                return (
                  <div
                    key={p.id}
                    className="absolute h-2 w-2 rounded-full bg-red-500"
                    style={{
                      transform: `translate(${xPx - 1}px, ${yPx - 1}px)`,
                    }}
                  />
                );
              }
              return null;
            })}
          </div>

          {/* Stats */}
          <div className="bg-white rounded shadow p-4">
            <p>Time Elapsed: {timeElapsed.toFixed(1)} s</p>
            <p>People Finished: {peopleFinished} / {numPeople}</p>
            <p>
              Flow Rate:{" "}
              {timeElapsed > 0
                ? ((peopleFinished / timeElapsed) * 60).toFixed(2)
                : 0}{" "}
              people/minute
            </p>
            <p>
              Compare with Strategy 1 (ideal capacity):  
              <br />
              If everyone stands two-wide on the escalator, a rough capacity is 
              (2 persons per step) * (steps / escalatorLength) * escalatorSpeed...
              <br />
              *You could add a more direct formula or simulator side-by-side here.*
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}