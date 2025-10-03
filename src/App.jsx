import { useState } from 'react'
import ClaudeOpus4Viz from './models/claude-opus-4'
import ClaudeOpus41Viz from './models/claude-opus-41'
import ClaudeSonnet4Viz from './models/claude-sonnet-4'
import ClaudeSonnet45Viz from './models/claude-sonnet-45'
import ClaudeSonnet35Viz from './models/claude-sonnet-35'
import ClaudeSonnet37Viz from './models/claude-sonnet-37'
import DeepseekR1Qwen32BViz from './models/dsr1q32b'
import O3MiniViz from './models/o3-mini'
import O1Viz from './models/o1'
import PittiViz from './models/pitti'
import Dsr1Viz from './models/dsr1'
import DSR10528Viz from './models/dsr1-0528'
import Dsv3Viz from './models/dsv3'
import DSv32Viz from './models/dsv32'
import MistralViz from './models/mistral-not-sure'
import Gemini2Viz from './models/gemini2'
import Gemini2ProViz from './models/gemini2-pro'
import Gemini25ProViz from './models/gemini2.5-pro'
import Gemini25Pro0506Viz from './models/gemini2.5-pro-0506'
import Gemini25Flash0520Viz from './models/gemini2.5-flash-0520'
import Gemini25Pro0605Viz from './models/gemini2.5-pro-0605'
import Gemini2FlashThinkingExpViz from './models/gemini2-flash-thinking-experimental'
import KimiK2Viz from './models/kimi-k2'
import QwQViz from './models/qwq32b'
import Qwen3CoderViz from './models/qwen3-coder-480B-A35B-Instruct'
import GPTOss120BViz from './models/gpt-oss-120b'
import GPT5DefaultViz from './models/openai-gpt5-default'

import './App.css'

function App() {
  const [assistant, setAssistant] = useState("Gemini 2.5 Pro 06-05")

  const modelElements ={
    "DeepSeek v3.2": DSv32Viz,
    "Claude Sonnet 4.5": ClaudeSonnet45Viz,
    "Claude Opus 4.1": ClaudeOpus41Viz,
    "OpenAi GPT5 Default": GPT5DefaultViz,
    "OpenAi GPT-OSS 120B": GPTOss120BViz,
    "Qwen 3 Coder 480B A35B Instruct": Qwen3CoderViz,
    "Kimi K2": KimiK2Viz,
    "Gemini 2.5 Pro 06-05" : Gemini25Pro0605Viz,
    "DeepSeek r1 0528" : DSR10528Viz,
    "Claude Opus 4" : ClaudeOpus4Viz,
    "Claude Sonnet 4" : ClaudeSonnet4Viz,
    "Gemini 2.5 Flash 05-20" : Gemini25Flash0520Viz,
    "Gemini 2.5 Pro 05-06" : Gemini25Pro0506Viz,
    "Gemini 2.5 Pro 03-25" : Gemini25ProViz,
    "DeepSeek v3 0324" : Dsv3Viz,
    "QwQ32B" : QwQViz,
    "Claude Sonnet 3.7" : ClaudeSonnet37Viz, 
    "Mistral [Not sure]" : MistralViz,
    "DeepSeek r1" : Dsr1Viz,
    "DeepSeek r1 Distill Qwen2.5-32B" : DeepseekR1Qwen32BViz,
    "OpenAi o3-mini" : O3MiniViz,
    "Gemini 2 Pro" : Gemini2ProViz,
    "Gemini 2 Flash Thinking Experimental" : Gemini2FlashThinkingExpViz,
    "OpenAi o1" : O1Viz,
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
