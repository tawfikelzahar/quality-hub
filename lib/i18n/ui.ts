import { translations, type Dict, type Lang } from './translations'
import { isolateLatinDeep } from './bidi'

// The dictionary the screen uses. Arabic gets the English stretches inside
// its sentences marked left to right (lib/i18n/bidi.ts), worked out once.
// Server-side uses (page titles, structured data, report text) keep reading
// lib/i18n/translations.ts directly, without the invisible marks.
let arDict: Dict | null = null

export function uiDict(lang: Lang): Dict {
  if (lang !== 'ar') return translations[lang]
  if (!arDict) arDict = isolateLatinDeep(translations.ar)
  return arDict
}
