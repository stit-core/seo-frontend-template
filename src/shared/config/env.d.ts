// Build-time env (Vite, только VITE_*). Runtime-конфиг — window.__APP_CONFIG__ (index.ts).
interface ImportMetaEnv {
  readonly VITE_API_MODE?: 'mock' | 'real'
  readonly VITE_API_TARGET?: string
  readonly VITE_MOCK_SCENARIO?: 'empty' | 'populated' | 'authenticated' | 'error'
  readonly VITE_MOCK_DEVTOOLS?: string
}
