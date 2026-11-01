// Builds www/, the files the Android and iOS apps carry (webDir in capacitor.config.json).
//
//   npm run app:www                          uses the Render server
//   FARKLE_SERVER=https://my.host npm run app:www
//
// The apps have no Express server inside, so this:
//   - copies public/ (without the service worker, which the apps do not need)
//   - makes the lobby index.html and points /rules links at rules.html
//   - copies the libraries and fonts the pages use from node_modules, the same files the
//     website serves under /vendor/, plus the socket.io client and Capacitor's runtime
//   - writes scripts/config.js with the game server's address
const fs = require("fs");
const path = require("path");
const { fileFor, PRECACHE_FIXED } = require("../pwa");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const OUT = path.join(ROOT, "www");
const SERVER = String(process.env.FARKLE_SERVER || "https://farkle-eqec.onrender.com").replace(/\/+$/, "");

// public/ files the apps leave out
const SKIP = new Set(["sw.js", "manifest.webmanifest"]);
// Pages: source name -> name in the app
const PAGES = { "lobby.html": "index.html", "game.html": "game.html", "rules.html": "rules.html", "farkle.html": "farkle.html" };

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyTree(from, to) {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dest);
    else copy(src, dest);
  }
}

// Changes for pages that run inside the app
function adaptPage(html) {
  return html
    // No Express route for /rules in the app
    .replace(/href="\/rules"/g, 'href="/rules.html"')
    // The web app manifest means nothing inside a native app
    .replace(/\s*<link rel="manifest"[^>]*>/, "")
    // Capacitor's runtime before config.js, so the pages can reach native plugins
    .replace('    <script src="/scripts/config.js"></script>', '    <script src="/vendor/capacitor/capacitor.js"></script>\n    <script src="/scripts/config.js"></script>');
}

function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  // public/, pages renamed and adapted
  for (const entry of fs.readdirSync(PUBLIC, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const src = path.join(PUBLIC, entry.name);
    if (entry.isDirectory()) {
      copyTree(src, path.join(OUT, entry.name));
    } else if (PAGES[entry.name]) {
      const html = adaptPage(fs.readFileSync(src, "utf8"));
      if (!html.includes("/vendor/capacitor/capacitor.js")) throw new Error(`${entry.name} has no config.js script tag to put Capacitor before`);
      fs.writeFileSync(path.join(OUT, PAGES[entry.name]), html);
    } else {
      copy(src, path.join(OUT, entry.name));
    }
  }

  // Libraries and fonts: exactly the /vendor/ files the website keeps offline
  let vendorFiles = 0;
  for (const url of PRECACHE_FIXED) {
    if (!url.startsWith("/vendor/") || url.startsWith("/vendor/themestrap/")) continue;
    copy(fileFor(PUBLIC, url), path.join(OUT, url));
    vendorFiles++;
  }
  // Bootstrap Icons' CSS also names a .woff fallback next to the .woff2
  copy(fileFor(PUBLIC, "/vendor/bootstrap-icons/fonts/bootstrap-icons.woff"), path.join(OUT, "vendor/bootstrap-icons/fonts/bootstrap-icons.woff"));

  // The socket.io client the website gets from the server at /socket.io/socket.io.js
  const socketClient = path.join(path.dirname(require.resolve("socket.io")), "..", "client-dist", "socket.io.min.js");
  copy(socketClient, path.join(OUT, "socket.io", "socket.io.js"));

  // Capacitor's runtime, for plugins such as Share
  copy(path.join(ROOT, "node_modules", "@capacitor", "core", "dist", "capacitor.js"), path.join(OUT, "vendor", "capacitor", "capacitor.js"));

  // Where the game server is
  fs.writeFileSync(
    path.join(OUT, "scripts", "config.js"),
    "// Written by scripts/build-www.js, the game server the app talks to\n" +
      `window.FARKLE_SERVER = ${JSON.stringify(SERVER)};\n`,
  );

  console.log(`www/ built for ${SERVER}: ${Object.keys(PAGES).length} pages, ${vendorFiles} library and font files`);
}

build();
