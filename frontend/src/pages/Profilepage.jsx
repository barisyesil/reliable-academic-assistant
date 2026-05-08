import { useState } from 'react'
import { User, Save, LogOut, Loader2, CheckCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const DEPARTMENTS = [
  'Bilgisayar Mühendisliği', 'Elektrik-Elektronik Mühendisliği',
  'Makine Mühendisliği', 'Endüstri Mühendisliği',
  'İnşaat Mühendisliği', 'Kimya Mühendisliği',
  'Matematik', 'Fizik', 'İşletme', 'Diğer'
]

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth()
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    student_id: user?.student_id || '',
    department: user?.department || '',
    year_of_study: user?.year_of_study || '',
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const set = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }))

  const handleSave = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.patch('/api/user/me', {
        ...form,
        year_of_study: form.year_of_study ? parseInt(form.year_of_study) : null,
        student_id: form.student_id || null,
        department: form.department || null,
      })
      updateUser(res.data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e.response?.data?.detail || 'Kaydedilemedi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-bg-main transition-colors duration-300">
      <div className="h-14 bg-bg-side border-b border-border-subtle flex items-center px-5 pl-14 lg:px-5 gap-3 flex-shrink-0">
        <User size={16} className="text-estu-red flex-shrink-0" />
        <h1 className="font-syne text-[15px] font-bold text-text-main flex-1">Profilim</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-8 flex justify-center">
        <div className="w-full max-w-md space-y-5">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3 mb-2">
            <div className="w-20 h-20 rounded-2xl bg-estu-red/10 border border-estu-red/20 flex items-center justify-center">
              <span className="text-3xl font-syne font-bold text-estu-red-light">
                {user?.full_name?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
            <div className="text-center">
              <p className="font-syne font-bold text-text-main text-lg">{user?.full_name}</p>
              <p className="text-text-muted text-sm font-sans">{user?.email}</p>
            </div>
          </div>

          {/* Form */}
          <div className="bg-bg-side border border-border-subtle rounded-2xl p-6 space-y-4">
            <h2 className="font-syne font-bold text-text-main text-sm">Profil Bilgileri</h2>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-lg px-3 py-2 font-sans">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs text-text-muted font-sans block mb-1.5">Ad Soyad</label>
              <input type="text" value={form.full_name} onChange={set('full_name')}
                className="w-full bg-bg-card border border-border-subtle rounded-[9px] px-3 py-2.5 text-sm text-text-main font-sans outline-none focus:border-estu-red/50 transition-colors" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-muted font-sans block mb-1.5">Öğrenci No</label>
                <input type="text" value={form.student_id} onChange={set('student_id')}
                  placeholder="221234567"
                  className="w-full bg-bg-card border border-border-subtle rounded-[9px] px-3 py-2.5 text-sm text-text-main font-sans outline-none focus:border-estu-red/50 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-text-muted font-sans block mb-1.5">Sınıf</label>
                <select value={form.year_of_study} onChange={set('year_of_study')}
                  className="w-full bg-bg-card border border-border-subtle rounded-[9px] px-3 py-2.5 text-sm text-text-main font-sans outline-none focus:border-estu-red/50 transition-colors">
                  <option value="">Seç</option>
                  {[1,2,3,4,5].map(y => <option key={y} value={y}>{y}. Sınıf</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-text-muted font-sans block mb-1.5">Bölüm</label>
              <select value={form.department} onChange={set('department')}
                className="w-full bg-bg-card border border-border-subtle rounded-[9px] px-3 py-2.5 text-sm text-text-main font-sans outline-none focus:border-estu-red/50 transition-colors">
                <option value="">Seçiniz</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <button onClick={handleSave} disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-estu-red hover:bg-estu-red-hover disabled:opacity-50 text-white font-sans font-medium text-sm py-2.5 rounded-[9px] transition-colors">
              {loading ? <Loader2 size={15} className="animate-spin" /> : saved ? <CheckCircle size={15} /> : <Save size={15} />}
              {loading ? 'Kaydediliyor...' : saved ? 'Kaydedildi!' : 'Değişiklikleri Kaydet'}
            </button>
          </div>

          {/* Çıkış */}
          <button onClick={logout}
            className="w-full flex items-center justify-center gap-2 bg-bg-side border border-border-subtle hover:border-red-500/30 hover:bg-red-500/5 text-text-muted hover:text-red-500 font-sans text-sm py-2.5 rounded-[9px] transition-colors">
            <LogOut size={15} />
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  )
}