/****************************************************** 
 * LICENCE : WHATEVER THE MOST RESTRICTIVE IS BETWWEEN OPENAI AND CLAUDE
*******************************************************/
import React, { useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
  
/*******************************************************
 * 1) UTILITY FUNCTIONS & CONSTANTS
 *******************************************************/

// Box-Muller for normal distribution
function randomNormal(mean, stdDev) {
  let u1 = Math.random();
  let u2 = Math.random();
  let z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z * stdDev;
}

// Truncate speeds to [mean-2std, mean+2std], clamp to 0 if negative
function truncatedWalkingSpeed(mean, stdDev) {
  let raw = randomNormal(mean, stdDev);

  let lower = mean - 2 * stdDev;
  let upper = mean + 2 * stdDev;

  if (raw < lower) raw = lower;
  if (raw > upper) raw = upper;
  if (raw < 0) raw = 0;
  return raw;
}

// Canvas dimensions for each simulation
const CANVAS_WIDTH = 250;
const CANVAS_HEIGHT = 300;

// Where the "funnel" ends and the escalator begins
// We'll treat y as the top of the funnel region
const ESCALATOR_TOP_Y = CANVAS_HEIGHT / 2;

// Distances for collision checks, etc.
const PERSON_RADIUS = 2;

// For reference only 
class SimulationData{
  constructor(time, people, finishedCount, queueLength){
    this.time = time,
    this.people = people,
    this.finishedCount = finishedCount,
    this.queueLength = queueLength
  }
}

function mergeByTimestamp(dataS1, dataS2) {
  // We'll assume each entry is { timestamp, queueCount }, but you can adapt if the property names differ.
  const map = new Map();

  // Insert Strategy 1 data
  for (const d of dataS1) {
    map.set(d.timestamp, {
      time: d.timestamp,
      finishedCountS1: d.finishedCount,
      queueS1: d.queueCount,
      finishedCountS2: 0, // default
      queueS2: 0, // default
    });
  }
  
  // Insert Strategy 2 data
  for (const d of dataS2) {
    if (!map.has(d.timestamp)) {
      map.set(d.timestamp, {
        time: d.timestamp,
        finishedCountS1: 0,
        queueS1: 0,
        finishedCountS2: d.finishedCount,
        queueS2: d.queueCount,
      });
    } else {
      // Already exists, just fill in queueS2
      const existing = map.get(d.timestamp);
      existing.finishedCountS2 = d.finishedCount;
      existing.queueS2 = d.queueCount;
    }
  }
  
  // Convert Map -> Array, then sort by time
  const mergedArray = Array.from(map.values()).sort(
    (a, b) => a.time - b.time
  );

  return mergedArray;
}

/*******************************************************
 * 2) SIMULATION HOOK
 *
 *    Each strategy will have its own instance.
 *******************************************************/
function runEscalatorSimulation({
  strategy,         // "S1" or "S2"
  escalatorSpeed,   // e.g. 0.5
  walkSpeedMean,    
  walkSpeedStd,
  walkProbability,  // fraction for Strategy 2
  timestamp,
  stepY,
  dt,
  newCount,
  prev,
}) {
  // 2.1) State
  let updatedPeople = [...prev.people];
  let updatedFinishedCount = prev.finishedCount;
  let updatedQueueCount = prev.queueCount;

  const space = Math.max(stepY / 2, 10)

  if (newCount > 0) {
    for (let i = 0; i < newCount; i++) {
      const rand = Math.random();
      const id = performance.now() + rand;
      let isWalking = false;
      // We'll place them randomly in the bottom of the funnel (y ~ CANVAS_HEIGHT - 20 ..CANVAS_HEIGHT).
      // The funnel's bottom is wide, say x in [50..CANVAS_WIDTH-50].
      let x = 25 + Math.random() * (CANVAS_WIDTH-50);
      if (strategy === "S2") {
        // For Strategy 2, we randomly decide if they walk
        isWalking = Math.random() < walkProbability;
        // We'll place walkers on the left, standers on the right
        x = isWalking 
          ? 25 + Math.random() * (CANVAS_WIDTH-50) * walkProbability
          : 25 + (CANVAS_WIDTH-50) * walkProbability + Math.random() * (CANVAS_WIDTH-50) * (1 - walkProbability);
      }
      const y = CANVAS_HEIGHT - 20 + Math.random() * 20;
      const walkingSpeed = isWalking
        ? truncatedWalkingSpeed(walkSpeedMean, walkSpeedStd)
        : 0;

      updatedPeople.push({
        id,
        rand,
        x,
        y,
        isWalking,
        walkingSpeed,
        onEscalator: false,
        done: false,
      });
      updatedQueueCount++;
    }
  }
  // 2.4.2) UPDATE POSITIONS

  // 2D funnel logic for those not on escalator yet
  // We'll do a simplistic approach:
  // - Each person tries to move upward at some base speed .
  // - They are restricted by funnel boundaries (linearly shrinking).
  // - They can't overlap other people (simple collision check).
  // - Once y <= ESCALATOR_TOP_Y, they transition to escalator logic.

  // Sort by y ascending so the front (lowest y) is first
  updatedPeople.sort((a, b) => a.y - b.y);

  const queueSpeed = 1.2 * walkSpeedMean; // base speed in funnel 
  for (let i = 0; i < updatedPeople.length; i++) {
    const p = {...updatedPeople[i]};
    if (p.done) continue;

    if (!p.onEscalator) {
      // Move up at queueSpeed
      let desiredDy = queueSpeed * dt;

      // Very simple collision-avoidance:
      // If p is about to overlap with the passenger in front (i-1),
      // we reduce desiredDy or shift slightly.
      if (i > 0) {
        const pFront = updatedPeople[i - 1];
        if (!pFront.done && !pFront.onEscalator) {
        const dx = pFront.x - p.x;
        const dy = pFront.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < stepY) { 
            // The minimum distance between two people is the width of a step
            desiredDy = 0;
        }
        }
      }

      // Actually move up
      p.y -= desiredDy  * stepY ; //(all speeds are in steps/s)

      // Keep them within funnel boundaries
      funnelClamp(p, walkProbability);

      // If at escalator boundary, switch to escalator logic
      if (p.y <= ESCALATOR_TOP_Y) {
        p.onEscalator = true;
        updatedQueueCount--;
        // Place them exactly at boundary
        p.y = ESCALATOR_TOP_Y;

        // Strategy 1: side by side in the middle 
        // Strategy 2: if walking => left, else right
       
        if (strategy === "S1") {
          p.x = p.rand < 0.5 ? CANVAS_WIDTH / 2 - space : CANVAS_WIDTH / 2 + space;
        } 
        else if (walkProbability < 1) {
            p.x = p.isWalking ? CANVAS_WIDTH / 2 - space : CANVAS_WIDTH / 2 + space;
        } else if (
            walkProbability === 1 && updatedPeople
            .slice(0, i)
            .filter((otherPs) => !otherPs.isWalking && !otherPs.done)
            .length === 0
        ) {
            p.x = p.rand < 0.5 ? CANVAS_WIDTH / 2 - space : CANVAS_WIDTH / 2 + space;
        } else {
            p.x = p.isWalking ? CANVAS_WIDTH / 2 - space : CANVAS_WIDTH / 2 + space;
        }
      }
    } else {
      // ESCALATOR LOGIC
      // base speed = escalatorSpeed 
      // if walking => escalatorSpeed + walkingSpeed
      let desiredSpeed = escalatorSpeed ;
      if (p.isWalking) desiredSpeed += p.walkingSpeed;

      // no-overtaking on escalator
      if (i > 0) {
        const pFronts = updatedPeople
          .slice(0, i)
          .filter((otherPs) => otherPs.y < p.y && otherPs.x === p.x);
        const pFront = pFronts[pFronts.length - 1];
        if (pFront?.onEscalator && !pFront.done) {
          // check vertical overlap
          // If they are within 1 escalator step, we slow down
          if (Math.abs(pFront.y - p.y) < stepY && p.walkingSpeed > pFront.walkingSpeed) {
            desiredSpeed = escalatorSpeed + pFront.walkingSpeed;
            p.walkingSpeed = pFront.walkingSpeed;
          }
        }
      }

      // Move up (all speeds are in steps/s)
      p.y -= desiredSpeed * dt * stepY;
      // if p.y <= 0 => done
      if (p.y <= 0) {
        p.done = true;
        updatedFinishedCount++;
      }
    }
    updatedPeople[i] = p;
  }
  const finishedCount = updatedFinishedCount;
  const queueCount = updatedQueueCount;

  return {
    timestamp,
    people : updatedPeople.filter((p) => !p.done),
    finishedCount,
    queueCount,
  };
}
  
