/****************************************************** 
 * LICENCE : CLAUDE SONNET 4.5 OUTPUT
*******************************************************/
import React, { useEffect, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

// Default styling expects TailwindCSS in your project
// Usage: import EscalatorSimulator from './EscalatorSimulator.jsx' and render <EscalatorSimulator />

export default function GPT5DefaultViz() {
  // ----- Inputs (left column) -----
  const [escalatorLength, setEscalatorLength] = useState(40); // meters
  const [escalatorSpeed, setEscalatorSpeed] = useState(0.5); // m/s (conveyer speed)
  const [totalArrivals, setTotalArrivals] = useState(500); // total people to generate
  const [arrivalRate, setArrivalRate] = useState(60); // people per minute (used to space arrivals)
  const [pctWalkers, setPctWalkers] = useState(0.4); // fraction who want to walk
  const [avgWalkSpeed, setAvgWalkSpeed] = useState(0.7); // additional m/s relative to escalator
  const [walkStdDev, setWalkStdDev] = useState(0.15); // stdev for walking speeds
  const [strategy, setStrategy] = useState(2); // 1 = everyone stands, 2 = left-walk-right-stand

  // simulation controls
  const [running, setRunning] = useState(false);
  const [timeScale, setTimeScale] = useState(1); // speedup of simulation

  // ----- Internal sim state -----
  const peopleRef = useRef([]); // array of person objects
  const lastIdRef = useRef(0);
  const simTimeRef = useRef(0); // seconds
  const rafRef = useRef(null);
  const lastFrameRef = useRef(null);
  const arrivalsGeneratedRef = useRef(0);
  const arrivalIntervalSec = () => (arrivalRate > 0 ? 60 / arrivalRate : Infinity);
  const nextArrivalAtRef = useRef(0);

  // visualization & stats
  const [viewTick, setViewTick] = useState(0); // used to re-render
  const [throughput, setThroughput] = useState(0);
  const flowBucketsRef = useRef([]); // array of {tMin, count} per minute
  const flowWindowRef = useRef([]);

  // layout constants
  const stepDepth = 0.4; // meters between steps
  const laneCount = 2; // two lanes: left(0) and right(1)
  const laneX = [60, 140]; // pixel X positions for drawing lanes
  const escalatorPixels = 300; // pixels height for escalator in UI

  // helper: sample normal using Box-Muller
  function sampleNormal(mu = 0, sigma = 1) {
    let u = 0,
      v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mu + z * sigma;
  }

  function resetSim() {
    cancelAnimationFrame(rafRef.current);
    peopleRef.current = [];
    lastIdRef.current = 0;
    simTimeRef.current = 0;
    arrivalsGeneratedRef.current = 0;
    nextArrivalAtRef.current = 0;
    flowBucketsRef.current = [];
    flowWindowRef.current = [];
    setThroughput(0);
    setViewTick((v) => v + 1);
  }

  useEffect(() => {
    // reset when important inputs change
    resetSim();
  }, [escalatorLength, escalatorSpeed, pctWalkers, avgWalkSpeed, walkStdDev, totalArrivals, arrivalRate, strategy]);

  function spawnPerson(now) {
    if (arrivalsGeneratedRef.current >= totalArrivals) return;
    arrivalsGeneratedRef.current += 1;
    const wantsToWalk = Math.random() < (strategy === 1 ? 0 : pctWalkers);
    const walkSpeedRel = wantsToWalk ? Math.max(0, sampleNormal(avgWalkSpeed, walkStdDev)) : 0;

    // each person is assigned to lane: strategy1 -> both lanes standing; strategy2 -> walkers left(0), standers right(1)
    let lane = 1; // default right
    if (strategy === 1) lane = Math.random() < 0.5 ? 0 : 1; // fill both lanes with standers
    else lane = wantsToWalk ? 0 : 1;

    const p = {
      id: ++lastIdRef.current,
      lane,
      wantsToWalk,
      walkSpeedRel, // m/s additional to escalator speed (0 if not walking)
      pos: -Math.random() * 1.0, // position in meters along escalator: negative means waiting just before boarding
      state: "queue", // 'queue' | 'on' | 'done'
      enteredAt: null,
      leftAt: null,
    };
    peopleRef.current.push(p);
  }

  function updateStatsReached(nowSec) {
    // record throughput in minute buckets
    const minute = Math.floor(nowSec / 60);
    if (!flowBucketsRef.current[minute]) flowBucketsRef.current[minute] = 0;
    flowBucketsRef.current[minute] += 1;
    setThroughput((t) => t + 1);
  }

  function stepSim(dt) {
    // dt in seconds already scaled by timeScale
    simTimeRef.current += dt;
    const now = simTimeRef.current;

    // spawn arrivals
    if (arrivalsGeneratedRef.current < totalArrivals) {
      if (now >= nextArrivalAtRef.current) {
        spawnPerson(now);
        nextArrivalAtRef.current = now + arrivalIntervalSec();
      }
    }

    // For each lane, we enforce spacing. Convert positions such that 0 = bottom boarding edge, escalatorLength = top (meters)
    // People with pos < 0 are in queue; when pos reaches 0 they can step on if there's spacing on that lane.

    // sort by lane and front-most first
    const lanes = [[], []];
    for (const p of peopleRef.current) lanes[p.lane].push(p);
    for (let lane = 0; lane < laneCount; lane++) {
      lanes[lane].sort((a, b) => b.pos - a.pos);

      for (let i = 0; i < lanes[lane].length; i++) {
        const p = lanes[lane][i];

        if (p.state === "done") continue;

        if (p.state === "queue") {
          // can step on if front-most (no one blocking at pos approx 0 on that lane)
          const front = lanes[lane].find((q) => q !== p && q.pos >= 0);
          if (!front) {
            // nobody on the lane -> allow to board if pos + something >= 0
            if (p.pos + escalatorSpeed * dt >= 0) {
              p.pos = 0;
              p.state = "on";
              p.enteredAt = simTimeRef.current;
            } else {
              // move forward in queue slightly as time passes due to crowd compression (small factor)
              p.pos += Math.min(0.2 * dt, Math.abs(p.pos));
            }
          } else {
            // someone on the lane, check distance to them from boarding point
            // if front.pos > stepDepth then this p can move closer in queue
            const canBoard = front.pos >= stepDepth * 0.9; // safety margin
            if (canBoard && p.pos + escalatorSpeed * dt >= 0) {
              p.pos = 0;
              p.state = "on";
              p.enteredAt = simTimeRef.current;
            } else {
              // compress queue a bit
              p.pos += Math.min(0.15 * dt, Math.abs(p.pos));
            }
          }
        } else if (p.state === "on") {
          // compute candidate movement: v = escalatorSpeed + p.walkSpeedRel
          const desiredV = escalatorSpeed + (p.wantsToWalk ? p.walkSpeedRel : 0);
          let candidate = p.pos + desiredV * dt;

          // cannot go beyond escalator length
          if (candidate >= escalatorLength) {
            // reaches top
            p.pos = escalatorLength;
            p.state = "done";
            p.leftAt = simTimeRef.current;
            updateStatsReached(simTimeRef.current);
            continue;
          }

          // cannot overtake the person ahead in same lane
          const idxInLane = lanes[lane].indexOf(p);
          if (idxInLane > 0) {
            const ahead = lanes[lane][idxInLane - 1];
            if (ahead && ahead.pos > p.pos) {
              // need to ensure candidate <= ahead.pos - minGap
              const minGap = stepDepth * 0.6; // meters
              const maxAllowed = ahead.pos - minGap;
              if (candidate > maxAllowed) candidate = Math.min(candidate, maxAllowed);
            }
          }

          // assign
          p.pos = candidate;
        }
      }
    }

    // remove completed far done persons from memory after some time to keep arrays small
    if (peopleRef.current.length > 2000) {
      peopleRef.current = peopleRef.current.filter((p) => !(p.state === "done" && simTimeRef.current - p.leftAt > 30));
    }

    // update view
    setViewTick((v) => v + 1);
  }

  // main loop
  useEffect(() => {
    if (!running) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastFrameRef.current = null;
      return;
    }

    function frame(ts) {
      if (!lastFrameRef.current) lastFrameRef.current = ts;
      const rawDtMs = ts - lastFrameRef.current;
      lastFrameRef.current = ts;
      const dt = (rawDtMs / 1000) * timeScale;
      stepSim(dt);
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, timeScale]);

  // prepare data for charts
  const flowData = flowBucketsRef.current.map((count, idx) => ({ minute: idx + 1, flow: count || 0 })).slice(-30);

  // UI helpers
  function start() {
    if (!running) setRunning(true);
  }
  function pause() {
    setRunning(false);
  }
  function doReset() {
    setRunning(false);
    resetSim();
  }

  // UI rendering of escalator (SVG)
  function renderSVG() {
    // map positions (meters 0..escalatorLength) to pixels [bottom->top]
    const yFor = (posMeters) => {
      const t = posMeters / escalatorLength;
      // invert (0 bottom -> escalatorPixels bottom)
      return escalatorPixels - t * escalatorPixels + 20;
    };

    const people = peopleRef.current.slice(-1000);

    return (
      <svg width="220" height={escalatorPixels + 60} className="bg-slate-50 rounded p-2 shadow-inner">
        {/* escalator background */}
        <rect x={40} y={20} width={140} height={escalatorPixels} rx={8} className="fill-white stroke-slate-200 stroke" />

        {/* lanes lines */}
        <line x1={laneX[0]} x2={laneX[0]} y1={20} y2={escalatorPixels + 20} className="stroke-slate-300 stroke" />
        <line x1={laneX[1]} x2={laneX[1]} y1={20} y2={escalatorPixels + 20} className="stroke-slate-300 stroke" />

        {/* steps markers */}
        {Array.from({ length: Math.max(4, Math.floor(escalatorLength / stepDepth)) }).map((_, i) => {
          const pos = (i / Math.max(4, Math.floor(escalatorLength / stepDepth))) * escalatorLength;
          const y = yFor(pos);
          return <line key={i} x1={40} x2={180} y1={y} y2={y} className="stroke-slate-100" />;
        })}

        {/* people */}
        {people.map((p) => {
          const px = laneX[p.lane];
          const y = p.pos < 0 ? escalatorPixels + 30 - (Math.max(0, p.pos) * 10) : yFor(p.pos);
          const r = p.state === "done" ? 0 : p.wantsToWalk ? 6 : 5;
          const fill = p.state === "queue" ? "#94a3b8" : p.wantsToWalk ? "#ef4444" : "#3b82f6";
          return <circle key={p.id} cx={px} cy={y} r={r} fill={fill} opacity={0.95} />;
        })}

        {/* top label and stats */}
        <text x={100} y={12} textAnchor="middle" className="text-sm text-slate-600">Escalator (top)</text>
      </svg>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div><em>Note : one-shot by OpenAi GPT5 (default) </em></div>
    <div className="flex gap-6 p-6">
      {/* Left column: inputs */}
      <div className="w-80 bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Inputs</h2>

        <label className="block text-sm">Escalator length (m)</label>
        <input type="range" min={10} max={80} value={escalatorLength} onChange={(e) => setEscalatorLength(Number(e.target.value))} />
        <div className="text-xs text-slate-500 mb-2">{escalatorLength} m</div>

        <label className="block text-sm">Escalator speed (m/s)</label>
        <input type="range" min={0.1} max={1.2} step={0.05} value={escalatorSpeed} onChange={(e) => setEscalatorSpeed(Number(e.target.value))} />
        <div className="text-xs text-slate-500 mb-2">{escalatorSpeed} m/s</div>

        <label className="block text-sm">Total arrivals</label>
        <input type="number" value={totalArrivals} onChange={(e) => setTotalArrivals(Number(e.target.value))} className="w-full" />

        <label className="block text-sm mt-2">Arrival rate (people / min)</label>
        <input type="number" value={arrivalRate} onChange={(e) => setArrivalRate(Number(e.target.value))} className="w-full" />

        <label className="block text-sm mt-2">% who want to walk</label>
        <input type="range" min={0} max={1} step={0.01} value={pctWalkers} onChange={(e) => setPctWalkers(Number(e.target.value))} />
        <div className="text-xs text-slate-500 mb-2">{Math.round(pctWalkers * 100)}%</div>

        <label className="block text-sm">Avg walking speed relative (m/s)</label>
        <input type="range" min={0} max={1.6} step={0.05} value={avgWalkSpeed} onChange={(e) => setAvgWalkSpeed(Number(e.target.value))} />
        <div className="text-xs text-slate-500 mb-2">{avgWalkSpeed} m/s</div>

        <label className="block text-sm">Walking speed std dev</label>
        <input type="range" min={0} max={0.6} step={0.01} value={walkStdDev} onChange={(e) => setWalkStdDev(Number(e.target.value))} />
        <div className="text-xs text-slate-500 mb-2">{walkStdDev} m/s</div>

        <label className="block text-sm mt-2">Strategy</label>
        <div className="flex gap-2 mt-1">
          <button className={`px-2 py-1 rounded ${strategy === 1 ? "bg-slate-800 text-white" : "bg-slate-100"}`} onClick={() => setStrategy(1)}>
            1 - All stand
          </button>
          <button className={`px-2 py-1 rounded ${strategy === 2 ? "bg-slate-800 text-white" : "bg-slate-100"}`} onClick={() => setStrategy(2)}>
            2 - Left walk / right stand
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={start} className="px-3 py-1 bg-green-600 text-white rounded">Start</button>
          <button onClick={pause} className="px-3 py-1 bg-yellow-400 text-white rounded">Pause</button>
          <button onClick={doReset} className="px-3 py-1 bg-red-500 text-white rounded">Reset</button>
        </div>

        <div className="mt-4 text-sm text-slate-600">Time scale</div>
        <input type="range" min={0.25} max={4} step={0.25} value={timeScale} onChange={(e) => setTimeScale(Number(e.target.value))} />
        <div className="text-xs text-slate-500 mb-2">{timeScale}x</div>

        <div className="mt-4 text-sm">
          <div>Throughput: <strong>{throughput}</strong> persons reached top</div>
          <div>Active in sim: <strong>{peopleRef.current.filter(p => p.state!=='done').length}</strong></div>
          <div>Generated: <strong>{arrivalsGeneratedRef.current}</strong></div>
        </div>
      </div>

      {/* Right column: visualization + charts */}
      <div className="flex-1 space-y-4">
        <div className="bg-white p-4 rounded shadow">{renderSVG()}</div>

        <div className="bg-white p-4 rounded shadow grid grid-cols-2 gap-4">
          <div className="col-span-1">
            <h3 className="text-sm font-medium mb-2">Flow (per minute)</h3>
            <div style={{ width: "100%", height: 180 }}>
              <ResponsiveContainer>
                <LineChart data={flowData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="minute" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="flow" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="col-span-1">
            <h3 className="text-sm font-medium mb-2">Realtime stats</h3>
            <div className="text-sm text-slate-700 space-y-1">
              <div>People at bottom queue: <strong>{peopleRef.current.filter(p=>p.state==='queue').length}</strong></div>
              <div>People on escalator: <strong>{peopleRef.current.filter(p=>p.state==='on').length}</strong></div>
              <div>People finished: <strong>{peopleRef.current.filter(p=>p.state==='done').length}</strong></div>
              <div>Avg walking speed (requested): <strong>{avgWalkSpeed.toFixed(2)} m/s</strong></div>
              <div>Escalator travel time (standing): <strong>{(escalatorLength / escalatorSpeed).toFixed(1)} s</strong></div>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow text-sm text-slate-600">
          <h4 className="font-medium">Notes & assumptions</h4>
          <ul className="list-disc ml-5 mt-2">
            <li>People are modeled individually; walking speed is sampled from a normal distribution and truncated at 0.</li>
            <li>Walkers add speed relative to the escalator speed (v = v_escalator + v_walk_rel).</li>
            <li>No overtaking is allowed within a lane: a faster walker will queue behind a slower one.</li>
            <li>Boarding enforces a minimum step spacing per lane (approx. {stepDepth} m).</li>
            <li>Strategy 1 overrides walkers fraction to 0 (all stand).</li>
          </ul>
        </div>
      </div>
    </div>
    </div>
  );
}