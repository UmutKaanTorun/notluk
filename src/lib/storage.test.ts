import { beforeEach, describe, expect, it } from 'vitest'
import { DATA_KEY, initials, loadLocalData, makeId, resetLocalData, saveLocalData, stripHtml } from './storage'

describe('local storage helpers', () => {
  beforeEach(() => localStorage.clear())

  it('loads seeded content when storage is empty', () => {
    const data = loadLocalData()
    expect(data.workspaces.length).toBeGreaterThan(0)
    expect(data.notes.some((note) => note.title === 'Pazartesi ürün toplantısı')).toBe(true)
  })

  it('persists and restores data', () => {
    const data = resetLocalData()
    data.workspaces[0].name = 'Yeni isim'
    saveLocalData(data)
    expect(JSON.parse(localStorage.getItem(DATA_KEY) || '{}').workspaces[0].name).toBe('Yeni isim')
    expect(loadLocalData().workspaces[0].name).toBe('Yeni isim')
  })

  it('creates readable initials and strips html', () => {
    expect(initials('Umut Torun')).toBe('UT')
    expect(initials('elif.kaya@example.com')).toBe('EK')
    expect(stripHtml('<h2>Başlık</h2><p>Metin</p>')).toBe('BaşlıkMetin')
    expect(makeId('note')).toMatch(/^note-/)
  })
})
