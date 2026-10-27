import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../api/client'
import { Alert, Spinner } from '../components/ui'

const DEMO = [
  { role: 'Admin', email: 'admin@sims.io', password: 'admin123' },
  { role: 'Manager', email: 'manager@sims.io', password: 'manager123' },
  { role: 'Sales', email: 'sales@sims.io', password: 'sales123' },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('sales@sims.io')
  const [password, setPassword] = useState('sales123')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(errorMessage(err, 'Login failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h2>📚 BookExpert</h2>
        <p className="sub">Sales &amp; Inventory Management</p>
        <Alert kind="error">{error}</Alert>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} autoComplete="username"
              onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? <Spinner /> : 'Sign in'}
          </button>
        </form>
        <div className="demo-accounts">
          <strong>Demo accounts</strong> (click to fill):
          {DEMO.map((d) => (
            <div key={d.email} className="pick" onClick={() => { setEmail(d.email); setPassword(d.password) }}>
              {d.role}: <code>{d.email}</code> / <code>{d.password}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
