import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  // Başlangıçta asistanın ilk mesajı ekranda olsun
  const [messages, setMessages] = useState([
    { sender: 'ai', text: 'Hello! I am an Academic Assistant for ESTÜ. How can I assist you today?', sources: [] }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Her sayfa yenilendiğinde benzersiz bir oturum kimliği oluşturur (Hafıza için kritik)
  const [sessionId] = useState(() => 'session_' + Math.random().toString(36).substr(2, 9));
  const messagesEndRef = useRef(null);

  // Yeni mesaj geldiğinde otomatik olarak en aşağı kaydırma fonksiyonu
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input.trim();
    
    // Kullanıcının mesajını ekrana ekle
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      // Backend'e POST isteği atıyoruz
      const response = await axios.post('http://127.0.0.1:8000/api/chat', {
        session_id: sessionId,
        query: userMsg
      });

      // Gelen cevabı ve kaynakları ekrana ekle
      setMessages(prev => [...prev, { 
        sender: 'ai', 
        text: response.data.answer,
        sources: response.data.sources 
      }]);
    } catch (error) {
      console.error("API Error:", error);
      setMessages(prev => [...prev, { sender: 'ai', text: 'Üzgünüm, sunucuya bağlanırken bir hata oluştu. Backend açık mı?', sources: [] }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <h2>🎓 ESTÜ Akademik Asistan</h2>
        <span className="session-badge">Oturum: {sessionId.substring(0,12)}</span>
      </header>
      
      <div className="chat-box">
        {messages.map((msg, index) => (
          <div key={index} className={`message-wrapper ${msg.sender}`}>
            <div className="message">
              <p>{msg.text}</p>
              
              {/* Eğer kaynak varsa şık bir rozet olarak göster */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="sources">
                  <strong>Kaynaklar: </strong>
                  {msg.sources.map((src, i) => (
                    <span key={i} className="source-badge">Sayfa {src.page}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* Yükleme Animasyonu */}
        {isLoading && (
          <div className="message-wrapper ai">
            <div className="message loading">Asistan düşünüyor...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="input-area" onSubmit={sendMessage}>
        <input 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="Yönetmelik veya okul hakkında bir soru sorun..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>Gönder</button>
      </form>
    </div>
  );
}

export default App;