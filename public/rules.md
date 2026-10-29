# 10,000 with Friends

The dice game 10,000 (also known as Farkle), playable online with friends or alone in 3D.

## Running it

```bash
npm install
npm start
```

Then open http://localhost:3030.

| Page | What it is |
| --- | --- |
| `/` | Lobby: start a new online game or join an open one |
| `/<room>` | An online game. Share the link (or use **Invite**) so friends can join |
| `/farkle.html` | Single player or pass and play in 3D (also linked from the lobby) |
| `/rules` | Rules and scoring chart |

`npm run dev` restarts the server whenever a file changes.

## Playing online

1. Press **New Game** in the lobby and **Join** with a name. The first player to join is the host.
2. Send the invite link to friends. They join from the link or from the lobby's open games list.
3. The host presses **Start**. A random player goes first.
4. On your turn, **Roll**, click the dice you want to keep (they turn green), then **Roll** the rest or **Bank**.
5. Your first bank needs at least 1,000 points from a single turn. After that every bank needs at least 400.
6. The first player to bank 10,000 wins. The host can then start another game with the same players.

If a player's connection drops or they reload the page, they keep their seat for a minute and are put back automatically.

## Settings

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3030` | Port the server listens on |
| `WINNING_SCORE` | `10000` | Score that starts the final round, handy for short test games |
| `ENTRY_SCORE` | `1000` | Points needed in one turn for a player's first bank |
| `MIN_BANK` | `400` | Smallest turn total a player can bank once on the board |
| `LEAVE_GRACE_MS` | `60000` | How long a disconnected player keeps their seat |

## Project layout

| File | Role |
| --- | --- |
| `server.js` | Express pages and the socket.io game server |
| `gameclass.js` | Game rules and turn state, the server is the only source of truth |
| `public/scripts/scoring.js` | Meld scoring, shared by the server, the online game and the 3D game |
| `public/scripts/app.js` | Shared page setup: drawers, tooltips, page loader, toasts, storage |
| `public/scripts/main.js` | Online game page client |
| `public/scripts/Lobby.js` | Lobby page client |
| `public/scripts/farkle.js` | 3D single player game |
| `public/rules.md` | The rules and scoring chart, shown on every page that has rules |
| `public/styles/app.css` | Styles for all pages, on top of Bootstrap 5.3, with light and dark themes |
| `public/vendor/themestrap/` | The Themestrap core, `themestrap.init.js` and the plugins the game uses |
| `test/game.test.js` | Rule tests plus a full game played by socket clients |

## Built with Themestrap

The interface is Bootstrap 5.3 with [Themestrap](https://github.com/daemondevin/Themestrap) components, loaded as plain script files with no build step.

| Feature | Themestrap piece |
| --- | --- |
| Dice board in the online game | PluginDice |
| Moving dots behind each page | PluginParticles |
| Rules and chat panels | PluginDrawer |
| Rules text from `rules.md` | PluginMarkdown |
| Join form, game over and notices | PluginDialog |
| Notifications | PluginToast |
| Button hints | PluginTooltip |
| Page, connection and dice model loaders | PluginLoadingOverlay |
| Player count in the 3D game | PluginNumberInput |
| Progress toward 10,000 | PluginProgressBar |
| Animated scores | PluginCounter |
| Show and hide the player list | PluginCollapsible |
| Fades on the chat, the rules and the score table | PluginScrollShadow |
| Light and dark theme toggle on every page | PluginDarkMode |
| Remembering your name and seat | StorageBin (`themestrap.fn.createStorage`) |

The theme follows the system setting until a player presses the sun or moon button, then that choice is kept in the browser and shared by every tab.

To update Themestrap, copy the same files from the Themestrap repository into `public/vendor/themestrap/`.

## Tests

```bash
npm test
```