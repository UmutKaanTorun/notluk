import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import {
  ArchiveRestore,
  Bold,
  BookOpenText,
  Check,
  ChevronDown,
  Cloud,
  CloudOff,
  Copy,
  Ellipsis,
  Eye,
  FileText,
  Folder,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  LoaderCircle,
  LogOut,
  Moon,
  Plus,
  Quote,
  RotateCcw,
  Search,
  Settings,
  Share2,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import type { CloudConfig, Member, MemberRole, Note, SaveState, Workspace } from './types'
import { THEME_KEY } from './lib/storage'
import { type NoteFilter, useNotluk } from './hooks/useNotluk'

type Theme = 'light' | 'dark' | 'system'

const roleLabel: Record<MemberRole, string> = {
  owner: 'Sahip',
  editor: 'Düzenleyebilir',
  viewer: 'Görüntüleyebilir',
}

function formatDate(value: string): string {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (minutes < 1) return 'Şimdi'
  if (minutes < 60) return `${minutes} dk önce`
  if (hours < 24) return hours === 1 ? '1 saat önce' : `${hours} saat önce`
  if (days === 1) return 'Dün'
  if (days < 7) return `${days} gün önce`
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(date)
}

function applyTheme(theme: Theme) {
  const dark =
    theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <span className="logo-mark" style={{ width: size, height: size }} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  )
}

