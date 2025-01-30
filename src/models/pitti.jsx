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

// incremental spots in the queue graph per level (1 or 2)
const QUEUE_X_INCREMENT = 2; // two stops at the top of the queue, 4 behinf them, 6 behind them, etc.

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

//spot in the graph
class Node {
  constructor(type, level, index) {
    this.type = type; // escalator or queue
    this.level = level;
    this.index = index;
    this.connections = []; // [frontLeft (if any), front (if any), frontRight (if any)]
    this.occupied = null;  // null or Person
  }
}

class Person {
  constructor(id, isWalking, walkingSpeed) {
    this.id = id;
    this.isWalking = isWalking;
    this.walkingSpeed = walkingSpeed;
    this.currentNode = null; //
    this.onEscalator = false;
    this.done = false;
  }
}
/*******************************************************
 * 2) GRAPH COMPONENT
 *******************************************************/

class EscalatorGraph {
  constructor(strategy, escalatorHeight, queueHeight, escalatorLength, escalatorSpeed){
    this.strategy = strategy;
    this.escalatorLength = escalatorLength;
    this.escalatorSpeed = escalatorSpeed;
    this.nodes = new Map();
    this.escalatorLevels = [];
    this.queueLevels = [];
    this.people = [];
    this.inQueue = 0;
    this.onEscalator = 0;
    this.finishedCount = 0;
    this.bloated = false;
    this.buildEscalatorGraph();
    this.buildQueueGraph(escalatorLength  * queueHeight / (escalatorHeight  || 1));
  }

  buildEscalatorGraph() {
    // Build from bottom to top
    const levelsCount = this.escalatorLength;
    for (let level = 0; level < levelsCount; level++) {
      const nodeLeft = new Node("escalator", level, 0);
      const nodeRight = new Node("escalator", level, 1);
      this.nodes.set(("escalator", level, 0),nodeLeft);
      this.nodes.set(("escalator", level, 1),nodeRight);
      this.escalatorLevels.push([nodeLeft, nodeRight]);
      if (level > 0) {
        const aboveLevel = this.escalatorLevels[level - 1];
        nodeLeft.connections.push(aboveLevel[0]);
        nodeRight.connections.push(aboveLevel[1]);
      } 
    }
    // console.log(`escalator length ${this.escalatorLevels.length}`);
  }

  buildQueueGraph(height) {
    // Build from top to bottom
    // Top level has 2 spots
    const levelsCount = Math.floor(height);
    
    for (let level = 0; level < levelsCount; level++) {
      const nodesInLevel = 2 + (level * QUEUE_X_INCREMENT);
      const levelNodes = [];
      
      // Create nodes for this level
      for (let i = 0; i < nodesInLevel; i++) {
        const node = new Node("queue", level, i);
        levelNodes.push(node);
        this.nodes.set(("queue", level, i),node);
      }
      
      this.queueLevels.push(levelNodes);
      
      // Connect to level above if not top level
      if (level > 0) {
        const aboveLevel = this.queueLevels[level - 1];
        const aboveLevelLength = aboveLevel.length;
        
        levelNodes.forEach((node, i) => {
          // Calculate potential connections to above level          
          const connectedNodes = aboveLevel.filter(upperNode => 
            upperNode.index >= Math.max(0,i - 2) 
            && upperNode.index <= Math.min(i, aboveLevelLength - 1)
          )
          node.connections=[...connectedNodes];
        });
      };
    }
    // console.log(`queuelength ${this.queueLevels.length}`);
  }

  findAvailableStartNodes(isWalking, walkProbability) {
    const bottomLevel = this.queueLevels[this.queueLevels.length - 1];
    const walkersSpots = Math.floor(walkProbability * bottomLevel.length);
    const maxWalkersIndex= Math.max(walkersSpots-1,0);
    const available = bottomLevel.filter(node => {
      if (node.occupied) return false;
      if (isWalking && node.index > maxWalkersIndex) return false;
      if (!isWalking && node.index <= maxWalkersIndex) return false;
      return true;
    });
    return available;
  }

