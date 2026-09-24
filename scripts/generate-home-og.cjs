#!/usr/bin/env node

// Rebuild the static share cards from the source photo and the approved SVG
// wordmark. Keep this outside the app bundle: sharp must not enter page traces.
const sharp = require("sharp");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const photo = join(root, "public/og-race.jpg");
const logo = readFileSync(join(root, "public/brand/lets-race.svg"));
const output = join(root, "public/og");
const cards = {
  en: {
    title: ["Every cycling race, on one", "map"],
    description: [
      "Road, gravel, MTB, cyclocross and kids' races across Central",
      "Europe. Plan the season for yourself, your family or your team.",
    ],
  },
  cs: {
    title: ["Všechny cyklistické", "závody na jedné mapě"],
    description: [
      "Silnice, gravel, MTB, cyklokros i dětské závody napříč střední",
      "Evropou. Naplánuj sezónu sobě, rodině nebo týmu.",
    ],
  },
  pl: {
    title: ["Wszystkie wyścigi kolarskie", "na jednej mapie"],
    description: [
      "Szosa, gravel, MTB, przełaje i wyścigi dla dzieci w Europie",
      "Środkowej. Zaplanuj sezon dla siebie, rodziny lub drużyny.",
    ],
  },
  sk: {
    title: ["Všetky cyklistické preteky", "na jednej mape"],
    description: [
      "Cesta, gravel, MTB, cyklokros aj detské preteky naprieč",
      "strednou Európou. Naplánuj sezónu sebe, rodine alebo tímu.",
    ],
  },
};

function escape(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function textOverlay({ title, description }) {
  const heading = title
    .map((line, i) => `<text x="72" y="${391 + i * 65}" class="title">${escape(line)}</text>`)
    .join("");
  const detail = description
    .map((line, i) => `<text x="73" y="${515 + i * 35}" class="detail">${escape(line)}</text>`)
    .join("");
  return Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="shade"><stop stop-color="#000" stop-opacity=".25"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>
    <rect width="1200" height="630" fill="#000" fill-opacity=".43"/>
    <rect width="1200" height="630" fill="url(#shade)"/>
    <style>
      .title { font-family: 'Inter Display'; font-size: 60px; font-weight: 800; letter-spacing: -2px; fill: white; }
      .detail { font-family: 'Inter Display'; font-size: 25px; font-weight: 400; fill: #ededed; }
    </style>${heading}${detail}</svg>`);
}

async function render(name, copy) {
  const card = await sharp(photo)
    .resize(1200, 630, { fit: "cover" })
    .composite([
      { input: textOverlay(copy), left: 0, top: 0 },
      { input: await sharp(logo).resize({ width: 245 }).png().toBuffer(), left: 73, top: 86 },
    ])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  await sharp(card).toFile(join(output, `home-${name}.jpg`));
}

(async () => {
  for (const [locale, copy] of Object.entries(cards)) await render(locale, copy);
  await render("default", cards.en);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
