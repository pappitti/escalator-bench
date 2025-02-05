/****************************************************** 
 * LICENCE : GEMINI 2 PRO EXPERIMENTAL OUTPUT
*******************************************************/

import React, { useState, useEffect, useRef } from 'react';

class Simulator {
    constructor(options) {
        this.options = {
            escalatorLength: options.escalatorLength || 10, // in meters, for example
            escalatorSpeed: options.escalatorSpeed || 0.5, // meters per second
            numPeople: options.numPeople || 100,
            percentWalking: options.percentWalking || 0.3,
            avgWalkingSpeed: options.avgWalkingSpeed || 1.34, // Average human walking speed (m/s)
            walkingSpeedStdDev: options.walkingSpeedStdDev || 0.2, // Standard deviation for walking speed
            timeStep: options.timeStep || 0.1, // seconds, Simulation time step
             ...options,
        };
        this.time = 0;
        this.people = [];
        this.peopleAtTop = 0;
        this.peopleAtBottom = 0;
        this.lastArrivalTimes = []; // to calculate flow, a queue of arrival times
        this.isFinished = false; //we add this flag to tell the animation that no more calculations are needed
        this.reset(); // Initialize the simulation
    }

    reset() {
        this.time = 0;
        this.people = [];
        this.peopleAtTop = 0;
        this.peopleAtBottom = this.options.numPeople;
        this.lastArrivalTimes = [];
        this.isFinished = false;
        // Create initial people
        for (let i = 0; i < this.options.numPeople; i++) {
            this.addPerson();
        }
    }

    addPerson() {
        const isWalker = Math.random() < this.options.percentWalking;
        let walkingSpeed = 0;
        if (isWalker) {
             // Sample from a normal distribution
             walkingSpeed = this.options.avgWalkingSpeed + (this.randomNormal() * this.options.walkingSpeedStdDev);
            walkingSpeed = Math.max(0, walkingSpeed); // Ensure speed is not negative
        }

        const person = {
            id: this.people.length,
            isWalker: isWalker,
            walkingSpeed: walkingSpeed,
            position: 0, // Position on the escalator (0 = bottom, escalatorLength = top)
            isOnEscalator: false,
            finished: false, // True when the person reaches the top

        };
        this.people.push(person);
    }

    // Helper function for generating normally distributed random numbers (Box-Muller transform)
    randomNormal() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random(); //Converting [0,1) to (0,1)
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    update() {
    if (this.isFinished) return; // Optimization: Stop updating if the simulation is finished
        this.time += this.options.timeStep;
      this.peopleAtBottom = 0; //recount to avoid approximations

    // 1. Move people onto the escalator
    for (const person of this.people) {
        if (!person.finished) { //only consider those who haven't reached the top
            if (!person.isOnEscalator) {
                // Check if the person can get on the escalator (simplified queuing)
                let canGetOn = false;

              if(this.options.percentWalking === 0){ //strategy 1: always get on
                canGetOn = true
              } else {  //strategy 2: check the lanes
                  if(person.isWalker){
                    canGetOn = true; // Simplified: Walkers always have space.  In a more complex model, you'd check for space in the walking lane.
                  } else {
                      //check that not blocked by walkers
                      canGetOn = true;
                  }
                }

                if (canGetOn) {
                    person.isOnEscalator = true;
                } else {
                    this.peopleAtBottom += 1;
                }
            }
        }
    }

    // 2. Move people up the escalator
    for (const person of this.people) {
        if (person.isOnEscalator && !person.finished) {
            let speed = person.isWalker ? person.walkingSpeed + this.options.escalatorSpeed : this.options.escalatorSpeed;
          
             // Overtaking logic (simplified):
            if (person.isWalker) {
                const personAhead = this.people.find(p => p.isOnEscalator && p.position > person.position && !p.finished);
              if (personAhead) {
                   const distanceToAhead = personAhead.position - person.position;
                    // Adjust speed based on the person ahead (simplified)
                    if (distanceToAhead < 0.5) { // Adjust this threshold as needed
                        speed = Math.min(speed, personAhead.walkingSpeed + this.options.escalatorSpeed);
                    }
                }
            }
          

            person.position += speed * this.options.timeStep;

            // Check if the person reached the top
            if (person.position >= this.options.escalatorLength) {
                person.position = this.options.escalatorLength; // Ensure they don't go past the top
                person.finished = true;
                this.peopleAtTop++;
                this.lastArrivalTimes.push(this.time);
                // Keep only the last 60 seconds of arrival times
                while (this.lastArrivalTimes.length > 0 && this.lastArrivalTimes[0] < this.time - 60) {
                    this.lastArrivalTimes.shift();
                }
            }
        }
    }
      // Check if simulation is complete
    this.isFinished = this.people.every(p => p.finished);
}

