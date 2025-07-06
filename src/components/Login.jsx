import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) setError(error.message)
    else onLogin(data)
  }

  return (
    <form onSubmit={handleLogin}>
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      <button type="submit">Log In</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  )
}

