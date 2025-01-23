# Escalator Simulation Benchmark

For three weeks in 2015, researchers asked [commuters in London](https://www.bbc.co.uk/news/uk-england-london-34926581) not to walk up the escaltoro to find out the optimal strategy at busy hours.  
This seems like reasonably easy thing to model and simulate without annoying anyone for three weeks. So we decided to ask different AI models to do the work... in less than 5 minutes.

## Prompt

I want to build a model to assess the optimal escalator strategy when stations are busy. Let's assume that an escalator is wide enough for two people
- strategy 1 : everyone stands still on the escalator, with two people on each step
- strategy 2 : people who do not want to walk up stand still on the right, and those who want to walk up can do so on the left.
the model should take many inputs, including, total number of people arriving at the bottom of the escalator, lengths and speed of the escalator, percentage of people who want to walk up but also average speed for those who walk up and maybe a distribution of walking speeds to simulate slow downs when slow people walk. There may be more, please suggest anything that makes sense
in terms of output, I want to put show this simulator in a react app so please provide the code for both the simulator and the UI

## Run
```bash
git clone https://github.com/pappitti/escalator-bench.git
cd escalator-bench
npm run dev
```