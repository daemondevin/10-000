// Everything that makes the game installable and usable offline:
//   - the front end libraries and fonts, served from node_modules instead of a CDN
//   - the service worker, built from public/sw.js with the list of files to keep offline and
//     a version taken from those files' contents, so each deploy that changes one of them
//     updates installed copies of the game
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");

const MODULES = path.join(__dirname, "node_modules");

// URL prefix -> folder inside node_modules. Versions are pinned in package.json.
const VENDOR = {
  "/vendor/bootstrap": "bootstrap/dist",
  "/vendor/bootstrap-icons": "bootstrap-icons/font",
  "/vendor/jquery": "jquery/dist",
  "/vendor/three/build": "three/build",
  "/vendor/three/examples/jsm": "three/examples/jsm",
  "/vendor/cannon-es": "cannon-es/dist",
  "/vendor/fonts/lato": "@fontsource/lato/files",
  "/vendor/fonts/bruno-ace-sc": "@fontsource/bruno-ace-sc/files",
  "/vendor/fonts/montserrat": "@fontsource/montserrat/files",
};

// Pages served by a route rather than straight from public/
const PAGES = {
  "/": "lobby.html",
  "/rules": "rules.html",
};

// What the service worker stores when the game is installed. Enough for the lobby, the rules
// and the whole 3D game to open without a connection. The 2 MB dice model and the page
// background are cached the first time they are used instead (the 3D game draws its own dice
// until the model is there).
const PRECACHE_FIXED = [
  "/",
  "/rules",
  "/farkle.html",
  "/rules.md",
  "/manifest.webmanifest",
  "/styles/app.css",
  "/styles/fonts.css",
  "/scripts/config.js",
  "/scripts/app.js",
  "/scripts/lobby.js",
  "/scripts/main.js",
  "/scripts/farkle.js",
  "/scripts/dice3d.js",
  "/scripts/scoring.js",
  "/img/background.png",
  "/img/icons/icon-192.png",
  "/img/icons/icon-512.png",
  "/img/icons/favicon.svg",
  "/vendor/bootstrap/css/bootstrap.min.css",
  "/vendor/bootstrap/js/bootstrap.bundle.min.js",
  "/vendor/bootstrap-icons/bootstrap-icons.min.css",
  "/vendor/bootstrap-icons/fonts/bootstrap-icons.woff2",
  "/vendor/jquery/jquery.min.js",
  "/vendor/three/build/three.module.js",
  "/vendor/three/examples/jsm/controls/OrbitControls.js",
  "/vendor/three/examples/jsm/loaders/OBJLoader.js",
  "/vendor/three/examples/jsm/loaders/MTLLoader.js",
  "/vendor/cannon-es/cannon-es.js",
  "/vendor/fonts/lato/lato-latin-300-normal.woff2",
  "/vendor/fonts/lato/lato-latin-400-normal.woff2",
  "/vendor/fonts/lato/lato-latin-400-italic.woff2",
  "/vendor/fonts/lato/lato-latin-700-normal.woff2",
  "/vendor/fonts/bruno-ace-sc/bruno-ace-sc-latin-400-normal.woff2",
  "/vendor/fonts/montserrat/montserrat-latin-600-normal.woff2",
];

// The file on disk behind a URL, or null
function fileFor(publicDir, url) {
  if (PAGES[url]) return path.join(publicDir, PAGES[url]);
  for (const [prefix, folder] of Object.entries(VENDOR)) {
    if (url.startsWith(prefix + "/")) return path.join(MODULES, folder, url.slice(prefix.length + 1));
  }
  return path.join(publicDir, url.replace(/^\/+/, ""));
}

// Every Themestrap file the pages load
function themestrapFiles(publicDir) {
  const base = path.join(publicDir, "vendor", "themestrap", "js");
  const urls = [];
  const walk = (dir, url) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name), `${url}/${entry.name}`);
      else if (entry.name.endsWith(".js")) urls.push(`${url}/${entry.name}`);
    }
  };
  if (fs.existsSync(base)) walk(base, "/vendor/themestrap/js");
  return urls.sort();
}

function buildServiceWorker(publicDir) {
  const precache = [...PRECACHE_FIXED, ...themestrapFiles(publicDir)];
  const hash = crypto.createHash("sha256");
  const missing = [];
  for (const url of precache) {
    const file = fileFor(publicDir, url);
    if (file && fs.existsSync(file)) hash.update(url).update(fs.readFileSync(file));
    else missing.push(url);
  }
  if (missing.length) console.warn("service worker: files to cache are missing:", missing.join(", "));
  const template = fs.readFileSync(path.join(publicDir, "sw.js"), "utf8");
  hash.update(template);
  const version = hash.digest("hex").slice(0, 12);
  const available = precache.filter((url) => !missing.includes(url));
  return template
    .replace("__VERSION__", version)
    .replace("__PRECACHE__", JSON.stringify(available, null, 2));
}

// Call before express.static(publicDir) so /sw.js comes from here
function mountPwa(app, { publicDir }) {
  for (const [prefix, folder] of Object.entries(VENDOR)) {
    // The versions are pinned, so browsers may keep these for a long time
    app.use(prefix, express.static(path.join(MODULES, folder), { maxAge: "30d", fallthrough: false }));
  }

  // Built once per server start. In development, restart the server after changing a cached file.
  const serviceWorker = buildServiceWorker(publicDir);
  app.get("/sw.js", (req, res) => {
    res.type("application/javascript");
    // Browsers must always check for a new worker
    res.set("Cache-Control", "no-cache");
    res.send(serviceWorker);
  });
}

module.exports = { mountPwa, buildServiceWorker, fileFor, PRECACHE_FIXED, VENDOR };
