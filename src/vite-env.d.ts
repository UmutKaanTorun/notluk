/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_AUTH_REDIRECT_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  desktop?: {
    platform: string
    openExternal: (url: string) => Promise<void>
    onDeepLink: (handler: (url: string) => void) => () => void
  }
}