function IconButton({
  label,
  children,
  active = false,
  onClick,
  className = '',
}: {
  label: string
  children: ReactNode
  active?: boolean
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  className?: string
}) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? 'is-active' : ''} ${className}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function Avatar({ member, size = 'medium' }: { member: Pick<Member, 'avatar' | 'name'>; size?: 'small' | 'medium' | 'large' }) {
  const hue = [...member.name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360
  return (
    <span
      className={`avatar avatar-${size}`}
      style={{ '--avatar-hue': hue } as React.CSSProperties}
      title={member.name}
    >
      {member.avatar}
    </span>
  )
}

function SaveIndicator({ state, cloud }: { state: SaveState; cloud: boolean }) {
  const config = {
    saved: { icon: cloud ? <Cloud size={13} /> : <Check size={13} />, text: 'Kaydedildi' },
    saving: { icon: <LoaderCircle size={13} className="spin" />, text: 'Kaydediliyor' },
    offline: { icon: <CloudOff size={13} />, text: 'Çevrimdışı' },
    error: { icon: <CloudOff size={13} />, text: 'Kayıt hatası' },
  }[state]
  return (
    <span className={`save-indicator save-${state}`}>
      {config.icon}
      {config.text}
    </span>
  )
}

function AuthScreen({
  onSignIn,
  onVerify,
}: {
  onSignIn: (email: string) => Promise<void>
  onVerify: (email: string, code: string) => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [resendIn, setResendIn] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (step !== 'code' || resendIn <= 0) return undefined
    const timer = window.setTimeout(() => setResendIn((current) => Math.max(0, current - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [resendIn, step])

  async function requestCode() {
    await onSignIn(email.trim().toLowerCase())
    setStep('code')
    setCode('')
    setResendIn(60)
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Geçerli bir e-posta adresi gir.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await requestCode()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Giriş kodu gönderilemedi.')
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault()
    const cleaned = code.replace(/\D/g, '')
    if (cleaned.length !== 6) {
      setError('6 haneli doğrulama kodunu gir.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onVerify(email.trim().toLowerCase(), cleaned)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Kod doğrulanamadı.')
    } finally {
      setBusy(false)
    }
  }

  async function resendCode() {
    if (resendIn > 0) return
    setBusy(true)
    setError('')
    try {
      await requestCode()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Yeni kod gönderilemedi.')
    } finally {
      setBusy(false)
    }
  }

  function useDifferentEmail() {
    setStep('email')
    setCode('')
    setError('')
    setResendIn(0)
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo"><LogoMark size={46} /></div>
        {step === 'code' ? (
          <>
            <h1>Doğrulama kodunu gir</h1>
            <p className="auth-copy strong">
              6 haneli kodu <strong>{email}</strong> adresine gönderdik.
            </p>
            <p className="auth-note">
              Kodun gelmesi birkaç dakika sürebilir. Spam klasörünü de kontrol et.
            </p>
            <form onSubmit={submitCode} className="auth-form">
              <label htmlFor="auth-code">Doğrulama kodu</label>
              <input
                id="auth-code"
                className="auth-code-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="1 2 3 4 5 6"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
              />
              {error && <p className="form-error">{error}</p>}
              <button className="primary-button large auth-submit" disabled={busy}>
                {busy && <LoaderCircle size={16} className="spin" />}
                Doğrula
              </button>
            </form>
            <button type="button" className="text-button auth-back" onClick={useDifferentEmail}>
              Farklı e-posta kullan
            </button>
            <button type="button" className="text-button auth-resend" onClick={() => void resendCode()} disabled={busy || resendIn > 0}>
              {resendIn > 0 ? `${resendIn} sn sonra yeni kod isteyebilirsin` : 'Yeni kod gönder'}
            </button>
          </>
        ) : (
          <>
            <h1>Notluk'a giriş yap</h1>
            <form onSubmit={submitEmail} className="auth-form">
            <label htmlFor="auth-email">E-posta adresi</label>
            <input
              id="auth-email"
              type="email"
              placeholder="sen@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoFocus
            />
            {error && <p className="form-error">{error}</p>}
            <button className="primary-button large auth-submit" disabled={busy}>
              {busy && <LoaderCircle size={16} className="spin" />}
              Kod gönder
            </button>
          </form>
          </>
        )}
        <p className="auth-legal">
          Notluk'u kullanarak gizlilik ve kullanım şartlarını kabul etmiş olursun.
        </p>
      </section>
    </main>
  )
}

function CloudSetupScreen({ onConfigure }: { onConfigure: (config: CloudConfig) => void }) {
  const [url, setUrl] = useState('')
  const [anonKey, setAnonKey] = useState('')
  const [error, setError] = useState('')

  function connect(event: FormEvent) {
    event.preventDefault()
    if (!url.startsWith('https://') || anonKey.trim().length < 20) {
      setError('Geçerli Supabase URL ve publishable key değerlerini gir.')
      return
    }
    onConfigure({ url: url.trim().replace(/\/$/, ''), anonKey: anonKey.trim() })
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo"><LogoMark size={46} /></div>
        <h1>Notluk bağlantısı</h1>
        <p className="auth-copy">
          Giriş yapmak için Notluk'un Supabase bağlantısı gerekiyor.
        </p>
        <form onSubmit={connect} className="auth-form">
          <label htmlFor="setup-url">Project URL</label>
          <input
            id="setup-url"
            type="url"
            placeholder="https://projen.supabase.co"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            autoFocus
          />
          <label htmlFor="setup-key">Publishable key</label>
          <textarea
            id="setup-key"
            placeholder="sb_publishable_..."
            value={anonKey}
            onChange={(event) => setAnonKey(event.target.value)}
            rows={3}
          />
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button large auth-submit">
            Bağlan
          </button>
        </form>
        <p className="auth-legal">
          Bu bilgiler cihazda saklanır ve giriş kodu göndermek için kullanılır.
        </p>
      </section>
    </main>
  )
}

function Sidebar({
  user,
  workspaces,
  members,
  notes,
  activeWorkspaceId,
  filter,
  cloud,
  onWorkspace,
  onFilter,
  onNewWorkspace,
  onSettings,
}: {
  user: { name: string; email: string; avatar: string; id: string }
  workspaces: Workspace[]
  members: Member[]
  notes: Note[]
  activeWorkspaceId: string
  filter: NoteFilter
  cloud: boolean
  onWorkspace: (id: string) => void
  onFilter: (filter: NoteFilter) => void
  onNewWorkspace: () => void
  onSettings: () => void
}) {
  const activeNotes = notes.filter((note) => !note.archived)
  const sharedCount = activeNotes.filter((note) =>
    members.some((member) => member.workspaceId === note.workspaceId && member.userId !== user.id),
  ).length
  const items: Array<{ id: NoteFilter; label: string; icon: ReactNode; count: number }> = [
    { id: 'all', label: 'Tüm Notlar', icon: <FileText size={17} />, count: activeNotes.length },
    { id: 'favorites', label: 'Favoriler', icon: <Star size={17} />, count: activeNotes.filter((note) => note.favorite).length },
    { id: 'shared', label: 'Benimle Paylaşılan', icon: <Users size={17} />, count: sharedCount },
  ]

  return (
    <aside className="sidebar">
      <div className="profile-row">
        <Avatar member={user} size="large" />
        <div className="profile-copy">
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </div>
        <ChevronDown size={15} />
      </div>

      <nav className="main-nav" aria-label="Not filtreleri">
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            className={filter === item.id ? 'selected' : ''}
            onClick={() => onFilter(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
            <small>{item.count}</small>
          </button>
        ))}
      </nav>

      <div className="sidebar-section-heading">
        <span>Çalışma alanları</span>
        <IconButton label="Yeni çalışma alanı" onClick={onNewWorkspace}><Plus size={15} /></IconButton>
      </div>
      <nav className="workspace-nav" aria-label="Çalışma alanları">
        {workspaces.map((workspace) => {
          const count = notes.filter((note) => note.workspaceId === workspace.id && !note.archived).length
          return (
            <button
              type="button"
              key={workspace.id}
              className={filter === 'workspace' && activeWorkspaceId === workspace.id ? 'selected' : ''}
              onClick={() => onWorkspace(workspace.id)}
            >
              <span className="workspace-icon" style={{ '--workspace-color': workspace.color } as React.CSSProperties}>
                {workspace.name === 'Kişisel' ? <BookOpenText size={16} /> : <Users size={16} />}
              </span>
              <span>{workspace.name}</span>
              <small>{count}</small>
            </button>
          )
        })}
      </nav>

      <div className="sidebar-bottom">
        <button type="button" className={filter === 'trash' ? 'selected' : ''} onClick={() => onFilter('trash')}>
          <Trash2 size={17} /><span>Çöp Kutusu</span>
        </button>
        <button type="button" onClick={onSettings}>
          <Settings size={17} /><span>Ayarlar</span>
        </button>
        <div className={`connection-pill ${cloud ? 'cloud' : 'local'}`}>
          {cloud ? <Cloud size={13} /> : <Sparkles size={13} />}
          {cloud ? 'Bulut bağlı' : 'Yerel'}
        </div>
      </div>
    </aside>
  )
}

function filterHeading(filter: NoteFilter, workspace: Workspace | null): string {
  if (filter === 'workspace') return workspace?.name || 'Çalışma alanı'
  if (filter === 'favorites') return 'Favoriler'
  if (filter === 'shared') return 'Benimle Paylaşılan'
  if (filter === 'trash') return 'Çöp Kutusu'
  return 'Tüm Notlar'
}

function NoteList({
  notes,
  activeNoteId,
  workspace,
  members,
  filter,
  search,
  onSearch,
  onSelect,
  onCreate,
  onToggleFavorite,
}: {
  notes: Note[]
  activeNoteId: string
  workspace: Workspace | null
  members: Member[]
  filter: NoteFilter
  search: string
  onSearch: (value: string) => void
  onSelect: (id: string) => void
  onCreate: () => void
  onToggleFavorite: (note: Note) => void
}) {
  return (
    <section className="note-list-panel">
      <header className="note-list-header">
        <div>
          <h2>{filterHeading(filter, workspace)}</h2>
          <p>{notes.length} not</p>
        </div>
        <IconButton label="Yeni not" className="new-note-button" onClick={onCreate}><Plus size={19} /></IconButton>
      </header>
      <label className="search-field" htmlFor="note-search">
        <Search size={16} />
        <input
          id="note-search"
          type="search"
          placeholder="Notlarda ara"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
        <kbd>⌘K</kbd>
      </label>

      <div className="note-list" role="list">
        {notes.length ? (
          notes.map((note) => {
            const noteMembers = members.filter((member) => member.workspaceId === note.workspaceId && member.status === 'active')
            return (
              <article
                role="listitem"
                key={note.id}
                className={`note-card ${note.id === activeNoteId ? 'selected' : ''}`}
                onClick={() => onSelect(note.id)}
              >
                <div className="note-card-title-row">
                  <h3>{note.title || 'İsimsiz not'}</h3>
                  {!note.archived && (
                    <button
                      type="button"
                      className={`star-button ${note.favorite ? 'active' : ''}`}
                      aria-label={note.favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                      onClick={(event) => {
                        event.stopPropagation()
                        onToggleFavorite(note)
                      }}
                    >
                      <Star size={15} fill={note.favorite ? 'currentColor' : 'none'} />
                    </button>
                  )}
                </div>
                <p>{note.plainText || 'Henüz içerik yok.'}</p>
                <footer>
                  <time>{formatDate(note.updatedAt)}</time>
                  <span className="mini-avatar-stack">
                    {noteMembers.slice(0, 2).map((member) => <Avatar key={member.id} member={member} size="small" />)}
                  </span>
                </footer>
              </article>
            )
          })
        ) : (
          <div className="empty-list">
            <FileText size={25} />
            <strong>{search ? 'Sonuç bulunamadı' : 'Henüz not yok'}</strong>
            <p>{search ? 'Başka bir kelimeyle aramayı dene.' : 'İlk notunu oluşturarak başla.'}</p>
            {!search && filter !== 'trash' && <button className="secondary-button" onClick={onCreate}>Yeni not</button>}
          </div>
        )}
      </div>
    </section>
  )
}

function EditorToolbar({ editorRef, onChange }: { editorRef: React.RefObject<HTMLDivElement | null>; onChange: () => void }) {
  function command(name: string, value?: string) {
    editorRef.current?.focus()
    document.execCommand(name, false, value)
    onChange()
  }

  function link() {
    const value = window.prompt('Bağlantı adresi')
    if (value) command('createLink', value)
  }

  return (
    <div className="editor-format-bar" aria-label="Metin biçimlendirme">
      <IconButton label="Kalın" onClick={() => command('bold')}><Bold size={16} /></IconButton>
      <IconButton label="İtalik" onClick={() => command('italic')}><Italic size={16} /></IconButton>
      <span className="toolbar-separator" />
      <IconButton label="Başlık" onClick={() => command('formatBlock', 'h2')}><Heading2 size={17} /></IconButton>
      <IconButton label="Madde listesi" onClick={() => command('insertUnorderedList')}><List size={17} /></IconButton>
      <IconButton label="Numaralı liste" onClick={() => command('insertOrderedList')}><ListOrdered size={17} /></IconButton>
      <IconButton label="Kontrol listesi" onClick={() => command('insertUnorderedList')}><ListChecks size={17} /></IconButton>
      <span className="toolbar-separator" />
      <IconButton label="Alıntı" onClick={() => command('formatBlock', 'blockquote')}><Quote size={16} /></IconButton>
      <IconButton label="Bağlantı" onClick={link}><LinkIcon size={16} /></IconButton>
    </div>
  )
}

function SharePanel({
  workspace,
  members,
  onClose,
  onInvite,
  onToast,
}: {
  workspace: Workspace
  members: Member[]
  onClose: () => void
  onInvite: (email: string, role: 'editor' | 'viewer') => Promise<boolean>
  onToast: (message: string) => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    const ok = await onInvite(email, role)
    setBusy(false)
    if (ok) setEmail('')
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`notluk://invite?workspace=${workspace.id}`)
    onToast('Davet bağlantısı kopyalandı.')
  }

  return (
    <aside className="share-panel" aria-label="Çalışma alanını paylaş">
      <header>
        <div>
          <h2>Çalışma alanını paylaş</h2>
          <p>{workspace.name}’ne kişileri e-posta ile davet et.</p>
        </div>
        <IconButton label="Paylaşım panelini kapat" onClick={onClose}><X size={17} /></IconButton>
      </header>
      <form onSubmit={submit} className="share-form">
        <label htmlFor="invite-email">E-posta adresi</label>
        <input
          id="invite-email"
          type="email"
          placeholder="ornek@email.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <label htmlFor="invite-role">Yetki</label>
        <select id="invite-role" value={role} onChange={(event) => setRole(event.target.value as 'editor' | 'viewer')}>
          <option value="editor">Düzenleyebilir</option>
          <option value="viewer">Görüntüleyebilir</option>
        </select>
        <button className="primary-button" disabled={busy}>
          {busy && <LoaderCircle size={15} className="spin" />}
          Davet gönder
        </button>
      </form>

      <div className="share-divider" />
      <div className="member-heading"><strong>Üyeler</strong><span>{members.length} kişi</span></div>
      <div className="member-list">
        {members.map((member) => (
          <div className="member-row" key={member.id}>
            <Avatar member={member} size="medium" />
            <div>
              <strong>{member.name}</strong>
              <span className={member.status === 'pending' ? 'pending' : ''}>
                {member.status === 'pending' ? 'Davet bekliyor' : member.email}
              </span>
            </div>
            <small>{roleLabel[member.role]}</small>
          </div>
        ))}
      </div>
      <button type="button" className="link-access-row" onClick={copyLink}>
        <span className="link-access-icon"><Copy size={15} /></span>
        <span><strong>Davet bağlantısı</strong><small>Yalnızca davet edilen kişiler</small></span>
        <ChevronDown size={15} />
      </button>
    </aside>
  )
}

function NoteEditor({
  note,
  workspace,
  members,
  saveState,
  cloud,
  canEdit,
  shareOpen,
  onShare,
  onCloseShare,
  onUpdate,
  onInvite,
  onToast,
}: {
  note: Note | null
  workspace: Workspace | null
  members: Member[]
  saveState: SaveState
  cloud: boolean
  canEdit: boolean
  shareOpen: boolean
  onShare: () => void
  onCloseShare: () => void
  onUpdate: (patch: Partial<Pick<Note, 'title' | 'content' | 'favorite' | 'archived'>>) => void
  onInvite: (email: string, role: 'editor' | 'viewer') => Promise<boolean>
  onToast: (message: string) => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    if (!note || !editorRef.current) return
    if (document.activeElement !== editorRef.current && editorRef.current.innerHTML !== note.content) {
      editorRef.current.innerHTML = note.content
    }
  }, [note?.content, note?.id])

  if (!note) {
    return (
      <section className="editor-panel empty-editor">
        <div>
          <FileText size={36} />
          <h2>Bir not seç</h2>
          <p>Not oluşturduğunda veya listeden seçtiğinde burada açılacak.</p>
        </div>
      </section>
    )
  }

  const visibleMembers = members.filter((member) => member.status === 'active')

  function syncEditor() {
    if (editorRef.current) onUpdate({ content: editorRef.current.innerHTML })
  }

  return (
    <section className={`editor-panel ${shareOpen ? 'share-is-open' : ''}`}>
      <header className="editor-topbar">
        <div className="breadcrumbs">
          <span>{workspace?.name || 'Çalışma alanı'}</span>
          <ChevronDown size={13} />
          <span>{note.title || 'İsimsiz not'}</span>
        </div>
        <div className="editor-actions">
          <SaveIndicator state={saveState} cloud={cloud} />
          <div className="avatar-stack">
            {visibleMembers.slice(0, 3).map((member) => <Avatar key={member.id} member={member} size="small" />)}
          </div>
          <button
            type="button"
            className={`share-button ${shareOpen ? 'active' : ''}`}
            onClick={onShare}
            disabled={!canEdit}
            title={canEdit ? 'Çalışma alanını paylaş' : 'Bu alanda yalnızca görüntüleme yetkin var'}
          >
            <Share2 size={15} /> Paylaş
          </button>
          {canEdit && <div className="more-menu-wrap">
            <IconButton label="Not seçenekleri" onClick={() => setMoreOpen((open) => !open)}><Ellipsis size={18} /></IconButton>
            {moreOpen && (
              <div className="more-menu">
                <button type="button" onClick={() => { onUpdate({ favorite: !note.favorite }); setMoreOpen(false) }}>
                  <Star size={15} /> {note.favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                </button>
                <button type="button" className="danger" onClick={() => { onUpdate({ archived: !note.archived }); setMoreOpen(false) }}>
                  {note.archived ? <ArchiveRestore size={15} /> : <Trash2 size={15} />}
                  {note.archived ? 'Notu geri yükle' : 'Çöp kutusuna taşı'}
                </button>
              </div>
            )}
          </div>}
        </div>
      </header>

      <div className="editor-scroll">
        <main className="note-document">
          <textarea
            className="note-title-input"
            value={note.title}
            onChange={(event) => onUpdate({ title: event.target.value })}
            placeholder="İsimsiz not"
            aria-label="Not başlığı"
            rows={1}
            disabled={!canEdit || note.archived}
          />
          <div className="note-meta">{formatDate(note.updatedAt)} · {note.updatedBy} düzenledi</div>
          {canEdit && !note.archived && <EditorToolbar editorRef={editorRef} onChange={syncEditor} />}
          <div
            ref={editorRef}
            className="rich-editor"
            contentEditable={canEdit && !note.archived}
            suppressContentEditableWarning
            onInput={syncEditor}
            data-placeholder="Bir şeyler yaz…"
          />
          {note.archived && (
            <button className="restore-banner" onClick={() => onUpdate({ archived: false })}>
              <ArchiveRestore size={16} /> Bu not çöp kutusunda. Geri yükle
            </button>
          )}
          {!canEdit && (
            <div className="readonly-banner"><Eye size={15} /> Bu çalışma alanında görüntüleme yetkin var.</div>
          )}
        </main>
      </div>

      {shareOpen && workspace && (
        <SharePanel
          workspace={workspace}
          members={members}
          onClose={onCloseShare}
          onInvite={onInvite}
          onToast={onToast}
        />
      )}
    </section>
  )
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header><h2>{title}</h2><IconButton label="Kapat" onClick={onClose}><X size={17} /></IconButton></header>
        {children}
      </section>
    </div>
  )
}

function NewWorkspaceModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    await onCreate(name)
    setBusy(false)
    onClose()
  }
  return (
    <Modal title="Yeni çalışma alanı" onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <div className="modal-intro-icon"><Folder size={21} /></div>
        <p>Bir proje veya ekip için notları aynı yerde topla.</p>
        <label htmlFor="workspace-name">Çalışma alanı adı</label>
        <input id="workspace-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Örn. Tasarım Ekibi" autoFocus />
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Vazgeç</button>
          <button className="primary-button" disabled={busy || !name.trim()}>
            {busy && <LoaderCircle size={15} className="spin" />} Oluştur
          </button>
        </div>
      </form>
    </Modal>
  )
}

