import { app, shell, BrowserWindow, Menu } from 'electron'
import { join } from 'path'
import type Database from 'better-sqlite3'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { openDatabase } from './db/open'
import { migrate } from './db/migrate'
import { registerIpc } from './ipc'

let quitting = false
let db: Database

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#090909',
    webPreferences: {
      preload: join(__dirname, '../preload-cjs/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // macOS: hide window on close instead of destroying it, so dock click re-shows
  // it with IPC handlers and menu bindings intact.
  if (process.platform === 'darwin') {
    mainWindow.on('close', (e) => {
      if (!quitting) {
        e.preventDefault()
        mainWindow.hide()
      }
    })
  }

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const parsed = new URL(details.url)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(details.url)
      }
    } catch {
      // invalid URL — drop
    }
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('ist.solo.dash')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  db = openDatabase(join(app.getPath('userData'), 'dash.db'))
  migrate(db)
  registerIpc(db)

  buildMenu()
  createWindow()

  app.on('activate', () => {
    const existing = BrowserWindow.getAllWindows()[0]
    if (existing) existing.show()
    else createWindow()
  })
})

app.on('before-quit', () => {
  quitting = true
  db?.close()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
