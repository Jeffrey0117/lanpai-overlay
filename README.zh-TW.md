<p align="center">
  <img src="assets/icon.png" alt="懶拍 Overlay" width="64" />
</p>
<h1 align="center">懶拍 Overlay</h1>
<p align="center">
  <strong>把文字和圖片直接釘在螢幕上。沒有視窗,沒有背景,沒有廢話。</strong>
</p>
<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT" />
  <img src="https://img.shields.io/badge/electron-36-blue" alt="Electron 36" />
  <img src="https://img.shields.io/badge/framework-%E9%9B%B6-orange" alt="Zero Framework" />
</p>
<p align="center">
  <a href="README.md">English</a> | 繁體中文
</p>

---

## 想像一下

你在錄短影片。台詞記不住,提詞 app 又是一個大視窗擋在那邊。

你按 `Ctrl+Shift+Space`,打兩行台詞,Enter。台詞就浮在鏡頭旁邊——完全去背,只有字。
拖到順眼的位置,拉大,加個黑底。錄完按 Del,字消失,像沒存在過。

中途要對照分鏡?`Win+Shift+S` 截圖、`Ctrl+Shift+V`,分鏡圖直接上牆。

整個過程,螢幕上沒有出現過任何一個「視窗」。

---

## 為什麼不直接用 Snipaste / OBS?

| | Snipaste 貼圖 | OBS 文字來源 | 懶拍 Overlay |
|---|---|---|---|
| 圖片釘在螢幕上 | ✅ | ❌ 只在錄製畫布 | ✅ |
| 打字直接上螢幕 | ❌ | ✅ 但要開 OBS | ✅ **一顆快捷鍵** |
| 完全去背無視窗框 | ⚠️ 有邊框 | — | ✅ |
| 空白處滑鼠穿透 | — | — | ✅ **不擋任何操作** |
| 文字樣式 + 模板 | ❌ | ⚠️ 要進設定改 | ✅ **浮動面板就地改** |
| 安裝負擔 | 小 | 大 | `npm start` |

---

## 它做了什麼

### 一顆鍵,什麼都能上螢幕
`Ctrl+Shift+Space` 冒出輸入框——打字就是文字,貼 `https://` 圖片網址就自動變圖片。不用選模式。

### 剪貼簿直通螢幕
`Ctrl+Shift+V` 把剪貼簿的圖直接釘上去。配合 `Win+Shift+S` 截圖,兩秒完成「看到 → 上牆」。剪貼簿裡是圖片網址?也通。

### 元素隨手調,空白處隱形
滑鼠移到元素上:拖曳移動、拉右下角把手縮放、雙擊改字、Del 或右鍵刪除。
滑鼠在空白處:整層完全穿透,你的點擊直接落到底下的應用程式,它不存在。

### 樣式面板,陰影永遠不尷尬
點文字浮出面板:7 色色票、粗細三段、陰影四式、底色三款(無底/黑底/白底,底會比字寬一圈)。
陰影顏色自動對比——黑字自動配白影,白字自動配黑影,零設定。
調好的樣式可存成模板(T1、T2⋯),重開還在;內容本身用完即丟,不搞存檔。

### 點圖片,就地換圖
圖片的面板是一個網址輸入框:貼新網址 Enter,原地換圖,位置大小不動。網址壞了自動退回原圖。

---

## 快速開始

```bash
git clone https://github.com/Jeffrey0117/lanpai-overlay.git
cd lanpai-overlay
npm install
npm start
```

啟動後螢幕上**什麼都不會出現**——這是正常的。工作列的藍色小圓點就是它。

### 快捷鍵

| 鍵 | 動作 |
|---|---|
| `Ctrl+Shift+Space` | 萬用輸入框(文字 / 圖片網址) |
| `Ctrl+Shift+V` | 貼剪貼簿圖片 |
| `Del` | 刪除選中的元素 |
| `Esc` | 關閉輸入框 |

### 元素操作

| 動作 | 效果 |
|---|---|
| 拖曳元素 | 移動 |
| 拉右下角把手 | 縮放(文字調字級、圖片等比) |
| 點一下 | 浮出樣式面板 |
| 雙擊文字 | 就地重新編輯 |
| 右鍵元素 | 刪除 |
| 右鍵模板 chip | 刪除該模板 |

---

## 架構

零框架、零 build step,五個檔案:

```
lanpai-overlay/
├── main.js       # 透明視窗、tray、全域快捷鍵、剪貼簿、檔案對話框
├── preload.js    # IPC 橋(8 行)
├── overlay.html  # 覆蓋層外殼 + 樣式
├── overlay.js    # 元素建立 / 拖曳縮放 / 滑鼠穿透切換
└── toolbar.js    # 樣式面板、模板(localStorage)
```

核心機制:`setIgnoreMouseEvents(true, { forward: true })` + `mousemove` 偵測——滑鼠在元素上時視窗可互動,其餘時間完全穿透。

---

## 前世今生

前身是 [lanpai-blueplan](https://github.com/Jeffrey0117/lanpai-blueplan)(Tauri + React 版),砍掉重練成現在這個樣子:更少的程式碼、零編譯、開了就跑。

---

## Roadmap

- [x] 透明覆蓋層 + tray
- [x] 全域快捷鍵 + 剪貼簿貼圖
- [x] 樣式面板 + 模板
- [x] 文字底色
- [ ] 打包成免安裝 exe(electron-builder)
- [ ] 多螢幕支援
- [ ] 自訂快捷鍵

---

## License

MIT
