import { contextBridge } from 'electron'

// Typed API surface exposed to the renderer. IPC channels land here as the app
// grows (tasks, settings, window) — keep everything behind this bridge.
const api = {
  platform: process.platform
}

export type DashApi = typeof api

contextBridge.exposeInMainWorld('api', api)
