import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const DEPARTMENTS = [
  'Bilgisayar Mühendisliği', 'Elektrik-Elektronik Mühendisliği',
  'Makine Mühendisliği', 'Endüstri Mühendisliği',
  'İnşaat Mühendisliği', 'Kimya Mühendisliği',
  'Matematik', 'Fizik', 'İşletme', 'Diğer'
]

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    full_name: '', email: '', password: '',
    student_id: '', department: '', year_of_study: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) { setError('Şifre en az 6 karakter olmalı.'); return }
    setLoading(true)
    try {
      await register({
        ...form,
        year_of_study: form.year_of_study ? parseInt(form.year_of_study) : null,
        student_id: form.student_id || null,
        department: form.department || null,
      })
      navigate('/chat', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Kayıt olunamadı.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-[14px] bg-estu-red flex items-center justify-center mb-4 shadow-lg shadow-estu-red/20">
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 className="font-syne text-xl font-extrabold text-text-main">Hesap Oluştur</h1>
          <p className="text-text-muted text-sm font-sans mt-1">ESTÜ Asistan'a hoş geldin</p>
        </div>

        <div className="bg-bg-side border border-border-subtle rounded-2xl p-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-lg px-3 py-2 font-sans mb-4">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-text-muted font-sans block mb-1.5">Ad Soyad *</label>
              <input type="text" required value={form.full_name} onChange={set('full_name')}
                placeholder="Barış Yeşildağ"
                className="w-full bg-bg-card border border-border-subtle rounded-[9px] px-3 py-2.5 text-sm text-text-main placeholder-text-muted/50 font-sans outline-none focus:border-estu-red/50 transition-colors" />
            </div>
            <div>
              <label className="text-xs text-text-muted font-sans block mb-1.5">E-posta *</label>
              <input type="email" required value={form.email} onChange={set('email')}
                placeholder="ornek@ogrenci.estu.edu.tr"
                className="w-full bg-bg-card border border-border-subtle rounded-[9px] px-3 py-2.5 text-sm text-text-main placeholder-text-muted/50 font-sans outline-none focus:border-estu-red/50 transition-colors" />
            </div>
            <div>
              <label className="text-xs text-text-muted font-sans block mb-1.5">Şifre *</label>
              <input type="password" required value={form.password} onChange={set('password')}
                placeholder="En az 6 karakter"
                className="w-full bg-bg-card border border-border-subtle rounded-[9px] px-3 py-2.5 text-sm text-text-main placeholder-text-muted/50 font-sans outline-none focus:border-estu-red/50 transition-colors" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-muted font-sans block mb-1.5">Öğrenci No</label>
                <input type="text" value={form.student_id} onChange={set('student_id')}
                  placeholder="221234567"
                  className="w-full bg-bg-card border border-border-subtle rounded-[9px] px-3 py-2.5 text-sm text-text-main placeholder-text-muted/50 font-sans outline-none focus:border-estu-red/50 transition-colors" />
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
            <button type="submit" disabled={loading}
              className="w-full bg-estu-red hover:bg-estu-red-hover disabled:opacity-50 text-white font-sans font-medium text-sm py-2.5 rounded-[9px] transition-colors mt-2">
              {loading ? 'Kayıt oluşturuluyor...' : 'Kayıt Ol'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-text-muted font-sans mt-4">
          Zaten hesabın var mı?{' '}
          <Link to="/login" className="text-estu-red hover:text-estu-red-hover transition-colors">
            Giriş yap
          </Link>
        </p>
      </div>
    </div>
  )
}