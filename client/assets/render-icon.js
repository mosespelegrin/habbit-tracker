/**
 * Renders assets/icon.svg to assets/icon.png at exactly 512x512 (transparent rounded corners).
 * Usage: node assets/render-icon.js
 * Then:  npm run assets:android   (regenerates the Android launcher icons + splash)
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SVG = path.join(__dirname, 'icon.svg');
const OUT = path.join(__dirname, 'icon.png');

(async () => {
  const svg = fs.readFileSync(SVG, 'utf8');
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 512, height: 512, deviceScaleFactor: 1 });
  await page.setContent(
    `<!doctype html><style>*{margin:0;padding:0}html,body{width:512px;height:512px;overflow:hidden}svg{display:block}</style>${svg}`,
    { waitUntil: 'load' }
  );
  await page.screenshot({ path: OUT, omitBackground: true, clip: { x: 0, y: 0, width: 512, height: 512 } });
  await browser.close();

  // verify IHDR dimensions
  const buf = fs.readFileSync(OUT);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  console.log(`wrote ${OUT} (${w}x${h}, ${buf.length} bytes)`);
  if (w !== 512 || h !== 512) {
    console.error('ERROR: icon is not 512x512');
    process.exit(1);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
