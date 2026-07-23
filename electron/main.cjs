const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('node:path')

const PROTOCOL = 'notluk'
let mainWindow = null
let pendingDeepLink = null

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

function extractDeepLink(argv) {
  return argv.find((value) => value.startsWith(`${PROTOCOL}://`)) || null
}

function deliverDeepLink(url) {
  if (!url) return
  if (mainWindow?.webContents) {
    mainWindow.webContents.send('deep-link', url)
    mainWindow.show()
    mainWindow.focus()
  } else {
    pendingDeepLink = url
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#f7f7f8',
    title: 'Notluk',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:)/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  } else {
    mainWindow.loadURL('http://127.0.0.1:5173')
    if (process.env.NOTLUK_OPEN_DEVTOOLS === '1') mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingDeepLink) {
      deliverDeepLink(pendingDeepLink)
      pendingDeepLink = null
    }
  })
}

app.on('second-instance', (_event, argv) => {
  deliverDeepLink(extractDeepLink(argv))
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.on('open-url', (event, url) => {
  event.preventDefault()
  deliverDeepLink(url)
})

app.whenReady().then(() => {
  app.setAsDefaultProtocolClient(PROTOCOL)

  ipcMain.handle('open-external', async (_event, url) => {
    if (typeof url !== 'string' || !/^(https?:|mailto:)/.test(url)) return false
    await shell.openExternal(url)
    return true
  })

  createWindow()
  deliverDeepLink(extractDeepLink(process.argv))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
