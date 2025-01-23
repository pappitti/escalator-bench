import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

class EscalatorSimulation {
    constructor({
        escalatorLength,        // Length in steps
        escalatorSpeed,         // Steps per second
        arrivalRate,           // People per second
        walkingPercentage,     // Percentage who want to walk (0-1)
        baseWalkingSpeed,      // Additional steps per second for walkers
        walkingSpeedVariation, // Standard deviation of walking speed
        simulationDuration,    // Total simulation time in seconds
        strategy               // 'standing' or 'walking'
    }) {
        this.config = {
            escalatorLength,
            escalatorSpeed,
            arrivalRate,
            walkingPercentage,
            baseWalkingSpeed,
            walkingSpeedVariation,
            simulationDuration,
            strategy
        };
      
        // Initialize state
        this.reset();
    }
  
    reset() {
        this.time = 0;
        this.queue = [];           // People waiting at bottom
        this.onEscalator = [];     // People currently on escalator
        this.completed = [];       // People who reached top
        this.metrics = {
            totalWaitTime: 0,
            maxQueueLength: 0,
            peopleProcessed: 0,
            averageJourneyTime: 0
        };
    }
  
    // Generate a new person with their properties
    createPerson(arrivalTime) {
      const wantsToWalk = Math.random() < this.config.walkingPercentage;
      const walkingSpeed = wantsToWalk ? 
        this.config.baseWalkingSpeed + (Math.random() * 2 - 1) * this.config.walkingSpeedVariation : 
        0;
  
      return {
        id: Math.random().toString(36).substr(2, 9),
        arrivalTime,
        wantsToWalk,
        walkingSpeed,
        position: 0,              // Current step position
        startTime: null,          // When they start on escalator
        completionTime: null      // When they reach the top
      };
    }
  
    // Try to add people from queue to escalator
    processQueue() {
        if (this.queue.length === 0) return;
    
        if (this.config.strategy === 'standing') {
            // For standing strategy, we can put two people per step
            while (this.queue.length > 0) {
                const stepNumber = Math.floor(this.onEscalator.length / 2);
                if (stepNumber >= this.config.escalatorLength) break;
                
                const person = this.queue.shift();
                person.startTime = this.time;
                person.position = 0;
                this.onEscalator.push(person);
            }
        } else {
            // For walking strategy, we need to check both lanes
            const rightLane = this.onEscalator.filter(p => !p.wantsToWalk);
            const leftLane = this.onEscalator.filter(p => p.wantsToWalk);
            
            while (this.queue.length > 0) {
                const person = this.queue[0];
                const personLane = person.wantsToWalk ? leftLane : rightLane;
                const stepNumber = personLane.length;
                
                if (stepNumber >= this.config.escalatorLength) break;
                
                this.queue.shift();
                person.startTime = this.time;
                person.position = 0;
                this.onEscalator.push(person);
                
                if (person.wantsToWalk) {
                    leftLane.push(person);
                } else {
                    rightLane.push(person);
                }
            }
        }
    }
  
    // Move people up the escalator
    moveEscalator() {
      // Sort people by position (descending) to avoid overtaking conflicts
      this.onEscalator.sort((a, b) => b.position - a.position);
      
      for (let person of this.onEscalator) {
        const baseMove = this.config.escalatorSpeed;
        const walkingBonus = this.config.strategy === 'walking' && person.wantsToWalk ? 
          person.walkingSpeed : 0;
        
        // Calculate potential new position
        let newPosition = person.position + baseMove + walkingBonus;
        
        // Check for collision with person ahead
        const personAhead = this.onEscalator.find(p => 
          p.position > person.position && p.position <= newPosition
        );
        
        if (personAhead) {
          // If collision would occur, only move up to the person ahead
          newPosition = personAhead.position;
        }
        
        person.position = newPosition;
      }
      
      // Remove people who reached the top
      const completed = this.onEscalator.filter(p => 
        p.position >= this.config.escalatorLength
      );
      
      for (let person of completed) {
        person.completionTime = this.time;
        this.completed.push(person);
        this.metrics.totalWaitTime += person.completionTime - person.arrivalTime;
        this.metrics.peopleProcessed++;
      }
      
      this.onEscalator = this.onEscalator.filter(p => 
        p.position < this.config.escalatorLength
      );
    }
  
    // Run one step of the simulation
    step() {
      // Generate new arrivals based on arrival rate
      const newArrivals = Math.random() < this.config.arrivalRate ? 1 : 0;
      for (let i = 0; i < newArrivals; i++) {
        this.queue.push(this.createPerson(this.time));
      }
      
      // Update metrics
      this.metrics.maxQueueLength = Math.max(
        this.metrics.maxQueueLength, 
        this.queue.length
      );
      
      // Process queue and move escalator
      this.processQueue();
      this.moveEscalator();
      
      // Increment time
      this.time++;
      
      // Calculate average journey time
      if (this.completed.length > 0) {
        this.metrics.averageJourneyTime = 
          this.metrics.totalWaitTime / this.metrics.peopleProcessed;
      }
      
      return {
        time: this.time,
        queueLength: this.queue.length,
        peopleOnEscalator: this.onEscalator.length,
        peopleCompleted: this.completed.length,
        metrics: { ...this.metrics }
      };
    }
  
