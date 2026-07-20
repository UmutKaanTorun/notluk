import { seedData } from '../data/seed'
import type { AppData, CloudConfig } from '../types'

export const DATA_KEY = 'sadenot:data:v1'
export const CLOUD_KEY = 'sadenot:cloud:v1'
export const THEME_KEY = 'sadenot:theme'
export const UI_KEY = 'sadenot:ui:v1'

export interface StoredUiState {
  workspaceId: string
  noteId: string
  filter: 'workspace' | 'all' | 'favorites' | 'shared' | 'trash'
}

const cloneSeed = (): AppData => JSON.parse(JSON.stringify(seedData)) as AppData

export function loadLocalData(storage: Storage = window.localStorage): AppData {
  const raw = storage.getItem(DATA_KEY)
  if (!raw) return cloneSeed()

  try {
    const parsed = JSON.parse(raw) as AppData
    if (!Array.isArray(parsed.workspaces) || !Array.isArray(parsed.notes)) return cloneSeed()
    return parsed
  } catch {
    return cloneSeed()
  }
}

export function saveLocalData(data: AppData, storage: Storage = window.localStorage): void {
  storage.setItem(DATA_KEY, JSON.stringify(data))
}

export function resetLocalData(storage: Storage = window.localStorage): AppData {
  const fresh = cloneSeed()
  saveLocalData(fresh, storage)
  return fresh
}

export function loadCloudConfig(storage: Storage = window.localStorage): CloudConfig | null {
  const envUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
  const envKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (envUrl && envKey && !envUrl.includes('YOUR_PROJECT')) return { url: envUrl, anonKey: envKey }

  const raw = storage.getItem(CLOUD_KEY)
  if (!raw) return null
  try {
    const config = JSON.parse(raw) as CloudConfig
    if (!config.url.startsWith('https://') || config.anonKey.length < 20) return null
    return config
  } catch {
    return null
  }
}

export function saveCloudConfig(config: CloudConfig, storage: Storage = window.localStorage): void {
  storage.setItem(CLOUD_KEY, JSON.stringify(config))
}

export function clearCloudConfig(storage: Storage = window.localStorage): void {
  storage.removeItem(CLOUD_KEY)
}

export function loadUiState(storage: Storage = window.localStorage): StoredUiState {
  const fallback: StoredUiState = {
    workspaceId: 'product-team',
    noteId: 'note-product-meeting',
    filter: 'workspace',
  }
  const raw = storage.getItem(UI_KEY)
  if (!raw) return fallback
  try {
    return { ...fallback, ...(JSON.parse(raw) as Partial<StoredUiState>) }
  } catch {
    return fallback
  }
}

export function saveUiState(state: StoredUiState, storage: Storage = window.localStorage): void {
  storage.setItem(UI_KEY, JSON.stringify(state))
}

export function makeId(prefix: string): string {
  const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  return `${prefix}-${id}`
}

export function initials(nameOrEmail: string): string {
  const clean = nameOrEmail.split('@')[0].trim()
  const parts = clean.split(/[._\-\s]+/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : clean.slice(0, 2)).toUpperCase()
}

export function stripHtml(html: string): string {
  const element = document.createElement('div')
  element.innerHTML = html
  return (element.textContent || '').replace(/\s+/g, ' ').trim()
}
