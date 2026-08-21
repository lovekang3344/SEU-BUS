const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')

// Config file path (in user data directory)
const configPath = path.join(app.getPath('userData'), 'desk-pet-config.json')

function getConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    }
  } catch (e) {
    console.error('Failed to read config:', e)
  }
  // Default config
  return {
    location: '橘园',
    destination: '无线谷',
    reminderMinutes: 5,
    x: undefined,
    y: undefined,
  }
}

function saveConfig(config) {
  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true })
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  } catch (e) {
    console.error('Failed to save config:', e)
  }
}

// Create tray icon
function createTrayIcon() {
  // Try 32x32 first (better quality on high-DPI), fall back to 16x16
  const icon32Path = path.join(__dirname, 'tray-icon-32.png')
  const icon16Path = path.join(__dirname, 'tray-icon.png')
  if (fs.existsSync(icon32Path)) {
    return nativeImage.createFromPath(icon32Path).resize({ width: 32, height: 32 })
  }
  if (fs.existsSync(icon16Path)) {
    return nativeImage.createFromPath(icon16Path)
  }
  return nativeImage.createEmpty()
}

let mainWindow
let tray

function createWindow() {
  const config = getConfig()

  // Get screen dimensions to position window initially
  const { workArea } = screen.getPrimaryDisplay()

  mainWindow = new BrowserWindow({
    width: 320,
    height: 500,
    x: config.x ?? (workArea.x + workArea.width - 360),
    y: config.y ?? (workArea.y + workArea.height - 560),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Create tray icon
  const trayIcon = createTrayIcon()
  tray = new Tray(trayIcon)
  tray.setToolTip('东南大学接驳车桌宠')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示桌宠',
      click: () => {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.show()
        mainWindow.focus()
      },
    },
    { type: 'separator' },
    {
      label: '最小化到托盘',
      click: () => {
        mainWindow.minimize()
      },
    },
    {
      label: '退出',
      click: () => {
        tray.destroy()
        mainWindow.close()
        app.quit()
      },
    },
  ])
  tray.setContextMenu(contextMenu)

  // Double-click tray to show window
  tray.on('double-click', () => {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  // Enable click-through when not interacting
  mainWindow.setIgnoreMouseEvents(false, { forward: true })

  // Load the app
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
    // DevTools only in true dev mode (not in packaged app)
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools({ mode: 'off' })
    }
  } else {
    // In production, serve the built files
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html')
    mainWindow.loadFile(indexPath)
  }

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('config-loaded', config)
  })

  // Save position on move
  mainWindow.on('moved', () => {
    const [x, y] = mainWindow.getPosition()
    const config = getConfig()
    config.x = x
    config.y = y
    saveConfig(config)
  })

  // When window is minimized, hide it but keep tray icon
  mainWindow.on('minimize', (e) => {
    e.preventDefault()
    mainWindow.hide()
  })
}

// IPC handlers
ipcMain.handle('get-config', () => getConfig())
ipcMain.handle('save-config', (_, config) => {
  saveConfig(config)
  return true
})
ipcMain.handle('minimize-window', () => {
  mainWindow?.minimize()
})
ipcMain.handle('close-window', () => {
  mainWindow?.hide()
})
ipcMain.handle('get-window-position', () => {
  return mainWindow?.getPosition() ?? [0, 0]
})
ipcMain.handle('set-window-position', (_, [x, y]) => {
  mainWindow?.setPosition(x, y)
})
ipcMain.handle('set-window-size', (_, [w, h]) => {
  if (!mainWindow) return
  mainWindow.setSize(w, h)
})

// Load schedule data file (works in both dev and production)
ipcMain.handle('load-schedule-data', async () => {
  try {
    let dataPath
    if (app.isPackaged) {
      dataPath = path.join(process.resourcesPath, 'dist', 'time.json')
      if (!fs.existsSync(dataPath)) {
        dataPath = path.join(process.resourcesPath, 'public', 'time.json')
      }
    } else {
      dataPath = path.join(__dirname, '..', 'public', 'time.json')
    }
    if (!fs.existsSync(dataPath)) {
      console.error('[IPC] load-schedule-data: file not found at', dataPath)
      return null
    }
    const content = fs.readFileSync(dataPath, 'utf-8')
    const parsed = JSON.parse(content)
    return parsed
  } catch (e) {
    console.error('[IPC] load-schedule-data failed:', e.message)
    return null
  }
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
