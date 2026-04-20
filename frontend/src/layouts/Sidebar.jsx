import { 
  Sun, Moon, MessageSquare, BookOpen, 
  Calendar, BarChart2, Clock, X, 
  Settings, User, LogOut 
} from 'lucide-react'

const navItems = [
  { id: 'chat',      label: 'AI Asistan',      icon: MessageSquare },
  { id: 'resources', label: 'Kaynaklar',        icon: BookOpen },
  { id: 'calendar',  label: 'Takvim',           icon: Calendar },
  { id: 'gpa',       label: 'GPA Hesaplama',    icon: BarChart2 },
]

const recentChats = [
  'Veri yapıları sorusu',
  'Bitirme projesi özeti',
]

export default function Sidebar({ activePage, setActivePage, isOpen, setIsOpen, darkMode, setDarkMode }) {
  
  const handleNavClick = (id) => {
    setActivePage(id)
    if(window.innerWidth < 1024) { 
        setIsOpen(false)
    }
  }

  return (
    <aside className={`
        fixed inset-y-0 left-0 z-30 w-[260px] bg-bg-side flex flex-col border-r border-border-subtle flex-shrink-0 transition-transform duration-300 ease-in-out
        lg:static lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>

      {/* Header / Logo */}
      <div className="px-5 py-5 border-b border-border-subtle flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-estu-red flex items-center justify-center flex-shrink-0 shadow-lg shadow-estu-red/20">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <p className="font-syne text-[15px] font-extrabold text-text-main leading-none tracking-wide">
              ESTÜ Asistan
            </p>
            <p className="text-[10px] text-text-muted uppercase tracking-[0.1em] mt-0.5 font-sans">
              Academic AI
            </p>
          </div>
        </div>
        
        <button 
            className="lg:hidden text-text-muted hover:text-text-main transition-colors"
            onClick={() => setIsOpen(false)}
        >
            <X size={20} />
        </button>
      </div>

      {/* Nav Section */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1 custom-scrollbar">
        <p className="text-[10px] text-text-muted uppercase tracking-[0.1em] px-2 mb-2 font-sans font-semibold">
          Ana Menü
        </p>

        {navItems.map(({ id, label, icon: Icon, badge }) => {
          const isActive = activePage === id
          return (
            <button
              key={id}
              onClick={() => handleNavClick(id)}
              className={`
                w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-[8px]
                text-[13.5px] font-sans transition-all duration-150
                relative text-left group
                ${isActive
                  ? 'bg-estu-red/10 text-estu-red-light'
                  : 'text-text-muted hover:bg-bg-card hover:text-text-main'
                }
              `}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-estu-red rounded-r-full" />
              )}
              <Icon size={15} className={`flex-shrink-0 ${isActive ? 'text-estu-red-light' : 'group-hover:text-text-main'}`} />
              <span className="flex-1">{label}</span>
            </button>
          )
        })}

        {/* Son Sohbetler */}
        <div className="pt-6">
          <p className="text-[10px] text-text-muted uppercase tracking-[0.1em] px-2 mb-2 font-sans font-semibold">
            Son Sohbetler
          </p>
          <div className="space-y-0.5">
            {recentChats.map((chat, i) => (
              <button
                key={i}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[8px]
                  text-[12.5px] text-text-muted hover:text-text-main hover:bg-bg-card
                  transition-all duration-150 font-sans text-left"
              >
                <Clock size={13} className="flex-shrink-0 opacity-40" />
                <span className="truncate">{chat}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Footer Section (Toggle, Settings, Profile) */}
      <div className="p-3 border-t border-border-subtle space-y-1">
        
        {/* Dark/Light Mode Toggle */}
        <button 
          onClick={() => setDarkMode(!darkMode)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-[8px] text-[13px] text-text-muted hover:text-text-main hover:bg-bg-card transition-all font-sans"
        >
          {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          <span className="flex-1">{darkMode ? 'Aydınlık Mod' : 'Karanlık Mod'}</span>
        </button>

        {/* Ayarlar Placeholder */}
        <button 
          className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-[8px] text-[13px] text-text-muted hover:text-text-main hover:bg-bg-card transition-all font-sans"
          onClick={() => console.log("Ayarlar açılıyor...")}
        >
          <Settings size={15} />
          <span className="flex-1">Ayarlar</span>
        </button>

        {/* Profil Kartı / Butonu */}
        <div className="pt-2 mt-2 border-t border-border-subtle">
            <button 
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-bg-card transition-all group"
                onClick={() => console.log("Profil sayfası...")}
            >
                <div className="w-8 h-8 rounded-lg bg-bg-card border border-border-subtle flex items-center justify-center text-text-muted group-hover:text-estu-red-light transition-colors">
                    <User size={16} />
                </div>
                <div className="flex-1 text-left overflow-hidden">
                    <p className="text-[13px] font-bold text-text-main truncate leading-none">Barış Yeşildağ</p>
                    <p className="text-[10px] text-text-muted truncate mt-1">Öğrenci</p>
                </div>
            </button>
        </div>
      </div>
    </aside>
  )
}