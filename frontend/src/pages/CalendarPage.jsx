import { useState } from 'react'
import { Calendar, Plus, X, ChevronLeft, ChevronRight, Clock, Tag, Trash2 } from 'lucide-react'

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

const EVENT_COLORS = [
  { id: 'red',    label: 'Ödev',    bg: 'bg-red-500/20',    text: 'text-red-500',    dot: 'bg-red-500' },
  { id: 'blue',   label: 'Sınav',   bg: 'bg-blue-500/20',   text: 'text-blue-500',   dot: 'bg-blue-500' },
  { id: 'green',  label: 'Etkinlik',bg: 'bg-emerald-500/20',text: 'text-emerald-500',dot: 'bg-emerald-500' },
  { id: 'amber',  label: 'Toplantı',bg: 'bg-amber-500/20',  text: 'text-amber-500',  dot: 'bg-amber-500' },
  { id: 'purple', label: 'Kişisel', bg: 'bg-purple-500/20', text: 'text-purple-500', dot: 'bg-purple-500' },
]

const today = new Date()

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate() }
function getFirstDayOfMonth(year, month) {
  let d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

export default function CalendarPage() {
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState(today.getDate())
  const [events, setEvents] = useState([
    { id: 1, year: today.getFullYear(), month: today.getMonth(), day: today.getDate(), title: 'Algoritma Ödevi Teslimi', time: '23:59', color: 'red' },
    { id: 2, year: today.getFullYear(), month: today.getMonth(), day: today.getDate() + 2, title: 'Dönem Sınavı - Veritabanı', time: '10:00', color: 'blue' },
  ])
  const [showModal, setShowModal] = useState(false)
  const [newEvent, setNewEvent] = useState({ title: '', time: '', color: 'red' })

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)

  const prevMonth = () => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) } else setCurrentMonth(m => m - 1) }
  const nextMonth = () => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) } else setCurrentMonth(m => m + 1) }
  
  const eventsForDay = (day) => events.filter(e => e.year === currentYear && e.month === currentMonth && e.day === day)
  const selectedEvents = eventsForDay(selectedDay)
  
  const addEvent = () => {
    if (!newEvent.title.trim()) return
    setEvents(prev => [...prev, { id: Date.now(), year: currentYear, month: currentMonth, day: selectedDay, ...newEvent }])
    setNewEvent({ title: '', time: '', color: 'red' })
    setShowModal(false)
  }
  const deleteEvent = (id) => setEvents(prev => prev.filter(e => e.id !== id))
  const isToday = (day) => day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()

  return (
    <div className="flex flex-col h-full bg-bg-main transition-colors duration-300">
      
      {/* Topbar */}
      <div className="h-14 bg-bg-side border-b border-border-subtle flex items-center px-5 pl-14 lg:px-5 gap-3 flex-shrink-0 transition-colors duration-300">
        <Calendar size={16} className="text-estu-red flex-shrink-0" />
        <h1 className="font-syne text-[15px] font-bold text-text-main flex-1">Takvim</h1>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-estu-red hover:bg-estu-red-hover text-white text-[12px] font-sans font-medium px-3 py-1.5 rounded-[8px] transition-colors">
          <Plus size={13} /> Etkinlik Ekle
        </button>
      </div>

      {/* Main Content (Mobilde alt alta, bilgisayarda yan yana) */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

        {/* Sol Taraf: Takvim Grid */}
        <div className="flex-1 overflow-y-auto px-5 py-5 custom-scrollbar min-h-[400px]">
          <div className="flex items-center justify-between mb-5">
            <button onClick={prevMonth} className="w-8 h-8 bg-bg-card border border-border-subtle rounded-[8px] flex items-center justify-center hover:bg-border-subtle transition-colors">
              <ChevronLeft size={14} className="text-text-muted" />
            </button>
            <h2 className="font-syne text-[16px] font-bold text-text-main">{MONTHS[currentMonth]} {currentYear}</h2>
            <button onClick={nextMonth} className="w-8 h-8 bg-bg-card border border-border-subtle rounded-[8px] flex items-center justify-center hover:bg-border-subtle transition-colors">
              <ChevronRight size={14} className="text-text-muted" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(d => (<div key={d} className="text-center text-[11px] text-text-muted font-sans py-1 font-medium tracking-wider">{d}</div>))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (<div key={`e-${i}`} />))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayEvents = eventsForDay(day)
              const isSelected = day === selectedDay
              const isTodayCell = isToday(day)
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`aspect-square flex flex-col items-center justify-start p-1.5 rounded-[9px] transition-all relative
                    ${isSelected ? 'bg-estu-red/10 border border-estu-red/30' : 'hover:bg-border-subtle border border-transparent'}`}
                >
                  <span className={`text-[13px] font-sans font-medium leading-none w-6 h-6 flex items-center justify-center rounded-full
                    ${isTodayCell ? 'bg-estu-red text-white' : isSelected ? 'text-text-main font-bold' : 'text-text-muted'}`}>
                    {day}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                      {dayEvents.slice(0, 3).map(ev => {
                        const cfg = EVENT_COLORS.find(c => c.id === ev.color) || EVENT_COLORS[0]
                        return (<span key={ev.id} className={`w-1 h-1 rounded-full ${cfg.dot}`} />)
                      })}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-border-subtle">
            {EVENT_COLORS.map(c => (
              <div key={c.id} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                <span className="text-[11px] text-text-muted font-sans">{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sağ Taraf: Seçili Gün Paneli (Mobilde Alta Geçer) */}
        <div className="w-full lg:w-64 border-t lg:border-t-0 lg:border-l border-border-subtle bg-bg-side flex flex-col flex-shrink-0 transition-colors duration-300 min-h-[300px]">
          <div className="px-4 py-4 border-b border-border-subtle">
            <p className="font-syne text-[13px] font-bold text-text-main">{selectedDay} {MONTHS[currentMonth]}</p>
            <p className="text-[11px] text-text-muted font-sans mt-0.5">{selectedEvents.length} etkinlik</p>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 custom-scrollbar">
            {selectedEvents.length === 0 && (
              <div className="text-center py-10">
                <p className="text-[12px] text-text-muted font-sans">Bu gün için etkinlik yok.</p>
                <button onClick={() => setShowModal(true)} className="mt-3 text-[11px] text-estu-red hover:text-estu-red-hover font-sans transition-colors">+ Etkinlik ekle</button>
              </div>
            )}
            {selectedEvents.map(ev => {
              const cfg = EVENT_COLORS.find(c => c.id === ev.color) || EVENT_COLORS[0]
              return (
                <div key={ev.id} className={`rounded-[9px] px-3 py-2.5 ${cfg.bg} border border-border-subtle group relative`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-[12.5px] font-sans font-medium leading-snug ${cfg.text}`}>{ev.title}</p>
                    <button onClick={() => deleteEvent(ev.id)} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
                      <Trash2 size={11} className={`${cfg.text} hover:opacity-70`} />
                    </button>
                  </div>
                  {ev.time && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <Clock size={10} className={cfg.text} style={{opacity: 0.7}} />
                      <span className={`text-[11px] font-sans ${cfg.text}`} style={{opacity: 0.8}}>{ev.time}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="px-3 py-3 border-t border-border-subtle">
            <button onClick={() => setShowModal(true)} className="w-full flex items-center justify-center gap-1.5 bg-estu-red/10 hover:bg-estu-red/20 border border-estu-red/20 text-estu-red text-[12px] font-sans font-medium py-2 rounded-[8px] transition-colors">
              <Plus size={13} /> Etkinlik Ekle
            </button>
          </div>
        </div>
      </div>

      {/* Etkinlik Ekleme Modalı */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card border border-border-subtle rounded-2xl w-full max-w-sm shadow-2xl animate-[slideUp_0.2s_ease-out_forwards]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
              <h3 className="font-syne text-[14px] font-bold text-text-main">Yeni Etkinlik — {selectedDay} {MONTHS[currentMonth]}</h3>
              <button onClick={() => setShowModal(false)} className="text-text-muted hover:text-text-main"><X size={16} /></button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-[11px] text-text-muted font-sans block mb-1.5">Etkinlik Başlığı</label>
                <input type="text" value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} placeholder="Örn: Algoritma Ödevi..." className="w-full bg-bg-main border border-border-subtle rounded-[9px] px-3 py-2 text-[13px] text-text-main placeholder-text-muted/50 font-sans outline-none focus:border-estu-red/50 transition-colors" />
              </div>
              <div>
                <label className="text-[11px] text-text-muted font-sans block mb-1.5">Saat (opsiyonel)</label>
                <input type="time" value={newEvent.time} onChange={e => setNewEvent(p => ({ ...p, time: e.target.value }))} className="w-full bg-bg-main border border-border-subtle rounded-[9px] px-3 py-2 text-[13px] text-text-main font-sans outline-none focus:border-estu-red/50 transition-colors [&::-webkit-calendar-picker-indicator]:opacity-50" />
              </div>
              <div>
                <label className="text-[11px] text-text-muted font-sans block mb-1.5">Kategori</label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_COLORS.map(c => (
                    <button key={c.id} onClick={() => setNewEvent(p => ({ ...p, color: c.id }))} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] text-[11px] font-sans border transition-all ${newEvent.color === c.id ? `${c.bg} ${c.text} border-transparent` : 'bg-transparent text-text-muted border-border-subtle hover:text-text-main'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} /> {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 px-5 pb-4">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-[9px] text-[12px] font-sans text-text-muted bg-border-subtle hover:bg-text-muted/20 transition-colors">İptal</button>
              <button onClick={addEvent} disabled={!newEvent.title.trim()} className="flex-1 py-2 rounded-[9px] text-[12px] font-sans font-medium bg-estu-red text-white hover:bg-estu-red-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Ekle</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}