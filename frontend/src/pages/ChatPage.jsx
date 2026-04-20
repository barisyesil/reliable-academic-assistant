import { useState, useRef, useEffect } from 'react'
import { Send, AlertTriangle, FileText } from 'lucide-react'

const SESSION_ID = "sess_" + Math.random().toString(36).substring(2, 10);
const API_URL = "http://localhost:8000"; 

const initialMessages = [
  {
    id: 1,
    role: 'assistant',
    content: 'Bugün sana nasıl yardımcı olabilirim? Yönetmelikler, staj şartları, ders geçme notları veya aklına takılan herhangi bir akademik soruyu sorabilirsin. 🎓',
    sources: null
  },
]

export default function ChatPage() {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isOnline, setIsOnline] = useState(false) 
  
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/docs`);
        if (res.ok) setIsOnline(true);
        else setIsOnline(false);
      } catch (error) {
        setIsOnline(false);
      }
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSend = async () => {
    const text = input.trim()
    if (!text) return

    const userMsg = { id: Date.now(), role: 'user', content: text, sources: null }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
    }

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: SESSION_ID,
          query: text,
        }),
      });

      if (!response.ok) {
        throw new Error("Sunucu yanıt vermedi.");
      }

      const data = await response.json();

      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: data.answer,
          sources: data.sources 
        },
      ])

    } catch (error) {
      console.error("Hata:", error);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: "Üzgünüm, şu anda sunucuya bağlanamıyorum. Lütfen bağlantınızı kontrol edin veya daha sonra tekrar deneyin.",
          sources: null
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const autoResize = (e) => {
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const getDocumentUrl = (category, filename) => {
      return `${API_URL}/api/document/${encodeURIComponent(category)}/${encodeURIComponent(filename)}`;
  }

  return (
    <div className="flex flex-col h-full bg-bg-main transition-colors duration-300">

      {/* Topbar */}
      <div className="h-14 bg-bg-side border-b border-border-subtle flex items-center px-5 lg:px-5 pl-14 gap-3 flex-shrink-0 transition-colors duration-300">
        <h1 className="font-syne text-[15px] font-bold text-text-main flex-1">
          ESTÜ Akademik Asistan
        </h1>
        <div className={`flex items-center gap-1.5 bg-bg-card border border-border-subtle text-[11px] px-3 py-1.5 rounded-full font-sans transition-colors ${isOnline ? 'text-text-muted' : 'text-red-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {isOnline ? 'Çevrimiçi' : 'Sunucu Kapalı'}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4
        [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-text-main/10
        [&::-webkit-scrollbar-track]:bg-transparent">

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col gap-1.5 animate-[slideUp_0.3s_ease-out_forwards]
              ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className={`flex gap-2.5 items-start ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0 text-[11px] font-bold font-syne
                ${msg.role === 'assistant' 
                  ? 'bg-estu-red/10 text-estu-red-light border border-estu-red/20' 
                  : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>
                {msg.role === 'assistant' ? 'AI' : 'SİZ'}
                </div>
                
                {/* Message Bubble */}
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-[13.5px] font-sans leading-relaxed whitespace-pre-wrap transition-colors
                ${msg.role === 'assistant' 
                  ? 'bg-bg-card border border-border-subtle text-text-main rounded-tl-[4px]' 
                  : 'bg-estu-red text-white rounded-tr-[4px] shadow-sm'}`}>
                {msg.content}
                </div>
            </div>

            {/* Sources */}
            {msg.sources && msg.sources.length > 0 && (
                <div className="ml-10 flex flex-wrap gap-2 mt-1">
                    {msg.sources.map((source, idx) => (
                        <a 
                            key={idx}
                            href={getDocumentUrl(source.category, source.document_name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={source.content}
                            className="flex items-center gap-1.5 bg-bg-card hover:bg-border-subtle border border-border-subtle text-text-muted hover:text-estu-red text-[10px] px-2 py-1 rounded-[6px] transition-colors font-sans max-w-[200px]"
                        >
                            <FileText size={10} className="flex-shrink-0" />
                            <span className="truncate">{source.document_name}</span>
                            <span className="opacity-70">S.{source.page}</span>
                        </a>
                    ))}
                </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-2.5 items-start animate-[fadeIn_0.2s_ease-out_forwards]">
            <div className="w-7 h-7 rounded-[7px] bg-estu-red/10 text-estu-red-light border border-estu-red/20 flex items-center justify-center text-[11px] font-bold font-syne flex-shrink-0">
              AI
            </div>
            <div className="bg-bg-card border border-border-subtle rounded-xl rounded-tl-[4px] px-4 py-3.5 flex gap-1.5 items-center">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-text-muted/40"
                  style={{ animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-5 pb-4 pt-3 border-t border-border-subtle bg-bg-side flex-shrink-0 transition-colors duration-300">
        <div className={`flex items-end gap-2.5 bg-bg-card border border-border-subtle rounded-xl px-3.5 py-2.5 transition-colors ${isOnline ? 'focus-within:border-estu-red/50' : 'opacity-50 pointer-events-none'}`}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => { setInput(e.target.value); autoResize(e) }}
            onKeyDown={handleKeyDown}
            placeholder={isOnline ? "Akademik bir soru sor..." : "Sunucuya bağlanılamıyor..."}
            disabled={!isOnline}
            className="flex-1 bg-transparent border-none outline-none resize-none text-[13.5px] text-text-main placeholder-text-muted/50 font-sans leading-relaxed min-h-[22px]"
          />
          <div className="flex items-center gap-2 flex-shrink-0">
            <button 
              onClick={handleSend}
              disabled={!input.trim() || !isOnline}
              className="w-8 h-8 rounded-[8px] flex items-center justify-center transition-all duration-150 flex-shrink-0 bg-estu-red hover:bg-estu-red-hover disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Send size={13} className="text-white translate-x-px" />
            </button>
          </div>
        </div>

        {/* AI disclaimer */}
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          <AlertTriangle size={10} className="text-text-muted/70 flex-shrink-0" />
          <p className="text-[10.5px] text-text-muted/70 font-sans tracking-wide">
            Yapay zeka asistanı hata yapabilir. Lütfen kritik tarihleri ve işlemleri resmi kanallardan doğrulayın.
          </p>
        </div>
      </div>

    </div>
  )
}