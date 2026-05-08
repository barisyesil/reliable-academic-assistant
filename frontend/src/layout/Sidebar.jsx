import { NavLink } from 'react-router-dom'
import { Sun, Moon, MessageSquare, BookOpen, Calendar, BarChart2, X, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { path: '/chat',      label: 'AI Asistan',   icon: MessageSquare },
  { path: '/calendar',  label: 'Takvim',        icon: Calendar },
  { path: '/gpa',       label: 'GPA Hesaplama', icon: BarChart2 },
]

export default function Sidebar({ isOpen, setIsOpen, darkMode, setDarkMode }) {
  const { user, logout } = useAuth()

  const close = () => { if (window.innerWidth < 1024) setIsOpen(false) }

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-30 w-[260px] bg-bg-side flex flex-col border-r border-border-subtle
      transition-transform duration-300 ease-in-out
      lg:static lg:translate-x-0
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>
      {/* Header */}
      <div className="px-5 py-5 border-b border-border-subtle flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-estu-red flex items-center justify-center shadow-lg shadow-estu-red/20">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <p className="font-syne text-[15px] font-extrabold text-text-main leading-none tracking-wide">ESTÜ Asistan</p>
            <p className="text-[10px] text-text-muted uppercase tracking-[0.1em] mt-0.5 font-sans">Academic AI</p>
          </div>
        </div>
        <button className="lg:hidden text-text-muted hover:text-text-main" onClick={() => setIsOpen(false)}>
          <X size={20} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        <p className="text-[10px] text-text-muted uppercase tracking-[0.1em] px-2 mb-2 font-sans font-semibold">Ana Menü</p>
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={path} onClick={close}
            className={({ isActive }) => `
              w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-[8px]
              text-[13.5px] font-sans transition-all duration-150 relative text-left
              ${isActive
                ? 'bg-estu-red/10 text-estu-red-light'
                : 'text-text-muted hover:bg-bg-card hover:text-text-main'}
            `}>
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-estu-red rounded-r-full" />}
                <Icon size={15} className="flex-shrink-0" />
                <span className="flex-1">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border-subtle space-y-1">
        <button onClick={() => setDarkMode(!darkMode)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-[8px] text-[13px] text-text-muted hover:text-text-main hover:bg-bg-card transition-all font-sans">
          {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          <span>{darkMode ? 'Aydınlık Mod' : 'Karanlık Mod'}</span>
        </button>

        {/* Profil */}
        <div className="pt-2 mt-2 border-t border-border-subtle">
          <NavLink to="/profile" onClick={close}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-bg-card transition-all group">
            <div className="w-8 h-8 rounded-lg bg-estu-red/10 border border-estu-red/20 flex items-center justify-center text-estu-red-light font-bold font-syne text-sm">
              {user?.full_name?.[0]?.toUpperCase() || <User size={14} />}
            </div>
            <div className="flex-1 text-left overflow-hidden">
              <p className="text-[13px] font-bold text-text-main truncate leading-none">{user?.full_name || 'Kullanıcı'}</p>
              <p className="text-[10px] text-text-muted truncate mt-1">{user?.department || 'Öğrenci'}</p>
            </div>
          </NavLink>
        </div>
      </div>
    </aside>
  )
}