  addNewPeople(count, walkProbability, walkSpeedMean, walkSpeedStd) {
    for (let i = 0; i < count; i++) {
      const isWalking = this.strategy === "S2" && Math.random() < walkProbability;
      const walkingSpeed = isWalking
        ? truncatedWalkingSpeed(walkSpeedMean, walkSpeedStd)
        : 0;
        
      const availableNodes = this.findAvailableStartNodes(isWalking, walkProbability);
      if (availableNodes.length === 0) {
        console.log("Queue is full!");
        this.bloated = true;
        break;
      }
      const startNode = availableNodes[Math.floor(Math.random() * availableNodes.length)];
      const person = new Person(
        performance.now() + Math.random(),
        isWalking,
        walkingSpeed
      );
      
      person.currentNode = startNode;
      startNode.occupied = person;
      this.people.push(person);
      this.inQueue++;

      console.log("New person", person);
    }
  }

  cleanPeople() {
    this.people = this.people.filter(p => !p.done);
  }

  // Move people from bottom to top
  movePeople() {

    function moveWalkersInQueue(shuffledNodes, aboveLevelHalf) {
      shuffledNodes.forEach(node => {
        // Find available connections
        const availableNodes = node.connections.filter(n => !n.occupied);
        
        if (availableNodes.length > 0) {
          // sorted connections by index
          availableNodes.sort((a, b) => a.index - b.index );
          
          const rand = Math.random();
          let targetNode = undefined;
          let updatePosition = false;

          if (availableNodes.length === 1){
            if (
              availableNodes[0].index === node.index 
              && rand > 0.8 
              && availableNodes[0].index != aboveLevelHalf
            ){
              // only 20% chances to try overtake on the right
              targetNode = availableNodes[0];
              updatePosition = true;
            } else if (availableNodes[0].index !== node.index){
              targetNode = availableNodes[0];
              updatePosition = true;
            }
          } else if (
            availableNodes.length === 2 
            && availableNodes[availableNodes.length-1].index === node.index
          ){
            // take the leftmost node
            targetNode = availableNodes[0];
            updatePosition = true;
          }
          else {
            if (rand < 0.8){
              // 80% chances to stay in your lane
              targetNode = availableNodes[1];
              updatePosition = true;
            } else {
              // 20% chances to walk to the left
              targetNode = availableNodes[0];
              updatePosition = true;
            }
          }
          
          // Move person to new node
          if (updatePosition) {
            targetNode.occupied = node.occupied;
            node.occupied.currentNode = targetNode;
            node.occupied = null;
          }
        }
      });
    }
    
    const moveStandersInQueue = (shuffledNodes, aboveLevelHalf) => {

      shuffledNodes.forEach(node => {
        // Find available connections
        const availableNodes = node.connections.filter(n => !n.occupied);
        
        if (availableNodes.length > 0) {
          // sorted connections by distance to the middle
          availableNodes.sort((a, b) => 
            Math.abs(a.index - aboveLevelHalf) - Math.abs(b.index - aboveLevelHalf)
          );

          // Check if the last node is further than the current node from the middle
          const isLastFurther = availableNodes[availableNodes.length-1].index >= aboveLevelHalf 
            ? node.index >= aboveLevelHalf && node.index === availableNodes[availableNodes.length-1].index
            : availableNodes[availableNodes.length-1].index < node.index -1;
          
          const rand = Math.random();
          let targetNode = undefined;
          let updatePosition = false;

          if (availableNodes.length === 1){
            if (this.strategy === "S2" && availableNodes[0].index === 0){
              // leftmost nodes are reserved for walkers
              return
            } else if (isLastFurther && rand > 0.75){
              // only 25% chances to walk further away from the middl
              targetNode = availableNodes[0];
              updatePosition = true;
            } else if (!isLastFurther){
              targetNode = availableNodes[0];
              updatePosition = true;
            } 
          } else if (availableNodes.length === 2 && isLastFurther) {
              // do not walk further away from the middle
              targetNode = availableNodes[0];
              updatePosition = true;
          } else {
            if (rand < 0.66){
              // 66% chances to walk towards the middle
              targetNode = availableNodes[0];
              updatePosition = true;
            } else {
              // 33% chances to stay in your lane
              targetNode = availableNodes[1];
              updatePosition = true;
            }
          }
          
          // Move person to new node
          if (updatePosition) {
            targetNode.occupied = node.occupied;
            node.occupied.currentNode = targetNode;
            node.occupied = null;
          }
        }
      });
    }

    // escalator logic for level 0
    // TODO cahnge escalator logic to use coordinates
    for (let i = 0; i < this.escalatorLevels.length; i++) {
      const level = this.escalatorLevels[i];
      level.forEach( (node,j) => {
        if (node.occupied) {
          const person = node.occupied;
          // TODO
          const iterations = 1 + person.walkingSpeed ;
          
          let startingPoint = i
          let iteration = 1;

          while (true) {
            if (startingPoint === 0) {
              // person is done
              person.done = true;
              this.finishedCount++;
              this.onEscalator--;
              person.currentNode.occupied = null;
              break;
            }

            const nextNode = person.currentNode.connections[0];
            if (nextNode.occupied) {
              // In that case the walker is blocked and keeps progressing at the same speed
              person.walkingSpeed = nextNode.occupied.walkingSpeed;
              break;
            } else {
              // otherwise move up
              nextNode.occupied = person;
              person.currentNode.occupied = null;
              person.currentNode = nextNode;
            }
            startingPoint--;
            iteration++;
            if ( iteration > iterations) break;
          }
        }
      });
    }

    // Moving people on the escalator
    for (let j=0; j < this.queueLevels[0].length; j++) {
      const node = this.queueLevels[0][j];
      if (node.occupied) {
        const person = node.occupied;
        const nextNode = this.escalatorLevels[this.escalatorLevels.length - 1][j];
        if (!nextNode.occupied) {
          nextNode.occupied = person;
          person.currentNode.occupied = null;
          person.currentNode = nextNode;
          this.inQueue--;
          this.onEscalator++;
        }
      }
    }

    // Process levels from top to bottom
    for (let level = 1; level < this.queueLevels.length; level++) {
      const currentLevel = this.queueLevels[level];
      const aboveLevel = this.queueLevels[level - 1];
      const aboveLevelHalf = Math.floor(aboveLevel.length/2);
      
      const occupiedNodes = currentLevel.filter(node => node.occupied);
      // Randomize order of nodes in level
      const shuffleWalkers = occupiedNodes
        .filter(node => node.occupied.isWalking)
        .sort(() => Math.random() - 0.5);
      const shuffleStanders = occupiedNodes
        .filter(node => !node.occupied.isWalking)
        .sort(() => Math.random() - 0.5);

      moveWalkersInQueue(shuffleWalkers);
      moveStandersInQueue(shuffleStanders, aboveLevelHalf);
    
    }
  }

