import { useState, useRef, useEffect } from 'react'
import { BarChart2, Plus, Trash2, RotateCcw, ChevronDown, ChevronUp, FileText, Loader2, Save, CheckCircle } from 'lucide-react'
import api from '../services/api'

const LETTER_GRADES = [
  { letter: 'AA', points: 4.0 }, { letter: 'AB', points: 3.7 },
  { letter: 'BA', points: 3.3 }, { letter: 'BB', points: 3.0 },
  { letter: 'BC', points: 2.7 }, { letter: 'CB', points: 2.3 },
  { letter: 'CC', points: 2.0 }, { letter: 'CD', points: 1.7 },
  { letter: 'DC', points: 1.3 }, { letter: 'DD', points: 1.0 },
  { letter: 'FF', points: 0.0 }, { letter: 'S', points: 0.0 }, { letter: 'U', points: 0.0 }
]

const GRADE_COLOR = {
  4.0: 'text-emerald-500', 3.7: 'text-emerald-500',
  3.3: 'text-blue-500', 3.0: 'text-blue-500',
  2.7: 'text-amber-500', 2.3: 'text-amber-500',
  2.0: 'text-orange-500', 1.7: 'text-orange-500',
  1.3: 'text-red-500', 1.0: 'text-red-500', 0.0: 'text-red-600',
}

function calcGPA(courses) {
  const valid = courses.filter(c => !['S', 'U'].includes(c.grade))
  if (!valid.length) return { gpa: 0, totalCredits: 0 }
  let pts = 0, creds = 0
  valid.forEach(c => {
    const g = LETTER_GRADES.find(g => g.letter === c.grade)
    if (g) { pts += g.points * Number(c.credits); creds += Number(c.credits) }
  })
  return { gpa: creds ? pts / creds : 0, totalCredits: creds }
}

function groupBySemester(courses) {
  const map = {}
  courses.forEach(c => {
    if (!map[c.semester]) map[c.semester] = { name: c.semester, expanded: true, courses: [] }
    map[c.semester].courses.push(c)
  })
  return Object.values(map)
}

