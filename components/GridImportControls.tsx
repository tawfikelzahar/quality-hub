'use client'

// ─────────────────────────────────────────────────────────────────────────
// Small shared UI pieces that go with lib/gridImport.ts's useGridImport().
// Kept separate from the hook so pages that want fully custom markup can
// still use the hook alone — these are just the two bits of UI that are
// identical everywhere: the "which sheet?" chip row and the paste toast.
// ─────────────────────────────────────────────────────────────────────────

interface SheetPickerProps {
  sheetNames: string[]
  activeSheet: string
  onSelect: (name: string) => void
  accentColor: string
  textColor: string
  mutedColor: string
  borderColor: string
}

// Renders nothing when the workbook only has one sheet — uploading never
// blocks on a choice the user didn't need to make.
export function SheetPicker({
  sheetNames,
  activeSheet,
  onSelect,
  accentColor,
  textColor,
  mutedColor,
  borderColor,
}: SheetPickerProps) {
  if (sheetNames.length <= 1) return null
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, color: mutedColor, marginBottom: 6 }}>
        This file has {sheetNames.length} sheets — showing:
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {sheetNames.map(name => {
          const active = name === activeSheet
          return (
            <button
              key={name}
              onClick={() => onSelect(name)}
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 12,
                border: `1px solid ${active ? accentColor : borderColor}`,
                background: active ? `${accentColor}18` : 'transparent',
                color: active ? accentColor : textColor,
                cursor: 'pointer',
              }}
            >
              {name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface PasteToastProps {
  show: boolean
  label?: string
}

// Matches the fixed-position confirmation toast already used by
// Pareto/DPMO/SPC when a paste is picked up.
export function PasteToast({ show, label = '✓ Data pasted' }: PasteToastProps) {
  if (!show) return null
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--qh-accent)',
        color: 'var(--qh-onAccent)',
        padding: '10px 20px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        zIndex: 9999,
      }}
    >
      {label}
    </div>
  )
}
