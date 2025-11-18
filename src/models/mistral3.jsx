/****************************************************** 
 * LICENSE : MISTRAL (LE CHAT)
*******************************************************/

import React, { useEffect, useState } from 'react';

class EscalatorSimulation {
    constructor(length, speed, totalPeople, walkPercentage, avgWalkSpeed, walkSpeedStdDev) {
      this.length = length;
      this.speed = speed;
      this.totalPeople = totalPeople;
      this.walkPercentage = walkPercentage;
      this.avgWalkSpeed = avgWalkSpeed;
      this.walkSpeedStdDev = walkSpeedStdDev;
      this.people = this.generatePeople();
      this.time = 0;
    }
  
    generatePeople() {
      const people = [];
      for (let i = 0; i < this.totalPeople; i++) {
        const willWalk = Math.random() < this.walkPercentage;
        const walkSpeed = willWalk ? this.normalRandom(this.avgWalkSpeed, this.walkSpeedStdDev) : 0;
        people.push({ willWalk, walkSpeed, position: 0 });
      }
      return people;
    }
  
    normalRandom(mean, stdDev) {
      let u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * stdDev + mean;
    }
  
    update() {
      this.time += 1; // Increment time by 1 second
      this.people.forEach(person => {
        const speed = person.willWalk ? person.walkSpeed + this.speed : this.speed;
        person.position += speed;
      });
      this.people = this.people.filter(person => person.position < this.length);
    }
  
    getStats() {
      const atTop = this.people.filter(person => person.position >= this.length).length;
      const atBottom = this.people.filter(person => person.position === 0).length;
      return { atTop, atBottom };
    }
  }

const MistralViz = () => {
    const [simulation, setSimulation] = useState(null);
  const [stats, setStats] = useState({ atTop: 0, atBottom: 0 });

  useEffect(() => {
    const sim = new EscalatorSimulation(50, 0.5, 100, 0.3, 1.2, 0.2);
    setSimulation(sim);

    const interval = setInterval(() => {
      sim.update();
      setStats(sim.getStats());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4 w-full">
        <div><em>Note : Mistral [free model in the Le CHAT app on Feb 7th, 2025] built this in one shot.</em></div>
    <div className="flex">
      <div className="w-1/2 p-4">
        <h2 className="text-xl font-bold mb-4">Inputs</h2>
        <div className="mb-4">
          <label className="block text-gray-700">Escalator Length (m)</label>
          <input type="number" className="border border-gray-300 p-2 w-full" />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Escalator Speed (m/s)</label>
          <input type="number" className="border border-gray-300 p-2 w-full" />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Number of People</label>
          <input type="number" className="border border-gray-300 p-2 w-full" />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Percentage Walking Up</label>
          <input type="number" className="border border-gray-300 p-2 w-full" />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Average Walking Speed (m/s)</label>
          <input type="number" className="border border-gray-300 p-2 w-full" />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Walking Speed Std Dev</label>
          <input type="number" className="border border-gray-300 p-2 w-full" />
        </div>
      </div>
      <div className="w-1/2 p-4">
        <h2 className="text-xl font-bold mb-4">Escalator Animation</h2>
        <div className="border border-gray-300 h-64 relative">
          {simulation && simulation.people.map((person, index) => (
            <div
              key={index}
              className="w-2 h-2 bg-blue-500 absolute"
              style={{ bottom: `${person.position * 2}px`, left: person.willWalk ? '50%' : '25%' }}
            />
          ))}
        </div>
        <div className="mt-4">
          <h3 className="text-lg font-bold">Statistics</h3>
          <p>People at Top: {stats.atTop}</p>
          <p>People at Bottom: {stats.atBottom}</p>
        </div>
      </div>
    </div>
    </div>
  );
};
  
//

export default MistralViz;
