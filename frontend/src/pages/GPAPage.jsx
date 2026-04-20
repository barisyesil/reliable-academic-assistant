import { useState } from 'react'
import { BarChart2, Plus, Trash2, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'

const LETTER_GRADES = [
  { letter: 'AA', points: 4.0 }, { letter: 'BA', points: 3.5 },
  { letter: 'BB', points: 3.0 }, { letter: 'CB', points: 2.5 },
  { letter: 'CC', points: 2.0 }, { letter: 'DC', points: 1.5 },
  { letter: 'DD', points: 1.0 }, { letter: 'FD', points: 0.5 },
  { letter: 'FF', points: 0.0 },
]

const GRADE_COLOR = {
  4.0: 'text-emerald-500', 3.5: 'text-emerald-500',
  3.0: 'text-blue-500',   2.5: 'text-blue-500',
  2.0: 'text-amber-500',  1.5: 'text-amber-500',
  1.0: 'text-orange-500', 0.5: 'text-red-500',
  0.0: 'text-red-600',
}

const defaultCourse = () => ({
  id: Date.now(), name: '', credits: 3, grade: 'BB', expanded: false,
})

const defaultSemester = (index) => ({
  id: Date.now() + index, name: `${index + 1}. Dönem`, courses: [defaultCourse()], expanded: true,
})

function calcSemesterGPA(courses) {
  const valid = courses.filter(c => c.name.trim())
  if (!valid.length) return { gpa: 0, totalCredits: 0 }
  const totalPoints = valid.reduce((sum, c) => {
    const g = LETTER_GRADES.find(g => g.letter === c.grade)
    return sum + (g ? g.points * c.credits : 0)
  }, 0)
  const totalCredits = valid.reduce((sum, c) => sum + Number(c.credits), 0)
  return { gpa: totalCredits ? totalPoints / totalCredits : 0, totalCredits }
}

function calcCumulativeGPA(semesters) {
  let totalPoints = 0, totalCredits = 0
  semesters.forEach(sem => {
    sem.courses.filter(c => c.name.trim()).forEach(c => {
      const g = LETTER_GRADES.find(g => g.letter === c.grade)
      if (g) {
        totalPoints += g.points * c.credits
        totalCredits += Number(c.credits)
      }
    })
  })
  return { gpa: totalCredits ? totalPoints / totalCredits : 0, totalCredits }
}

export default function GPAPage() {
  const [semesters, setSemesters] = useState([defaultSemester(0)])

  const addSemester = () => setSemesters(prev => [...prev, defaultSemester(prev.length)])
  const removeSemester = (semId) => setSemesters(prev => prev.filter(s => s.id !== semId))
  const toggleSemester = (semId) => setSemesters(prev => prev.map(s => s.id === semId ? { ...s, expanded: !s.expanded } : s))
  const updateSemesterName = (semId, name) => setSemesters(prev => prev.map(s => s.id === semId ? { ...s, name } : s))
  const addCourse = (semId) => setSemesters(prev => prev.map(s => s.id === semId ? { ...s, courses: [...s.courses, defaultCourse()] } : s))
  const removeCourse = (semId, courseId) => setSemesters(prev => prev.map(s => s.id === semId ? { ...s, courses: s.courses.filter(c => c.id !== courseId) } : s))
  const updateCourse = (semId, courseId, field, value) => setSemesters(prev => prev.map(s => s.id === semId ? { ...s, courses: s.courses.map(c => c.id === courseId ? { ...c, [field]: value } : c) } : s))
  const reset = () => setSemesters([defaultSemester(0)])

  const { gpa: cumGPA, totalCredits } = calcCumulativeGPA(semesters)

  const gpaColor = cumGPA >= 3.5 ? 'text-emerald-500' : cumGPA >= 3.0 ? 'text-blue-500'
    : cumGPA >= 2.5 ? 'text-amber-500' : cumGPA >= 2.0 ? 'text-orange-500' : 'text-red-500'

  const gpaLabel = cumGPA >= 3.5 ? 'Yüksek Onur' : cumGPA >= 3.0 ? 'Onur' :
    cumGPA >= 2.0 ? 'Normal' : cumGPA > 0 ? 'Düşük' : '—'

  return (
    <div className="flex flex-col h-full bg-bg-main transition-colors duration-300">
      {/* Topbar */}
      <div className="h-14 bg-bg-side border-b border-border-subtle flex items-center px-5 pl-14 lg:px-5 gap-3 flex-shrink-0 transition-colors duration-300">
        <BarChart2 size={16} className="text-estu-red flex-shrink-0" />
        <h1 className="font-syne text-[15px] font-bold text-text-main flex-1">GPA Hesaplama</h1>
        <button onClick={reset} className="flex items-center gap-1.5 bg-bg-card hover:bg-border-subtle border border-border-subtle text-text-muted hover:text-text-main text-[12px] font-sans px-3 py-1.5 rounded-[8px] transition-all">
          <RotateCcw size={12} /> Sıfırla
        </button>
        <button onClick={addSemester} className="flex items-center gap-1.5 bg-estu-red hover:bg-estu-red-hover text-white text-[12px] font-sans font-medium px-3 py-1.5 rounded-[8px] transition-colors">
          <Plus size={13} /> Dönem Ekle
        </button>
      </div>

      {/* Main Content Area (Mobilde alt alta, bilgisayarda yan yana) */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        
        {/* Sol Taraf: Dönemler ve Dersler */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3 custom-scrollbar">
          {semesters.map((sem) => {
            const { gpa: semGPA, totalCredits: semCredits } = calcSemesterGPA(sem.courses)
            const semGpaColor = GRADE_COLOR[Math.round(semGPA * 2) / 2] || 'text-text-muted'
            return (
              <div key={sem.id} className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden transition-colors duration-300">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
                  <input type="text" value={sem.name} onChange={e => updateSemesterName(sem.id, e.target.value)} className="flex-1 bg-transparent text-[13.5px] font-syne font-bold text-text-main outline-none min-w-0" />
                  <span className={`text-[13px] font-syne font-bold ${semGpaColor}`}>{semGPA.toFixed(2)}</span>
                  <span className="text-[11px] text-text-muted font-sans">{semCredits} kredi</span>
                  <button onClick={() => toggleSemester(sem.id)} className="text-text-muted hover:text-text-main transition-colors">
                    {sem.expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                  {semesters.length > 1 && (
                    <button onClick={() => removeSemester(sem.id)} className="text-text-muted hover:text-red-500 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {sem.expanded && (
                  <div className="px-4 py-3">
                    <div className="grid grid-cols-[1fr_80px_80px_32px] gap-2 mb-2 px-1">
                      {['Ders Adı', 'Kredi', 'Not', ''].map(h => (
                        <span key={h} className="text-[10px] text-text-muted font-sans tracking-wider uppercase">{h}</span>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      {sem.courses.map(course => {
                        const g = LETTER_GRADES.find(g => g.letter === course.grade)
                        const ptColor = g ? (GRADE_COLOR[g.points] || 'text-text-muted') : 'text-text-muted'
                        return (
                          <div key={course.id} className="grid grid-cols-[1fr_80px_80px_32px] gap-2 items-center">
                            <input type="text" value={course.name} onChange={e => updateCourse(sem.id, course.id, 'name', e.target.value)} placeholder="Ders adı..." className="bg-bg-main border border-border-subtle rounded-[8px] px-2.5 py-2 text-[12.5px] text-text-main placeholder-text-muted/50 font-sans outline-none focus:border-estu-red/50 transition-colors w-full" />
                            <select value={course.credits} onChange={e => updateCourse(sem.id, course.id, 'credits', Number(e.target.value))} className="bg-bg-main border border-border-subtle rounded-[8px] px-2 py-2 text-[12.5px] text-text-main font-sans outline-none focus:border-estu-red/50 transition-colors w-full">
                              {[1,2,3,4,5,6].map(c => (<option key={c} value={c}>{c}</option>))}
                            </select>
                            <select value={course.grade} onChange={e => updateCourse(sem.id, course.id, 'grade', e.target.value)} className={`bg-bg-main border border-border-subtle rounded-[8px] px-2 py-2 text-[12.5px] font-sans font-bold outline-none focus:border-estu-red/50 transition-colors w-full ${ptColor}`}>
                              {LETTER_GRADES.map(g => (<option key={g.letter} value={g.letter}>{g.letter} ({g.points.toFixed(1)})</option>))}
                            </select>
                            <button onClick={() => removeCourse(sem.id, course.id)} disabled={sem.courses.length === 1} className="w-8 h-8 flex items-center justify-center rounded-[7px] text-text-muted hover:text-red-500 hover:bg-red-500/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                    <button onClick={() => addCourse(sem.id)} className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-text-muted hover:text-estu-red font-sans transition-colors">
                      <Plus size={12} /> Ders Ekle
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Sağ Taraf: Özet Paneli (Mobilde Alta Geçer) */}
        <div className="w-full lg:w-56 border-t lg:border-t-0 lg:border-l border-border-subtle bg-bg-side flex flex-col flex-shrink-0 px-4 py-5 space-y-4 overflow-y-auto transition-colors duration-300">
          <div className="bg-bg-card border border-border-subtle rounded-xl px-4 py-4 text-center transition-colors">
            <p className="text-[10px] text-text-muted font-sans uppercase tracking-widest mb-2">Kümülatif GPA</p>
            <p className={`font-syne text-[36px] font-extrabold ${gpaColor} leading-none`}>{cumGPA.toFixed(2)}</p>
            <div className={`mt-2 inline-block text-[10px] font-sans font-medium px-2.5 py-1 rounded-full ${
                cumGPA >= 3.5 ? 'bg-emerald-500/15 text-emerald-500' :
                cumGPA >= 3.0 ? 'bg-blue-500/15 text-blue-500' :
                cumGPA >= 2.0 ? 'bg-amber-500/15 text-amber-500' :
                cumGPA > 0 ? 'bg-red-500/15 text-red-500' : 'bg-border-subtle text-text-muted'
              }`}>
              {gpaLabel}
            </div>
          </div>
          <div className="space-y-2">
            <div className="bg-bg-card border border-border-subtle rounded-[10px] px-3 py-2.5">
              <p className="text-[10px] text-text-muted font-sans mb-1">Toplam Kredi</p>
              <p className="text-[20px] font-syne font-bold text-text-main">{totalCredits}</p>
            </div>
            <div className="bg-bg-card border border-border-subtle rounded-[10px] px-3 py-2.5">
              <p className="text-[10px] text-text-muted font-sans mb-1">Dönem Sayısı</p>
              <p className="text-[20px] font-syne font-bold text-text-main">{semesters.length}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] text-text-muted font-sans uppercase tracking-wider mb-2">Dönem GPA</p>
            <div className="space-y-1.5">
              {semesters.map(sem => {
                const { gpa } = calcSemesterGPA(sem.courses)
                return (
                  <div key={sem.id}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] text-text-muted font-sans truncate flex-1 pr-2">{sem.name}</span>
                      <span className="text-[11px] font-syne font-bold text-text-main/80">{gpa.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 bg-border-subtle rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{
                          width: `${(gpa / 4.0) * 100}%`,
                          background: gpa >= 3.5 ? '#10b981' : gpa >= 3.0 ? '#3b82f6' : gpa >= 2.0 ? '#f59e0b' : '#ef4444'
                        }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}