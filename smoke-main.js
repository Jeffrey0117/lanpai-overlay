// 一次性煙霧測試:獨立 userData 繞過單實例鎖,跑完寫 smoke-result.json 後自動退出
const { app, BrowserWindow } = require('electron')
const path = require('path')
const os = require('os')
const fs = require('fs')

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'lanpai-smoke-')))
require('./main.js')

const testScript = fs.readFileSync(path.join(__dirname, 'smoke-renderer.js'), 'utf8')

app.whenReady().then(() => {
  setTimeout(async () => {
    const win = BrowserWindow.getAllWindows()[0]
    try {
      const result = await win.webContents.executeJavaScript(testScript)
      fs.writeFileSync(path.join(__dirname, 'smoke-result.json'), result)
    } catch (error) {
      fs.writeFileSync(path.join(__dirname, 'smoke-result.json'), JSON.stringify({ error: String(error) }))
    }
    app.exit(0)
  }, 2500)
})
