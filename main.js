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
  clipboard,
  shell,
  safeStorage
} = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const { createLicense } = require('./license')

let win = null
let tray = null
let onTop = true

const pasteDir = path.join(app.getPath('temp'), 'lanpai-overlay-paste')
const API_BASE = process.env.LANPAI_API_URL || 'https://lanpai.pipee.tw'
const LICENSE_REFRESH_MS = 6 * 3600 * 1000
let license = null

// 登入憑證用作業系統金鑰加密後才落地;讀不到或解不開就當沒登入
function createLicenseStore() {
  const file = path.join(app.getPath('userData'), 'account.bin')
  return {
    load() {
      try {
        if (!safeStorage.isEncryptionAvailable()) return null
        return JSON.parse(safeStorage.decryptString(fs.readFileSync(file)))
      } catch (error) {
        return null
      }
    },
    save(value) {
      try {
        if (!safeStorage.isEncryptionAvailable()) return
        fs.writeFileSync(file, safeStorage.encryptString(JSON.stringify(value)))
      } catch (error) {
        // 存不下來只影響下次要重新登入
      }
    }
  }
}

function initLicense() {
  license = createLicense({
    apiBase: API_BASE,
    store: createLicenseStore(),
    openExternal: (url) => shell.openExternal(url),
    onChange: (plan) => {
      if (win) win.webContents.send('plan-changed', plan)
      refreshTrayMenu()
    }
  })
  ipcMain.handle('get-plan', () => license.plan())
  ipcMain.handle('start-upgrade', async () => {
    try {
      const result = await license.upgrade()
      refreshTrayMenu()
      return result
    } catch (error) {
      return 'error'
    }
  })
  license.refresh().then(refreshTrayMenu)
  setInterval(() => license.refresh().then(refreshTrayMenu), LICENSE_REFRESH_MS).unref()
}

async function confirmCancel() {
  const { until } = license.account()
  const end = until ? new Date(until).toLocaleDateString() : '這期結束'
  const { response } = await dialog.showMessageBox({
    type: 'question',
    buttons: ['取消訂閱', '繼續使用'],
    defaultId: 1,
    cancelId: 1,
    title: '取消訂閱',
    message: `確定要取消嗎?已付的期間可以用到 ${end}。`
  })
  if (response !== 0) return
  const ok = await license.cancel().catch(() => false)
  await dialog.showMessageBox({
    type: ok ? 'info' : 'error',
    title: '取消訂閱',
    message: ok ? '已取消,之後不會再扣款。' : '取消沒有成功,請稍後再試。'
  })
  refreshTrayMenu()
}

function accountMenuItems() {
  const account = license.account()
  if (account.plan === 'pro') {
    const until = account.until ? `到 ${new Date(account.until).toLocaleDateString()}` : ''
    return [
      { label: `懶拍 Pro ${until}`.trim(), enabled: false },
      { label: account.email || '已登入', enabled: false },
      { label: '取消訂閱', click: confirmCancel },
      { label: '登出', click: () => license.logout() }
    ]
  }
  const items = [
    {
      label: '升級 Pro',
      click: () => {
        if (win) {
          win.webContents.executeJavaScript("showUpgradeCard('elements')")
          win.focus()
        }
      }
    }
  ]
  if (account.signedIn) {
    items.push({ label: account.email || '已登入', enabled: false })
    items.push({ label: '登出', click: () => license.logout() })
  }
  else items.push({ label: '登入', click: () => license.login().then(refreshTrayMenu) })
  return items
}

function refreshTrayMenu() {
  if (tray) tray.setContextMenu(buildTrayMenu())
}

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

// Electron 沒有「壓到最底」的 API:setAlwaysOnTop(false) 只拿掉置頂旗標,視窗還是停在原本的 z 位置
// (所以從最前面放開時不會自己沉下去)。用 Win32 SetWindowPos 把它真的丟到 z-order 最底。
function pushToBack() {
  if (process.platform !== 'win32' || !win) return
  const buf = win.getNativeWindowHandle()
  const hwnd = buf.length === 8 ? buf.readBigInt64LE(0).toString() : buf.readInt32LE(0).toString()
  const sig =
    '[DllImport("user32.dll")]public static extern bool SetWindowPos(IntPtr h,IntPtr a,int x,int y,int cx,int cy,uint f);'
  // -2 = HWND_NOTOPMOST、1 = HWND_BOTTOM、0x13 = NOMOVE|NOSIZE|NOACTIVATE
  const command = `Add-Type -MemberDefinition '${sig}' -Name U -Namespace W;[W.U]::SetWindowPos([IntPtr]${hwnd},[IntPtr]-2,0,0,0,0,0x13);[W.U]::SetWindowPos([IntPtr]${hwnd},[IntPtr]1,0,0,0,0,0x13)`
  try {
    spawn('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', command], { windowsHide: true })
  } catch (error) {
    // 壓背景失敗就維持原狀,不影響其他功能
  }
}

// 兩顆明確方向鍵,不用切換:↑ 叫到最前面、↓ 退到背景
// ↑ 同時通知畫面端退出聚焦(若有):聚焦中按它 = 全部回來且置頂
function bringToFront() {
  if (!win) return
  onTop = true
  win.setAlwaysOnTop(true, 'screen-saver')
  win.moveTop()
  win.webContents.send('exit-spotlight')
}

function sendToBack() {
  if (!win) return
  onTop = false
  win.setAlwaysOnTop(false)
  pushToBack()
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
  tray.setContextMenu(buildTrayMenu())
  tray.on('double-click', addSmart)
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
      { label: '加文字 / 圖片網址\tCtrl+Shift+Space', click: addSmart },
      { label: '貼剪貼簿圖片\tCtrl+Shift+V', click: pasteClipboardImage },
      { label: '加圖片(選檔)', click: addImage },
      { label: '叫到最前面\tCtrl+Shift+↑', click: bringToFront },
      { label: '退到背景\tCtrl+Shift+↓', click: sendToBack },
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
      ...accountMenuItems(),
      { type: 'separator' },
      {
        label: '使用說明 / 快捷鍵',
        click: () => {
          win.webContents.send('show-help')
          win.focus()
        }
      },
      { label: '結束', click: () => app.quit() }
  ])
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
  initLicense()
  createWindow()
  createTray()
  globalShortcut.register('CommandOrControl+Shift+Space', addSmart)
  globalShortcut.register('CommandOrControl+Shift+V', pasteClipboardImage)
  globalShortcut.register('CommandOrControl+Shift+X', clearAll)
  globalShortcut.register('CommandOrControl+Shift+Up', bringToFront)
  globalShortcut.register('CommandOrControl+Shift+Down', sendToBack)
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  clearPasteDir()
})

app.on('window-all-closed', () => {
  app.quit()
})
