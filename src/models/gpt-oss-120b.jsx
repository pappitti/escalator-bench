/****************************************************** 
 * LICENSE : GPT-OSS-120B APACHE-2.0
*******************************************************/
import React, { useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function createSimulation(params) {
  return {
    nextId: 0,
    passengers: [],
    totalArrivals: 0,
    totalDepartures: 0,
  };
}

function step(state, params) {
  const { dtSec } = params;

  // -------------------------------------------------------------
  // 1️⃣ Generate new arrivals (Poisson process approximated by Bernoulli)
  // -------------------------------------------------------------
  const expectedArrivals = params.arrivalRatePps * dtSec;
  // For small dt the probability of >1 arrival is negligible.
  const arrivalsThisTick =
    Math.random() < expectedArrivals ? 1 : 0; // simple Bernoulli

  for (let i = 0; i < arrivalsThisTick; ++i) {
    const walking =
      params.strategy === "mixed" && Math.random() < params.walkingPct;
    const walkSpeed = walking
      ? Math.max(
          0,
          randomNormal(params.walkMeanMps, params.walkStdMps)
        )
      : 0;

    state.passengers.push({
      id: state.nextId++,
      walking,
      walkSpeed,
      position: 0, // start at the bottom of the step
    });
  }
  state.totalArrivals += arrivalsThisTick;

  // -------------------------------------------------------------
  // 2️⃣ Move everybody forward respecting “no‑overtake” rule
  // -------------------------------------------------------------
  // Sort by current position (ascending = closer to bottom)
  state.passengers.sort((a, b) => a.position - b.position);

  const newPassengers = [];
  let departuresThisTick = 0;

  for (let i = 0; i < state.passengers.length; ++i) {
    const p = { ...state.passengers[i] }; // copy – we will mutate the copy

    // Base speed is beltSpeed. If walking, add personal walkSpeed.
    let desiredSpeed = params.beltSpeedMps + (p.walking ? p.walkSpeed : 0);

    // Compute max distance we could travel this tick
    const maxDelta = desiredSpeed * dtSec;

    // Respect the “no overtaking” rule:
    //   - If there is a passenger in front, we cannot go past his position.
    //   - We also keep at least `minGap` (≈ length of one step) behind him.
    const minGap = 0.5; // metres – roughly one escalator step
    if (i > 0) {
      const front = newPassengers[i - 1];
      const allowedPos = Math.max(
        p.position, // never move backwards
        Math.min(front.position - minGap, p.position + maxDelta)
      );
      p.position = allowedPos;
    } else {
      // No one in front – just go as far as speed allows.
      p.position += maxDelta;
    }

    // Has the passenger reached or passed the top?
    if (p.position >= params.lengthM) {
      departuresThisTick++;
    } else {
      newPassengers.push(p);
    }
  }

  state.passengers = newPassengers;
  state.totalDepartures += departuresThisTick;

  return {
    passengers: state.passengers,
    arrivalsThisTick,
    departuresThisTick,
  };
}

/* -----------------------------------------------------------------
   Helper – generate a random normal variate (Box‑Muller)
----------------------------------------------------------------- */
function randomNormal(mean, stdDev) {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random(); // avoid log(0)
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdDev + mean;
}

function ControlsPanel({
  lengthM,
  setLengthM,
  beltSpeed,
  setBeltSpeed,
  arrivalRate,
  setArrivalRate,
  strategy,
  setStrategy,
  walkingPct,
  setWalkingPct,
  walkMean,
  setWalkMean,
  walkStd,
  setWalkStd,
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Escalator variables</h2>

      {/* Length */}
      <label className="block">
        <span className="text-gray-700">Length (m)</span>
        <input
          type="range"
          min={10}
          max={60}
          step={1}
          value={lengthM}
          onChange={(e) => setLengthM(+e.target.value)}
          className="w-full"
        />
        <div className="text-sm text-center">{lengthM} m</div>
      </label>

      {/* Belt speed */}
      <label className="block">
        <span className="text-gray-700">Belt speed (m/s)</span>
        <input
          type="range"
          min={0.2}
          max={1.5}
          step={0.05}
          value={beltSpeed}
          onChange={(e) => setBeltSpeed(+e.target.value)}
          className="w-full"
        />
        <div className="text-sm text-center">{beltSpeed.toFixed(2)} m/s</div>
      </label>

      <h2 className="text-xl font-semibold mt-8">People input</h2>

      {/* Arrival rate */}
      <label className="block">
        <span className="text-gray-700">Arrival rate (people / min)</span>
        <input
          type="range"
          min={5}
          max={120}
          step={5}
          value={arrivalRate}
          onChange={(e) => setArrivalRate(+e.target.value)}
          className="w-full"
        />
        <div className="text-sm text-center">{arrivalRate} p/min</div>
      </label>

      {/* Strategy */}
      <label className="block">
        <span className="text-gray-700">Strategy</span>
        <select
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
          className="mt-1 block w-full rounded border-gray-300"
        >
          <option value="standing">1 – Everyone stands</option>
          <option value="mixed">2 – Mixed (walk / stand)</option>
        </select>
      </label>

      {/* Walking percentage – only visible for mixed */}
      {strategy === "mixed" && (
        <>
          <label className="block">
            <span className="text-gray-700">
              % who want to walk up
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={walkingPct * 100}
              onChange={(e) => setWalkingPct(+e.target.value / 100)}
              className="w-full"
            />
            <div className="text-sm text-center">
              {Math.round(walkingPct * 100)} %
            </div>
          </label>

          {/* Walking speed mean */}
          <label className="block">
            <span className="text-gray-700">Mean walking speed (m/s)</span>
            <input
              type="range"
              min={0.2}
              max={1.5}
              step={0.05}
              value={walkMean}
              onChange={(e) => setWalkMean(+e.target.value)}
              className="w-full"
            />
            <div className="text-sm text-center">{walkMean.toFixed(2)} m/s</div>
          </label>

          {/* Walking speed std */}
          <label className="block">
            <span className="text-gray-700">Walking‑speed spread (σ)</span>
            <input
              type="range"
              min={0}
              max={0.5}
              step={0.05}
              value={walkStd}
              onChange={(e) => setWalkStd(+e.target.value)}
              className="w-full"
            />
            <div className="text-sm text-center">{walkStd.toFixed(2)} m/s</div>
          </label>
        </>
      )}
    </div>
  );
}

function EscalatorCanvas({
  lengthM,
  passengers,
  strategy,
}) {
  const canvasRef = useRef(null);

  // Convert real metres to pixels – keep a constant visual height
  const PIXELS_PER_METER = 12; // adjust for your screen size

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Resize canvas to fill container (responsive)
    function resize() {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = lengthM * PIXELS_PER_METER + 40; // extra margin
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [lengthM]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Clear and redraw every frame
    function draw() {
      const w = canvas.width;
      const h = canvas.height;

      // ---- background (escalator steps) ----
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#e2e8f0"; // light gray for steps
      const stepHeight = PIXELS_PER_METER * 0.5; // one real step ≈0.5 m
      for (let y = h - stepHeight; y > 0; y -= stepHeight) {
        ctx.fillRect(0, y, w, stepHeight / 2);
      }

      // ---- draw passengers ----
      passengers.forEach((p) => {
        const xBase = strategy === "standing" ? w / 2 : w / 4;
        const laneOffset = p.walking ? -w / 8 : w / 8; // left lane for walkers

        const x = xBase + laneOffset;
        const y = h - p.position * PIXELS_PER_METER;

        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = p.walking ? "#f87171" : "#60a5fa"; // red walkers, blue standers
        ctx.fill();
      });

      requestAnimationFrame(draw);
    }
    draw();
  }, [passengers, strategy]);

  return <canvas ref={canvasRef} className="border rounded bg-white shadow-sm" />;
}