/*******************************************************
 * 3) FUNNEL CLAMPING FUNCTION
 *
 * We'll define a trapezoid from y=600 to y=200, narrowing
 * from x=[50..250] at bottom to x=[125..175] at top.
 *
 * We linearly interpolate the left & right boundaries
 * based on y.
 *******************************************************/
function funnelClamp(p, walkProbability) {
  // p.y is in [600..200]
  // fraction f = (bottomY - p.y) / (bottomY - topY) = (600 - p.y) / (400)
  // left boundary = leftBottom + f*(leftTop - leftBottom) = 50 + f*(125 - 50)
  // right boundary = rightBottom + f*(rightTop - rightBottom) = 250 + f*(175 - 250)
  // Then clamp p.x to [left, right]
  const bottomY = CANVAS_HEIGHT;
  const topY =  ESCALATOR_TOP_Y;
  const rangeY = bottomY - topY; 

  if (p.y > bottomY) return;  // below funnel, no clamp
  if (p.y < topY) return;     // above funnel, no clamp

  const f = (bottomY - p.y) / rangeY; // 0..1

  const leftBottom = p.isWalking 
    ? 25
    : 25 + (CANVAS_WIDTH-50) * walkProbability;
  const leftTop = CANVAS_WIDTH/2 - 25;
  const rightBottom = p.isWalking 
    ? 25 + (CANVAS_WIDTH-50) * walkProbability 
    : CANVAS_WIDTH - 25;
  const rightTop = CANVAS_WIDTH/2 + 25;

  const leftBoundary = leftBottom + f * (leftTop - leftBottom) 
  const rightBoundary = rightBottom + f * (rightTop - rightBottom) 

  if (p.x < leftBoundary) p.x = leftBoundary;
  if (p.x > rightBoundary) p.x = rightBoundary;
}
  