  step({
    walkSpeedMean,
    walkSpeedStd,
    walkProbability,
    timescale,
    newCount,
  }) {

    let remainingNewCount = newCount;
    const partialCount = Math.floor(newCount / timescale);

    for (let i = 0; i < timescale; i++) {

      const stepNewCount = remainingNewCount < 2 * partialCount ? remainingNewCount : partialCount;


      // Add new people
      this.addNewPeople(
        stepNewCount, 
        walkProbability, 
        walkSpeedMean, 
        walkSpeedStd
      );
      
      if (!this.bloated) {
        // Move people
        this.movePeople(timescale);

        this.cleanPeople();
      }

      remainingNewCount -= stepNewCount; 

      //console.log(this.people, this.inQueue, this.onEscalator, this.finishedCount);
    }

    // Return metrics
    return {
      people: this.people.map(p => ({ ...p })), // Return copy of people array
      finishedCount: this.finishedCount,
      queueCount: this.inQueue,
      escalatorCount: this.onEscalator,
      bloated: this.bloated,
    };
  }

  runEscalatorSimulation({
    walkSpeedMean,
    walkSpeedStd,
    walkProbability,
    timestamp,
    timescale,
    newCount,
  }) {
    console.log(`Running simulation ${timestamp} ${this.strategy}`)
    console.log(this.people.map(p => ({ ...p })));
    console.log(this.inQueue, this.onEscalator, this.finishedCount);
    return {
      timestamp,
      ...this.step({
        walkSpeedMean,
        walkSpeedStd,
        walkProbability,
        timescale,
        newCount,
      })
    }
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
 * 3) STRATEGY SIMULATION COMPONENT
 *
 *    Renders the canvas and a "Reset" button.
 *******************************************************/
function StrategySimulation(props) {
  const {
    strategyLabel,
    escalatorLength, //escalatorLength
    graphQueueLevelsBase, //maxWidth
    timestamp,
    people,
    finishedCount,
  } = props;

  // Drawing
  const canvasRef = useRef(null);

  useEffect(() => {

    const y = ESCALATOR_TOP_Y/escalatorLength;
    const x = (CANVAS_WIDTH - 50) / graphQueueLevelsBase ;

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
      const node = p.currentNode;
      const pY = (node.level + p.onEscalator ? 0 : escalatorLength )* y + y / 2 ;
      const pX =  CANVAS_WIDTH / 2 + (node.index - 1 - p.onEscalator ? 0 : (node.level)) * x;
      ctx.beginPath();
      ctx.arc(pX , pY, PERSON_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = p.isWalking ?  "#c6005c" : "#007595" ;
      ctx.fill();
    });
  }, [people, escalatorLength, graphQueueLevelsBase]);

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
 * 4) METRICS TILES
 *******************************************************/

