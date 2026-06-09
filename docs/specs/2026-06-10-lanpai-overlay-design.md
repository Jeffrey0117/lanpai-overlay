# lanpai-overlay 設計規格

日期:2026-06-10
取代:lanpai-blueplan(Tauri 版,棄用)

## 目標

桌面透明覆蓋小工具:在螢幕上顯示文字與圖片,完全去背、無視窗框,可拖曳移動、拉動縮放。架構極小、使用極簡。

## 技術選型

- Electron(latest),零框架、零 build step,純 HTML/CSS/JS
- 不用 React / Vite / TypeScript 編譯

## 架構(方案 A:單一全螢幕透明層)

| 檔案 | 職責 |
|------|------|
| `main.js` | App 進入點:建立透明視窗、tray 選單、檔案對話框、IPC |
| `preload.js` | contextBridge,橋接 main ↔ renderer |
| `overlay.html` | 覆蓋層外殼 + 樣式 |
| `overlay.js` | 元素建立/拖曳/縮放/刪除、滑鼠穿透切換 |

## 視窗行為

- `transparent: true, frame: false, skipTaskbar: true, resizable: false`
- 尺寸 = 主螢幕 bounds,`alwaysOnTop`(screen-saver 層級)
- 預設 `setIgnoreMouseEvents(true, { forward: true })`:空白處滑鼠完全穿透
- renderer 以 `mousemove` + `elementFromPoint` 偵測 hover,移到元素上時切為可互動,離開後恢復穿透

## 使用流程

1. 啟動 → 無任何可見視窗,只有 tray 圖示
2. Tray 選單:`加文字`、`加圖片`、`清空全部`、`結束`
3. 加文字 → 螢幕中央出現輸入框,Enter 確認成為元素,Esc 取消
4. 加圖片 → 原生檔案對話框選圖(png/jpg/gif/webp)
5. 元素互動:
   - 拖曳本體 → 移動
   - 拖右下角把手 → 縮放(文字調 font-size、圖片調寬度,等比)
   - 雙擊文字 → 重新編輯
   - 右鍵元素 → 刪除
6. 多元素並存;關閉即清空,不做持久化

## 錯誤處理

- 圖片載入失敗 → 移除該元素
- 對話框取消 → 無動作

## 驗證方式

GUI 行為以手動驗證為主:啟動不崩潰、tray 出現、加文字/圖片/拖曳/縮放/刪除各走一遍。
