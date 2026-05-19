import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { setupIpcHandlers } from './ipcHandlers'

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  win = new BrowserWindow({
    title: 'SinCracK RDM',
    icon: path.join(process.env.VITE_PUBLIC || '', 'icon.png'),
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true, // Required to load web consoles (Proxmox, Plesk, router, etc.)
    },
  })

  // Remove system menu for clean dark slate aesthetic
  win.removeMenu();

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  // Redirect frontend console logs to terminal stdout for easy remote debugging
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[BROWSER CONSOLE - LEVEL ${level}] ${message} (at ${sourceId}:${line})`);
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    // win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(process.env.DIST || '', 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  setupIpcHandlers()
  createWindow()
})
