import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ChatPanel from './components/ChatPanel'

function App() {
  // Simpan/baca session ID aktif
  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('chat_session_id') || ('session_' + Math.random().toString(36).substr(2, 9))
  })

  // Simpan ke localstorage tiap berganti sesi
  useEffect(() => {
    localStorage.setItem('chat_session_id', sessionId)
  }, [sessionId])

  const handleNewChat = () => {
    setSessionId('session_' + Math.random().toString(36).substr(2, 9))
  }

  return (
    <div className="h-screen w-full flex bg-white overflow-hidden font-sans">
      <Sidebar 
        currentSessionId={sessionId} 
        onSelectSession={setSessionId} 
        onNewChat={handleNewChat} 
      />
      <ChatPanel sessionId={sessionId} />
    </div>
  )
}

export default App