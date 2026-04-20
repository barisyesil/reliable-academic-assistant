import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './layouts/Sidebar'
import ChatPage from './pages/ChatPage'
// Diğer sayfaların yolları aynı kalıyor
import ResourcesPage from './pages/ResourcesPage'
import CalendarPage from './pages/CalendarPage'
import GPAPage from './pages/GPAPage'

export default function App() {
  const [activePage, setActivePage] = useState('chat')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  
  // Tema state'i (Varsayılan olarak localStorage'dan alıyoruz)
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
           (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  const renderPage = () => {
    switch (activePage) {
      // isSidebarOpen fonksiyonunu ChatPage'e de prop olarak geçiriyoruz
      case 'chat':      return <ChatPage setSidebarOpen={setIsSidebarOpen} />
      case 'resources': return <ResourcesPage />
      case 'calendar':  return <CalendarPage />
      case 'gpa':       return <GPAPage />
      default:          return <ChatPage setSidebarOpen={setIsSidebarOpen} />
    }
  }

  return (
    <div className="flex h-screen bg-bg-main overflow-hidden relative">
      
      {/* Mobil Sidebar Arkası Karartma (Overlay) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-20 lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Bileşeni */}
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen}
        darkMode={darkMode}
        setDarkMode={setDarkMode} // Buton için prop geçiyoruz
      />
      
      <main className="flex-1 flex flex-col min-w-0 bg-[#111111] h-full w-full relative">
        
        {/* MOBİL İÇİN HAMBURGER MENÜ (Sayfa üstüne yapışık) */}
        <div className="lg:hidden absolute top-0 left-0 z-10 flex h-14 items-center px-4">
            <button 
                onClick={() => setIsSidebarOpen(true)}
                className="text-white/70 hover:text-white transition-colors"
            >
                <Menu size={24} />
            </button>
        </div>

        {renderPage()}
      </main>
    </div>
  )
}