// Metric card component for displaying individual statistics
const MetricCard = ({ title, value }) => (
  <div className="bg-gray-100 dark:bg-gray-100/10 p-4 rounded-lg shadow">
    <h3 className="text-sm font-medium text-gray-500">{title}</h3>
    <p className="mt-1 text-2xl font-semibold">{value}</p>
  </div>
);
  
/*******************************************************
 * 5) MAIN APP: MANAGES INPUTS & DISPLAYS RECHARTS LINECHART
 *******************************************************/
export default function PittiViz() {
  // 5.1) Simulation parameters
  const [escalatorLength, setEscalatorLength] = useState(100);
  const [escalatorSpeed, setEscalatorSpeed] = useState(2);

  const [arrivalRate, setArrivalRate] = useState(1.0);
  const [walkSpeedMean, setWalkSpeedMean] = useState(2);
  const [walkSpeedStd, setWalkSpeedStd] = useState(0.3);
  // Probability of walking for Strategy 2
  const [walkProbability, setWalkProbability] = useState(0.2);

  // For the arrival logic
  const arrivalAccumulatorRef = useRef(0);

  // 5.2) Time controls
  const currentTimeRef = useRef(0);
  const [timeScale, setTimeScale] = useState(1.0);
  const [paused, setPaused] = useState(false);

  // 5.3) Each strategy’s data
  const [dataS1, setDataS1] = useState([]);
  const [dataS2, setDataS2] = useState([]);
  const graph1Ref = useRef( 
    new EscalatorGraph(
      "S1", 
      ESCALATOR_TOP_Y, 
      CANVAS_HEIGHT - ESCALATOR_TOP_Y, 
      escalatorLength,
      escalatorSpeed
    ) 
  )
  const graph2Ref = useRef(
    new EscalatorGraph(
      "S2", 
      ESCALATOR_TOP_Y, 
      CANVAS_HEIGHT - ESCALATOR_TOP_Y, 
      escalatorLength,
      escalatorSpeed
    )
  );
  
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

  // 5.4) Build a merged array for Recharts
  const mergedData = mergeByTimestamp(dataS1, dataS2);

  // 5.5) Setup effect: start or reset simulation on param changes
  useEffect(() => {
      let intervalId = null;

      // The tick interval in ms is proportional to the escalator speed (can be accelerated with time scale) so people move up the graph at each tick
      const tick = 1 / escalatorSpeed;

      if (!paused) {
        intervalId = setInterval(() => {
          // Tick every 0.1s
          const newTime = ( currentTimeRef.current || 0 ) + tick * timeScale;
          currentTimeRef.current = newTime;
          // Then run your simulation logic with dt=0.1 * timeScale
          updateSimulation( timeScale, newTime);
        }, tick * 1000 );
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

  // 5.6) Reset function
  function resetSimulation() {
    currentTimeRef.current = 0;
    graph1Ref.current = new EscalatorGraph(
      "S1",
      ESCALATOR_TOP_Y, 
      CANVAS_HEIGHT - ESCALATOR_TOP_Y, 
      escalatorLength,
      escalatorSpeed
    );
    graph2Ref.current = new EscalatorGraph(
      "S2",
      ESCALATOR_TOP_Y, 
      CANVAS_HEIGHT - ESCALATOR_TOP_Y, 
      escalatorLength,
      escalatorSpeed
    );
    setDataS1([]);
    setDataS2([]);
    arrivalAccumulatorRef.current = 0;
  }

  // 5.7) Main update loop
  function updateSimulation(timescale, timestamp) {

    // Accumulate fractional arrivals
    arrivalAccumulatorRef.current += arrivalRate / escalatorSpeed * timescale;
    let newCount = Math.floor(arrivalAccumulatorRef.current);
    arrivalAccumulatorRef.current -= newCount;

    // Run the simulation for each strategy
    const newS1Data = graph1Ref.current.runEscalatorSimulation({
      walkSpeedMean,
      walkSpeedStd,
      walkProbability: 0,
      timestamp,
      timescale,
      newCount
    })

    const newS2Data = graph2Ref.current.runEscalatorSimulation({
      walkSpeedMean,
      walkSpeedStd,
      walkProbability,
      timestamp,
      timescale,
      newCount,
    })
    
    // Use a single setState call to batch updates
    setDataS1(prev => [
      ...prev, 
      {
        timestamp: newS1Data.timestamp, 
        finishedCount: newS1Data.finishedCount, 
        queueCount: newS1Data.queueCount,
        escalatorCount: newS1Data.escalatorCount
      }
    ]);
    setDataS2(prev => [
      ...prev, 
      {
        timestamp: newS2Data.timestamp, 
        finishedCount: newS2Data.finishedCount, 
        queueCount: newS2Data.queueCount,
        escalatorCount: newS2Data.escalatorCount
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
              min="0.2"
              className="border p-2 w-full rounded-lg text-center"
              value={escalatorSpeed}
              onChange={(e) => setEscalatorSpeed(Math.min(Number(e.target.value),0.2))}
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
                  {graph1Ref?.current && 
                    <StrategySimulation
                      strategyLabel="All standing"
                      escalatorLength={escalatorLength}
                      graphQueueLevelsBase={graph1Ref.current.queueLevels[graph1Ref.current.queueLevels.length-1].length}
                      timestamp={graph1Ref.current.timestamp}
                      people={graph1Ref.current.people}
                      finishedCount={graph1Ref.current.finishedCount}
                  />
}
              </div>
              <div className="flex flex-col items-center bg-gray-100 dark:bg-gray-100/10 p-4 rounded-lg shadow">
                {graph2Ref?.current &&
                  <StrategySimulation
                      strategyLabel="Walkers"
                      escalatorLength={escalatorLength}
                      graphQueueLevelsBase={graph2Ref.current.queueLevels[graph2Ref.current.queueLevels.length-1].length}
                      timestamp={graph2Ref.current.timestamp}
                      people={graph2Ref.current.people}
                      finishedCount={graph2Ref.current.finishedCount}
                  />
                }
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
              value={graph1Ref.current.finishedCount}
              />
              <MetricCard 
              title="Current Queue Length" 
              value={graph1Ref.current.queueCount}
              />
              <MetricCard 
              title="Total Throughput" 
              value={`${(graph1Ref.current.finishedCount * 60 / (graph1Ref.current.timestamp||1)).toFixed(2)}/min`}
              />
              <MetricCard 
              title="Last Minute Throughput" 
              value={`${(lastMinuteS1.throughput *60 ).toFixed(2)}/min`}
              />
              <div className="text-pink-700">Strategy 2 : Walkers </div>
              <MetricCard 
              title="People Processed" 
              value={graph2Ref.current.finishedCount}
              />
              <MetricCard 
              title="Current Queue Length" 
              value={graph2Ref.current.queueCount}
              />
              <MetricCard 
              title="Total Throughput" 
              value={`${(graph2Ref.current.finishedCount *60 / (graph2Ref.current.timestamp || 1)).toFixed(2)}/min`}
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

