import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { ArrowUp, Paperclip, Square, Copy, Check, Sun, Loader2, FileText, AlertCircle, X } from 'lucide-react'

const API = 'http://127.0.0.1:8000/api'
const SUGGESTIONS = ['Ringkas dokumen ini', 'Apa poin terpenting di dokumen ini?', 'Buat daftar istilah penting beserta artinya']

// ... (CopyButton, BotAvatar, ThinkingIndicator, EmptyState biarkan sama seperti sebelumnya) ...
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }
  return (
    <button type="button" onClick={handleCopy} className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-600 md:opacity-0 md:group-hover:opacity-100">
      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Tersalin' : 'Salin'}
    </button>
  )
}

function BotAvatar() {
  return <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-400 text-[#151a33]"><Sun size={18} strokeWidth={2.4} /></div>
}

function ThinkingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <BotAvatar />
      <div className="flex items-center gap-2 pt-1.5 text-sm text-slate-500">
        <span className="flex gap-1" aria-hidden="true">
          {[0, 150, 300].map((delay) => ( <span key={delay} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${delay}ms` }} /> ))}
        </span>
        Apollo sedang membaca…
      </div>
    </div>
  )
}

function EmptyState({ onPick, disabled }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[#151a33] text-amber-400"><Sun size={28} strokeWidth={2.2} /></div>
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Tanyakan apa saja dari dokumen Anda</h2>
      <p className="mt-2 max-w-md text-[15px] leading-6 text-slate-500">Upload PDF dengan tombol klip di bawah, lalu mulai bertanya.</p>
      <div className="mt-8 flex max-w-xl flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => ( <button key={s} type="button" disabled={disabled} onClick={() => onPick(s)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50">{s}</button> ))}
      </div>
    </div>
  )
}

export default function ChatPanel({ sessionId, onChatUpdated }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [isThinking, setIsThinking] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  
  // STATE BARU: Mengingat nama file terakhir yang di-upload di sesi ini
  const [activeFileContext, setActiveFileContext] = useState(null)

  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)
  const abortRef = useRef(null)

  const isBusy = isThinking || isStreaming

  useEffect(() => {
    let cancelled = false
    abortRef.current?.abort()
    
    setMessages([])
    setIsThinking(false)
    setIsStreaming(false)
    setIsLoadingHistory(true)
    setSelectedFile(null)
    setActiveFileContext(null) // Reset konteks file saat pindah chat

    axios.get(`${API}/chat/${sessionId}`).then((res) => { if (!cancelled) setMessages(res.data) }).finally(() => { if (!cancelled) setIsLoadingHistory(false) })
    return () => { cancelled = true }
  }, [sessionId])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: isStreaming ? 'auto' : 'smooth' }) }, [messages, isThinking, isStreaming])
  useEffect(() => { const el = textareaRef.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 160)}px` }, [input])

  const pushSystem = (text, error = false) => setMessages((prev) => [...prev, { role: 'system', text, error }])

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') { pushSystem('File harus berformat PDF.', true); if (fileInputRef.current) fileInputRef.current.value = ''; return }
    setSelectedFile(file)
  }

  // UPDATE: Fungsi ini sekarang menerima contextFile
  const sendMessage = async (content, contextFile = activeFileContext) => {
    setMessages((prev) => [...prev, { role: 'user', text: content }])
    setIsThinking(true)
    const controller = new AbortController()
    abortRef.current = controller
    let botReply = ''; let started = false

    try {
      const response = await fetch(`${API}/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // KIRIM FILE CONTEXT KE BACKEND
        body: JSON.stringify({ session_id: sessionId, message: content, file_context: contextFile }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error('Request gagal')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        botReply += decoder.decode(value, { stream: true })
        if (!started) {
          started = true; setIsThinking(false); setIsStreaming(true)
          setMessages((prev) => [...prev, { role: 'bot', text: botReply }])
        } else {
          setMessages((prev) => { const next = [...prev]; next[next.length - 1] = { ...next[next.length - 1], text: botReply }; return next })
        }
      }
      if (!started) setMessages((prev) => [ ...prev, { role: 'bot', error: true, text: 'Tidak ada jawaban dari server.' } ])
    } catch (error) {
      if (error.name !== 'AbortError') setMessages((prev) => [ ...prev, { role: 'bot', error: true, text: 'Pesan gagal dikirim.' } ])
    } finally {
      setIsThinking(false); setIsStreaming(false); abortRef.current = null; onChatUpdated?.(); textareaRef.current?.focus()
    }
  }

  const processSubmit = async (textToUse) => {
    const content = textToUse.trim()
    if (!content && !selectedFile) return
    if (isBusy || isUploading) return

    let fileUploadedName = null

    if (selectedFile) {
      setIsUploading(true)
      const formData = new FormData()
      formData.append('file', selectedFile)

      try {
        const response = await axios.post(`${API}/documents/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        fileUploadedName = response.data.filename
        
        // INGAT FILE INI SEBAGAI FOKUS UTAMA OBROLAN
        setActiveFileContext(fileUploadedName) 
        
        pushSystem(`✅ "${fileUploadedName}" berhasil di-upload ke database vektor.`)
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      } catch (error) {
        pushSystem('Dokumen gagal di-upload.', true)
        setIsUploading(false)
        return 
      }
      setIsUploading(false)
    }

    if (content) {
      setInput('')
      // Kirim pesan dengan fileUploadedName jika baru saja di-upload, 
      // atau gunakan activeFileContext yang sudah ada sebelumnya.
      sendMessage(content, fileUploadedName || activeFileContext)
    } else if (fileUploadedName) {
      setInput('')
    }
  }

  const handleSubmit = (e) => { if (e) e.preventDefault(); processSubmit(input) }
  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSubmit() } }
  const showEmpty = !isLoadingHistory && messages.length === 0 && !isBusy

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-slate-50">
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-6 py-3.5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#151a33] text-amber-400"><Sun size={18} strokeWidth={2.4} /></div>
        <div className="leading-tight">
          <h1 className="text-[15px] font-semibold text-slate-900">Apollo AI</h1>
          <p className="text-xs text-slate-500">
             {/* Indikator UI Kecil untuk memberitahu user file apa yang sedang aktif */}
             {activeFileContext ? `Fokus: ${activeFileContext}` : 'Asisten untuk dokumen PDF Anda'}
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {showEmpty ? (
          <EmptyState onPick={processSubmit} disabled={isUploading || isBusy} />
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-8 md:px-6">
            {isLoadingHistory && <div className="flex justify-center py-10 text-slate-400"><Loader2 size={20} className="animate-spin" /></div>}

            {messages.map((msg, index) => {
              if (msg.role === 'system') {
                return (
                  <div key={index} className={`inline-flex items-center gap-2 self-center rounded-full border bg-white px-3.5 py-1.5 text-xs ${msg.error ? 'border-red-200 text-red-600' : 'border-slate-200 text-slate-600'}`}>
                    {msg.error ? <AlertCircle size={14} /> : <FileText size={14} className="text-emerald-600" />} {msg.text}
                  </div>
                )
              }
              if (msg.role === 'user') {
                return <div key={index} className="max-w-[80%] self-end whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[#151a33] px-4 py-3 text-[15px] leading-6 text-white">{msg.text}</div>
              }
              const isLast = index === messages.length - 1
              return (
                <div key={index} className="group flex items-start gap-3">
                  <BotAvatar />
                  <div className="min-w-0 flex-1">
                    <div className={`whitespace-pre-wrap break-words text-[15px] leading-7 ${msg.error ? 'text-red-600' : 'text-slate-800'}`}>
                      {msg.text}
                      {isStreaming && isLast && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-amber-400 align-middle" />}
                    </div>
                    {!msg.error && !(isStreaming && isLast) && msg.text && <CopyButton text={msg.text} />}
                  </div>
                </div>
              )
            })}
            {isThinking && <ThinkingIndicator />}
            <div ref={messagesEndRef} className="h-2" />
          </div>
        )}
      </div>

      <div className="flex flex-shrink-0 justify-center px-4 pb-4 pt-2">
        <div className="flex w-full max-w-3xl flex-col gap-2">
          {isUploading && <div className="flex items-center gap-2 px-3 text-sm text-slate-600"><Loader2 size={16} className="animate-spin text-amber-500" />Mengamankan dan membaca PDF…</div>}
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-1.5 rounded-3xl border border-slate-200 bg-white p-2 shadow-sm transition focus-within:border-slate-400">
            {selectedFile && (
              <div className="mx-2 mt-1 mb-1 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                <div className="flex items-center gap-2 overflow-hidden text-sm text-slate-700">
                  <FileText size={16} className="shrink-0 text-amber-500" />
                  <span className="truncate font-medium">{selectedFile.name}</span>
                  <span className="text-xs text-slate-400">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
                <button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }} className="rounded p-1 text-slate-400 transition-colors hover:bg-amber-100 hover:text-red-500"><X size={16} /></button>
              </div>
            )}
            <div className="flex items-end gap-1.5">
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"><Paperclip size={20} /></button>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".pdf,application/pdf" className="hidden" />
              <textarea ref={textareaRef} rows={1} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Tanyakan sesuatu tentang dokumen Anda..." disabled={isBusy || isUploading} className="max-h-40 flex-1 resize-none bg-transparent px-1 py-2.5 text-[15px] leading-5 text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50" />
              {isBusy ? (
                <button type="button" onClick={() => abortRef.current?.abort()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#151a33] text-white transition hover:bg-black"><Square size={14} fill="currentColor" /></button>
              ) : (
                <button type="submit" disabled={(!input.trim() && !selectedFile) || isUploading} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#151a33] text-white transition hover:bg-black disabled:bg-slate-200 disabled:text-slate-400"><ArrowUp size={20} strokeWidth={2.4} /></button>
              )}
            </div>
          </form>
          <p className="text-center text-[11px] text-slate-400">Apollo AI bisa keliru. Periksa kembali informasi yang penting.</p>
        </div>
      </div>
    </div>
  )
}