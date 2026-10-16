import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../lib/api'

export default function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api('/login', { method: 'POST', body: JSON.stringify({ password }) })
      navigate('/')
    } catch {
      setError('Wrong password')
    }
  }

  return (
    <form onSubmit={submit} className="min-h-dvh flex flex-col justify-center gap-3 p-6 max-w-sm mx-auto">
      <input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="min-h-12 rounded-lg px-4 border-[0.5px] border-fg bg-bg text-fg"
      />
      <button className="min-h-12 rounded-lg bg-primary text-bg font-medium">Log in</button>
      <p className="text-sm text-primary min-h-5" role="alert">{error}</p>
    </form>
  )
}
