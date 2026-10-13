import { useEffect, useState } from 'react'
import axios from 'axios'
import { MessageSquare, Plus, Trash2, Check, X, Sun } from 'lucide-react'

const API = 'http://127.0.0.1:8000/api'

export default function Sidebar({ currentSessionId, onSelectSession, onNewChat, refreshKey }) {
  const [sessions, setSessions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [confirmingId, setConfirmingId] = useState(null)
  const [error, setError] = useState('')

  const fetchSessions = async () => {
    try {
      const response = await axios.get(`${API}/chat/sessions`)
      setSessions(response.data)
      setError('')
    } catch (err) {
      console.error('Gagal memuat sesi:', err)
      setError('Riwayat gagal dimuat.')
    } finally {
      setIsLoading(false)
    }
  }

  // Muat ulang saat sesi berganti atau saat ChatPanel memberi sinyal ada pesan baru
  useEffect(() => {
    fetchSessions()
  }, [currentSessionId, refreshKey])

  const confirmDelete = async (id) => {
    try {
      await axios.delete(`${API}/chat/sessions/${id}`)
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (currentSessionId === id) onNewChat()
    } catch (err) {
      console.error(err)
      setError('Obrolan gagal dihapus.')
    } finally {
      setConfirmingId(null)
    }
  }

  return (
    <aside className="flex h-full w-full flex-shrink-0 flex-col bg-[#0f1224] text-slate-200 md:w-72">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 pb-2 pt-5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-400 text-[#151a33]">
          <Sun size={18} strokeWidth={2.4} />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-white">Apollo AI</span>
      </div>

      {/* Chat baru */}
      <div className="px-4 py-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-[#151a33] transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <Plus size={18} strokeWidth={2.6} />
          Chat baru
        </button>
      </div>

      {/* Riwayat */}
      <h3 className="px-5 pb-1.5 pt-3 text-xs font-medium text-slate-500">Riwayat</h3>

      <nav
        aria-label="Riwayat obrolan"
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-4"
      >
        {isLoading &&
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="mx-1 my-1 h-9 animate-pulse rounded-lg bg-white/5" />
          ))}

        {!isLoading && sessions.length === 0 && !error && (
          <p className="px-3 py-4 text-sm leading-5 text-slate-500">
            Belum ada obrolan. Kirim pertanyaan pertama Anda.
          </p>
        )}

        {error && (
          <p className="mx-1 mb-1 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        {sessions.map((sess) => {
          const isActive = currentSessionId === sess.id
          const isConfirming = confirmingId === sess.id

          return (
            <div key={sess.id} className="group relative">
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-amber-400" />
              )}

              <button
                type="button"
                onClick={() => onSelectSession(sess.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 pr-12 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 ${
                  isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <MessageSquare
                  size={16}
                  className={`shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-500'}`}
                />
                <span className="truncate text-sm">{sess.title || 'Obrolan baru'}</span>
              </button>

              {isConfirming ? (
                <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => confirmDelete(sess.id)}
                    aria-label="Konfirmasi hapus"
                    title="Hapus"
                    className="grid h-7 w-7 place-items-center rounded-md text-red-400 hover:bg-red-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    aria-label="Batal"
                    title="Batal"
                    className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingId(sess.id)}
                  aria-label={`Hapus obrolan ${sess.title || ''}`}
                  title="Hapus obrolan"
                  className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-slate-500 transition hover:bg-white/10 hover:text-red-400 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 md:opacity-0 md:group-hover:opacity-100"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}