export default function GPAPage() {
  const [semesters, setSemesters] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const fileInputRef = useRef(null)

  // DB'den dersleri yükle
  useEffect(() => {
    loadCourses()
  }, [])

  const loadCourses = async () => {
    setIsLoading(true)
    try {
      const res = await api.get('/api/user/courses')
      const courses = res.data
      if (courses.length > 0) {
        setSemesters(groupBySemester(courses))
      } else {
        setSemesters([{ name: '1. Dönem', expanded: true, courses: [defaultCourse()] }])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  const defaultCourse = () => ({
    id: 'local_' + Date.now() + Math.random(),
    course_code: '', course_name: '', credits: 3.0, grade: 'BB', semester: '', isLocal: true
  })

  const addSemester = () => setSemesters(prev => [
    ...prev,
    { name: `${prev.length + 1}. Dönem`, expanded: true, courses: [defaultCourse()] }
  ])

  const toggleSemester = (idx) => setSemesters(prev =>
    prev.map((s, i) => i === idx ? { ...s, expanded: !s.expanded } : s)
  )

  const addCourse = (semIdx) => setSemesters(prev =>
    prev.map((s, i) => i === semIdx ? { ...s, courses: [...s.courses, defaultCourse()] } : s)
  )

  const removeCourse = async (semIdx, courseId) => {
    if (!String(courseId).startsWith('local_')) {
      try { await api.delete(`/api/user/courses/${courseId}`) } catch (e) { console.error(e) }
    }
    setSemesters(prev => prev.map((s, i) =>
      i === semIdx ? { ...s, courses: s.courses.filter(c => c.id !== courseId) } : s
    ).filter(s => s.courses.length > 0))
  }

  const updateCourse = (semIdx, courseId, field, value) => setSemesters(prev =>
    prev.map((s, i) => i === semIdx
      ? { ...s, courses: s.courses.map(c => c.id === courseId ? { ...c, [field]: value } : c) }
      : s)
  )

  // Tüm değişiklikleri DB'ye kaydet
  const saveAll = async () => {
    setIsSaving(true)
    try {
      // Lokal (yeni) kursları DB'ye ekle
      for (const sem of semesters) {
        for (const c of sem.courses) {
          if (String(c.id).startsWith('local_') && c.course_code.trim()) {
            await api.post('/api/user/courses', {
              course_code: c.course_code,
              course_name: c.course_name,
              credits: Number(c.credits),
              grade: c.grade,
              semester: sem.name,
              source: 'manual',
            })
          }
        }
      }
      await loadCourses()
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2500)
    } catch (e) {
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await api.post('/api/parse-transcript', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      if (!res.data.semesters?.length) {
        alert('Transkript okundu ancak ders bulunamadı.')
        return
      }
      await loadCourses()
    } catch (e) {
      console.error(e)
      alert('Transkript okunamadı.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const allCourses = semesters.flatMap(s => s.courses)
  const { gpa: cumGPA, totalCredits } = calcGPA(allCourses)
  const gpaColor = cumGPA >= 3.5 ? 'text-emerald-500' : cumGPA >= 3.0 ? 'text-blue-500' : cumGPA >= 2.5 ? 'text-amber-500' : cumGPA >= 2.0 ? 'text-orange-500' : 'text-red-500'
  const gpaLabel = cumGPA >= 3.5 ? 'Yüksek Onur' : cumGPA >= 3.0 ? 'Onur' : cumGPA >= 2.0 ? 'Normal' : cumGPA > 0 ? 'Düşük' : '—'

  return (
    <div className="flex flex-col h-full bg-bg-main transition-colors duration-300">
      <input type="file" accept="application/pdf" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

      {/* Topbar */}
      <div className="h-14 bg-bg-side border-b border-border-subtle flex items-center px-5 pl-14 lg:px-5 gap-3 flex-shrink-0">
        <BarChart2 size={16} className="text-estu-red flex-shrink-0" />
        <h1 className="font-syne text-[15px] font-bold text-text-main flex-1">GPA Hesaplama</h1>

        {savedMsg && (
          <div className="flex items-center gap-1.5 text-emerald-500 text-xs font-sans">
            <CheckCircle size={13} /> Kaydedildi
          </div>
        )}

        <button onClick={() => fileInputRef.current.click()} disabled={isUploading}
          className="flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-500 text-[12px] font-sans font-medium px-3 py-1.5 rounded-[8px] transition-colors disabled:opacity-50">
          {isUploading ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
          <span className="hidden sm:inline">{isUploading ? 'İşleniyor...' : 'Transkript Yükle'}</span>
        </button>

        <button onClick={saveAll} disabled={isSaving}
          className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-500 text-[12px] font-sans font-medium px-3 py-1.5 rounded-[8px] transition-colors disabled:opacity-50">
          {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          <span className="hidden sm:inline">Kaydet</span>
        </button>

        <button onClick={addSemester}
          className="flex items-center gap-1.5 bg-estu-red hover:bg-estu-red-hover text-white text-[12px] font-sans font-medium px-3 py-1.5 rounded-[8px] transition-colors">
          <Plus size={13} /> Dönem Ekle
        </button>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Dönemler */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-estu-red border-t-transparent rounded-full animate-spin" />
            </div>
          ) : semesters.map((sem, semIdx) => {
            const { gpa: semGPA, totalCredits: semCreds } = calcGPA(sem.courses)
            const semColor = GRADE_COLOR[Math.round(semGPA * 2) / 2] || 'text-text-muted'
            return (
              <div key={sem.name + semIdx} className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle bg-border-subtle/30">
                  <input type="text" value={sem.name}
                    onChange={e => setSemesters(prev => prev.map((s, i) => i === semIdx ? { ...s, name: e.target.value } : s))}
                    className="flex-1 bg-transparent text-[13.5px] font-syne font-bold text-text-main outline-none min-w-0" />
                  <span className={`text-[13px] font-syne font-bold ${semColor}`}>{semGPA.toFixed(2)}</span>
                  <span className="text-[11px] text-text-muted font-sans">{semCreds} AKTS</span>
                  <button onClick={() => toggleSemester(semIdx)} className="text-text-muted hover:text-text-main">
                    {sem.expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>

                {sem.expanded && (
                  <div className="px-4 py-3">
                    <div className="grid grid-cols-[1fr_70px_70px_32px] gap-2 mb-2 px-1">
                      {['Ders Kodu/Adı', 'AKTS', 'Not', ''].map(h => (
                        <span key={h} className="text-[10px] text-text-muted font-sans uppercase tracking-wider">{h}</span>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      {sem.courses.map(course => {
                        const g = LETTER_GRADES.find(g => g.letter === course.grade)
                        const ptColor = g ? (GRADE_COLOR[g.points] || 'text-text-muted') : 'text-text-muted'
                        return (
                          <div key={course.id} className="grid grid-cols-[1fr_70px_70px_32px] gap-2 items-center">
                            <input type="text"
                              value={course.course_code ? `${course.course_code} - ${course.course_name}` : ''}
                              onChange={e => {
                                const parts = e.target.value.split(' - ')
                                updateCourse(semIdx, course.id, 'course_code', parts[0] || '')
                                updateCourse(semIdx, course.id, 'course_name', parts.slice(1).join(' - ') || '')
                              }}
                              placeholder="BİL101 - Programlama"
                              className="bg-bg-main border border-border-subtle rounded-[8px] px-2.5 py-2 text-[12.5px] text-text-main placeholder-text-muted/50 font-sans outline-none focus:border-estu-red/50 transition-colors w-full" />
                            <input type="number" step="0.5" min="0" value={course.credits}
                              onChange={e => updateCourse(semIdx, course.id, 'credits', e.target.value)}
                              className="bg-bg-main border border-border-subtle rounded-[8px] px-2 py-2 text-[12.5px] text-text-main font-sans outline-none focus:border-estu-red/50 transition-colors w-full text-center" />
                            <select value={course.grade}
                              onChange={e => updateCourse(semIdx, course.id, 'grade', e.target.value)}
                              className={`bg-bg-main border border-border-subtle rounded-[8px] px-2 py-2 text-[12px] font-sans font-bold outline-none focus:border-estu-red/50 transition-colors w-full ${ptColor}`}>
                              {LETTER_GRADES.map(g => <option key={g.letter} value={g.letter}>{g.letter}</option>)}
                            </select>
                            <button onClick={() => removeCourse(semIdx, course.id)}
                              disabled={sem.courses.length === 1}
                              className="w-8 h-8 flex items-center justify-center rounded-[7px] text-text-muted hover:text-red-500 hover:bg-red-500/10 disabled:opacity-20 transition-colors">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                    <button onClick={() => addCourse(semIdx)}
                      className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-text-muted hover:text-estu-red font-sans transition-colors">
                      <Plus size={12} /> Ders Ekle
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Özet Paneli */}
        <div className="w-full lg:w-56 border-t lg:border-t-0 lg:border-l border-border-subtle bg-bg-side flex flex-col flex-shrink-0 px-4 py-5 space-y-4 overflow-y-auto">
          <div className="bg-bg-card border border-border-subtle rounded-xl px-4 py-4 text-center">
            <p className="text-[10px] text-text-muted font-sans uppercase tracking-widest mb-2">Kümülatif GPA</p>
            <p className={`font-syne text-[36px] font-extrabold ${gpaColor} leading-none`}>{cumGPA.toFixed(2)}</p>
            <div className={`mt-2 inline-block text-[10px] font-sans font-medium px-2.5 py-1 rounded-full
              ${cumGPA >= 3.5 ? 'bg-emerald-500/15 text-emerald-500' : cumGPA >= 3.0 ? 'bg-blue-500/15 text-blue-500' : cumGPA >= 2.0 ? 'bg-amber-500/15 text-amber-500' : cumGPA > 0 ? 'bg-red-500/15 text-red-500' : 'bg-border-subtle text-text-muted'}`}>
              {gpaLabel}
            </div>
          </div>
          <div className="space-y-2">
            <div className="bg-bg-card border border-border-subtle rounded-[10px] px-3 py-2.5 flex justify-between items-center">
              <p className="text-[11px] text-text-muted font-sans">Toplam AKTS</p>
              <p className="text-[16px] font-syne font-bold text-text-main">{totalCredits}</p>
            </div>
            <div className="bg-bg-card border border-border-subtle rounded-[10px] px-3 py-2.5 flex justify-between items-center">
              <p className="text-[11px] text-text-muted font-sans">Dönem Sayısı</p>
              <p className="text-[16px] font-syne font-bold text-text-main">{semesters.length}</p>
            </div>
          </div>
          <div className="text-[10px] text-text-muted font-sans text-center leading-relaxed">
            Değişiklikleri kaydetmek için üstteki <strong>Kaydet</strong> butonunu kullan. Transkript yükleyerek de otomatik doldurabilirsin.
          </div>
        </div>
      </div>
    </div>
  )
}