/*******************************************************
 * 4) STRATEGY SIMULATION COMPONENT
 *
 *    Renders the canvas and a "Reset" button.
 *******************************************************/
function StrategySimulation(props) {
  const {
    strategyLabel,
    timestamp,
    people,
    finishedCount,
  } = props;

  // Drawing
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    // background
    ctx.fillStyle = "transparent"; //"#f0f0f0"
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw trapezoid region for funnel
    ctx.fillStyle = "#ddd";
    ctx.beginPath();
    // bottom line 
    ctx.moveTo(25, CANVAS_HEIGHT);
    ctx.lineTo(CANVAS_WIDTH-25, CANVAS_HEIGHT);
    // top line (y=200) from x=125 to x=175
    ctx.lineTo(CANVAS_WIDTH / 2 + 25, ESCALATOR_TOP_Y);
    ctx.lineTo(CANVAS_WIDTH / 2 - 25, ESCALATOR_TOP_Y);
    ctx.closePath();
    ctx.fill();

    // Draw escalator
    ctx.fillStyle = "#ddd";
    ctx.fillRect(CANVAS_WIDTH / 2 - 25 , 0, 50, ESCALATOR_TOP_Y);

    // People
    people.forEach((p) => {
      if (p.done) return;
      ctx.beginPath();
      ctx.arc(p.x, p.y, PERSON_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = p.isWalking ?  "#c6005c" : "#007595" ;
      ctx.fill();
    });
  }, [people]);

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-lg font-bold mb-2">{strategyLabel}</h2>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
      />
      {/* <div className="mt-2 text-sm">
        <div>Time: {timestamp.toFixed(1)}s</div>
        <div>Finished: {finishedCount}</div>
      </div> */}
    </div>
  );
}

/*******************************************************
 * 5) METRICS TILES
 *******************************************************/

