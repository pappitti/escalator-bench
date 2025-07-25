import { useState, useEffect, useRef, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

/* ---------- CONFIG ---------- */
const STEP_TIME_MS = 100;               // simulation tick
const DOT_SIZE = 8;                     // px
const ESCALATOR_WIDTH = 200;            // px
const ESCALATOR_HEIGHT = 300;           // px
const PERSON_COLORS = {
  stand: "#38bdf8",
  walk:  "#f59e0b"
};

/* ---------- UTILS ---------- */
const randNormal = (mean, std) => {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
};

/* ---------- SIMULATION ---------- */
function useEscalatorSimulation(inputs) {
  const {
    lengthM,
    speedMps,
    totalPeople,
    walkPercent,
    walkSpeedAvg,
    walkSpeedStd,
    strategy
  } = inputs;

  const [people, setPeople] = useState([]);
  const [arrivedCount, setArrivedCount] = useState(0);
  const [time, setTime] = useState(0);           // ticks
  const [flowHistory, setFlowHistory] = useState([]); // {time, strategy1, strategy2}

  const reset = () => {
    setPeople([]);
    setArrivedCount(0);
    setTime(0);
    setFlowHistory([]);
  };

  // Add people gradually until we reach totalPeople
  useEffect(() => {
    const interval = setInterval(() => {
      setPeople(prev => {
        if (prev.length >= totalPeople) return prev;
        const newPerson = {
          id: Date.now() + Math.random(),
          x: 0,
          y: 0,
          type: Math.random() < walkPercent / 100 ? "walk" : "stand",
          walkSpeed: Math.max(0.3, randNormal(walkSpeedAvg, walkSpeedStd)) // m/s
        };
        return [...prev, newPerson];
      });
    }, 300);
    return () => clearInterval(interval);
  }, [totalPeople, walkPercent, walkSpeedAvg, walkSpeedStd]);

  // Physics tick
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(t => t + 1);
      setPeople(prev => {
        let newArrived = 0;
        const updated = prev.map(p => {
          if (p.y >= lengthM) return p; // already at top

          // choose lane
          const lane = strategy === 1 ? 0 : (p.type === "stand" ? 1 : 0); // 0 left, 1 right
          const effectiveSpeed = p.type === "walk"
            ? speedMps + p.walkSpeed
            : speedMps;

          const nextY = p.y + effectiveSpeed * (STEP_TIME_MS / 1000);
          return { ...p, y: Math.min(nextY, lengthM), lane };
        });

        const stillOn = updated.filter(p => {
          if (p.y >= lengthM) {
            newArrived++;
            return false;
          }
          return true;
        });

        setArrivedCount(c => c + newArrived);
        return stillOn;
      });

      // record flow every 60 ticks \u2248 6 s
      if (time % 60 === 0) {
        setFlowHistory(h => [...h, {
          time: Math.round(time * STEP_TIME_MS / 1000),
          [strategy === 1 ? "strategy1" : "strategy2"]: arrivedCount
        }]);
      }
    }, STEP_TIME_MS);
    return () => clearInterval(timer);
  }, [lengthM, speedMps, strategy, time, arrivedCount]);

  return { people, arrivedCount, reset, flowHistory };
}

