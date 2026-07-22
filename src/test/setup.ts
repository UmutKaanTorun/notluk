import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>()

  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      get length() {
        return store.size
      },
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      removeItem: (key: string) => store.delete(key),
      setItem: (key: string, value: string) => store.set(key, value),
    },
    configurable: true,
  })
}

afterEach(() => cleanup())