function SettingsModal({
  theme,
  cloud,
  config,
  onTheme,
  onConfigure,
  onResetDemo,
  onSignOut,
  onClose,
}: {
  theme: Theme
  cloud: boolean
  config: CloudConfig | null
  onTheme: (theme: Theme) => void
  onConfigure: (config: CloudConfig) => void
  onResetDemo: () => void
  onSignOut: () => Promise<void>
  onClose: () => void
}) {
  const [url, setUrl] = useState(config?.url || '')
  const [anonKey, setAnonKey] = useState(config?.anonKey || '')
  const [error, setError] = useState('')

  function connect(event: FormEvent) {
    event.preventDefault()
    if (!url.startsWith('https://') || anonKey.trim().length < 20) {
      setError('Geçerli Supabase URL ve publishable key değerlerini gir.')
      return
    }
    onConfigure({ url: url.trim().replace(/\/$/, ''), anonKey: anonKey.trim() })
    onClose()
  }

  return (
    <Modal title="Ayarlar" onClose={onClose}>
      <div className="settings-content">
        <section className="settings-section">
          <h3>Görünüm</h3>
          <div className="theme-switcher">
            <button className={theme === 'light' ? 'selected' : ''} onClick={() => onTheme('light')}><Sun size={16} /> Açık</button>
            <button className={theme === 'dark' ? 'selected' : ''} onClick={() => onTheme('dark')}><Moon size={16} /> Koyu</button>
            <button className={theme === 'system' ? 'selected' : ''} onClick={() => onTheme('system')}><Settings size={16} /> Sistem</button>
          </div>
        </section>
        <section className="settings-section">
          <div className="settings-title-row">
            <div><h3>Bulut ve ortak çalışma</h3><p>Supabase projesini bağlayarak gerçek cihazlar arasında senkronizasyonu aç.</p></div>
            <span className={`status-tag ${cloud ? 'connected' : ''}`}>{cloud ? 'Bağlı' : 'Yerel'}</span>
          </div>
          {!cloud ? (
            <form className="cloud-form" onSubmit={connect}>
              <label htmlFor="supabase-url">Project URL</label>
              <input id="supabase-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://projen.supabase.co" />
              <label htmlFor="supabase-key">Publishable key</label>
              <textarea id="supabase-key" value={anonKey} onChange={(event) => setAnonKey(event.target.value)} placeholder="sb_publishable_..." rows={3} />
              {error && <p className="form-error">{error}</p>}
              <button className="primary-button"><Cloud size={15} /> Buluta bağlan</button>
            </form>
          ) : (
            <div className="connected-card">
              <Cloud size={18} />
              <div><strong>Supabase bağlantısı etkin</strong><span>{config?.url}</span></div>
              <button className="secondary-button" onClick={onSignOut}><LogOut size={14} /> Çıkış yap</button>
            </div>
          )}
        </section>
        {!cloud && (
          <section className="settings-section danger-zone">
            <div><h3>Yerel veriler</h3><p>Yerel değişiklikleri silerek başlangıç verilerine dön.</p></div>
            <button className="secondary-button" onClick={onResetDemo}><RotateCcw size={14} /> Yenile</button>
          </section>
        )}
      </div>
    </Modal>
  )
}

