import { describe, expect, it } from 'vitest'
import { sanitizeNoteHtml } from './sanitize'

describe('note HTML sanitizer', () => {
  it('keeps supported rich text', () => {
    expect(sanitizeNoteHtml('<h2>Başlık</h2><p><strong>Güvenli</strong> metin</p>')).toBe(
      '<h2>Başlık</h2><p><strong>Güvenli</strong> metin</p>',
    )
  })

  it('removes executable content and unsafe links', () => {
    const clean = sanitizeNoteHtml(
      '<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">Bağlantı</a>',
    )
    expect(clean).not.toContain('script')
    expect(clean).not.toContain('onerror')
    expect(clean).not.toContain('javascript:')
    expect(clean).toContain('Bağlantı')
  })
})
