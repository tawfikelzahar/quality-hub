'use client'

import Link from 'next/link'
import AuthStatus from '@/components/AuthStatus'

export default function SPCPage() {
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#060d1a',fontFamily:'system-ui,sans-serif'}}>

      {/* Nav */}
      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 32px',height:56,background:'rgba(6,13,26,.95)',backdropFilter:'blur(24px)',borderBottom:'1px solid rgba(15,212,200,.1)',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <Link href="/" style={{display:'flex',alignItems:'center',gap:9,textDecoration:'none',color:'#f0f6ff',fontWeight:800,fontSize:15}}>
            <div style={{width:30,height:30,background:'linear-gradient(135deg,#0fd4c8,#00a896)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',color:'#060d1a',fontWeight:900,fontSize:13}}>σ</div>
            QualityTools
          </Link>
          <span style={{color:'rgba(255,255,255,.12)',fontSize:20}}>/</span>
          <span style={{fontSize:13,color:'#6b89b4',fontWeight:500}}>SPC Engine</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <span style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:20,background:'rgba(34,197,94,.1)',color:'#4ade80',border:'1px solid rgba(34,197,94,.2)',display:'flex',alignItems:'center',gap:5}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:'#4ade80',display:'inline-block'}}/>Live
          </span>
          <AuthStatus />
          <Link href="/pricing" style={{background:'linear-gradient(135deg,#0fd4c8,#00a896)',color:'#060d1a',fontWeight:700,fontSize:12,padding:'7px 16px',borderRadius:7,textDecoration:'none'}}>Get Pro →</Link>
        </div>
      </nav>

      {/* SPC Tool */}
      <div style={{flex:1,overflow:'hidden'}}>
        <iframe src="/spc-tool.html" style={{width:'100%',height:'100%',border:'none'}} title="SPC Engine"/>
      </div>

    </div>
  )
}