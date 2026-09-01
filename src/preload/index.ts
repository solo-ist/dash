import { contextBridge, ipcRenderer } from 'electron'
import type { DashApi, TaskAddInput } from '../shared/api'

// Typed API surface exposed to the renderer. Renderer↔main communication goes
// only through this bridge — see src/shared/api.ts for the contract.
const api: DashApi = {
  platform: process.platform,
  tasks: {
    list: (projectId) => ipcRenderer.invoke('tasks:list', projectId),
    add: (input: TaskAddInput) => ipcRenderer.invoke('tasks:add', input),
    complete: (id) => ipcRenderer.invoke('tasks:complete', id),
    uncomplete: (id) => ipcRenderer.invoke('tasks:uncomplete', id),
    delete: (id) => ipcRenderer.invoke('tasks:delete', id)
  },
  projects: {
    list: () => ipcRenderer.invoke('projects:list')
  }
}

contextBridge.exposeInMainWorld('api', api)
