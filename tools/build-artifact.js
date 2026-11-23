#!/usr/bin/env node
// Bundles the game into dist/ as one HTML page (CSS and JS inlined) plus the
// character images, ready to publish as a claude.ai artifact.
//
//   node tools/fetch-images.js --download   # first, so images/ has the files
//   node tools/build-artifact.js
//
// The artifact host only allows images that ship with the page, so the images
// are copied next to it instead of being loaded from AniList.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const html = read("index.html");
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const fonts = html.match(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/)[0];
let body = html.match(/<body>([\s\S]*)<\/body>/)[1];
body = body.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => `<script>\n${read(src)}\n</script>`);

const page = `${title}
<link rel="preconnect" href="https://fonts.googleapis.com" />
${fonts}
<style>
${read("css/style.css")}
</style>
${body}`;

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, "images"), { recursive: true });
fs.writeFileSync(path.join(DIST, "index.html"), page);

let n = 0;
for (const f of fs.readdirSync(path.join(ROOT, "images"))) {
  if (!/\.(png|jpe?g|webp)$/i.test(f)) continue;
  fs.copyFileSync(path.join(ROOT, "images", f), path.join(DIST, "images", f));
  n++;
}
console.log(`dist/index.html (${(page.length / 1024).toFixed(0)} KB) + ${n} images`);