    getFlowRate() {
        // People per minute
        return this.lastArrivalTimes.length;
    }

    getState() {
        return {
            time: this.time,
            people: this.people,
            peopleAtTop: this.peopleAtTop,
            flowRate: this.getFlowRate(),
            peopleAtBottom: this.peopleAtBottom,
            isFinished: this.isFinished,
        };
    }
}

const EscalatorVisualisation = ({ people, escalatorLength, isFinished }) => {
    const canvasRef = useRef(null);
    const escalatorHeightPixels = 300; // Fixed height for the visualization
    const escalatorWidthPixels = 100;
    const peopleRadius = 3;

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw the escalator
        ctx.beginPath();
        ctx.strokeStyle = 'gray';
        ctx.lineWidth = 2;

       //strategy 2 division
        if(people.length && people[0].isWalker !== undefined){
            ctx.moveTo(canvas.width / 4, 0); //top left
            ctx.lineTo(canvas.width / 4 , canvas.height); //bottom left
        }

        ctx.stroke();

        // Draw people as dots
        people.forEach(person => {
           if (!person.finished) { //don't draw those who have finished
                let x, y;

                if (!person.isOnEscalator) {
                    // Position at the bottom, waiting
                    y = canvas.height - peopleRadius - 5; // Slightly above the bottom
                    //x depends on whether they are walkers
                    x = person.isWalker ?  Math.random() * (canvas.width/2-2*peopleRadius) : canvas.width/2 + Math.random() * (canvas.width/2 -2*peopleRadius)
                } else {
                    // Calculate y based on position along escalator
                    y = canvas.height - (person.position / escalatorLength) * escalatorHeightPixels;
                    //x now fixed
                    x = person.isWalker ? canvas.width / 4 : canvas.width*3/4;  // Adjust x for standing/walking lanes
                }

                ctx.beginPath();
                ctx.arc(x, y, peopleRadius, 0, 2 * Math.PI);
                ctx.fillStyle = person.isWalker ? 'blue' : 'red'; // Different colors for walkers and standers
                ctx.fill();
            }
        });

    }, [people, escalatorLength, isFinished]); // Redraw whenever people or escalatorLength changes

    return (
        <canvas
            ref={canvasRef}
            width={escalatorWidthPixels}
            height={escalatorHeightPixels}
            style={{ border: '1px solid black' }} // Add a border for clarity
        />
    );
};

const InputForm = ({ options, onChange, onReset }) => {
    const handleChange = (event) => {
        const { name, value } = event.target;
        // Convert value to number if necessary
        const numValue = isNaN(Number(value)) ? value : Number(value);

        onChange({ ...options, [name]: numValue });
    };

    return (
      <div className="space-y-4">
        <div>
          <label htmlFor="escalatorLength" className="block text-sm font-medium text-gray-700">Escalator Length (m)</label>
          <input
            type="number"
            id="escalatorLength"
            name="escalatorLength"
            value={options.escalatorLength}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label htmlFor="escalatorSpeed" className="block text-sm font-medium text-gray-700">Escalator Speed (m/s)</label>
          <input
            type="number"
            id="escalatorSpeed"
            name="escalatorSpeed"
            value={options.escalatorSpeed}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label htmlFor="numPeople" className="block text-sm font-medium text-gray-700">Number of People</label>
          <input
            type="number"
            id="numPeople"
            name="numPeople"
            value={options.numPeople}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label htmlFor="percentWalking" className="block text-sm font-medium text-gray-700">Percentage Walking (%)</label>
          <input
            type="number"
            id="percentWalking"
            name="percentWalking"
            value={options.percentWalking}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label htmlFor="avgWalkingSpeed" className="block text-sm font-medium text-gray-700">Average Walking Speed (m/s)</label>
          <input
            type="number"
            id="avgWalkingSpeed"
            name="avgWalkingSpeed"
            value={options.avgWalkingSpeed}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label htmlFor="walkingSpeedStdDev" className="block text-sm font-medium text-gray-700">Walking Speed Standard Deviation</label>
          <input
            type="number"
            id="walkingSpeedStdDev"
            name="walkingSpeedStdDev"
            value={options.walkingSpeedStdDev}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Reset
        </button>
      </div>
  );
};

