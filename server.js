const path = require("path");
const crypto = require("crypto");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Game = require("./game");

const port = process.env.PORT || 3030;
const PUBLIC_DIR = path.join(__dirname, "public");
const FARKLE_PAUSE_MS = 3200;
// How long a disconnected player keeps their seat
const LEAVE_GRACE_MS = Number(process.env.LEAVE_GRACE_MS) || 60 * 1000;
// Games nobody has joined are removed after this long
const EMPTY_GAME_TTL_MS = 30 * 60 * 1000;
const ROOM_NAME = /^[a-z]{5}$/;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Every open game, keyed by its five letter name
const games = new Map();

function newGameName() {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  let name;
  do {
    name = Array.from({ length: 5 }, () => letters[crypto.randomInt(0, letters.length)]).join("");
  } while (games.has(name));
  return name;
}

// Records what just happened. The sequence number lets browsers show each event once.
function announce(game, event) {
  game.eventSeq = (game.eventSeq || 0) + 1;
  game.lastEvent = Object.assign({ seq: game.eventSeq }, event);
}

function broadcastState(game) {
  io.to(game.name).emit("state", game.publicState());
}

function removeGameIfEmpty(game) {
  if (game.players.length === 0 && games.get(game.name) === game) {
    clearTimeout(game.farkleTimer);
    games.delete(game.name);
    console.log(`game ${game.name} closed`);
  }
}

// Pages and API

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "lobby.html"));
});

app.get("/rules", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "rules.html"));
});

app.get("/api/newgame", (req, res) => {
  const game = new Game(newGameName());
  games.set(game.name, game);
  // A game that is created but never joined should not live forever
  game.emptyTimer = setTimeout(() => removeGameIfEmpty(game), EMPTY_GAME_TTL_MS);
  console.log(`game ${game.name} created`);
  res.json({ Name: game.name });
});

app.get("/api/getrooms", (req, res) => {
  res.json({ rooms: [...games.values()].map((g) => g.summary()) });
});

app.use(express.static(PUBLIC_DIR));

app.get("/:room", (req, res) => {
  const room = req.params.room.toLowerCase();
  if (ROOM_NAME.test(room) && games.has(room)) {
    res.sendFile(path.join(PUBLIC_DIR, "game.html"));
  } else {
    res.redirect(`/?missing=${encodeURIComponent(req.params.room)}`);
  }
});

// Sockets

