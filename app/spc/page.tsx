'use client'

export default function SPCPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <iframe
        src="/spc-tool.html"
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="SPC Engine - Tawfik Elzahar"
      />
    </div>
  )
}