import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/chat', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Giriş yapılamadı.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-[14px] bg-estu-red flex items-center justify-center mb-4 shadow-lg shadow-estu-red/20">
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 className="font-syne text-xl font-extrabold text-text-main">ESTÜ Asistan</h1>
          <p className="text-text-muted text-sm font-sans mt-1">Hesabına giriş yap</p>
        </div>

        {/* Form */}
        <div className="bg-bg-side border border-border-subtle rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-lg px-3 py-2 font-sans">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-text-muted font-sans block mb-1.5">E-posta</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="ornek@ogrenci.estu.edu.tr"
                className="w-full bg-bg-card border border-border-subtle rounded-[9px] px-3 py-2.5 text-sm text-text-main placeholder-text-muted/50 font-sans outline-none focus:border-estu-red/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted font-sans block mb-1.5">Şifre</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                className="w-full bg-bg-card border border-border-subtle rounded-[9px] px-3 py-2.5 text-sm text-text-main placeholder-text-muted/50 font-sans outline-none focus:border-estu-red/50 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-estu-red hover:bg-estu-red-hover disabled:opacity-50 text-white font-sans font-medium text-sm py-2.5 rounded-[9px] transition-colors"
            >
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-text-muted font-sans mt-4">
          Hesabın yok mu?{' '}
          <Link to="/register" className="text-estu-red hover:text-estu-red-hover transition-colors">
            Kayıt ol
          </Link>
        </p>
      </div>
    </div>
  )
}