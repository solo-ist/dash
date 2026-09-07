import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { DashApi, DataChangedPayload } from '../shared/api'

// Typed API surface exposed to the renderer. Renderer↔main communication goes
// only through this generic bridge — see src/shared/api.ts and
// docs/architecture.md §5 for the contract. Never add per-feature methods
// here; add named queries/ops in src/shared instead.
const api: DashApi = {
  platform: process.platform,
  query: (name, params) => ipcRenderer.invoke('db:query', name, params),
  mutate: (op) => ipcRenderer.invoke('db:mutate', op),
  on: (channel, cb) => {
    const listener = (_event: IpcRendererEvent, payload: DataChangedPayload): void => cb(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