    // Run the full simulation
    runSimulation() {
      this.reset();
      const results = [];
      
      while (this.time < this.config.simulationDuration) {
        const stepResult = this.step();
        results.push(stepResult);
      }
      
      return results;
    }
  }

// ConfigInput component for consistent form styling
const ConfigInput = ({ label, value, onChange, type = "number", step = "1", min, max }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      step={step}
      min={min}
      max={max}
      className="w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
    />
  </div>
);

// Results display component
const SimulationResults = ({ results }) => {
  if (!results.length) return null;
  
  const finalMetrics = results[results.length - 1].metrics;
  
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Queue Length Over Time</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={results}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="time" 
                label={{ value: 'Time (seconds)', position: 'bottom' }} 
              />
              <YAxis 
                label={{ value: 'Number of People', angle: -90, position: 'left' }} 
              />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="queueLength" 
                stroke="#8884d8" 
                name="Queue Length" 
              />
              <Line 
                type="monotone" 
                dataKey="peopleOnEscalator" 
                stroke="#82ca9d" 
                name="On Escalator" 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard 
          title="Average Journey Time" 
          value={`${finalMetrics.averageJourneyTime.toFixed(1)}s`}
        />
        <MetricCard 
          title="People Processed" 
          value={finalMetrics.peopleProcessed}
        />
        <MetricCard 
          title="Max Queue Length" 
          value={finalMetrics.maxQueueLength}
        />
        <MetricCard 
          title="Throughput" 
          value={`${(finalMetrics.peopleProcessed / results.length).toFixed(2)}/s`}
        />
      </div>
    </div>
  );
};

// Metric card component for displaying individual statistics
const MetricCard = ({ title, value }) => (
  <div className="bg-white p-4 rounded-lg shadow">
    <h3 className="text-sm font-medium text-gray-500">{title}</h3>
    <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
  </div>
);

// Main component
const ClaudeViz = () => {
  const [config, setConfig] = useState({
    escalatorLength: 50,
    escalatorSpeed: 1,
    arrivalRate: 0.5,
    walkingPercentage: 0.3,
    baseWalkingSpeed: 2,
    walkingSpeedVariation: 0.5,
    simulationDuration: 300,
    strategy: 'standing'
  });

  const [results, setResults] = useState([]);

  const handleConfigChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const runSimulation = () => {
    const sim = new EscalatorSimulation(config);
    const simResults = sim.runSimulation();
    setResults(simResults);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
        <div><em>Note : Claude built this in one shot (technically 2 because the output exceeded the maximum length so we had to ask a second time to finish)</em></div>
      <h1 className="text-3xl font-bold mb-8">Escalator Strategy Simulator</h1>
      
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Basic Configuration</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Strategy
              </label>
              <select
                value={config.strategy}
                onChange={(e) => handleConfigChange('strategy', e.target.value)}
                className="w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="standing">Everyone Standing</option>
                <option value="walking">Walking Allowed</option>
              </select>
            </div>

            <ConfigInput
              label="Escalator Length (steps)"
              value={config.escalatorLength}
              onChange={(v) => handleConfigChange('escalatorLength', v)}
              min={1}
            />
            
            <ConfigInput
              label="Arrival Rate (people/second)"
              value={config.arrivalRate}
              onChange={(v) => handleConfigChange('arrivalRate', v)}
              step="0.1"
              min={0}
            />
            
            <ConfigInput
              label="Walking Percentage"
              value={config.walkingPercentage}
              onChange={(v) => handleConfigChange('walkingPercentage', v)}
              step="0.1"
              min={0}
              max={1}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Advanced Settings</h2>
            
            <ConfigInput
              label="Escalator Speed (steps/second)"
              value={config.escalatorSpeed}
              onChange={(v) => handleConfigChange('escalatorSpeed', v)}
              step="0.1"
              min={0.1}
            />
            
            <ConfigInput
              label="Base Walking Speed (additional steps/second)"
              value={config.baseWalkingSpeed}
              onChange={(v) => handleConfigChange('baseWalkingSpeed', v)}
              step="0.1"
              min={0}
            />
            
            <ConfigInput
              label="Walking Speed Variation"
              value={config.walkingSpeedVariation}
              onChange={(v) => handleConfigChange('walkingSpeedVariation', v)}
              step="0.1"
              min={0}
            />
            
            <ConfigInput
              label="Simulation Duration (seconds)"
              value={config.simulationDuration}
              onChange={(v) => handleConfigChange('simulationDuration', v)}
              min={1}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-center mb-8">
        <button
          onClick={runSimulation}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Run Simulation
        </button>
      </div>

      <SimulationResults results={results} />
    </div>
  );
};

export default ClaudeViz;