import React, { useState } from 'react';

/**
 *
 * We assume:
 *  - 'numberOfPeople': total number of people arriving at time=0, forming a queue.
 *  - 'escalatorLengthSteps': how many steps are "active" from bottom to top.
 *  - 'escalatorSpeedStepsPerSecond': escalator speed (in steps/second).
 *  - 'portionWhoWalk': fraction (0 to 1) of people who want to walk.
 *  - 'walkingSpeedStepsPerSecond': average walking speed (in steps/second)
 *  - 'walkingSpeedStdDev': standard deviation for walking speed to simulate
 *     random walking speeds. (You can expand this to any distribution you like.)
 *
 * The simulator returns an object with relevant metrics:
 *  {
 *    strategy1: {
 *      totalTime: number, // the time when the last person steps off
 *      averageTime: number, // average time from queue to top
 *    },
 *    strategy2: {
 *      totalTime: number,
 *      averageTime: number
 *    }
 *  }
 *
 * NOTE: This is a simplified discrete-time approach for demonstration.
 */

/**
 * Returns a random sample from a Normal distribution using the Box-Muller transform.
 * mean = 0, stdDev = 1 by default; you can adapt as needed.
 */
function randomNormal(mean = 0, stdDev = 1) {
    const u1 = 1 - Math.random();
    const u2 = 1 - Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z * stdDev;
  }
  
  /**
   * Helper: clamp speeds to a minimum/maximum if desired to avoid negative or insane values
   */
  function clampSpeed(speed, minSpeed = 0.1, maxSpeed = 5) {
    return Math.max(minSpeed, Math.min(maxSpeed, speed));
  }
  
  /**
   * Simulate Strategy 1:
   * - Everyone stands, 2 people per step.
   * - The escalator has escalatorLengthSteps steps, each step can hold 2 people at once.
   * - The escalator moves at escalatorSpeedStepsPerSecond, so it takes (escalatorLengthSteps / escalatorSpeedStepsPerSecond) seconds
   *   from bottom to top for each person once on the escalator.
   *
   * We'll assume a continuous flow: 
   * - Each step becomes available at discrete intervals of 1 step / escalatorSpeedStepsPerSecond.
   * - Up to 2 new people can board each time a new "step" is effectively available at the bottom.
   *
   * We'll track the time each person actually boards and finishes.
   */
  function simulateStrategy1({
    numberOfPeople,
    escalatorLengthSteps,
    escalatorSpeedStepsPerSecond,
  }) {
    // Time to ride the escalator once on it:
    const rideTime = escalatorLengthSteps / escalatorSpeedStepsPerSecond;
  
    let peopleBoarded = 0;
    let currentTime = 0;
    let timeBetweenSteps = 1 / escalatorSpeedStepsPerSecond; // how often a new step arrives
  
    const finishTimes = [];
  
    // We keep adding people as steps become available
    while (peopleBoarded < numberOfPeople) {
      // Each time a new step arrives, we can place up to 2 people
      const capacityThisStep = 2;
      let count = 0;
      while (count < capacityThisStep && peopleBoarded < numberOfPeople) {
        // Person boards at currentTime, finishes at currentTime + rideTime
        const finishTime = currentTime + rideTime;
        finishTimes.push(finishTime);
        peopleBoarded++;
        count++;
      }
      currentTime += timeBetweenSteps;
    }
  
    // The last person boards at some time (<= currentTime), but must still ride for rideTime
    const totalTime = Math.max(...finishTimes);
    const averageTime = finishTimes.reduce((acc, t) => acc + t, 0) / finishTimes.length;
  
    return {
      totalTime,
      averageTime,
    };
  }
  
  /**
   * Simulate Strategy 2:
   * - People who want to walk: queue for the left lane.
   * - People who want to stand: queue for the right lane.
   * - The left lane speed is escalator speed + walk speed,
   *   but if there's a slower walker in front, that slows everyone behind them.
   *
   * We'll do a discrete-time simulation. We track each step along the escalator:
   * - At each discrete time increment "deltaT", we move each person up the escalator 
   *   according to their lane speed (escalator speed + their personal walk speed or just escalator speed if they're standing).
   * - We only allow 1 column of people in the left lane, 1 column in the right lane.
   * - A new "row" (or step) becomes available at the bottom every `timeBetweenSteps`.
   *
   * There are more sophisticated ways (e.g., event-based simulation). We'll do something 
   * fairly direct to get approximate results.
   */
  function simulateStrategy2({
    numberOfPeople,
    escalatorLengthSteps,
    escalatorSpeedStepsPerSecond,
    portionWhoWalk,
    walkingSpeedStepsPerSecond,
    walkingSpeedStdDev,
  }) {
    // We'll maintain two queues:
    // - leftLaneQueue for walkers
    // - rightLaneQueue for standers
    const numWalkers = Math.round(numberOfPeople * portionWhoWalk);
    const numStanders = numberOfPeople - numWalkers;
  
    // Generate random walker speeds (assuming normal distribution around walkingSpeedStepsPerSecond)
    const walkerSpeeds = Array.from({ length: numWalkers }).map(() => {
      const s = randomNormal(walkingSpeedStepsPerSecond, walkingSpeedStdDev);
      return clampSpeed(s, 0.1, 10);
    });
  
    // Each person's data structure:
    // { id, lane: 'left'|'right', personalWalkSpeed, position, finished, finishTime }
    const people = [];
  
    // left-lane (walkers)
    for (let i = 0; i < numWalkers; i++) {
      people.push({
        id: `W${i}`,
        lane: 'left',
        personalWalkSpeed: walkerSpeeds[i],
        position: 0, // in steps from the bottom
        finished: false,
        finishTime: null,
      });
    }
    // right-lane (standers)
    for (let i = 0; i < numStanders; i++) {
      people.push({
        id: `S${i}`,
        lane: 'right',
        personalWalkSpeed: 0, // they don't walk
        position: 0,
        finished: false,
        finishTime: null,
      });
    }
  
    // Sort so that we board in the order: first all (or we can shuffle them, but let's keep it simple)
    // Typically, people come in a single queue and choose a lane, but for simplicity:
    // We'll queue them in blocks: all standers, all walkers. 
    // In reality, you'd randomize or order by arrival. Adjust as needed.
    // For demonstration, let's just keep them as is. The difference is the lane they take.
    let queueIndex = 0;
  
    const timeBetweenSteps = 1 / escalatorSpeedStepsPerSecond;
  
    // We'll simulate in small time steps
    const deltaT = 0.1; // (seconds) time step for the simulation
    let currentTime = 0;
    const finishTimes = [];
  
    // We'll track who is actually on the escalator:
    let onEscalatorLeft = [];
    let onEscalatorRight = [];
  
    // Helper to board new people if there's space at the "bottom step"
    function boardPeople() {
      // We can board 1 person per lane each time a step arrives
      // We'll see how many steps have effectively become available since last board event
      // But a simpler approach: in every iteration, check if the "lowest position" on each lane
      // is strictly greater than 0. If so, there's space for a new person to board at position 0.
  
      // left lane
      const someoneAtZeroLeft = onEscalatorLeft.some(p => p.position < 0.1);
      if (!someoneAtZeroLeft && queueIndex < people.length) {
        // The next person in queue who is assigned lane 'left'
        // But we must only pick from the queue if they are a left-lane person
        let nextInQueueLeft = null;
        while (queueIndex < people.length && !nextInQueueLeft) {
          const candidate = people[queueIndex];
          if (candidate.lane === 'left') {
            nextInQueueLeft = candidate;
          }
          queueIndex++;
        }
        if (nextInQueueLeft) {
          onEscalatorLeft.push(nextInQueueLeft);
        }
      }
  
      // right lane
      const someoneAtZeroRight = onEscalatorRight.some(p => p.position < 0.1);
      if (!someoneAtZeroRight && queueIndex < people.length) {
        // The next person in queue who is assigned lane 'right'
        let nextInQueueRight = null;
        while (queueIndex < people.length && !nextInQueueRight) {
          const candidate = people[queueIndex];
          if (candidate.lane === 'right') {
            nextInQueueRight = candidate;
          }
          queueIndex++;
        }
        if (nextInQueueRight) {
          onEscalatorRight.push(nextInQueueRight);
        }
      }
    }
  
    while (true) {
      // Board new people if possible
      boardPeople();
  
      // Move people on the escalator
      // left lane: speed = escalatorSpeedStepsPerSecond + personalWalkSpeed
      onEscalatorLeft.forEach(p => {
        if (!p.finished) {
          // We'll constrain by the slowest in front. So let's find who is immediately in front
          // Sort by position descending
          const sortedLeft = [...onEscalatorLeft].sort((a, b) => b.position - a.position);
          let index = sortedLeft.findIndex(x => x.id === p.id);
          if (index > 0) {
            // There's someone in front
            const inFront = sortedLeft[index - 1];
            // The max distance p can move is up to inFront.position
            // We'll do a naive approach: if p's speed would cause them to surpass inFront, clamp
            const frontSpeed = escalatorSpeedStepsPerSecond + inFront.personalWalkSpeed;
            // For the next deltaT, p's speed is the min of p's own speed and frontSpeed 
            // BUT we also must ensure p doesn't exceed inFront.position minus some small spacing.
            const pSpeed = escalatorSpeedStepsPerSecond + p.personalWalkSpeed;
            const feasibleSpeed = Math.min(pSpeed, frontSpeed);
            const newPos = p.position + feasibleSpeed * deltaT;
            // clamp if it surpasses inFront's position
            if (newPos > inFront.position - 0.1) {
              p.position = inFront.position - 0.1;
            } else {
              p.position = newPos;
            }
          } else {
            // No one in front
            p.position += (escalatorSpeedStepsPerSecond + p.personalWalkSpeed) * deltaT;
          }
  
          if (p.position >= escalatorLengthSteps) {
            p.finished = true;
            p.finishTime = currentTime;
            finishTimes.push(currentTime);
          }
        }
      });
  
      // right lane: speed = escalatorSpeedStepsPerSecond only
      onEscalatorRight.forEach(p => {
        if (!p.finished) {
          // Similarly, the speed is the escalator speed, but if there's a person in front:
          const sortedRight = [...onEscalatorRight].sort((a, b) => b.position - a.position);
          let index = sortedRight.findIndex(x => x.id === p.id);
          if (index > 0) {
            const inFront = sortedRight[index - 1];
            const newPos = p.position + escalatorSpeedStepsPerSecond * deltaT;
            if (newPos > inFront.position - 0.1) {
              p.position = inFront.position - 0.1;
            } else {
              p.position = newPos;
            }
          } else {
            // no one in front
            p.position += escalatorSpeedStepsPerSecond * deltaT;
          }
  
          if (p.position >= escalatorLengthSteps) {
            p.finished = true;
            p.finishTime = currentTime;
            finishTimes.push(currentTime);
          }
        }
      });
  
      // Remove finished people from lanes
      onEscalatorLeft = onEscalatorLeft.filter(p => !p.finished);
      onEscalatorRight = onEscalatorRight.filter(p => !p.finished);
  
      currentTime += deltaT;
  
      // Check if all people are done
      // We compare length of finishTimes with total numberOfPeople
      if (finishTimes.length === numberOfPeople) {
        break;
      }
  
      // (Optional) Safety limit to avoid infinite loop in dev
      if (currentTime > 100000) {
        console.warn("Simulation ran too long, stopping.");
        break;
      }
    }
  
    const totalTime = Math.max(...finishTimes);
    const averageTime = finishTimes.reduce((a, b) => a + b, 0) / finishTimes.length;
  
    return {
      totalTime,
      averageTime,
    };
  }
  
  /**
   * Top-level function that runs both strategies with the given parameters.
   */
  export function simulateAll(params) {
    const strategy1Results = simulateStrategy1(params);
    const strategy2Results = simulateStrategy2(params);
  
    return {
      strategy1: strategy1Results,
      strategy2: strategy2Results,
    };
  }
  
  /**
 Additional Inputs That May Make Sense
Arrival pattern of people (e.g., a Poisson process of arrivals, or batch arrivals at intervals).
Escalator step height or physical length** to compute actual escalator speed vs. vertical/horizontal speed.
Maximum queue capacity or how the queue forms (are people waiting on the platform?).
Acceleration times of the escalator (if it starts/stops).
Physical constraints (e.g., can 2 large suitcases fit side-by-side?).
Behavior factors (some walkers may slow down behind a slower walker, or try to overtake if possible).
These refinements can be incorporated by adjusting (or replacing) the simulation logic in simulateStrategy2 and the data structures tracking each person’s position, speed, and interactions.
   */


  function O1Viz() {
    const [numberOfPeople, setNumberOfPeople] = useState(100);
    const [escalatorLengthSteps, setEscalatorLengthSteps] = useState(50);
    const [escalatorSpeed, setEscalatorSpeed] = useState(1.0); // steps/second
    const [portionWhoWalk, setPortionWhoWalk] = useState(0.5);
    const [walkingSpeed, setWalkingSpeed] = useState(1.0);
    const [walkingStdDev, setWalkingStdDev] = useState(0.2);

    const [results, setResults] = useState(null);

    const handleSimulate = () => {
        const params = {
        numberOfPeople: Number(numberOfPeople),
        escalatorLengthSteps: Number(escalatorLengthSteps),
        escalatorSpeedStepsPerSecond: Number(escalatorSpeed),
        portionWhoWalk: Number(portionWhoWalk),
        walkingSpeedStepsPerSecond: Number(walkingSpeed),
        walkingSpeedStdDev: Number(walkingStdDev),
        };

        const output = simulateAll(params);
        setResults(output);
    };

    return (
        <div style={{ margin: '1rem' }}>
             <div><em>Note : o1 built this in one shot</em></div>
        <h1>Escalator Strategy Simulator</h1>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '300px' }}>
            <label>
            Number of People:
            <input
                type="number"
                value={numberOfPeople}
                onChange={(e) => setNumberOfPeople(e.target.value)}
            />
            </label>
            <label>
            Escalator Length (steps):
            <input
                type="number"
                value={escalatorLengthSteps}
                onChange={(e) => setEscalatorLengthSteps(e.target.value)}
            />
            </label>
            <label>
            Escalator Speed (steps/sec):
            <input
                type="number"
                step="0.1"
                value={escalatorSpeed}
                onChange={(e) => setEscalatorSpeed(e.target.value)}
            />
            </label>
            <label>
            Fraction Who Walk (0 to 1):
            <input
                type="number"
                step="0.1"
                value={portionWhoWalk}
                onChange={(e) => setPortionWhoWalk(e.target.value)}
            />
            </label>
            <label>
            Avg Walking Speed (steps/sec):
            <input
                type="number"
                step="0.1"
                value={walkingSpeed}
                onChange={(e) => setWalkingSpeed(e.target.value)}
            />
            </label>
            <label>
            Walking Speed Std Dev:
            <input
                type="number"
                step="0.1"
                value={walkingStdDev}
                onChange={(e) => setWalkingStdDev(e.target.value)}
            />
            </label>
            <button onClick={handleSimulate}>Simulate</button>
        </div>

        {results && (
            <div style={{ marginTop: '2rem' }}>
            <h2>Simulation Results</h2>
            <h3>Strategy 1: Everyone Stands</h3>
            <p>Total time (sec): {results.strategy1.totalTime.toFixed(2)}</p>
            <p>Average time (sec per person): {results.strategy1.averageTime.toFixed(2)}</p>

            <h3>Strategy 2: Left Walk / Right Stand</h3>
            <p>Total time (sec): {results.strategy2.totalTime.toFixed(2)}</p>
            <p>Average time (sec per person): {results.strategy2.averageTime.toFixed(2)}</p>
            </div>
        )}
        </div>
    );
}

export default O1Viz;