'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <>
      <style>{`
        @keyframes float1 { 0%,100%{transform:translate(0,0) scale(1);opacity:.4} 50%{transform:translate(40px,-60px) scale(1.15);opacity:.65} }
        @keyframes float2 { 0%,100%{transform:translate(0,0) scale(1);opacity:.3} 50%{transform:translate(-30px,40px) scale(.85);opacity:.5} }
        @keyframes float3 { 0%,100%{transform:translate(0,0);opacity:.2} 33%{transform:translate(20px,-30px)} 66%{transform:translate(-15px,20px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .fu{animation:fadeUp .75s ease forwards;opacity:0}
        .fu1{animation-delay:.1s} .fu2{animation-delay:.28s} .fu3{animation-delay:.46s} .fu4{animation-delay:.62s}
        .card{transition:transform .3s ease,border-color .3s ease,box-shadow .3s ease}
        .card:hover{transform:translateY(-7px);box-shadow:0 24px 64px rgba(15,212,200,.1)}
        .btn{transition:transform .25s ease,box-shadow .25s ease}
        .btn:hover{transform:translateY(-2px);box-shadow:0 14px 44px rgba(15,212,200,.35)}
        .nl{transition:color .2s} .nl:hover{color:#0fd4c8!important}
      `}</style>

      <main style={{background:'#060d1a',color:'#f0f6ff',fontFamily:"'Inter',system-ui,sans-serif",minHeight:'100vh'}}>

        {/* ── Animated Background ── */}
        <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,overflow:'hidden'}}>
          <div style={{position:'absolute',top:'-15%',left:'-8%',width:800,height:800,borderRadius:'50%',background:'radial-gradient(circle,rgba(15,212,200,.13) 0%,transparent 68%)',animation:'float1 13s ease-in-out infinite'}}/>
          <div style={{position:'absolute',top:'45%',right:'-12%',width:650,height:650,borderRadius:'50%',background:'radial-gradient(circle,rgba(0,168,150,.1) 0%,transparent 68%)',animation:'float2 16s ease-in-out infinite'}}/>
          <div style={{position:'absolute',bottom:'-8%',left:'28%',width:550,height:550,borderRadius:'50%',background:'radial-gradient(circle,rgba(232,160,32,.07) 0%,transparent 68%)',animation:'float3 20s ease-in-out infinite'}}/>
          <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(15,212,200,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(15,212,200,.025) 1px,transparent 1px)',backgroundSize:'64px 64px'}}/>
        </div>

        {/* ── Nav ── */}
        <nav style={{position:'fixed',top:0,left:0,right:0,zIndex:100,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 48px',height:64,background:'rgba(6,13,26,.88)',backdropFilter:'blur(24px)',borderBottom:'1px solid rgba(15,212,200,.07)'}}>
          <div style={{display:'flex',alignItems:'center',gap:11,fontWeight:800,fontSize:17}}>
            <div style={{width:36,height:36,background:'linear-gradient(135deg,#0fd4c8,#00a896)',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',color:'#060d1a',fontWeight:900,fontSize:16}}>σ</div>
            QualityTools
          </div>
          <div style={{display:'flex',alignItems:'center',gap:32}}>
            <a href="#tools" className="nl" style={{fontSize:14,color:'#8fafd4',textDecoration:'none',fontWeight:500}}>Tools</a>
            <a href="#pricing" className="nl" style={{fontSize:14,color:'#8fafd4',textDecoration:'none',fontWeight:500}}>Pricing</a>
            <a href="/login" className="nl" style={{fontSize:14,color:'#8fafd4',textDecoration:'none',fontWeight:500}}>Sign In</a>
            <a href="/pricing" style={{background:'linear-gradient(135deg,#0fd4c8,#00a896)',color:'#060d1a',fontWeight:700,fontSize:13,padding:'8px 20px',borderRadius:8,textDecoration:'none'}}>Get Pro →</a>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section style={{position:'relative',zIndex:1,minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'120px 24px 80px'}}>

          <div className="fu fu1" style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(15,212,200,.07)',border:'1px solid rgba(15,212,200,.2)',borderRadius:100,padding:'7px 18px',fontSize:11,fontWeight:700,color:'#0fd4c8',letterSpacing:'2px',textTransform:'uppercase',marginBottom:40}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:'#0fd4c8',display:'inline-block',animation:'pulse 2s infinite'}}/>
            Free to start · No installation required
          </div>

          <h1 className="fu fu2" style={{fontSize:'clamp(42px,6.5vw,90px)',fontWeight:900,lineHeight:1.02,letterSpacing:-3,marginBottom:24,maxWidth:960}}>
            The quality engineer's<br/>
            <span style={{background:'linear-gradient(90deg,#0fd4c8 0%,#00d4b0 45%,#e8a020 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>
              secret weapon
            </span>
          </h1>

          <p className="fu fu3" style={{fontSize:19,color:'#6b89b4',maxWidth:520,lineHeight:1.75,margin:'0 auto 52px',fontWeight:300}}>
            Professional SPC, MSA & capability analysis — directly in your browser. No Minitab license. No learning curve.
          </p>

          <div className="fu fu4" style={{display:'flex',gap:14,flexWrap:'wrap',justifyContent:'center',marginBottom:72}}>
            <Link href="/spc" className="btn" style={{background:'linear-gradient(135deg,#0fd4c8,#00a896)',color:'#060d1a',fontWeight:700,fontSize:15,padding:'15px 38px',borderRadius:12,textDecoration:'none'}}>
              Open SPC Engine →
            </Link>
            <a href="#pricing" style={{border:'1px solid rgba(15,212,200,.2)',color:'#0fd4c8',fontSize:14,fontWeight:500,padding:'15px 28px',borderRadius:12,textDecoration:'none',background:'rgba(15,212,200,.04)'}}>
              See Pricing ↓
            </a>
          </div>

          {/* Feature pills */}
          <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center'}}>
            {['X̄-R & I-MR Charts','All 8 Nelson Rules','Cp · Cpk · Pp · Ppk','Anderson-Darling Test','Sigma Level & PPM','Attribute Charts'].map(f=>(
              <span key={f} style={{fontSize:12,color:'#6b89b4',background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.07)',borderRadius:20,padding:'6px 14px'}}>{f}</span>
            ))}
          </div>
        </section>

        {/* ── Tools ── */}
        <section id="tools" style={{position:'relative',zIndex:1,maxWidth:1100,margin:'0 auto',padding:'100px 32px'}}>
          <p style={{fontSize:11,fontWeight:700,letterSpacing:3,textTransform:'uppercase',color:'#0fd4c8',marginBottom:14}}>The Toolkit</p>
          <h2 style={{fontSize:'clamp(30px,4vw,50px)',fontWeight:800,letterSpacing:-1.5,marginBottom:12,lineHeight:1.1}}>
            Everything a quality engineer<br/>needs — in one place
          </h2>
          <p style={{fontSize:15,color:'#6b89b4',maxWidth:440,fontWeight:300,lineHeight:1.7,marginBottom:56}}>
            Tools that rival enterprise software, built for engineers who value their time.
          </p>

          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:20}}>
            {/* SPC — Live */}
            <Link href="/spc" className="card" style={{background:'rgba(11,22,40,.9)',border:'1px solid rgba(15,212,200,.2)',borderRadius:20,padding:32,textDecoration:'none',color:'inherit',display:'flex',flexDirection:'column',gap:20}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div style={{width:52,height:52,borderRadius:14,background:'rgba(15,212,200,.1)',border:'1px solid rgba(15,212,200,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>📊</div>
                <span style={{fontSize:10,fontWeight:700,padding:'4px 12px',borderRadius:20,background:'rgba(34,197,94,.1)',color:'#4ade80',border:'1px solid rgba(34,197,94,.2)',display:'flex',alignItems:'center',gap:5}}>
                  <span style={{width:5,height:5,borderRadius:'50%',background:'#4ade80',display:'inline-block',animation:'pulse 2s infinite'}}/>Live
                </span>
              </div>
              <div>
                <div style={{fontSize:20,fontWeight:700,marginBottom:8}}>SPC Engine</div>
                <div style={{fontSize:13,color:'#6b89b4',lineHeight:1.75,fontWeight:300}}>X̄&R · I-MR · Nelson Rules · Anderson-Darling · Cp · Cpk · Pp · Ppk · Sigma Level · PPM · Attribute Charts</div>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {['Cp·Cpk·Pp·Ppk','Nelson Rules','Sigma Level','PPM'].map(t=>(
                  <span key={t} style={{fontSize:11,color:'#0fd4c8',background:'rgba(15,212,200,.06)',border:'1px solid rgba(15,212,200,.12)',borderRadius:20,padding:'3px 10px'}}>{t}</span>
                ))}
              </div>
              <div style={{fontSize:13,fontWeight:600,color:'#0fd4c8'}}>Open Tool →</div>
            </Link>

            {/* MSA */}
            <div style={{background:'rgba(11,22,40,.45)',border:'1px solid rgba(255,255,255,.04)',borderRadius:20,padding:32,display:'flex',flexDirection:'column',gap:20,opacity:.6}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div style={{width:52,height:52,borderRadius:14,background:'rgba(232,160,32,.08)',border:'1px solid rgba(232,160,32,.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>🎯</div>
                <span style={{fontSize:10,fontWeight:700,padding:'4px 12px',borderRadius:20,background:'rgba(148,163,184,.06)',color:'#64748b',border:'1px solid rgba(148,163,184,.1)'}}>Coming Soon</span>
              </div>
              <div>
                <div style={{fontSize:20,fontWeight:700,marginBottom:8}}>MSA / Gauge R&R</div>
                <div style={{fontSize:13,color:'#6b89b4',lineHeight:1.75,fontWeight:300}}>ANOVA & XBAR methods · %R&R · ndc · Interaction charts</div>
              </div>
            </div>

            {/* FMEA */}
            <div style={{background:'rgba(11,22,40,.45)',border:'1px solid rgba(255,255,255,.04)',borderRadius:20,padding:32,display:'flex',flexDirection:'column',gap:20,opacity:.6}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div style={{width:52,height:52,borderRadius:14,background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>⚠️</div>
                <span style={{fontSize:10,fontWeight:700,padding:'4px 12px',borderRadius:20,background:'rgba(148,163,184,.06)',color:'#64748b',border:'1px solid rgba(148,163,184,.1)'}}>Coming Soon</span>
              </div>
              <div>
                <div style={{fontSize:20,fontWeight:700,marginBottom:8}}>FMEA Builder</div>
                <div style={{fontSize:13,color:'#6b89b4',lineHeight:1.75,fontWeight:300}}>Process & Design FMEA · RPN calculation · Risk matrix · Export to Excel</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" style={{position:'relative',zIndex:1,maxWidth:860,margin:'0 auto',padding:'100px 32px'}}>
          <div style={{textAlign:'center',marginBottom:60}}>
            <p style={{fontSize:11,fontWeight:700,letterSpacing:3,textTransform:'uppercase',color:'#0fd4c8',marginBottom:14}}>Pricing</p>
            <h2 style={{fontSize:'clamp(28px,4vw,48px)',fontWeight:800,letterSpacing:-1.5,marginBottom:12,lineHeight:1.1}}>Start free.<br/>Go pro when you're ready.</h2>
            <p style={{fontSize:15,color:'#6b89b4',fontWeight:300}}>No credit card required to start.</p>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
            {/* Free */}
            <div style={{background:'rgba(11,22,40,.9)',border:'1px solid rgba(255,255,255,.07)',borderRadius:24,padding:40}}>
              <div style={{fontSize:12,fontWeight:700,color:'#6b89b4',letterSpacing:1.5,textTransform:'uppercase',marginBottom:12}}>Free</div>
              <div style={{fontSize:48,fontWeight:900,letterSpacing:-2,marginBottom:4}}>$0</div>
              <div style={{fontSize:13,color:'#6b89b4',marginBottom:32}}>Forever free</div>
              <div style={{display:'flex',flexDirection:'column',gap:11,marginBottom:32}}>
                {['SPC Engine (basic)','Up to 50 data points','X̄-R and I-MR charts','Cp · Cpk calculation'].map(f=>(
                  <div key={f} style={{display:'flex',alignItems:'center',gap:10,fontSize:14,color:'#8fafd4'}}>
                    <span style={{color:'#0fd4c8',fontWeight:700}}>✓</span> {f}
                  </div>
                ))}
                {['Unlimited data points','PDF & Excel export','Save projects','MSA / Gauge R&R'].map(f=>(
                  <div key={f} style={{display:'flex',alignItems:'center',gap:10,fontSize:14,color:'#2d3748'}}>
                    <span>—</span> {f}
                  </div>
                ))}
              </div>
              <a href="/spc" style={{display:'block',textAlign:'center',border:'1px solid rgba(255,255,255,.1)',color:'#6b89b4',fontSize:14,fontWeight:600,padding:'13px',borderRadius:10,textDecoration:'none'}}>
                Start Free
              </a>
            </div>

            {/* Pro */}
            <div style={{background:'linear-gradient(160deg,rgba(15,212,200,.09),rgba(0,168,150,.04))',border:'1px solid rgba(15,212,200,.28)',borderRadius:24,padding:40,position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',top:18,right:18,fontSize:9,fontWeight:800,padding:'4px 12px',borderRadius:20,background:'linear-gradient(135deg,#0fd4c8,#00a896)',color:'#060d1a',letterSpacing:1.5}}>MOST POPULAR</div>
              <div style={{fontSize:12,fontWeight:700,color:'#0fd4c8',letterSpacing:1.5,textTransform:'uppercase',marginBottom:12}}>Pro</div>
              <div style={{fontSize:48,fontWeight:900,letterSpacing:-2,marginBottom:4}}>$9<span style={{fontSize:20,fontWeight:400,color:'#6b89b4'}}>/mo</span></div>
              <div style={{fontSize:13,color:'#6b89b4',marginBottom:32}}>Billed monthly · Cancel anytime</div>
              <div style={{display:'flex',flexDirection:'column',gap:11,marginBottom:32}}>
                {['Everything in Free','Unlimited data points','PDF & Excel export','Save & manage projects','MSA / Gauge R&R (soon)','FMEA Builder (soon)','Priority support'].map(f=>(
                  <div key={f} style={{display:'flex',alignItems:'center',gap:10,fontSize:14,color:'#e2e8f0'}}>
                    <span style={{color:'#0fd4c8',fontWeight:700}}>✓</span> {f}
                  </div>
                ))}
              </div>
              <a href="/pricing" style={{display:'block',textAlign:'center',background:'linear-gradient(135deg,#0fd4c8,#00a896)',color:'#060d1a',fontSize:14,fontWeight:700,padding:'13px',borderRadius:10,textDecoration:'none'}}>
                Get Pro →
              </a>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer style={{position:'relative',zIndex:1,borderTop:'1px solid rgba(255,255,255,.05)',padding:'28px 48px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:16}}>
          <div style={{display:'flex',alignItems:'center',gap:10,fontWeight:700,fontSize:15}}>
            <div style={{width:28,height:28,background:'linear-gradient(135deg,#0fd4c8,#00a896)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',color:'#060d1a',fontWeight:900,fontSize:13}}>σ</div>
            Quality<span style={{color:'#0fd4c8'}}>Tools</span>
            <span style={{color:'#2d3748',fontWeight:400,fontSize:13}}>· Tawfik Elzahar</span>
          </div>
          <div style={{fontSize:12,color:'#2d3748'}}>© 2025 Tawfik Elzahar. All rights reserved.</div>
        </footer>

      </main>
    </>
  )
}