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
const fs = require('fs')

let win = null
let tray = null
let onTop = true

const pasteDir = path.join(app.getPath('temp'), 'lanpai-overlay-paste')

function clearPasteDir() {
  try {
    fs.rmSync(pasteDir, { recursive: true, force: true })
  } catch (error) {
    // 暫存清不掉就留給下次,不影響功能
  }
}

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

  win.setMenu(null)
  win.setAlwaysOnTop(onTop, 'screen-saver')
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

function clearAll() {
  if (win) win.webContents.send('clear-all')
}

// 置頂開關:釘在最前面 ↔ 放開讓它被蓋住。要可靠跳到最前面,那一下就得變成置頂
function toggleTop() {
  if (!win) return
  onTop = !onTop
  win.setAlwaysOnTop(onTop, 'screen-saver')
  if (onTop) win.moveTop()
}

function pasteClipboardImage() {
  const image = clipboard.readImage()
  if (!image.isEmpty()) {
    try {
      fs.mkdirSync(pasteDir, { recursive: true })
      const filePath = path.join(pasteDir, `paste-${Date.now()}.png`)
      fs.writeFileSync(filePath, image.toPNG())
      win.webContents.send('add-image', filePath)
    } catch (error) {
      win.webContents.send('add-image', image.toDataURL())
    }
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
      { label: '置頂 / 放開\tCtrl+Shift+↑', click: toggleTop },
      { type: 'separator' },
      { label: '復原上一步\tCtrl+Z', click: () => win.webContents.send('undo') },
      {
        label: '還原較早版本',
        click: () => {
          win.webContents.send('show-history')
          win.focus()
        }
      },
      { type: 'separator' },
      { label: '清空全部\tCtrl+Shift+X', click: clearAll },
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

  // 不在開機時清暫存:萬一上次是當機,要留著剪貼簿圖片給「還原」用;正常結束才清(will-quit)
  createWindow()
  createTray()
  globalShortcut.register('CommandOrControl+Shift+Space', addSmart)
  globalShortcut.register('CommandOrControl+Shift+V', pasteClipboardImage)
  globalShortcut.register('CommandOrControl+Shift+X', clearAll)
  globalShortcut.register('CommandOrControl+Shift+Up', toggleTop)
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  clearPasteDir()
})

app.on('window-all-closed', () => {
  app.quit()
})
