// Styles for the account page and the saved-projects page (ac-* classes).
// Theme colours come from the --qh-* variables, so light and dark both work.
export default function AccountStyles() {
  return (
    <style>{`
.ac-wrap{max-width:1100px;margin:0 auto;padding:28px 20px 64px;width:100%;box-sizing:border-box}
.ac-card{border:1px solid var(--qh-border);border-radius:14px;background:var(--qh-surface);padding:22px;box-sizing:border-box;min-width:0}
.ac-card-gold{border-color:color-mix(in srgb, var(--qh-gold) 55%, var(--qh-border))}
.ac-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px}
.ac-person{display:flex;align-items:center;gap:16px;min-width:0}
.ac-avatar{width:64px;height:64px;border-radius:50%;background:var(--qh-accent);color:var(--qh-onAccent);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:26px;flex-shrink:0;object-fit:cover}
.ac-name{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ac-name h1{margin:0;font-size:22px;font-weight:700;color:var(--qh-text)}
.ac-meta{font-size:13px;color:var(--qh-muted);margin-top:4px;overflow-wrap:anywhere}
.ac-pill{font-size:11px;font-weight:700;border-radius:4px;padding:3px 8px;line-height:1.2;display:inline-block}
.ac-pill-pro{background:var(--qh-gold);color:var(--qh-onGold)}
.ac-pill-free{color:var(--qh-muted);border:1px solid var(--qh-border)}
.ac-pill-pro-o{color:var(--qh-gold);border:1px solid color-mix(in srgb, var(--qh-gold) 55%, transparent);font-size:10px;padding:1px 6px}
.ac-grid{display:grid;grid-template-columns:230px minmax(0,1fr);gap:24px;align-items:start}
.ac-nav{display:flex;flex-direction:column;gap:4px;position:sticky;top:16px}
.ac-nav a{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:0 14px;border-radius:8px;color:var(--qh-muted);font-size:14px;font-weight:500;text-decoration:none}
.ac-nav a:hover{color:var(--qh-text);background:var(--qh-surface2)}
.ac-nav a[aria-current="page"]{background:var(--qh-surface2);color:var(--qh-text);font-weight:600;box-shadow:inset 3px 0 0 var(--qh-gold)}
[dir="rtl"] .ac-nav a[aria-current="page"]{box-shadow:inset -3px 0 0 var(--qh-gold)}
.ac-count{font-family:var(--font-mono, ui-monospace, monospace);font-size:12px;color:var(--qh-muted)}
.ac-main{display:flex;flex-direction:column;gap:20px;min-width:0}
.ac-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}
.ac-card h2{margin:0;font-size:17px;font-weight:700;color:var(--qh-text)}
.ac-sub{font-size:13px;color:var(--qh-muted);margin-top:3px}
.ac-card-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
.ac-title-row{display:flex;align-items:center;gap:10px}
.ac-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid var(--qh-border)}
.ac-row-title{font-size:14px;font-weight:600;color:var(--qh-text);overflow:hidden;text-overflow:ellipsis}
.ac-row-sub{font-size:12px;color:var(--qh-muted);margin-top:2px}
.ac-row-actions{display:flex;gap:8px;flex-wrap:wrap}
.ac-btn{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:0 14px;border:1px solid var(--qh-border);border-radius:8px;background:transparent;color:var(--qh-text);font:inherit;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;white-space:nowrap}
.ac-btn:hover{background:var(--qh-surface2)}
.ac-btn-primary{background:var(--qh-accent);color:var(--qh-onAccent);border-color:var(--qh-accent)}
.ac-btn-primary:hover{background:var(--qh-accent);opacity:.9}
.ac-btn-gold{background:var(--qh-gold);color:var(--qh-onGold);border-color:var(--qh-gold);font-weight:700}
.ac-btn-gold:hover{background:var(--qh-gold);opacity:.9}
.ac-btn-danger{color:var(--qh-danger);border-color:color-mix(in srgb, var(--qh-danger) 40%, transparent)}
.ac-btn-ghost{color:var(--qh-muted);cursor:default}
.ac-link{font-size:13px;font-weight:600;color:var(--qh-text);text-decoration:none}
.ac-link:hover{text-decoration:underline}
.ac-lead{margin:0 0 14px;font-size:14px;line-height:1.65;color:var(--qh-text)}
.ac-example{border:1px dashed var(--qh-border);border-radius:10px;padding:2px 14px;opacity:.55}
.ac-example .ac-row:first-child{border-top:none}
.ac-cta-row{display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin-top:16px}
.ac-muted{font-size:12px;color:var(--qh-muted)}
.ac-empty{font-size:13px;color:var(--qh-muted);padding:14px 0}
.ac-error{font-size:13px;color:var(--qh-danger);padding:8px 0}
.ac-report{border-radius:10px;background:#FFFFFF;color:#0E1B31;padding:14px 16px;margin-bottom:14px}
.ac-report-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.ac-report-logo{width:120px;height:34px;border:1px dashed #B7C1CF;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#5B6B82;overflow:hidden}
.ac-report-logo img{max-width:92%;max-height:80%;object-fit:contain}
.ac-report-title{font-size:15px;font-weight:700;margin-top:10px}
.ac-report-by{font-size:11px;color:#5B6B82;margin-top:2px}
.ac-plan-name{font-size:22px;font-weight:700;margin:12px 0 2px;color:var(--qh-text)}
.ac-list{margin:12px 0 18px;padding-inline-start:18px;font-size:13px;line-height:1.9;color:var(--qh-text)}
.ac-eyebrow{font-size:12px;font-weight:600;color:var(--qh-gold);margin:16px 0 0;text-transform:uppercase;letter-spacing:.8px}
.ac-form{display:flex;flex-direction:column;gap:14px;max-width:520px}
.ac-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.ac-label{display:block;font-size:12px;font-weight:600;color:var(--qh-muted);margin-bottom:6px}
.ac-input{width:100%;box-sizing:border-box;min-height:40px;padding:8px 12px;border:1px solid var(--qh-border);border-radius:8px;background:var(--qh-bg);color:var(--qh-text);font:inherit;font-size:14px}
.ac-msg-ok{font-size:12px;color:var(--qh-good)}
.ac-msg-err{font-size:12px;color:var(--qh-danger)}
.ac-photo{display:flex;align-items:center;gap:12px}
.ac-photo .ac-avatar{width:48px;height:48px;font-size:18px}
@media (max-width: 820px){
  .ac-grid{grid-template-columns:1fr}
  .ac-nav{position:static;flex-direction:row;overflow-x:auto;gap:6px;padding-bottom:4px;scrollbar-width:none}
  .ac-nav a{flex-shrink:0;border:1px solid var(--qh-border);min-height:40px}
  .ac-nav a[aria-current="page"]{box-shadow:none;border-color:var(--qh-gold)}
  .ac-wrap{padding:18px 16px 48px}
  .ac-card{padding:18px}
}
`}</style>
  )
}