const Gemini2ProViz = () => {
    const [options, setOptions] = useState({
        escalatorLength: 20,
        escalatorSpeed: 0.75,
        numPeople: 200,
        percentWalking: 0.4,
        avgWalkingSpeed: 1.34,
        walkingSpeedStdDev: 0.3,
        timeStep: 0.1,
    });

    const [simulationState, setSimulationState] = useState({
      time: 0,
      people: [],
      peopleAtTop: 0,
      flowRate: 0,
      peopleAtBottom: 0,
      isFinished: false,
    });

    const simulatorRef = useRef(null);

    useEffect(() => {
        simulatorRef.current = new Simulator(options);  //create the simulator
          // Get initial state to render the visualisation at t=0
          setSimulationState(simulatorRef.current.getState());
    }, [options.numPeople, options.percentWalking]); // Re-create Simulator only when crucial parameters change

    useEffect(() => {
        let animationFrameId;

       const runSimulationStep = () => {
          if (simulatorRef.current && !simulatorRef.current.isFinished) {
                simulatorRef.current.update(); //simulator computes next step
                setSimulationState(simulatorRef.current.getState());//we retrieve the new state
                animationFrameId = requestAnimationFrame(runSimulationStep); // Continue the loop
            }
        };
        // Start simulation only if not yet finished
      if (!simulationState.isFinished) {
          runSimulationStep();
      }

        return () => cancelAnimationFrame(animationFrameId);
    }, [simulationState.isFinished]); // Re-run this effect only when isFinished changes


    const handleReset = () => {
        simulatorRef.current = new Simulator(options); //reset also create a new simulation
        setSimulationState(simulatorRef.current.getState()); //and retrieves state
    };


  //Calculate Strategy 1
  const standingFlowRate = options.numPeople / (options.escalatorLength / options.escalatorSpeed) /60;
  const standingPeopleAtBottom = Math.max(0, options.numPeople - simulationState.time * options.escalatorSpeed / options.escalatorLength);

    return (
        <div className="w-full h-full flex flex-col items-center justify-start">
            <div><em>Note : Gemini 2.0 Pro Experimental built this in one shot </em></div>
        <div className="container mx-auto p-4 flex">
            <div className="w-1/3 pr-4">
            <h1 className="text-2xl font-bold mb-4">Escalator Simulator</h1>
            <InputForm options={options} onChange={setOptions} onReset={handleReset} />
            </div>
            <div className="w-2/3">
                <EscalatorVisualisation
                    people={simulationState.people}
                    escalatorLength={options.escalatorLength}
                    isFinished={simulationState.isFinished}
                />
            <div className="mt-4">
                <p>Time: {simulationState.time.toFixed(1)}s</p>
                <p>People at Top: {simulationState.peopleAtTop}</p>
                <p>Flow Rate: {simulationState.flowRate} people/min</p>
                <p> People at Bottom: {Math.floor(simulationState.peopleAtBottom)}</p>
                <p className="mt-4 font-bold">Strategy 1 (Standing Only):</p>
            <p>Flow Rate: {standingFlowRate.toFixed(1)} people/min</p>
            <p>People at Bottom: {Math.floor(standingPeopleAtBottom)}</p>
            </div>
            </div>
        </div>
        </div>
    );
};


export default Gemini2ProViz;