import { useState, useRef, useEffect } from 'react'
import { Send, AlertTriangle, FileText, Plus, Trash2, MessageSquare } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm' // GitHub Flavored Markdown eklentisi
import 'github-markdown-css/github-markdown.css' // GitHub CSS'i

const WELCOME_MSG = {
  id: 'welcome',
  role: 'assistant',
  content: 'Merhaba! ESTÜ Akademik Asistanın. Yönetmelikler, staj şartları, ders geçme notları veya not ortalamanla ilgili her soruyu sorabilirsin. 🎓',
  sources: null,
}

export default function ChatPage() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId] = useState(null)
  const [messages, setMessages] = useState([WELCOME_MSG])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isOnline, setIsOnline] = useState(false)
  const [loadingConv, setLoadingConv] = useState(false)

  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  // Backend sağlık kontrolü
  useEffect(() => {
    const check = async () => {
      try {
        const res = await api.get('/health')
        setIsOnline(res.data.status === 'ok')
      } catch {
        setIsOnline(false)
      }
    }
    check()
    const t = setInterval(check, 30000)
    return () => clearInterval(t)
  }, [])

  // Sohbet listesini yükle
  useEffect(() => {
    loadConversations()
  }, [])

  const loadConversations = async () => {
    try {
      const res = await api.get('/api/chat/conversations')
      setConversations(res.data)
    } catch (e) {
      console.error(e)
    }
  }

  // Sohbet seç
  const selectConversation = async (convId) => {
    if (convId === activeConvId) return
    setLoadingConv(true)
    setActiveConvId(convId)
    try {
      const res = await api.get(`/api/chat/conversations/${convId}/messages`)
      const msgs = res.data.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: m.sources,
      }))
      setMessages(msgs.length ? msgs : [WELCOME_MSG])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingConv(false)
    }
  }

  const newConversation = () => {
    setActiveConvId(null)
    setMessages([WELCOME_MSG])
  }

  const deleteConversation = async (e, convId) => {
    e.stopPropagation()
    try {
      await api.delete(`/api/chat/conversations/${convId}`)
      setConversations(prev => prev.filter(c => c.id !== convId))
      if (activeConvId === convId) newConversation()
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || !isOnline) return

    const userMsg = { id: Date.now(), role: 'user', content: text, sources: null }
    setMessages(prev => [...prev.filter(m => m.id !== 'welcome'), userMsg])
    setInput('')
    setIsTyping(true)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    try {
      const res = await api.post('/api/chat', {
        conversation_id: activeConvId,
        query: text,
      })
      const data = res.data

      // KRİTİK DÜZELTME: React state'inin güvenli güncellenmesi
      if (!activeConvId && data?.conversation_id) {
        setActiveConvId(data.conversation_id)
        await loadConversations()
      }

      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: data.answer,
          sources: data.sources,
        },
      ])
    } catch (e) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: 'Üzgünüm, sunucuya bağlanamıyorum. Lütfen daha sonra tekrar dene.',
          sources: null,
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const autoResize = (e) => {
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const getDocUrl = (category, filename) =>
    `http://localhost:8000/api/document/${encodeURIComponent(category)}/${encodeURIComponent(filename)}`

  return (
    <div className="flex h-full bg-bg-main overflow-hidden">

      {/* Sohbet Listesi (Sol Panel) */}
      <div className="hidden md:flex w-56 flex-col border-r border-border-subtle bg-bg-side shrink-0">
        <div className="px-3 py-3 border-b border-border-subtle">
          <button
            onClick={newConversation}
            className="w-full flex items-center justify-center gap-2 bg-estu-red/10 hover:bg-estu-red/20 border border-estu-red/20 text-estu-red text-xs font-sans font-medium py-2 rounded-lg transition-colors"
          >
            <Plus size={13} /> Yeni Sohbet
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {conversations.length === 0 && (
            <p className="text-xs text-text-muted font-sans px-2 py-4 text-center">
              Henüz sohbet yok.
            </p>
          )}
          {conversations.map(c => (
            <button
              key={c.id}
              onClick={() => selectConversation(c.id)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors group relative
                ${activeConvId === c.id ? 'bg-estu-red/10 text-estu-red-light' : 'text-text-muted hover:bg-bg-card hover:text-text-main'}`}
            >
              <MessageSquare size={12} className="shrink-0 opacity-60" />
              <span className="text-xs font-sans truncate flex-1">{c.title}</span>
              <button
                onClick={(e) => deleteConversation(e, c.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hover:text-red-500"
              >
                <Trash2 size={11} />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* Ana Chat Alanı */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <div className="h-14 bg-bg-side border-b border-border-subtle flex items-center px-5 pl-14 lg:pl-5 gap-3 shrink-0">
          <h1 className="font-syne text-[15px] font-bold text-text-main flex-1">
            ESTÜ Akademik Asistan
          </h1>
          <div className={`flex items-center gap-1.5 bg-bg-card border border-border-subtle text-[11px] px-3 py-1.5 rounded-full font-sans
            ${isOnline ? 'text-text-muted' : 'text-red-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {isOnline ? 'Çevrimiçi' : 'Sunucu Kapalı'}
          </div>
        </div>

        {/* Mesajlar */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4
          [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-text-main/10">

          {loadingConv && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-estu-red border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loadingConv && messages.map(msg => (
            <div key={msg.id} className={`flex flex-col gap-1.5 animate-fade-in
              ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`flex gap-2.5 items-start ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0 text-[11px] font-bold font-syne
                  ${msg.role === 'assistant'
                    ? 'bg-estu-red/10 text-estu-red-light border border-estu-red/20'
                    : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>
                  {msg.role === 'assistant' ? 'AI' : (user?.full_name?.[0] || 'S')}
                </div>
                
                {/* --- GitHub Stili Markdown Entegrasyonu Başlangıcı --- */}
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-[13.5px] font-sans leading-relaxed
                  ${msg.role === 'assistant'
                    ? 'bg-bg-card border border-border-subtle text-text-main rounded-tl-sm'
                    : 'bg-estu-red text-white rounded-tr-sm whitespace-pre-wrap'}`}>
                  
                  {msg.role === 'assistant' ? (
                    /* DÜZELTME: 'markdown-body' sınıfı GitHub stilini aktifleştirir */
                    /* style{{}} ile tasarımın bozmaması için padding ve yazı boyutunu sıfırladık */
                    <div 
                      className="markdown-body" 
                      style={{ 
                        padding: '0', 
                        fontSize: 'inherit', 
                        color: 'inherit', 
                        backgroundColor: 'transparent' 
                      }}
                    >
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]} // Tablolar, kontrol listeleri vs. için
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
                {/* --- GitHub Stili Markdown Entegrasyonu Sonu --- */}
                
              </div>

              {msg.sources && msg.sources.length > 0 && (
                <div className="ml-10 flex flex-wrap gap-2 mt-1">
                  {msg.sources.map((src, idx) => (
                    <a key={idx}
                      href={getDocUrl(src.category, src.document_name)}
                      target="_blank" rel="noopener noreferrer"
                      title={src.content}
                      className="flex items-center gap-1.5 bg-bg-card hover:bg-border-subtle border border-border-subtle text-text-muted hover:text-estu-red text-[10px] px-2 py-1 rounded-md transition-colors font-sans max-w-50">
                      <FileText size={10} className="shrink-0" />
                      <span className="truncate">{src.document_name}</span>
                      <span className="opacity-70">S.{src.page}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-2.5 items-start">
              <div className="w-7 h-7 rounded-[7px] bg-estu-red/10 text-estu-red-light border border-estu-red/20 flex items-center justify-center text-[11px] font-bold font-syne shrink-0">
                AI
              </div>
              <div className="bg-bg-card border border-border-subtle rounded-xl rounded-tl-sm px-4 py-3.5 flex gap-1.5 items-center">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-text-muted/40"
                    style={{ animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-5 pb-4 pt-3 border-t border-border-subtle bg-bg-side shrink-0">
          <div className={`flex items-end gap-2.5 bg-bg-card border border-border-subtle rounded-xl px-3.5 py-2.5 transition-colors
            ${isOnline ? 'focus-within:border-estu-red/50' : 'opacity-50 pointer-events-none'}`}>
            <textarea ref={textareaRef} rows={1} value={input}
              onChange={e => { setInput(e.target.value); autoResize(e) }}
              onKeyDown={handleKeyDown}
              placeholder={isOnline ? 'Akademik bir soru sor...' : 'Sunucuya bağlanılamıyor...'}
              disabled={!isOnline}
              className="flex-1 bg-transparent border-none outline-none resize-none text-[13.5px] text-text-main placeholder-text-muted/50 font-sans leading-relaxed min-h-5.5"
            />
            <button onClick={handleSend} disabled={!input.trim() || !isOnline}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-estu-red hover:bg-estu-red-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0">
              <Send size={13} className="text-white translate-x-px" />
            </button>
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-2.5">
            <AlertTriangle size={10} className="text-text-muted/70 shrink-0" />
            <p className="text-[10.5px] text-text-muted/70 font-sans">
              Yapay zeka hata yapabilir. Kritik tarihleri resmi kanallardan doğrulayın.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}