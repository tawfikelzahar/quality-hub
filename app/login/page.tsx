'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  async function handleSubmit() {
    setLoading(true)
    setError('')
    const supabase = createClient()

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      setError('✅ Check your email to confirm your account.')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/spc')
  }

  return (
    <div style={{minHeight:'100vh',background:'#060d1a',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,fontFamily:'system-ui,sans-serif'}}>

      {/* Logo */}
      <Link href="/" style={{display:'flex',alignItems:'center',gap:10,textDecoration:'none',color:'#f0f6ff',fontWeight:800,fontSize:18,marginBottom:40}}>
        <div style={{width:38,height:38,background:'linear-gradient(135deg,#0fd4c8,#00a896)',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',color:'#060d1a',fontWeight:900,fontSize:17}}>σ</div>
        QualityTools
      </Link>

      {/* Card */}
      <div style={{width:'100%',maxWidth:420,background:'rgba(11,22,40,.9)',border:'1px solid rgba(15,212,200,.15)',borderRadius:24,padding:40}}>

        {/* Toggle */}
        <div style={{display:'flex',background:'rgba(255,255,255,.04)',borderRadius:12,padding:4,marginBottom:32}}>
          {(['login','signup'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{flex:1,padding:'9px',borderRadius:9,border:'none',cursor:'pointer',fontWeight:600,fontSize:13,transition:'all .2s',background: mode===m ? 'rgba(15,212,200,.15)' : 'transparent',color: mode===m ? '#0fd4c8' : '#6b89b4'}}>
              {m === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <h1 style={{fontSize:22,fontWeight:800,marginBottom:6,color:'#f0f6ff'}}>
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p style={{fontSize:13,color:'#6b89b4',marginBottom:28}}>
          {mode === 'login' ? 'Sign in to access your tools' : 'Free forever. No credit card required.'}
        </p>

        {/* Fields */}
        <div style={{display:'flex',flexDirection:'column',gap:14,marginBottom:20}}>
          <div>
            <label style={{fontSize:12,fontWeight:600,color:'#8fafd4',display:'block',marginBottom:6}}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              style={{width:'100%',padding:'12px 14px',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:10,color:'#f0f6ff',fontSize:14,outline:'none',boxSizing:'border-box'}}
            />
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:600,color:'#8fafd4',display:'block',marginBottom:6}}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={{width:'100%',padding:'12px 14px',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:10,color:'#f0f6ff',fontSize:14,outline:'none',boxSizing:'border-box'}}
            />
          </div>
        </div>

        {error && (
          <div style={{fontSize:13,padding:'10px 14px',borderRadius:9,marginBottom:16,background: error.startsWith('✅') ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',color: error.startsWith('✅') ? '#4ade80' : '#f87171',border:`1px solid ${error.startsWith('✅') ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`}}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{width:'100%',padding:'13px',background:'linear-gradient(135deg,#0fd4c8,#00a896)',color:'#060d1a',fontWeight:700,fontSize:15,borderRadius:11,border:'none',cursor:'pointer',opacity: loading ? .7 : 1}}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
        </button>

        <p style={{textAlign:'center',fontSize:12,color:'#4a6080',marginTop:24}}>
          By continuing, you agree to our{' '}
          <a href="#" style={{color:'#0fd4c8',textDecoration:'none'}}>Terms</a>
          {' & '}
          <a href="#" style={{color:'#0fd4c8',textDecoration:'none'}}>Privacy Policy</a>
        </p>
      </div>
    </div>
  )
}