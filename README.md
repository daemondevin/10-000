# 10,000 with Friends

The dice game 10,000 (also known as Farkle), playable online with friends or alone.

[Live Demo](https://farkle-eqec.onrender.com)

## Running it

```bash
npm install
npm start
```

Then open http://localhost:3030.

| Page | What it is |
| --- | --- |
| `/` | Lobby: start a new online game, join one by its code, or pick an open one |
| `/<room>` | An online game. Share the link (or use **Invite**) so friends can join. The **3D** button switches your own view between the flat dice and the 3D table |
| `/farkle.html` | Single player or pass and play in 3D (also linked from the lobby) |
| `/rules` | Rules and scoring chart |

`npm run dev` restarts the server whenever a file changes.

## Installing it as an app

The game is a Progressive Web App, so it installs from the browser with its own icon and window, and works offline for the 3D game, the rules and the lobby.

| Device | How |
| --- | --- |
| Windows, Linux, macOS, ChromeOS | Open the site in Chrome or Edge and press **Install app** in the lobby (or the install icon in the address bar) |
| Android | Open the site in Chrome and press **Install app**, or use the menu's **Install app** |
| iPhone and iPad | Open the site in Safari, tap **Share**, then **Add to Home Screen** (the lobby's **Install app** button shows these steps) |

Installing needs the site on **https**, as on Render, or on `http://localhost` while developing. A LAN address such as `http://192.168.1.10:3030` plays normally but browsers will not install it.

Online games still need the server. When there is no connection the lobby says so and points to the 3D game. Invites use the system share sheet on phones and tablets, and anyone can join from the lobby by typing the five letter game code or pasting the invite link.

Updates reach installed copies on their own: the server builds the service worker with a version taken from the files it keeps offline, so a deploy that changes any of them makes the app offer a **Reload** to the new version.

## Android and iOS apps

The same pages also ship as store apps, wrapped with [Capacitor](https://capacitorjs.com). The apps carry the pages, libraries and dice model with them and talk to the game server over the internet (the Render server by default), so the 3D game works offline and online games work anywhere.

What you need:

| For | Tools |
| --- | --- |
| Android (Android 7.0 and newer) | Android Studio, which brings the Java 21 and Android SDK the build uses. Windows, macOS or Linux |
| iOS (iOS 15 and newer) | A Mac with Xcode. Publishing also needs an Apple Developer account |

First time:

```bash
npm install
npm run app:www          # builds www/, the files the apps carry
npx cap add android      # creates android/
npx cap add ios          # creates ios/ (any computer, building it needs the Mac)
npm run app:assets       # app icons and splash screens from assets/
```

After that, whenever the game changes:

```bash
npm run app:android      # rebuilds www/, copies it into the apps, opens Android Studio
npm run app:ios          # the same for Xcode
```

In Android Studio press **Run** to try it on a phone or emulator, or **Build > Generate Signed App Bundle or APK** for the Play Store. In Xcode pick a device and press **Run**, or **Product > Archive** for the App Store.

| File | Role |
| --- | --- |
| `capacitor.config.json` | App id (`com.daemondevin.tenthousand`), name and screen settings. The id is permanent once an app is published |
| `scripts/build-www.js` | Builds `www/` from `public/` and `node_modules`: lobby as `index.html`, the libraries, the socket.io client, Capacitor's runtime and the server address |
| `assets/` | Source images for `npm run app:assets` (icon layers and splash screens) |
| `android/`, `ios/` | The native projects. Commit them once created, they hold your signing and store settings |

The server address the apps use comes from `FARKLE_SERVER` when building, for example `FARKLE_SERVER=https://my.host npm run app:android`. The server accepts the apps' requests from `capacitor://localhost` (iOS) and `https://localhost` (Android); set `ALLOWED_ORIGINS` on the server to change that list. Invites from the apps always send the website's address, so friends without the app can join in a browser.

Render's free plan puts the server to sleep when nobody plays, so the first game of the day can take most of a minute to start in the apps as well as on the website.

## Playing online

1. Press **New Game** in the lobby and **Join** with a name. The first player to join is the host.
2. Send the invite link to friends. They join from the link or from the lobby's open games list.
3. The host presses **Start**. A random player goes first.
4. On your turn, **Roll**, click the dice you want to keep (they turn green), then **Roll** the rest or **Bank**.
5. Your first bank needs at least 1,000 points from a single turn. After that every bank needs at least 400.
6. Banking to 10,000 starts the final round: everyone else gets one last turn to beat that score, and the highest score after it wins. Throwing six of a kind wins on the spot. The host can then start another game with the same players.

If a player's connection drops or they reload the page, they keep their seat for a minute and are put back automatically.

## Settings

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3030` | Port the server listens on |
| `WINNING_SCORE` | `10000` | Score that starts the final round, handy for short test games |
| `ENTRY_SCORE` | `1000` | Points needed in one turn for a player's first bank |
| `MIN_BANK` | `400` | Smallest turn total a player can bank once on the board |
| `LEAVE_GRACE_MS` | `60000` | How long a disconnected player keeps their seat |
| `ALLOWED_ORIGINS` | `capacitor://localhost,https://localhost` | Origins allowed to call the server from elsewhere, the Android and iOS apps |

## Project layout

| File | Role |
| --- | --- |
| `server.js` | Express pages and the socket.io game server |
| `pwa.js` | Serves the libraries and fonts from `node_modules` and builds the service worker |
| `game.js` | Game rules and turn state, the server is the only source of truth |
| `public/scripts/scoring.js` | Meld scoring, shared by the server, the online game and the 3D game |
| `public/scripts/config.js` | The game server's address, empty on the website, set in the apps' copy |
| `public/scripts/app.js` | Shared page setup: drawers, tooltips, page loader, toasts, storage, server address and room links |
| `public/scripts/main.js` | Online game page client |
| `public/scripts/lobby.js` | Lobby page client |
| `public/scripts/farkle.js` | 3D single player game |
| `public/scripts/dice3d.js` | The 3D table, dice and physics, shared by the 3D game and the online game's 3D view |
| `public/rules.md` | The rules and scoring chart, shown on every page that has rules |
| `public/styles/app.css` | Styles for all pages, on top of Bootstrap 5.3, with light and dark themes |
| `public/styles/fonts.css` | Lato and the logo's fonts, served by the game |
| `public/sw.js` | Service worker template, `pwa.js` fills in the version and the files to keep offline |
| `public/manifest.webmanifest` | App name, colors, icons and shortcuts for installing |
| `public/img/icons/` | App icons and favicons |
| `public/vendor/themestrap/` | The Themestrap core, `themestrap.init.js` and the plugins the game uses |
| `test/game.test.js` | Rule tests plus a full game played by socket clients |

## Built with Themestrap

The interface is Bootstrap 5.3 with [Themestrap](https://github.com/daemondevin/Themestrap) components, loaded as plain script files with no build step. Bootstrap, Bootstrap Icons, jQuery, three.js, cannon-es and the fonts are npm dependencies pinned in `package.json` and served by the game under `/vendor/`, so nothing loads from a CDN.

| Feature | Themestrap piece |
| --- | --- |
| Dice board in the online game | PluginDice |
| Moving dots behind each page | PluginParticles |
| Rules and chat panels | PluginDrawer |
| Rules text from `rules.md` | PluginMarkdown |
| Join form, game over and notices | PluginDialog |
| Notifications | PluginAlert |
| Button hints | PluginTooltip |
| Page, connection and dice model loaders | PluginLoadingOverlay |
| Player count in the 3D game | PluginNumberInput |
| Progress toward 10,000 | PluginProgressBar |
| Animated scores | PluginCounter |
| Show and hide the player list | PluginCollapsible |
| Fades on the chat, the rules and the score table | PluginScrollShadow |
| Scrollbars in the chat, the rules and the score table | PluginScrollbar |
| Light and dark theme toggle on every page | PluginDarkMode |
| Remembering your name and seat | StorageBin (`themestrap.fn.createStorage`) |

The theme follows the system setting until a player presses the sun or moon button, then that choice is kept in the browser and shared by every tab.

To update Themestrap, copy the same files from the Themestrap repository into `public/vendor/themestrap/`.

## Tests

```bash
npm test
```
