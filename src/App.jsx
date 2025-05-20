import { useState } from 'react'
import ClaudeSonnet35Viz from './models/claude-sonnet-35'
import ClaudeSonnet37Viz from './models/claude-sonnet-37'
import DeepseekR1Qwen32BViz from './models/dsr1q32b'
import O3MiniViz from './models/o3-mini'
import O1Viz from './models/o1'
import PittiViz from './models/pitti'
import Dsr1Viz from './models/dsr1'
import MistralViz from './models/mistral-not-sure'
import Gemini2Viz from './models/gemini2'
import Gemini2ProViz from './models/gemini2-pro'
import Gemini25ProViz from './models/gemini2.5-pro'
import Gemini25Pro0506Viz from './models/gemini2.5-pro-0506'
import Gemini25Pro0520Viz from './models/gemini2.5-pro-0520'
import Gemini2FlashThinkingExpViz from './models/gemini2-flash-thinking-experimental'
import QwQViz from './models/qwq32b'
import Dsv3Viz from './models/dsv3'
import './App.css'

function App() {
  const [assistant, setAssistant] = useState("Claude Sonnet 3.7")

  const modelElements ={
    "Gemini 2.5 Pro 05-20" : Gemini25Pro0520Viz,
    "Gemini 2.5 Pro 05-06" : Gemini25Pro0506Viz,
    "Gemini 2.5 Pro 03-25" : Gemini25ProViz,
    "DeepSeek v3 0324" : Dsv3Viz,
    "QwQ32B" : QwQViz,
    "Claude Sonnet 3.7" : ClaudeSonnet37Viz, 
    "Mistral [Not sure]" : MistralViz,
    "DeepSeek r1" : Dsr1Viz,
    "DeepSeek r1 Distill Qwen2.5-32B" : DeepseekR1Qwen32BViz,
    "o3-mini" : O3MiniViz,
    "Gemini 2 Pro" : Gemini2ProViz,
    "Gemini 2 Flash Thinking Experimental" : Gemini2FlashThinkingExpViz,
    "o1" : O1Viz,
    "Gemini 2 Experimental" : Gemini2Viz,
    "Claude Sonnet 3.5" : ClaudeSonnet35Viz, 
    "Pitti, o1 and Claude" : PittiViz
  }

  // Get the component for the current assistant
  const CurrentComponent = modelElements[assistant]

  return (
    <div className="min-w-full h-screen flex items-center justify-center gap-4">
      <div className='flex flex-1 flex-col h-full items-start justify-start gap-4 overflow-hidden overflow-y-scroll'>
        {Object.keys(modelElements).map((key) => (
          <button 
            className={`flex w-full justify-center items-center ${assistant === key ? 'border-blue-500 border-2' : ''}`}
            key={key} 
            onClick={() => setAssistant(key)
          }>
            {key}
          </button>
        ))}
      </div>
      <div className="h-screen flex-5 flex flex-col items-center overflow-hidden overflow-y-scroll">
        <h1 className="text-2xl font-bold my-[30px]">{assistant}</h1>
        <div className="flex w-full h-full">
          <CurrentComponent />
        </div>
      </div>
    </div>
  )
}

export default App