// Metric card component for displaying individual statistics
const MetricCard = ({ title, value }) => (
  <div className="bg-gray-100 dark:bg-gray-100/10 p-4 rounded-lg shadow">
    <h3 className="text-sm font-medium text-gray-500">{title}</h3>
    <p className="mt-1 text-2xl font-semibold">{value}</p>
  </div>
);
  
/*******************************************************
 * 6) MAIN APP: MANAGES INPUTS & DISPLAYS RECHARTS LINECHART
 *******************************************************/
export default function PittiViz() {
  // 6.1) Simulation parameters
  const [escalatorLength, setEscalatorLength] = useState(100);
  const [escalatorSpeed, setEscalatorSpeed] = useState(2);

  const stepY = ESCALATOR_TOP_Y / escalatorLength;

  const [arrivalRate, setArrivalRate] = useState(1.0);
  const [walkSpeedMean, setWalkSpeedMean] = useState(2);
  const [walkSpeedStd, setWalkSpeedStd] = useState(0.3);
  // Probability of walking for Strategy 2
  const [walkProbability, setWalkProbability] = useState(0.2);

  // For the arrival logic
  const arrivalAccumulatorRef = useRef(0);

  // 6.2) Time controls
  const currentTimeRef = useRef(0);
  const [timeScale, setTimeScale] = useState(1.0);
  const [paused, setPaused] = useState(false);

  // 6.3) Each strategy’s data
  const [dataS1, setDataS1] = useState([]);
  const [dataS2, setDataS2] = useState([]);

  const currentS1Ref = useRef({ timestamp: 0, people: [], finishedCount: 0, queueCount: 0 });
  const currentS2Ref = useRef({ timestamp: 0, people: [], finishedCount: 0, queueCount: 0 });
  
  function findLastMinuteStats(simulationData){
    const lastS = simulationData.length
      ? simulationData[simulationData.length - 1]
      : { timestamp: 0, people: [], finishedCount: 0, queueCount: 0 };
    const lastMinuteData = simulationData.length 
      ? simulationData.filter((d) => d.timestamp > lastS.timestamp - 60)
      :[lastS]
    const peopleProcessed = lastS.finishedCount - lastMinuteData[0].finishedCount;
    const duration = lastS.timestamp - lastMinuteData[0].timestamp || 1;
    const throughput = peopleProcessed / duration;
    return {
      peopleProcessed,
      throughput
    }
  }

  const lastMinuteS1 = findLastMinuteStats(dataS1);
  const lastMinuteS2 = findLastMinuteStats(dataS2);

  // 6.4) Build a merged array for Recharts
  const mergedData = mergeByTimestamp(dataS1, dataS2);

  // 6.5) Setup effect: start or reset simulation on param changes
  useEffect(() => {
      let intervalId = null;
      if (!paused) {
        intervalId = setInterval(() => {
          // Tick every 0.1s
          const newTime = (currentTimeRef.current || 0) + 0.1 * timeScale;
          currentTimeRef.current = newTime;
          // Then run your simulation logic with dt=0.1 * timeScale
          updateSimulation(0.1 * timeScale, newTime);
        }, 100);
      }
      return () => {
        if (intervalId) clearInterval(intervalId);
      };
    }, [paused, timeScale, arrivalRate, walkSpeedMean, walkSpeedStd, walkProbability]);
  
  useEffect(() => {
    resetSimulation();
    // eslint-disable-next-line
  }, [
    escalatorLength,
    escalatorSpeed,
  ]);

  // 6.6) Reset function
  function resetSimulation() {
    currentTimeRef.current = 0;
    setDataS1([]);
    setDataS2([]);
    currentS1Ref.current = { timestamp: 0, people: [], finishedCount: 0, queueCount: 0 };
    currentS2Ref.current = { timestamp: 0, people: [], finishedCount: 0, queueCount: 0 };
    arrivalAccumulatorRef.current = 0;
  }

  // 6.7) Main update loop
  function updateSimulation(dt, timestamp) {

    // Accumulate fractional arrivals
    arrivalAccumulatorRef.current += arrivalRate * dt;
    let newCount = Math.floor(arrivalAccumulatorRef.current);
    arrivalAccumulatorRef.current -= newCount;

    // Run the simulation for each strategy
    const newS1Data = runEscalatorSimulation({
      strategy: "S1",
      escalatorSpeed,
      walkSpeedMean,
      walkSpeedStd,
      walkProbability: 0,
      timestamp,
      stepY,
      dt,
      newCount,
      prev: currentS1Ref.current,
    })

    const newS2Data = runEscalatorSimulation({
      strategy: "S2",
      escalatorSpeed,
      walkSpeedMean,
      walkSpeedStd,
      walkProbability,
      timestamp,
      stepY,
      dt,
      newCount,
      prev: currentS2Ref.current,
    })

    // Update refs immediately
    currentS1Ref.current = newS1Data;
    currentS2Ref.current = newS2Data;
    
    // Use a single setState call to batch updates
    setDataS1(prev => [
      ...prev, 
      {
        timestamp: newS1Data.timestamp, 
        finishedCount: newS1Data.finishedCount, 
        queueCount: newS1Data.queueCount
      }
    ]);
    setDataS2(prev => [
      ...prev, 
      {
        timestamp: newS2Data.timestamp, 
        finishedCount: newS2Data.finishedCount, 
        queueCount: newS2Data.queueCount
      }]);
  }

  return (
    <div className="flex flex-col items-center w-full bg-gray-100 p-8 dark:bg-gray-100/10 rounded-xl">
      <h1 className="text-2xl w-full font-bold mb-8">Escalator Simulation</h1>
      <div className="w-full flex gap-4">
        {/* Left Panel: Controls */}
        <div className="flex-1 bg-[var(--bg-color)] p-8 rounded-xl shadow">
          <h2 className="text-xl font-semibold">Escalator Parameters</h2>

          <div className="my-3">
            <label className="block mb-2">Escalator Length (steps)</label>
            <input
              type="number"
              className="border p-2 w-full rounded-lg text-center"
              value={escalatorLength}
              onChange={(e) => setEscalatorLength(Number(e.target.value))}
            />
          </div>

          <div className="my-3">
            <label className="block mb-2">Escalator Speed (steps/s)</label>
            <input
              type="number"
              step="0.1"
              className="border p-2 w-full rounded-lg text-center"
              value={escalatorSpeed}
              onChange={(e) => setEscalatorSpeed(Number(e.target.value))}
            />
          </div>

          <h2 className="text-xl font-semibold mt-4">Passengers Parameters</h2>

          <div className="my-3">
            <label className="block mb-2">Arrival Rate (people/s)</label>
            <input
              type="number"
              step="0.5"
              className="border p-2 w-full rounded-lg text-center"
              value={arrivalRate}
              onChange={(e) => setArrivalRate(Number(e.target.value))}
            />
          </div>

          <div className="my-3">
            <label className="block mb-2">Avg Walking Speed <br/>(elevator steps/s)</label>
            <input
              type="number"
              step="0.1"
              className="border p-2 w-full rounded-lg text-center"
              value={walkSpeedMean}
              onChange={(e) => setWalkSpeedMean(Number(e.target.value))}
            />
          </div>

          <div className="my-3">
            <label className="block mb-2">Std Walking Speed <br/>(elevator steps/s)</label>
            <input
              type="number"
              step="0.1"
              className="border p-2 w-full rounded-lg text-center"
              value={walkSpeedStd}
              onChange={(e) => setWalkSpeedStd(Number(e.target.value))}
            />
          </div>

          {/* Probability of walking for Strategy 2 */}
          <div className="my-3">
            <label className="block mb-2">Probability of Walking Up</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              className="w-full"
              value={walkProbability}
              onChange={(e) => setWalkProbability(Number(e.target.value))}
            />
            <span>{(walkProbability * 100).toFixed(0)}%</span>
          </div>

          <h2 className="text-xl font-semibold mt-4">Time Controls</h2>
          <div className="my-3">
            <label className="block mb-2">Time Scale <br/>(slower / faster simulation)</label>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              className="w-full"
              value={timeScale}
              onChange={(e) => setTimeScale(Number(e.target.value))}
            />
            <div>{timeScale.toFixed(1)}x</div>
          </div>
          <div className="flex flex-col gap-4 mt-8">
          <button
            onClick={() => setPaused(!paused)}
            className="flex flex-col items-center bg-gray-100 dark:bg-gray-100/10 p-4 rounded-lg shadow"
          >
            {paused ? "Resume" : "Pause"}
          </button>
          <button
          onClick={resetSimulation}
          className="flex flex-col items-center bg-gray-100 dark:bg-gray-100/10 p-4 rounded-lg shadow"
          >
              Reset simulation
          </button>
          </div>
        </div>

        {/* Center Panel: Recharts Line Chart */}
        <div className="flex-2 bg-[var(--bg-color)] p-8 rounded-xl shadow flex flex-col justify-start">
          <h2 className="text-xl font-semibold mb-2 text-center">Simulation</h2>
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mergedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  // label={{ 
                  //   value: "Time (s)", 
                  //   position: "insideBottomRight",
                  //   }}
                  tickFormatter={(value) => value.toFixed(1)}  
                />
                <YAxis
                  label={{
                    value: "# in Queue",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip 
                  formatter={(value) => value.toFixed(1)}
                />
                <Line
                  type="monotone"
                  dataKey="queueS1"
                  stroke="var(--color-cyan-700)"
                  name="Strategy 1"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="queueS2"
                  stroke="var(--color-pink-700)"
                  name="Strategy 2"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mergedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  label={{ 
                    value: "Time (s)", 
                    position: "insideBottomRight",
                    offsetY: 20
                    }}
                  tickFormatter={(value) => value.toFixed(1)}  
                />
                <YAxis
                  label={{
                    value: "Total Out",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip 
                  formatter={(value) => value.toFixed(1)}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="finishedCountS1"
                  stroke="var(--color-cyan-700)"
                  name="Strategy 1"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="finishedCountS2"
                  stroke="var(--color-pink-700)"
                  name="Strategy 2"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="grid w-full grid-cols-2 gap-4 mt-4">
              <div className="flex flex-col items-center bg-gray-100 dark:bg-gray-100/10 p-4 rounded-lg shadow">
                  <StrategySimulation
                      strategyLabel="All standing"
                      timestamp={currentS1Ref.current.timestamp}
                      people={currentS1Ref.current.people}
                      finishedCount={currentS1Ref.current.finishedCount}
                  />
              </div>
              <div className="flex flex-col items-center bg-gray-100 dark:bg-gray-100/10 p-4 rounded-lg shadow">
                  <StrategySimulation
                      strategyLabel="Walkers"
                      timestamp={currentS2Ref.current.timestamp}
                      people={currentS2Ref.current.people}
                      finishedCount={currentS2Ref.current.finishedCount}
                  />
              </div>
          </div>
        </div>

        {/* Right Panel: Controls */}
        <div className="flex-1 bg-[var(--bg-color)] p-8 rounded-xl shadow">
          <h2 className="text-xl font-semibold mb-2 text-center">Key Stats</h2>
          <div className="flex flex-col gap-4">
              <div className="text-cyan-700">Strategy 1 : All Standing</div>
              <MetricCard 
              title="People Processed" 
              value={currentS1Ref.current.finishedCount}
              />
              <MetricCard 
              title="Current Queue Length" 
              value={currentS1Ref.current.queueCount}
              />
              <MetricCard 
              title="Total Throughput" 
              value={`${(currentS1Ref.current.finishedCount * 60 / (currentS1Ref.current.timestamp||1)).toFixed(2)}/min`}
              />
              <MetricCard 
              title="Last Minute Throughput" 
              value={`${(lastMinuteS1.throughput *60 ).toFixed(2)}/min`}
              />
              <div className="text-pink-700">Strategy 2 : Walkers </div>
              <MetricCard 
              title="People Processed" 
              value={currentS2Ref.current.finishedCount}
              />
              <MetricCard 
              title="Current Queue Length" 
              value={currentS2Ref.current.queueCount}
              />
              <MetricCard 
              title="Total Throughput" 
              value={`${(currentS2Ref.current.finishedCount *60 / (currentS2Ref.current.timestamp || 1)).toFixed(2)}/min`}
              />
              <MetricCard 
              title="Last Minute Throughput" 
              value={`${(lastMinuteS2.throughput *60).toFixed(2)}/min`}
              />
          </div>

        </div>
      </div>
      
    </div>
  );
}