function StatsChart({ data }) {
  // Show only the last N seconds to keep chart readable
  const recent = data.slice(-Math.min(data.length, 120));

  return (
    <div className="h-64 bg-white p-2 rounded shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={recent}>
          <XAxis dataKey="time" label={{ value: "seconds", position: "insideBottomRight", offset: -5 }} />
          <YAxis
            yAxisId="left"
            label={{
              value: "cumulative",
              angle: -90,
              position: "insideLeft",
            }}
          />
          <Tooltip />
          <Legend verticalAlign="top" height={36} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="arrivals"
            stroke="#60a5fa"
            name="Arrivals"
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="departures"
            stroke="#f87171"
            name="Departures"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const GPTOss120BViz = () => {
  const [lengthM, setLengthM] = useState(30);
  const [beltSpeed, setBeltSpeed] = useState(0.5); // m/s
  const [arrivalRate, setArrivalRate] = useState(30); // people / minute
  const [strategy, setStrategy] = useState("standing");
  const [walkingPct, setWalkingPct] = useState(0.4);
  const [walkMean, setWalkMean] = useState(0.6);
  const [walkStd, setWalkStd] = useState(0.2);
  // ---------- Simulation state ----------
  const simRef = useRef();

  // Initialise or re‑initialise simulation when any input changes
  useEffect(() => {
    const dt = 0.1; // seconds per tick – also the animation frame interval
    const params = {
      lengthM,
      beltSpeedMps: beltSpeed,
      arrivalRatePps: (arrivalRate / 60) * 1, // convert min → sec
      strategy,
      walkingPct,
      walkMeanMps: walkMean,
      walkStdMps: walkStd,
      dtSec: dt,
    };
    simRef.current = {
      params,
      state: createSimulation(params),
      lastTick: null,
      elapsedSec: 0,
    };
  }, [
    lengthM,
    beltSpeed,
    arrivalRate,
    strategy,
    walkingPct,
    walkMean,
    walkStd,
  ]);

  // ---------- Animation loop ----------
  const [tick, setTick] = useState(null);
  const requestRef = useRef();

  const animate = (time) => {
    if (!simRef.current) return;
    const { params, state } = simRef.current;

    // Run as many ticks as needed to catch up with real time
    const now = performance.now() / 1000; // seconds
    while (
      simRef.current.elapsedSec + params.dtSec <= now - startTimeRef.current
    ) {
      const result = step(state, params);
      simRef.current.lastTick = result;
      simRef.current.elapsedSec += params.dtSec;
    }
    setTick(simRef.current.lastTick ?? null);
    requestRef.current = requestAnimationFrame(animate);
  };
  const startTimeRef = useRef(performance.now() / 1000);

  // Start/stop the loop
  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simRef.current?.params]); // restart when params change

  // ---------- Accumulated stats for charts ----------
  const [history, setHistory] = useState([]);

  // Every real‑second we push a snapshot (nice for Recharts)
  useEffect(() => {
    const id = setInterval(() => {
      if (!simRef.current) return;
      const { totalArrivals, totalDepartures, elapsedSec } = simRef.current.state;
      setHistory((h) => [
        ...h,
        {
          time: Math.round(elapsedSec),
          arrivals: totalArrivals,
          departures: totalDepartures,
        },
      ]);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ---------- Render ----------
  return (
    <div className="container mx-auto p-4">
      <div><em>Note : GPT-oss-120B built this in 1 shot (although to be transparent it did it in typescript and I removed the type assertions myself rather than asking it to do it in javascript)</em></div>
      <div className="min-h-screen bg-gray-50 flex">
        {/* LEFT – Controls */}
        <div className="w-1/3 p-4 border-r overflow-y-auto">
          <ControlsPanel
            lengthM={lengthM}
            setLengthM={setLengthM}
            beltSpeed={beltSpeed}
            setBeltSpeed={setBeltSpeed}
            arrivalRate={arrivalRate}
            setArrivalRate={setArrivalRate}
            strategy={strategy}
            setStrategy={setStrategy}
            walkingPct={walkingPct}
            setWalkingPct={setWalkingPct}
            walkMean={walkMean}
            setWalkMean={setWalkMean}
            walkStd={walkStd}
            setWalkStd={setWalkStd}
          />
        </div>

        {/* RIGHT – Visualisation */}
        <div className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
          <EscalatorCanvas
            lengthM={lengthM}
            beltSpeed={beltSpeed}
            passengers={tick?.passengers ?? []}
            strategy={strategy}
          />
          <StatsChart data={history} />
        </div>
      </div>
    </div>
  );
}

export default GPTOss120BViz;