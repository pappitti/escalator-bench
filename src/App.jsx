import { useState } from 'react'
import ClaudeViz from './models/claude'
import DeepseekR1Qwen32BViz from './models/dsr1q32b'
import O1Viz from './models/o1'
import PittiViz from './models/pitti'
import Dsr1Viz from './models/dsr1'
import Gemini2Viz from './models/gemeni2'
import './App.css'

function App() {
  const [assistant, setAssistant] = useState("Claude")

  const modelElements ={
    "o1" : O1Viz,
    "Gemini 2 Experimental" : Gemini2Viz,
    "Claude" : ClaudeViz, 
    "DeepSeek r1" : Dsr1Viz,
    "DeepSeek r1 Distill Qwen2.5-32B" : DeepseekR1Qwen32BViz,
    "Pitti, o1 and Claude" : PittiViz
  }

  // Get the component for the current assistant
  const CurrentComponent = modelElements[assistant]

  return (
    <div className="w-full h-full flex flex-col items-center justify-start">
      <div className='flex flex-row items-center justify-center gap-4'>
        {Object.keys(modelElements).map((key) => (
          <button key={key} onClick={() => setAssistant(key)}>
            {key}
          </button>
        ))}
      </div>
      <h1 className="text-2xl my-[30px]">{assistant}</h1>
      <div className="flex w-full h-full">
        <CurrentComponent />
      </div>
    </div>
  )
}

export default App
