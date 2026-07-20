import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type {
  AppData,
  CloudConfig,
  Member,
  MemberRole,
  Note,
  SaveState,
  ToastMessage,
  Workspace,
} from '../types'
import {
  clearCloudConfig,
  initials,
  loadCloudConfig,
  loadLocalData,
  loadUiState,
  makeId,
  resetLocalData,
  saveCloudConfig,
  saveLocalData,
  saveUiState,
  stripHtml,
} from '../lib/storage'
import {
  createCloudWorkspace,
  exchangeDeepLink,
  getSupabase,
  inviteCloudMember,
  loadCloudData,
  sendMagicLink,
  upsertCloudNote,
} from '../lib/supabase'
import { sanitizeNoteHtml } from '../lib/sanitize'

export type NoteFilter = 'workspace' | 'all' | 'favorites' | 'shared' | 'trash'

const emptyData: AppData = {
  user: { id: '', name: '', email: '', avatar: '' },
  workspaces: [],
  members: [],
  notes: [],
}

function uuid(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : makeId('id')
}

function openExternal(url: string) {
  if (window.desktop) return window.desktop.openExternal(url)
  window.location.href = url
  return Promise.resolve(true)
}

export function useNotluk() {
  const initialUi = useMemo(() => loadUiState(), [])
  const [cloudConfig, setCloudConfigState] = useState<CloudConfig | null>(() => loadCloudConfig())
  const [session, setSession] = useState<Session | null>(null)
  const [data, setData] = useState<AppData>(() => (cloudConfig ? emptyData : loadLocalData()))
  const [loading, setLoading] = useState(Boolean(cloudConfig))
  const [authLoading, setAuthLoading] = useState(Boolean(cloudConfig))
  const [saveState, setSaveState] = useState<SaveState>(cloudConfig ? 'saving' : 'saved')
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(initialUi.workspaceId)
  const [activeNoteId, setActiveNoteId] = useState(initialUi.noteId)
  const [filter, setFilter] = useState<NoteFilter>(initialUi.filter)
  const [search, setSearch] = useState('')
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const clientRef = useRef<SupabaseClient | null>(null)
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isCloud = Boolean(cloudConfig)

  const toast = useCallback((text: string, kind: ToastMessage['kind'] = 'success') => {
    const id = makeId('toast')
    setToasts((current) => [...current, { id, kind, text }])
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3200)
  }, [])

  const refreshCloud = useCallback(
    async (client: SupabaseClient, currentSession: Session, quiet = false) => {
      try {
        if (!quiet) setLoading(true)
        const cloudData = await loadCloudData(client, currentSession)
        setData(cloudData)
        setActiveWorkspaceId((current) =>
          cloudData.workspaces.some((workspace) => workspace.id === current)
            ? current
            : cloudData.workspaces[0]?.id || '',
        )
        setActiveNoteId((current) =>
          cloudData.notes.some((note) => note.id === current) ? current : cloudData.notes[0]?.id || '',
        )
        setSaveState('saved')
      } catch (error) {
        console.error(error)
        setSaveState(navigator.onLine ? 'error' : 'offline')
        if (!quiet) toast('Bulut verileri yüklenemedi.', 'error')
      } finally {
        setLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    if (!cloudConfig) {
      setAuthLoading(false)
      setLoading(false)
      return
    }

    const client = getSupabase(cloudConfig)
    clientRef.current = client
    let alive = true
    let channel: ReturnType<SupabaseClient['channel']> | null = null

    const bindRealtime = (activeSession: Session) => {
      if (channel) client.removeChannel(channel)
      const scheduleRefresh = () => {
        if (refreshTimer.current) clearTimeout(refreshTimer.current)
        refreshTimer.current = setTimeout(() => refreshCloud(client, activeSession, true), 700)
      }
      channel = client
        .channel(`notluk:${activeSession.user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members' }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces' }, scheduleRefresh)
        .subscribe()
    }

    client.auth.getSession().then(({ data: authData }) => {
      if (!alive) return
      setSession(authData.session)
      setAuthLoading(false)
      if (authData.session) {
        bindRealtime(authData.session)
        refreshCloud(client, authData.session)
      } else {
        setLoading(false)
      }
    })

    const { data: subscription } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive) return
      setSession(nextSession)
      setAuthLoading(false)
      if (nextSession) {
        bindRealtime(nextSession)
        void refreshCloud(client, nextSession)
      } else {
        setData(emptyData)
        setLoading(false)
      }
    })

    const removeDeepLink = window.desktop?.onDeepLink((url) => {
      exchangeDeepLink(client, url).catch((error) => {
        console.error(error)
        toast('Giriş bağlantısı doğrulanamadı.', 'error')
      })
    })

    return () => {
      alive = false
      subscription.subscription.unsubscribe()
      removeDeepLink?.()
      if (channel) void client.removeChannel(channel)
    }
  }, [cloudConfig, refreshCloud, toast])

  useEffect(() => {
    const onOnline = () => setSaveState('saved')
    const onOffline = () => setSaveState('offline')
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    if (!isCloud && data.user.id) saveLocalData(data)
  }, [data, isCloud])

  useEffect(() => {
    saveUiState({ workspaceId: activeWorkspaceId, noteId: activeNoteId, filter })
  }, [activeNoteId, activeWorkspaceId, filter])

  const activeWorkspace = useMemo(
    () => data.workspaces.find((workspace) => workspace.id === activeWorkspaceId) || data.workspaces[0] || null,
    [activeWorkspaceId, data.workspaces],
  )

  const activeNote = useMemo(
    () => data.notes.find((note) => note.id === activeNoteId) || null,
    [activeNoteId, data.notes],
  )

  const activeMembers = useMemo(
    () => data.members.filter((member) => member.workspaceId === activeWorkspace?.id),
    [activeWorkspace?.id, data.members],
  )

  const writableWorkspaceIds = useMemo(() => {
    if (!isCloud) return new Set(data.workspaces.map((workspace) => workspace.id))
    const ids = new Set(
      data.workspaces.filter((workspace) => workspace.ownerId === data.user.id).map((workspace) => workspace.id),
    )
    data.members.forEach((member) => {
      const belongsToUser = member.userId === data.user.id || member.email === data.user.email
      if (belongsToUser && (member.role === 'owner' || member.role === 'editor')) ids.add(member.workspaceId)
    })
    return ids
  }, [data.members, data.user.email, data.user.id, data.workspaces, isCloud])

  const visibleNotes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('tr')
    return data.notes
      .filter((note) => {
        if (filter === 'trash') return note.archived
        if (note.archived) return false
        if (filter === 'workspace') return note.workspaceId === activeWorkspace?.id
        if (filter === 'favorites') return note.favorite
        if (filter === 'shared') {
          return data.members.some(
            (member) => member.workspaceId === note.workspaceId && member.userId !== data.user.id,
          )
        }
        return true
      })
      .filter((note) => !query || `${note.title} ${note.plainText}`.toLocaleLowerCase('tr').includes(query))
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
  }, [activeWorkspace?.id, data.members, data.notes, data.user.id, filter, search])

  const selectWorkspace = useCallback(
    (workspaceId: string) => {
      setActiveWorkspaceId(workspaceId)
      setFilter('workspace')
      const first = data.notes
        .filter((note) => note.workspaceId === workspaceId && !note.archived)
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))[0]
      setActiveNoteId(first?.id || '')
    },
    [data.notes],
  )

  const selectFilter = useCallback(
    (next: NoteFilter) => {
      setFilter(next)
      const candidate = data.notes
        .filter((note) => {
          if (next === 'trash') return note.archived
          if (note.archived) return false
          if (next === 'favorites') return note.favorite
          if (next === 'shared') {
            return data.members.some(
              (member) => member.workspaceId === note.workspaceId && member.userId !== data.user.id,
            )
          }
          return true
        })
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))[0]
      setActiveNoteId(candidate?.id || '')
      if (candidate) setActiveWorkspaceId(candidate.workspaceId)
    },
    [data.members, data.notes, data.user.id],
  )

  const openNote = useCallback(
    (noteId: string) => {
      const note = data.notes.find((item) => item.id === noteId)
      if (!note) return
      setActiveNoteId(note.id)
      setActiveWorkspaceId(note.workspaceId)
    },
    [data.notes],
  )

  const persistNote = useCallback(
    (note: Note) => {
      if (!isCloud || !clientRef.current) return
      const currentTimer = saveTimers.current.get(note.id)
      if (currentTimer) clearTimeout(currentTimer)
      setSaveState(navigator.onLine ? 'saving' : 'offline')
      const timer = setTimeout(async () => {
        try {
          if (!clientRef.current) return
          await upsertCloudNote(clientRef.current, note)
          setSaveState('saved')
        } catch (error) {
          console.error(error)
          setSaveState(navigator.onLine ? 'error' : 'offline')
          toast('Not kaydedilemedi.', 'error')
        }
      }, 600)
      saveTimers.current.set(note.id, timer)
    },
    [isCloud, toast],
  )

  const createNote = useCallback(async () => {
    const workspace = activeWorkspace || data.workspaces[0]
    if (!workspace) {
      toast('Önce bir çalışma alanı oluştur.', 'info')
      return
    }
    if (!writableWorkspaceIds.has(workspace.id)) {
      toast('Bu çalışma alanında yalnızca görüntüleme yetkin var.', 'info')
      return
    }
    const timestamp = new Date().toISOString()
    const note: Note = {
      id: isCloud ? uuid() : makeId('note'),
      workspaceId: workspace.id,
      title: 'İsimsiz not',
      content: '<p><br></p>',
      plainText: '',
      createdBy: data.user.id,
      updatedBy: data.user.name,
      createdAt: timestamp,
      updatedAt: timestamp,
      favorite: false,
      archived: false,
      version: 1,
    }
    setData((current) => ({ ...current, notes: [note, ...current.notes] }))
    setFilter('workspace')
    setActiveWorkspaceId(workspace.id)
    setActiveNoteId(note.id)
    if (isCloud && clientRef.current) {
      try {
        setSaveState('saving')
        await upsertCloudNote(clientRef.current, note)
        setSaveState('saved')
      } catch (error) {
        console.error(error)
        setSaveState('error')
        toast('Yeni not buluta eklenemedi.', 'error')
      }
    }
  }, [activeWorkspace, data.user.id, data.user.name, data.workspaces, isCloud, toast, writableWorkspaceIds])

  const updateNote = useCallback(
    (noteId: string, patch: Partial<Pick<Note, 'title' | 'content' | 'favorite' | 'archived'>>) => {
      const target = data.notes.find((note) => note.id === noteId)
      if (target && !writableWorkspaceIds.has(target.workspaceId)) {
        toast('Bu notu düzenleme yetkin yok.', 'info')
        return
      }
      setData((current) => {
        let noteToPersist: Note | null = null
        const notes = current.notes.map((note) => {
          if (note.id !== noteId) return note
          const content = patch.content === undefined ? note.content : sanitizeNoteHtml(patch.content)
          noteToPersist = {
            ...note,
            ...patch,
            content,
            plainText: patch.content === undefined ? note.plainText : stripHtml(content).slice(0, 320),
            updatedAt: new Date().toISOString(),
            updatedBy: current.user.name,
            version: note.version + 1,
          }
          return noteToPersist
        })
        if (noteToPersist) queueMicrotask(() => persistNote(noteToPersist as Note))
        return { ...current, notes }
      })
    },
    [data.notes, persistNote, toast, writableWorkspaceIds],
  )

  const createWorkspace = useCallback(
    async (name: string) => {
      const cleanName = name.trim()
      if (!cleanName) return
      try {
        let workspace: Workspace
        if (isCloud && clientRef.current) {
          workspace = await createCloudWorkspace(clientRef.current, data.user, cleanName)
        } else {
          workspace = {
            id: makeId('workspace'),
            name: cleanName,
            ownerId: data.user.id,
            createdAt: new Date().toISOString(),
            color: '#5965e8',
          }
          const owner: Member = {
            id: makeId('member'),
            workspaceId: workspace.id,
            userId: data.user.id,
            name: data.user.name,
            email: data.user.email,
            role: 'owner',
            status: 'active',
            avatar: data.user.avatar,
          }
          setData((current) => ({
            ...current,
            workspaces: [...current.workspaces, workspace],
            members: [...current.members, owner],
          }))
        }
        setActiveWorkspaceId(workspace.id)
        setActiveNoteId('')
        setFilter('workspace')
        toast('Çalışma alanı oluşturuldu.')
        if (isCloud && clientRef.current && session) await refreshCloud(clientRef.current, session, true)
      } catch (error) {
        console.error(error)
        toast('Çalışma alanı oluşturulamadı.', 'error')
      }
    },
    [data.user, isCloud, refreshCloud, session, toast],
  )

  const inviteMember = useCallback(
    async (email: string, role: Exclude<MemberRole, 'owner'>) => {
      const normalized = email.trim().toLowerCase()
      if (!activeWorkspace || !/^\S+@\S+\.\S+$/.test(normalized)) {
        toast('Geçerli bir e-posta adresi gir.', 'error')
        return false
      }
      if (normalized === data.user.email.toLowerCase()) {
        toast('Kendini tekrar davet etmene gerek yok.', 'info')
        return false
      }
      if (!writableWorkspaceIds.has(activeWorkspace.id)) {
        toast('Bu çalışma alanına üye davet etme yetkin yok.', 'error')
        return false
      }
      try {
        let member: Member
        if (isCloud && clientRef.current) {
          member = await inviteCloudMember(clientRef.current, activeWorkspace.id, normalized, role)
        } else {
          const existing = data.members.find(
            (item) => item.workspaceId === activeWorkspace.id && item.email === normalized,
          )
          member = existing
            ? { ...existing, role }
            : {
                id: makeId('member'),
                workspaceId: activeWorkspace.id,
                name: normalized.split('@')[0],
                email: normalized,
                role,
                status: 'pending',
                avatar: initials(normalized),
              }
        }
        setData((current) => ({
          ...current,
          members: [...current.members.filter((item) => item.id !== member.id), member],
        }))

        if (member.status === 'active') {
          toast('Üyenin yetkisi güncellendi.')
          return true
        }

        const subject = `${activeWorkspace.name} çalışma alanına davet`
        const body = [
          'Merhaba,',
          '',
          `Notluk uygulamasındaki “${activeWorkspace.name}” çalışma alanına davet edildin.`,
          `Uygulamaya ${normalized} e-posta adresiyle giriş yaptığında ortak notları görebilirsin.`,
          '',
          `Notluk’u aç: notluk://invite?workspace=${activeWorkspace.id}`,
        ].join('\n')
        await openExternal(
          `mailto:${encodeURIComponent(normalized)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
        )
        toast('Davet oluşturuldu; e-posta gönderime hazır.')
        return true
      } catch (error) {
        console.error(error)
        toast('Davet oluşturulamadı.', 'error')
        return false
      }
    },
    [activeWorkspace, data.members, data.user.email, isCloud, toast, writableWorkspaceIds],
  )

  const configureCloud = useCallback((config: CloudConfig) => {
    saveCloudConfig(config)
    setCloudConfigState(config)
    setData(emptyData)
    setAuthLoading(true)
    setLoading(true)
  }, [])

  const useDemoMode = useCallback(() => {
    clearCloudConfig()
    setCloudConfigState(null)
    setSession(null)
    const local = loadLocalData()
    setData(local)
    setActiveWorkspaceId(local.workspaces[1]?.id || local.workspaces[0]?.id || '')
    setActiveNoteId(local.notes.find((note) => note.workspaceId === (local.workspaces[1]?.id || ''))?.id || '')
    setAuthLoading(false)
    setLoading(false)
    setSaveState('saved')
  }, [])

  const resetDemo = useCallback(() => {
    const fresh = resetLocalData()
    setData(fresh)
    setActiveWorkspaceId('product-team')
    setActiveNoteId('note-product-meeting')
    toast('Demo verileri yenilendi.')
  }, [toast])

  const signIn = useCallback(
    async (email: string) => {
      if (!clientRef.current) return
      await sendMagicLink(clientRef.current, email)
    },
    [],
  )

  const signOut = useCallback(async () => {
    await clientRef.current?.auth.signOut()
  }, [])

  return {
    data,
    session,
    cloudConfig,
    isCloud,
    loading,
    authLoading,
    saveState,
    activeWorkspace,
    activeNote,
    activeMembers,
    activeWorkspaceId,
    activeNoteId,
    visibleNotes,
    filter,
    search,
    toasts,
    setSearch,
    setActiveNoteId,
    openNote,
    selectWorkspace,
    selectFilter,
    createNote,
    updateNote,
    createWorkspace,
    inviteMember,
    configureCloud,
    useDemoMode,
    resetDemo,
    signIn,
    signOut,
    toast,
  }
}
