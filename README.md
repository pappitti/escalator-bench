# Escalator Simulation Benchmark

For three weeks in 2015, researchers asked [commuters in London](https://www.bbc.co.uk/news/uk-england-london-34926581) not to walk up the escaltoro to find out the optimal strategy at busy hours.  
This seems like reasonably easy thing to model and simulate without annoying anyone for three weeks. So we decided to ask different AI models to do the work... in less than 5 minutes.

## Prompt

```
# Project description  
I want to build a model to assess the optimal escalator strategy when stations are busy. Let's assume that an escalator is wide enough for two people  
-strategy 1 : everyone stands still on the escalator, with two people on each step   
-strategy 2 : people who do not want to walk up stand still on the right, and those who want to walk up can do so on the left.   
the model should take many inputs, including, total number of people arriving at the bottom of the escalator, lengths and speed of the escalator, percentage of people who want to walk up but also average speed for those who walk up and maybe a distribution of walking speeds to simulate slow downs when slow people walk. 
There may be more, please suggest anything that makes sense.  
In terms of output, I want to put show this simulator in a react app with tailwind so please provide the code for both the simulator and the UI    

# Implementation steps  
I am working on a React App with tailwind, here is how I envisage the UI:
## left column   Inputs  
### Escalator variables  
- escalator length  
- escalator speed    
### People output  
- number of people arriving at the bottom of the escalator   
- percentage of people walking up (0 for strategy one)  
- average speed of people walking up  
- normal distribution of walking speed    
## Right Column    
### A basic animation in javascript to show the escalator  
- People can be represented by dots that accumulate at the bottom. In strategy 1, they all accumulate at the bottom, in strategy 2, the space at the bottom is divided in 2 to let people who want to access the escalator.    
- As time lapses, the dots progress until they reach the escalator (and move up at different speeds depending on whether they stand or walk). Those who walk, cannot overtake those ahead of them if they are slower (walking speed is selected randomly in normal distribution). It should be a real simulation that can be reset.
### statistics
- A counter for the points that reach the top and statistics of passenger flow per minute
- Maybe a comparison with strategy 1 (which can be modelled without randomisation) in terms of flow over the same period and the number of people at the bottom
```

## Run
```bash
git clone https://github.com/pappitti/escalator-bench.git
npm install
npm run dev
```