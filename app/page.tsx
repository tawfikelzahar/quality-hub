import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ background: '#060d1a', color: '#f0f6ff', fontFamily: 'system-ui, sans-serif', minHeight: '100vh' }}>

      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 48px', background: 'rgba(6,13,26,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(15,212,200,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 800, fontSize: 18 }}>
          <div style={{ width: 38, height: 38, background: 'linear-gradient(135deg, #0fd4c8, #00a896)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#060d1a', fontWeight: 900 }}>σ</div>
          QualityTools
        </div>
        <Link href="/spc" style={{ background: 'linear-gradient(135deg, #0fd4c8, #00a896)', color: '#060d1a', fontWeight: 700, fontSize: 13, padding: '9px 20px', borderRadius: 8, textDecoration: 'none' }}>
          Open SPC Engine →
        </Link>
      </nav>

      {/* Hero */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 24px 80px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(15,212,200,0.08)', border: '1px solid rgba(15,212,200,0.2)', borderRadius: 100, padding: '8px 18px', fontSize: 12, fontWeight: 700, color: '#0fd4c8', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 32 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0fd4c8', display: 'inline-block' }}></span>
          Free Quality Engineering Tools
        </div>

        <h1 style={{ fontSize: 'clamp(36px,6vw,80px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, marginBottom: 16 }}>
          <span style={{ display: 'block' }}>Professional Tools for</span>
          <span style={{ display: 'block', background: 'linear-gradient(90deg, #0fd4c8, #e8a020)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Quality Engineers
          </span>
        </h1>

        <p style={{ fontSize: 18, color: '#6b89b4', maxWidth: 520, lineHeight: 1.7, margin: '0 auto 48px', fontWeight: 300 }}>
          Browser-based SPC, MSA & capability analysis. No installation. No cost. No compromise.
        </p>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 80 }}>
          <Link href="/spc" style={{ background: 'linear-gradient(135deg, #0fd4c8, #00a896)', color: '#060d1a', fontWeight: 700, fontSize: 15, padding: '14px 32px', borderRadius: 10, textDecoration: 'none' }}>
            Open SPC Engine →
          </Link>
          <a href="#tools" style={{ border: '1px solid rgba(15,212,200,0.25)', color: '#0fd4c8', fontSize: 14, fontWeight: 500, padding: '14px 28px', borderRadius: 10, textDecoration: 'none', background: 'rgba(15,212,200,0.04)' }}>
            Explore All Tools ↓
          </a>
        </div>

        <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[['100%','Free to Use'],['0','Installation Required'],['6σ','Precision Level'],['10+','Years Experience']].map(([num, label]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#0fd4c8', lineHeight: 1 }}>{num}</div>
              <div style={{ fontSize: 12, color: '#6b89b4', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Tools */}
      <section id="tools" style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 32px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#0fd4c8', marginBottom: 16 }}>The Toolkit</p>
        <h2 style={{ fontSize: 'clamp(28px,4vw,46px)', fontWeight: 800, letterSpacing: -1, marginBottom: 12, lineHeight: 1.1 }}>Everything you need<br/>in one place</h2>
        <p style={{ fontSize: 16, color: '#6b89b4', maxWidth: 480, fontWeight: 300, lineHeight: 1.7, marginBottom: 56 }}>Professional tools that rival Minitab — completely free.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
          <Link href="/spc" style={{ background: 'rgba(11,22,40,0.85)', border: '1px solid rgba(15,212,200,0.15)', borderRadius: 20, padding: 32, textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(15,212,200,0.12)', border: '1px solid rgba(15,212,200,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📊</div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>● Live</span>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>SPC Engine</div>
              <div style={{ fontSize: 14, color: '#6b89b4', lineHeight: 1.65, fontWeight: 300 }}>X̄&R · I-MR · Nelson Rules · Anderson-Darling · Cp Cpk Pp Ppk · Sigma Level · PPM</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['Cp · Cpk · Pp · Ppk','Nelson Rules','Sigma Level','PPM'].map(t => (
                <span key={t} style={{ fontSize: 11, color: '#0fd4c8', background: 'rgba(15,212,200,0.07)', border: '1px solid rgba(15,212,200,0.12)', borderRadius: 20, padding: '3px 10px' }}>{t}</span>
              ))}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0fd4c8' }}>Open Tool →</div>
          </Link>

          <div style={{ background: 'rgba(11,22,40,0.85)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: 32, opacity: 0.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(232,160,32,0.12)', border: '1px solid rgba(232,160,32,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎯</div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: 'rgba(148,163,184,0.08)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.15)' }}>Coming Soon</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>MSA / Gauge R&R</div>
            <div style={{ fontSize: 14, color: '#6b89b4', lineHeight: 1.65 }}>ANOVA & XBAR methods · %R&R · ndc · Interaction charts</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '32px 48px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ fontWeight: 700, color: '#6b89b4' }}>Quality<span style={{ color: '#0fd4c8' }}>Tools</span> · Tawfik Elzahar</div>
        <div style={{ fontSize: 13, color: '#6b89b4' }}>© 2025 Tawfik Elzahar. Free to use.</div>
      </footer>
    </main>
  )
}