function App() {
  const app = useNotluk()
  const [shareOpen, setShareOpen] = useState(false)
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(THEME_KEY) as Theme) || 'system')

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(THEME_KEY, theme)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handle = () => theme === 'system' && applyTheme('system')
    media.addEventListener('change', handle)
    return () => media.removeEventListener('change', handle)
  }, [theme])

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.metaKey && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        void app.createNote()
      }
      if (event.metaKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        document.getElementById('note-search')?.focus()
      }
      if (event.key === 'Escape') {
        setShareOpen(false)
        setSettingsOpen(false)
        setWorkspaceModalOpen(false)
      }
    }
    window.addEventListener('keydown', keyboard)
    return () => window.removeEventListener('keydown', keyboard)
  }, [app.createNote])

  const noteWorkspace = useMemo(
    () => app.data.workspaces.find((workspace) => workspace.id === app.activeNote?.workspaceId) || app.activeWorkspace,
    [app.activeNote?.workspaceId, app.activeWorkspace, app.data.workspaces],
  )
  const noteMembers = useMemo(
    () => app.data.members.filter((member) => member.workspaceId === noteWorkspace?.id),
    [app.data.members, noteWorkspace?.id],
  )
  const currentMembership = useMemo(
    () => noteMembers.find(
      (member) => member.userId === app.data.user.id || member.email === app.data.user.email,
    ),
    [app.data.user.email, app.data.user.id, noteMembers],
  )
  const canEdit = !app.isCloud
    || noteWorkspace?.ownerId === app.data.user.id
    || currentMembership?.role === 'owner'
    || currentMembership?.role === 'editor'

  if (app.authLoading) {
    return <div className="splash"><LogoMark size={42} /><LoaderCircle size={20} className="spin" /></div>
  }

  if (!app.cloudConfig && !app.demoAvailable) {
    return <CloudSetupScreen onConfigure={app.configureCloud} />
  }

  if (app.isCloud && !app.session) {
    return <AuthScreen onSignIn={app.signIn} onVerify={app.verifySignIn} />
  }

  return (
    <div className="app-shell">
      <header className="titlebar">
        <div className="app-title"><LogoMark /><strong>Notluk</strong></div>
        <button type="button" className="quick-new" onClick={() => void app.createNote()}><Plus size={14} /><kbd>⌘N</kbd></button>
      </header>
      <div className="workspace-layout">
        <Sidebar
          user={app.data.user}
          workspaces={app.data.workspaces}
          members={app.data.members}
          notes={app.data.notes}
          activeWorkspaceId={app.activeWorkspaceId}
          filter={app.filter}
          cloud={app.isCloud}
          onWorkspace={(id) => { app.selectWorkspace(id); setShareOpen(false) }}
          onFilter={(next) => { app.selectFilter(next); setShareOpen(false) }}
          onNewWorkspace={() => setWorkspaceModalOpen(true)}
          onSettings={() => setSettingsOpen(true)}
        />
        <NoteList
          notes={app.visibleNotes}
          activeNoteId={app.activeNoteId}
          workspace={app.activeWorkspace}
          members={app.data.members}
          filter={app.filter}
          search={app.search}
          onSearch={app.setSearch}
          onSelect={(id) => { app.openNote(id); setShareOpen(false) }}
          onCreate={() => void app.createNote()}
          onToggleFavorite={(note) => app.updateNote(note.id, { favorite: !note.favorite })}
        />
        {app.loading ? (
          <section className="editor-panel editor-loading"><LoaderCircle size={24} className="spin" /><span>Notlar yükleniyor…</span></section>
        ) : (
          <NoteEditor
            note={app.activeNote}
            workspace={noteWorkspace}
            members={noteMembers}
            saveState={app.saveState}
            cloud={app.isCloud}
            canEdit={canEdit}
            shareOpen={shareOpen}
            onShare={() => setShareOpen((open) => !open)}
            onCloseShare={() => setShareOpen(false)}
            onUpdate={(patch) => app.activeNote && app.updateNote(app.activeNote.id, patch)}
            onInvite={app.inviteMember}
            onToast={(message) => app.toast(message)}
          />
        )}
      </div>

      {workspaceModalOpen && <NewWorkspaceModal onClose={() => setWorkspaceModalOpen(false)} onCreate={app.createWorkspace} />}
      {settingsOpen && (
        <SettingsModal
          theme={theme}
          cloud={app.isCloud}
          config={app.cloudConfig}
          onTheme={setTheme}
          onConfigure={app.configureCloud}
          onResetDemo={app.resetDemo}
          onSignOut={app.signOut}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <div className="toast-stack" aria-live="polite">
        {app.toasts.map((item) => (
          <div key={item.id} className={`toast toast-${item.kind}`}>
            {item.kind === 'success' ? <Check size={16} /> : item.kind === 'error' ? <CloudOff size={16} /> : <Eye size={16} />}
            {item.text}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
