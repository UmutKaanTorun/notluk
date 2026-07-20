import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import type { AppData, AppUser, CloudConfig, Member, Note, Workspace } from '../types'
import { initials } from './storage'
import { sanitizeNoteHtml } from './sanitize'

let activeClient: SupabaseClient | null = null
let activeKey = ''

export function getSupabase(config: CloudConfig): SupabaseClient {
  const key = `${config.url}|${config.anonKey}`
  if (!activeClient || activeKey !== key) {
    activeClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
    activeKey = key
  }
  return activeClient
}

export async function sendMagicLink(client: SupabaseClient, email: string): Promise<void> {
  const redirectTo = import.meta.env.VITE_AUTH_REDIRECT_URL || 'notluk://auth/callback'
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  })
  if (error) throw error
}

export async function exchangeDeepLink(client: SupabaseClient, url: string): Promise<void> {
  const parsed = new URL(url)
  const code = parsed.searchParams.get('code')
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code)
    if (error) throw error
    return
  }

  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''))
  const accessToken = hash.get('access_token')
  const refreshToken = hash.get('refresh_token')
  if (accessToken && refreshToken) {
    const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    if (error) throw error
  }
}

export async function loadCloudData(client: SupabaseClient, session: Session): Promise<AppData> {
  await client.rpc('claim_workspace_invites')

  const [workspaceResult, memberResult, noteResult, profileResult] = await Promise.all([
    client.from('workspaces').select('*').order('created_at', { ascending: true }),
    client.from('workspace_members').select('*').order('created_at', { ascending: true }),
    client.from('notes').select('*').eq('archived', false).order('updated_at', { ascending: false }),
    client.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
  ])

  const error = workspaceResult.error || memberResult.error || noteResult.error || profileResult.error
  if (error) throw error

  const email = session.user.email || ''
  const name = profileResult.data?.display_name || session.user.user_metadata?.full_name || email.split('@')[0] || 'Kullanıcı'
  const user: AppUser = {
    id: session.user.id,
    name,
    email,
    avatar: profileResult.data?.avatar_initials || initials(name),
  }

  const workspaces: Workspace[] = (workspaceResult.data || []).map((row) => ({
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    color: row.color || '#5965e8',
  }))

  const members: Member[] = (memberResult.data || []).map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id || undefined,
    name: row.display_name || row.email.split('@')[0],
    email: row.email,
    role: row.role,
    status: row.status,
    avatar: row.avatar_initials || initials(row.display_name || row.email),
  }))

  const notes: Note[] = (noteResult.data || []).map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    content: sanitizeNoteHtml(row.content || '<p></p>'),
    plainText: row.plain_text || '',
    createdBy: row.created_by,
    updatedBy: row.updated_by_name || 'Bir üye',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    favorite: Boolean(row.favorite),
    archived: Boolean(row.archived),
    version: row.version || 1,
  }))

  return { user, workspaces, members, notes }
}

export async function createCloudWorkspace(
  client: SupabaseClient,
  user: AppUser,
  name: string,
): Promise<Workspace> {
  const color = '#5965e8'
  const { data, error } = await client
    .from('workspaces')
    .insert({ name, owner_id: user.id, color })
    .select('*')
    .single()
  if (error) throw error

  const { error: memberError } = await client.from('workspace_members').insert({
    workspace_id: data.id,
    user_id: user.id,
    email: user.email.toLowerCase(),
    display_name: user.name,
    avatar_initials: user.avatar,
    role: 'owner',
    status: 'active',
  })
  if (memberError) throw memberError

  return {
    id: data.id,
    name: data.name,
    ownerId: data.owner_id,
    createdAt: data.created_at,
    color: data.color,
  }
}

export async function upsertCloudNote(client: SupabaseClient, note: Note): Promise<void> {
  const { error } = await client.from('notes').upsert({
    id: note.id,
    workspace_id: note.workspaceId,
    title: note.title,
    content: note.content,
    plain_text: note.plainText,
    created_by: note.createdBy,
    updated_by_name: note.updatedBy,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
    favorite: note.favorite,
    archived: note.archived,
    version: note.version,
  })
  if (error) throw error
}

export async function inviteCloudMember(
  client: SupabaseClient,
  workspaceId: string,
  email: string,
  role: 'editor' | 'viewer',
): Promise<Member> {
  const normalized = email.toLowerCase()
  const { data: existing, error: lookupError } = await client
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('email', normalized)
    .maybeSingle()
  if (lookupError) throw lookupError

  const query = existing
    ? client.from('workspace_members').update({ role }).eq('id', existing.id)
    : client.from('workspace_members').insert({
        workspace_id: workspaceId,
        email: normalized,
        display_name: normalized.split('@')[0],
        avatar_initials: initials(normalized),
        role,
        status: 'pending',
      })

  const { data, error } = await query.select('*').single()
  if (error) throw error
  return {
    id: data.id,
    workspaceId: data.workspace_id,
    userId: data.user_id || undefined,
    name: data.display_name,
    email: data.email,
    role: data.role,
    status: data.status,
    avatar: data.avatar_initials,
  }
}
