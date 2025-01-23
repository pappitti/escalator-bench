import { useState } from 'react'
import ClaudeViz from './models/claude'
import DeepseekR1Qwen32BViz from './models/dsr1qwen32b'
import O1Viz from './models/o1'
import './App.css'

function App() {
  const [assistant, setAssistant] = useState("Claude")

  const modelElements ={
    "Claude" : ClaudeViz, 
    "DeepSeek r1 Qwen2.5-32B" : DeepseekR1Qwen32BViz,
    "o1" : O1Viz
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
      <h1>{assistant}</h1>
      <div>
        <CurrentComponent />
      </div>
    </div>
  )
}

export default App
