// Gera os ícones do site a partir de dois SVGs (versão pequena e versão detalhada).
// Rodar com o servidor parado ou não, tanto faz: só usa o Chromium do Playwright.
//   node tests/icons.mjs
import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";

// cores oficiais da logo (as mesmas de assets/img/logo.svg): meia-lua grafite, C+M cobre
const GRAD = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9a066"/><stop offset="1" stop-color="#9a5426"/></linearGradient>`;
const MOON = `<path d="M52 4A46 46 0 0 0 52 96A37 46 0 0 1 52 4Z" fill="#2b2e33"/>`;
const LOGO_BG = "#f4f3ef";
const CM = "M74.5 21.2A33 33 0 1 0 74.5 78.8M41 72V32.5L60 55L79 32.5V72";

// Sem fundo por padrão (transparente). bg só nos atalhos de tela inicial: iOS e Android não aceitam
// transparência e pintariam o fundo de preto, sumindo com a meia-lua grafite.
// pad: margem interna (ícones "maskable" do Android precisam de área segura maior).
function icon({ detailed, bg = null, pad = 1 }) {
  const off = ((1 - pad) * 100) / 2;
  const mark = detailed
    ? `<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><g fill="none" stroke-miterlimit="10">
         <path d="${CM}" stroke="#fff" stroke-width="9"/><path d="${CM}" stroke="#000" stroke-width="2.6"/></g></mask>
       ${MOON}<rect width="100" height="100" fill="url(#g)" mask="url(#m)"/>`
    : `${MOON}<path d="${CM}" fill="none" stroke="url(#g)" stroke-width="10" stroke-miterlimit="10"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>${GRAD}</defs>
  ${bg ? `<rect width="100" height="100" fill="${bg}"/>` : ""}
  <g transform="translate(${off} ${off}) scale(${pad})">${mark}</g>
</svg>
`;
}

// Ícone da aba (SVG): é o único que sabe o tema do navegador.
// Tema claro: sem fundo. Tema escuro: a meia-lua grafite sumiria no fundo escuro da aba,
// então ganha um quadradinho no fundo claro da própria logo (cores oficiais intactas).
const tab = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <style>
    .tile { fill: none; }
    .mark { transform-origin: 50px 50px; }
    @media (prefers-color-scheme: dark) {
      .tile { fill: ${LOGO_BG}; }
      .mark { transform: scale(.8); }
    }
  </style>
  <defs>${GRAD}</defs>
  <rect class="tile" width="100" height="100" rx="22"/>
  <g class="mark">${MOON}<path d="${CM}" fill="none" stroke="url(#g)" stroke-width="10" stroke-miterlimit="10"/></g>
</svg>
`;
writeFileSync("assets/img/favicon.svg", tab);
mkdirSync("assets/img/icons", { recursive: true });

const targets = [
  // [arquivo, tamanho, opções]
  ["favicon-16.png", 16, { detailed: false }],
  ["favicon-32.png", 32, { detailed: false }],
  ["favicon-48.png", 48, { detailed: false }],
  ["favicon-96.png", 96, { detailed: true }],
  ["favicon-144.png", 144, { detailed: true }],
  ["apple-touch-icon.png", 180, { detailed: true, bg: LOGO_BG, pad: 0.8 }],
  ["icon-192.png", 192, { detailed: true }],
  ["icon-512.png", 512, { detailed: true }],
  ["icon-maskable-512.png", 512, { detailed: true, bg: LOGO_BG, pad: 0.66 }],
];

const browser = await chromium.launch();
const page = await browser.newPage();
const png = {};
for (const [file, size, opts] of targets) {
  await page.setViewportSize({ width: size, height: size });
  const svg = icon(opts).replace("<svg ", `<svg width="${size}" height="${size}" `);
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`);
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(`assets/img/icons/${file}`, buf);
  png[size] ??= buf;
  console.log(file, buf.length, "bytes");
}
await browser.close();

// favicon.ico com 16, 32 e 48 (PNG embutido em ICO: aceito por todos os navegadores atuais)
const sizes = [16, 32, 48];
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const e = 6 + 16 * i, data = png[s];
  header.writeUInt8(s, e);
  header.writeUInt8(s, e + 1);
  header.writeUInt8(0, e + 2);
  header.writeUInt8(0, e + 3);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(data.length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += data.length;
});
writeFileSync("favicon.ico", Buffer.concat([header, ...sizes.map((s) => png[s])]));
console.log("favicon.ico", offset, "bytes");
