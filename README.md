# Escalator Simulation Benchmark

For three weeks in 2015, researchers asked [commuters in London](https://www.bbc.co.uk/news/uk-england-london-34926581) not to walk up the escalator to find out the optimal strategy at rush hours.  
This seems like a reasonably easy thing to model and simulate without annoying anyone for three weeks. But is it?  
In this project, we ask different AI models to do the work of researchers... in less than 5 minutes. The objective is to challenge the claims that large language models can now fully automate scientific research.  
  
There are several dimensions to the research:
- a modelling challenge (passenger flow)
- a simulation challenge (high-level game engine)
- a rendering challenge (UI)
  
See project page [here](https://www.pitti.io/projects/escalator-benchmark) 
  
## Prompt
LLMs, and reasoners in particular, can be extremely helpful to the extent that you provide sufficient context. This exact prompt has been used for all the model outputs presented in this project.  

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

## Prelimimary findings
While the models are definitely useful to lay the foundations of a project, the claims that AI models can already fully automate research seem largely overblown. Here, the math is trivial and any undergrad with a math background would find a way to incorporate it in the modelling. It is basically about making the right choices. And on the UI side, it is also clear that you still need human involvement to piece everything together and give models a little nudge when they start going off-track.  
  
To illustrate the takeaways of this project, I mapped each model output (very subjectively and in the most un-scientific way possible): 
-  X-axis : for the UI
- Y-axis : for the reasoning  
  
![Escalator Benchmark](https://pitti-backend-assets.ams3.cdn.digitaloceanspaces.com/escalator-benchmark/benchmarkplot.png "Escalator Benchmark")

## Contribute (both humans and AI suggestions)
- Create a new component in src/models 
- import in App.jsx (should be self explanatory)
- submit PR
*Feel free to propose alternative prompts for this project*