io.on("connection", (socket) => {
  let game = null;

  // Wraps a handler so one bad message can never crash the server
  const on = (event, handler) => {
    socket.on(event, (...args) => {
      try {
        handler(...args);
      } catch (err) {
        console.error(`error handling "${event}" from ${socket.id}:`, err);
        socket.emit("problem", "Something went wrong on the server.");
      }
    });
  };

  const reply = (result) => {
    if (result && !result.ok && result.error) socket.emit("problem", result.error);
    return result && result.ok;
  };

  // The game page announces which room it is looking at. A browser that already has a
  // seat sends its token and gets that seat back.
  on("watch", (data) => {
    const name = String((data && data.room) || "").toLowerCase();
    const found = games.get(name);
    if (!found) {
      socket.emit("missing", name);
      return;
    }
    if (game && game !== found) socket.leave(game.name);
    game = found;
    socket.join(game.name);

    const player = game.reattach(data && data.token, socket.id);
    if (player) {
      clearTimeout(player.leaveTimer);
      socket.emit("joined", { id: player.id, name: player.name, token: player.token });
      announce(game, { type: "back", player: player.name });
      broadcastState(game);
    } else {
      socket.emit("state", game.publicState());
    }
  });

  on("playerjoin", (data) => {
    if (!game) return reply({ ok: false, error: "That game no longer exists." });
    const result = game.addPlayer(socket.id, data && data.name);
    if (!reply(result)) return;

    clearTimeout(game.emptyTimer);
    socket.emit("joined", { id: result.player.id, name: result.player.name, token: result.player.token });
    io.to(game.name).emit("msg", { system: true, msg: `${result.player.name} has joined the game.` });
    broadcastState(game);
  });

  on("GameStart", () => {
    if (!game) return;
    if (!reply(game.start(socket.id))) return;
    announce(game, { type: "start", player: game.currentPlayer().name });
    broadcastState(game);
  });

  on("roll", (data) => {
    if (!game) return;
    const keep = (data && data.keep) || [];
    const player = game.currentPlayer();
    const result = game.roll(socket.id, keep);
    if (!reply(result)) return;

    announce(game, {
      type: result.sixOfAKind ? "sixkind" : result.farkle ? "farkle" : "roll",
      player: player.name,
      thrown: result.thrown,
      gained: result.gained,
      hotDice: result.hotDice,
      hotDiceReady: Boolean(result.hotDiceReady),
      lost: result.lost || 0,
      face: result.face || null,
    });
    broadcastState(game);

    if (result.sixOfAKind) {
      io.to(game.name).emit("gamewon", game.winner);
      return;
    }

    if (result.farkle) {
      // Leave the farkled dice on screen for a moment, then pass the dice on
      const turnId = game.turnId;
      clearTimeout(game.farkleTimer);
      game.farkleTimer = setTimeout(() => {
        if (games.get(game.name) !== game || game.turnId !== turnId || game.phase !== "farkled") return;
        // A farkle in the final round still uses up that player's last turn
        if (game.finishTurn()) {
          announce(game, { type: "won", player: game.winner.name, winner: game.winner });
          io.to(game.name).emit("gamewon", game.winner);
        } else {
          announce(game, { type: "turn", player: game.currentPlayer().name });
        }
        broadcastState(game);
      }, FARKLE_PAUSE_MS);
    }
  });

  // The current player picking or dropping a die. Everyone else is told straight away, without
  // a full state broadcast, so the picks show up as the player makes them. Bad or out of turn
  // picks are dropped quietly, they can arrive just after a turn ends.
  on("select", (data) => {
    if (!game) return;
    const indexes = game.select(socket.id, data && data.keep);
    if (!indexes) return;
    socket.to(game.name).emit("selection", { turnId: game.turnId, indexes });
  });

  on("bank", (data) => {
    if (!game) return;
    const keep = (data && data.keep) || [];
    const result = game.bank(socket.id, keep);
    if (!reply(result)) return;

    const fr = game.finalRound;
    announce(game, {
      type: result.won ? "won" : result.finalRoundStarted ? "final" : "bank",
      player: result.player.name,
      banked: result.banked,
      score: result.player.score,
      tookLead: Boolean(result.tookLead),
      target: fr ? fr.target : null,
      winner: result.won ? game.winner : null,
    });
    if (result.won) io.to(game.name).emit("gamewon", game.winner);
    broadcastState(game);
  });

  on("msg", (text) => {
    if (!game) return;
    if (typeof text !== "string") return;
    const player = game.findPlayer(socket.id);
    const msg = text.trim().slice(0, 500);
    if (!player || !msg) return;
    socket.to(game.name).emit("msg", { sender: player.name, msg });
  });

  // A dropped connection keeps the seat for a while so a reload or flaky network
  // does not throw the player out. After the grace period the seat is given up.
  on("disconnect", () => {
    if (!game) return;
    const current = game;
    const player = current.markAway(socket.id);
    if (!player) return;

    announce(current, { type: "away", player: player.name });
    broadcastState(current);

    clearTimeout(player.leaveTimer);
    player.leaveTimer = setTimeout(() => {
      if (player.connected || games.get(current.name) !== current) return;
      const wasStarted = current.started;
      const hadTurn = wasStarted && current.currentPlayer() === player;
      if (!current.removePlayerById(player.id)) return;

      console.log(`${player.name} left game ${current.name}`);
      io.to(current.name).emit("playerDisconect", { name: player.name, hadTurn });
      if (current.players.length) {
        // Leaving can end the final round when the leaver was the last one still to play
        if (wasStarted && !current.started && current.winner) {
          announce(current, { type: "won", player: current.winner.name, winner: current.winner });
          io.to(current.name).emit("gamewon", current.winner);
        } else {
          announce(current, { type: "left", player: player.name });
        }
        broadcastState(current);
      } else {
        removeGameIfEmpty(current);
      }
    }, LEAVE_GRACE_MS);
  });
});

server.listen(port, () => {
  console.log("listening on port: " + port);
});

module.exports = { app, server, io, games };