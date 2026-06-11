// Generates assets/icon-256.png — a branded blue dot, no external deps.
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

const SIZE = 256
const data = Buffer.alloc(SIZE * SIZE * 4)

const cx = SIZE / 2
const cy = SIZE / 2
const R = SIZE * 0.46

// brand blue #78B4FF, deepened toward edge for a glossy disc
const inner = [0x9c, 0xcd, 0xff]
const outer = [0x3f, 0x86, 0xf0]

function px(x, y, r, g, b, a) {
  const i = (y * SIZE + x) * 4
  data[i] = r
  data[i + 1] = g
  data[i + 2] = b
  data[i + 3] = a
}

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const dx = x + 0.5 - cx
    const dy = y + 0.5 - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > R + 1) {
      px(x, y, 0, 0, 0, 0)
      continue
    }
    // radial gradient, highlight toward upper-left
    const hx = x + 0.5 - (cx - R * 0.35)
    const hy = y + 0.5 - (cy - R * 0.35)
    const hl = Math.min(1, Math.sqrt(hx * hx + hy * hy) / (R * 1.4))
    const t = dist / R
    const mix = Math.min(1, t * 0.7 + hl * 0.3)
    const r = Math.round(inner[0] + (outer[0] - inner[0]) * mix)
    const g = Math.round(inner[1] + (outer[1] - inner[1]) * mix)
    const b = Math.round(inner[2] + (outer[2] - inner[2]) * mix)
    // antialias the rim
    const a = dist > R ? Math.round(255 * (1 - (dist - R))) : 255
    px(x, y, r, g, b, Math.max(0, Math.min(255, a)))
  }
}

// PNG encode (truecolor + alpha)
function chunk(type, body) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(body.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, body])) >>> 0, 0)
  return Buffer.concat([len, typeBuf, body, crc])
}

const crcTable = (() => {
  const t = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // color type RGBA
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0 // filter none
  data.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
}
const idat = zlib.deflateSync(raw, { level: 9 })

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0))
])

const out = path.join(__dirname, '..', 'assets', 'icon-256.png')
fs.writeFileSync(out, png)
console.log('wrote', out, png.length, 'bytes')
