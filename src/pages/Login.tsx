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
    <form onSubmit={submit} className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-3 p-6">
      <h1 className="t-big rise mb-4 text-[52px]">Dictate</h1>
      <input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="min-h-12 bg-c100 px-4 text-ink"
      />
      <button className="t-small min-h-12 bg-ink text-c50">Log in</button>
      <p className="t-small min-h-5 text-hot-text" role="alert">{error}</p>
    </form>
  )
}