/* ---------- UI ---------- */
function KimiK2Viz() {
  const [inputs, setInputs] = useState({
    lengthM: 30,
    speedMps: 0.5,
    totalPeople: 150,
    walkPercent: 0,
    walkSpeedAvg: 0.8,
    walkSpeedStd: 0.2,
    strategy: 1
  });

  const { people, arrivedCount, reset, flowHistory } = useEscalatorSimulation(inputs);

  // Merge history so we can compare both strategies
  const mergedHistory = useMemo(() => {
    const map = {};
    flowHistory.forEach(pt => {
      const t = pt.time;
      if (!map[t]) map[t] = { time: t };
      Object.assign(map[t], pt);
    });
    return Object.values(map).sort((a, b) => a.time - b.time);
  }, [flowHistory]);

  return (
    <div className="container mx-auto p-4">
      <div><em>Note : Kimi K2 built this in 1 shot</em></div>
    <div className="flex h-screen font-sans">
      {/* LEFT COLUMN */}
      <aside className="w-80 p-4 space-y-6 overflow-y-auto bg-slate-100">
        <h2 className="text-xl font-bold">Escalator Simulator</h2>

        <div>
          <h3 className="font-semibold mb-2">Escalator</h3>
          <label className="block text-sm mb-1">Length (m)</label>
          <input type="number" value={inputs.lengthM} onChange={e => setInputs({...inputs, lengthM:+e.target.value})} className="w-full px-2 py-1 border rounded" />
          <label className="block text-sm mt-2 mb-1">Speed (m/s)</label>
          <input type="number" step="0.1" value={inputs.speedMps} onChange={e => setInputs({...inputs, speedMps:+e.target.value})} className="w-full px-2 py-1 border rounded" />
        </div>

        <div>
          <h3 className="font-semibold mb-2">People</h3>
          <label className="block text-sm mb-1">Total people</label>
          <input type="number" value={inputs.totalPeople} onChange={e => setInputs({...inputs, totalPeople:+e.target.value})} className="w-full px-2 py-1 border rounded" />
          <label className="block text-sm mt-2 mb-1">% walking (0 \u2192 strategy 1)</label>
          <input type="range" min="0" max="100" value={inputs.walkPercent} onChange={e => setInputs({...inputs, walkPercent:+e.target.value})} className="w-full" />
          <span className="text-xs">{inputs.walkPercent}%</span>
          <label className="block text-sm mt-2 mb-1">Walk speed avg (m/s)</label>
          <input type="number" step="0.1" value={inputs.walkSpeedAvg} onChange={e => setInputs({...inputs, walkSpeedAvg:+e.target.value})} className="w-full px-2 py-1 border rounded" />
          <label className="block text-sm mt-2 mb-1">Walk speed std (m/s)</label>
          <input type="number" step="0.1" value={inputs.walkSpeedStd} onChange={e => setInputs({...inputs, walkSpeedStd:+e.target.value})} className="w-full px-2 py-1 border rounded" />
        </div>

        <div>
          <h3 className="font-semibold mb-2">Strategy</h3>
          <select value={inputs.strategy} onChange={e => setInputs({...inputs, strategy:+e.target.value})} className="w-full px-2 py-1 border rounded">
            <option value={1}>Strategy 1 \u2013 everyone stands</option>
            <option value={2}>Strategy 2 \u2013 stand right / walk left</option>
          </select>
        </div>

        <button onClick={reset} className="w-full bg-sky-500 text-white py-2 rounded hover:bg-sky-600">Reset</button>
      </aside>

      {/* RIGHT COLUMN */}
      <main className="flex-1 flex flex-col p-4 space-y-4">
        {/* ANIMATION */}
        <div className="flex-1 flex items-center justify-center">
          <div className="relative" style={{ width: ESCALATOR_WIDTH, height: ESCALATOR_HEIGHT }}>
            {/* Escalator outline */}
            <div className="absolute inset-0 border-2 border-slate-400 rounded" />
            {/* People */}
            {people.map(p => {
              const xOffset = p.lane === 0 ? 0 : ESCALATOR_WIDTH / 2;
              const yPx = (p.y / inputs.lengthM) * ESCALATOR_HEIGHT;
              return (
                <div
                  key={p.id}
                  className="absolute rounded-full"
                  style={{
                    width: DOT_SIZE,
                    height: DOT_SIZE,
                    background: PERSON_COLORS[p.type],
                    left: xOffset + (ESCALATOR_WIDTH / 4 - DOT_SIZE / 2),
                    bottom: yPx - DOT_SIZE / 2,
                    transition: "bottom 0.1s linear"
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* STATS */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mergedHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" unit="s" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="strategy1" stroke="#ef4444" name="Strategy 1" dot={false} />
              <Line type="monotone" dataKey="strategy2" stroke="#3b82f6" name="Strategy 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="text-center text-sm">
          People arrived: <span className="font-bold text-sky-600">{arrivedCount}</span>
        </div>
      </main>
    </div>
    </div>
  );
}

export default KimiK2Viz;
