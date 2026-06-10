const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  dialog,
  ipcMain,
  screen,
  nativeImage,
  globalShortcut,
  clipboard
} = require('electron')
const path = require('path')

let win = null
let tray = null

function createWindow() {
  const { bounds } = screen.getPrimaryDisplay()

  win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transparent: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setMenu(null)
  win.setIgnoreMouseEvents(true, { forward: true })
  win.loadFile('overlay.html')
}

async function addImage() {
  const result = await dialog.showOpenDialog({
    title: '選擇圖片',
    filters: [{ name: '圖片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] }],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) return
  win.webContents.send('add-image', result.filePaths[0])
}

function addSmart() {
  win.webContents.send('add-smart')
  win.focus()
}

function pasteClipboardImage() {
  const image = clipboard.readImage()
  if (!image.isEmpty()) {
    win.webContents.send('add-image', image.toDataURL())
    return
  }
  const text = clipboard.readText().trim()
  if (/^https?:\/\/\S+$/i.test(text)) {
    win.webContents.send('add-image', text)
  }
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png'))
  tray = new Tray(icon)
  tray.setToolTip('懶拍 Overlay')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '加文字 / 圖片網址\tCtrl+Shift+Space', click: addSmart },
      { label: '貼剪貼簿圖片\tCtrl+Shift+V', click: pasteClipboardImage },
      { label: '加圖片(選檔)', click: addImage },
      { type: 'separator' },
      { label: '清空全部', click: () => win.webContents.send('clear-all') },
      { type: 'separator' },
      { label: '結束', click: () => app.quit() }
    ])
  )
  tray.on('double-click', addSmart)
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

app.whenReady().then(() => {
  ipcMain.on('set-ignore-mouse', (_event, ignore) => {
    if (!win) return
    if (ignore) {
      win.setIgnoreMouseEvents(true, { forward: true })
    } else {
      win.setIgnoreMouseEvents(false)
    }
  })

  createWindow()
  createTray()
  globalShortcut.register('CommandOrControl+Shift+Space', addSmart)
  globalShortcut.register('CommandOrControl+Shift+V', pasteClipboardImage)
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  app.quit()
})
