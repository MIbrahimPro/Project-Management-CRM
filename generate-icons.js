const fs = require("fs");
const path = require("path");

function createPNG(size, outputPath) {
  const width = size;
  const height = size;
  const channels = 4;

  const buffer = Buffer.alloc(width * height * channels);

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = width * 0.35;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        buffer[idx] = 0xf9;
        buffer[idx + 1] = 0x73;
        buffer[idx + 2] = 0x16;
        buffer[idx + 3] = 0xff;
      } else {
        buffer[idx] = 0x1a;
        buffer[idx + 1] = 0x1a;
        buffer[idx + 2] = 0x2e;
        buffer[idx + 3] = 0xff;
      }
    }
  }

  const png = createMinimalPNG(buffer, width, height);
  fs.writeFileSync(outputPath, png);
  console.log(`Created ${outputPath}`);
}

function createMinimalPNG(rawData, width, height) {
  const zlib = require("zlib");

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function makeChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const crcData = Buffer.concat([typeBuf, data]);
    const crc = crc32(crcData);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([length, typeBuf, data, crcBuf]);
  }

  function crc32(buf) {
    let c = 0xffffffff;
    const table = [];
    for (let n = 0; n < 256; n++) {
      let k = n;
      for (let i = 0; i < 8; i++) {
        k = k & 1 ? 0xedb88320 ^ (k >>> 1) : k >>> 1;
      }
      table[n] = k >>> 0;
    }
    for (let i = 0; i < buf.length; i++) {
      c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return c;
  }

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  let idatData = Buffer.alloc(0);
  for (let y = 0; y < height; y++) {
    const rowStart = y * width * 4;
    const rowEnd = rowStart + width * 4;
    const row = rawData.slice(rowStart, rowEnd);
    idatData = Buffer.concat([idatData, Buffer.from([0]), row]);
  }

  const compressed = zlib.deflateSync(idatData);

  return Buffer.concat([
    signature,
    makeChunk("IHDR", ihdrData),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

const iconsDir = path.join(__dirname, "public", "icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

createPNG(192, path.join(iconsDir, "icon-192.png"));
createPNG(512, path.join(iconsDir, "icon-512.png"));
