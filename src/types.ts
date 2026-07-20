export type MemberRole = 'owner' | 'editor' | 'viewer'
export type MemberStatus = 'active' | 'pending'

export interface AppUser {
  id: string
  name: string
  email: string
  avatar: string
}

export interface Workspace {
  id: string
  name: string
  ownerId: string
  createdAt: string
  color: string
}

export interface Member {
  id: string
  workspaceId: string
  userId?: string
  name: string
  email: string
  role: MemberRole
  status: MemberStatus
  avatar: string
}

export interface Note {
  id: string
  workspaceId: string
  title: string
  content: string
  plainText: string
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
  favorite: boolean
  archived: boolean
  version: number
}

export interface AppData {
  user: AppUser
  workspaces: Workspace[]
  members: Member[]
  notes: Note[]
}

export interface CloudConfig {
  url: string
  anonKey: string
}

export type SaveState = 'saved' | 'saving' | 'offline' | 'error'

export type ToastKind = 'success' | 'info' | 'error'

export interface ToastMessage {
  id: string
  kind: ToastKind
  text: string
}
