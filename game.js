const crypto = require("crypto");
const { scoreSelection, hasScoringDice } = require("./public/scripts/scoring.js");

const DICE_COUNT = 6;
// Reads a whole number setting from the environment, used for quick test games
function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 && process.env[name] !== "" ? value : fallback;
}

const WINNING_SCORE = envNumber("WINNING_SCORE", 10000) || 10000;
// Points a player needs in one turn before their first bank, the entry roll
const ENTRY_SCORE = envNumber("ENTRY_SCORE", 1000);
// Smallest turn total a player can bank once they are on the board
const MIN_BANK = envNumber("MIN_BANK", 400);
const MAX_PLAYERS = 8;
const MAX_NAME_LENGTH = 20;

function rollDie() {
  return crypto.randomInt(1, 7);
}

function cleanName(raw) {
  return String(raw == null ? "" : raw)
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

// Phases: lobby (waiting for the host), start (turn begins, nothing thrown yet),
// rolled (dice on the table, player is choosing), farkled (pause before the next turn)
class Game {
  constructor(name) {
    this.name = name;
    this.players = [];
    this.phase = "lobby";
    this.turnIndex = 0;
    this.turnScore = 0;
    this.dice = this.freshDice();
    this.winner = null;
    this.lastEvent = null;
    this.createdAt = Date.now();
  }

  freshDice() {
    return Array.from({ length: DICE_COUNT }, () => ({ value: null, held: false }));
  }

  get started() {
    return this.phase !== "lobby";
  }

  findPlayer(socketId) {
    return this.players.find((p) => p.socketId === socketId) || null;
  }

  currentPlayer() {
    return this.players[this.turnIndex] || null;
  }

  isHost(socketId) {
    const player = this.findPlayer(socketId);
    return Boolean(player && player.host);
  }

  isTurn(socketId) {
    const player = this.currentPlayer();
    return Boolean(player && player.socketId === socketId);
  }

  addPlayer(socketId, rawName) {
    if (this.findPlayer(socketId)) return { ok: false, error: "You have already joined this game." };
    if (this.started) return { ok: false, error: "This game has already started." };
    if (this.players.length >= MAX_PLAYERS) return { ok: false, error: `This game is full (${MAX_PLAYERS} players).` };

    let name = cleanName(rawName);
    if (!name) return { ok: false, error: "Please enter a name." };

    // Keep names unique so the score list stays readable
    const taken = new Set(this.players.map((p) => p.name.toLowerCase()));
    if (taken.has(name.toLowerCase())) {
      let n = 2;
      while (taken.has(`${name} ${n}`.toLowerCase())) n++;
      name = `${name} ${n}`;
    }

    const player = {
      id: crypto.randomBytes(4).toString("hex"),
      // Secret the browser keeps so it can take its seat back after a reload or dropped connection
      token: crypto.randomBytes(16).toString("hex"),
      socketId,
      connected: true,
      name,
      score: 0,
      entered: ENTRY_SCORE === 0,
      host: this.players.length === 0,
    };
    this.players.push(player);
    return { ok: true, player };
  }

  // Marks a player as away without giving up their seat. Returns the player or null.
  markAway(socketId) {
    const player = this.findPlayer(socketId);
    if (!player) return null;
    player.connected = false;
    player.socketId = null;
    return player;
  }

  // Puts a returning browser back into its seat. Returns the player or null.
  reattach(token, socketId) {
    if (typeof token !== "string" || !token) return null;
    const player = this.players.find((p) => p.token === token);
    if (!player) return null;
    player.socketId = socketId;
    player.connected = true;
    return player;
  }

  // Removes a player and keeps the game consistent. Returns the removed player or null.
  removePlayerById(id) {
    const index = this.players.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const [player] = this.players.splice(index, 1);
    if (player.host && this.players.length) this.players[0].host = true;

    if (!this.players.length) {
      this.phase = "lobby";
      return player;
    }

    if (this.started) {
      if (index < this.turnIndex) {
        this.turnIndex--;
      } else if (index === this.turnIndex) {
        // The leaving player had the dice, the next player starts a fresh turn
        this.turnIndex = this.turnIndex % this.players.length;
        this.beginTurn();
      }
    }
    return player;
  }

  start(socketId) {
    if (!this.isHost(socketId)) return { ok: false, error: "Only the host can start the game." };
    if (this.started) return { ok: false, error: "The game is already running." };
    if (!this.players.length) return { ok: false, error: "Nobody has joined yet." };

    this.players.forEach((p) => {
      p.score = 0;
      p.entered = ENTRY_SCORE === 0;
    });
    this.winner = null;
    this.turnIndex = crypto.randomInt(0, this.players.length);
    this.beginTurn();
    return { ok: true };
  }

  beginTurn() {
    // Lets delayed actions check that the turn they were scheduled for is still running
    this.turnId = (this.turnId || 0) + 1;
    this.phase = "start";
    this.turnScore = 0;
    this.dice = this.freshDice();
  }

  nextTurn() {
    if (!this.players.length) return;
    this.turnIndex = (this.turnIndex + 1) % this.players.length;
    this.beginTurn();
  }

  // Checks that keep lists distinct, available dice that all score, and returns their points
  scoreKeep(keep) {
    if (!Array.isArray(keep)) return { ok: false, error: "Invalid selection." };
    const unique = [...new Set(keep)];
    if (unique.length !== keep.length) return { ok: false, error: "Invalid selection." };
    for (const i of unique) {
      if (!Number.isInteger(i) || i < 0 || i >= DICE_COUNT) return { ok: false, error: "Invalid selection." };
      if (this.dice[i].held || this.dice[i].value == null) return { ok: false, error: "That die is already set aside." };
    }
    const points = scoreSelection(unique.map((i) => this.dice[i].value));
    if (!points) return { ok: false, error: "Every die you keep has to be part of a scoring meld." };
    return { ok: true, points, keep: unique };
  }

  // Throws the dice that are not set aside. After the first throw of a turn the
  // player must keep at least one scoring die from the previous throw.
  roll(socketId, keep = []) {
    if (!this.isTurn(socketId)) return { ok: false, error: "It is not your turn." };
    if (this.phase !== "start" && this.phase !== "rolled") return { ok: false, error: "You cannot throw right now." };

    let gained = 0;
    let hotDice = false;

    if (this.phase === "rolled") {
      const kept = this.scoreKeep(keep);
      if (!kept.ok) return kept;
      gained = kept.points;
      this.turnScore += gained;
      kept.keep.forEach((i) => {
        this.dice[i].held = true;
      });

      if (this.dice.every((d) => d.held)) {
        hotDice = true;
        this.dice = this.freshDice();
      }
    }

    const thrown = [];
    this.dice.forEach((d, i) => {
      if (!d.held) {
        d.value = rollDie();
        thrown.push(i);
      }
    });

    const values = thrown.map((i) => this.dice[i].value);
    if (!hasScoringDice(values)) {
      const lost = this.turnScore;
      this.turnScore = 0;
      this.phase = "farkled";
      return { ok: true, farkle: true, lost, thrown, hotDice, gained };
    }

    this.phase = "rolled";
    // Hot Dice: every die just thrown can be kept in a scoring meld, so keeping them all
    // gives the player all six dice back. Reported now, when the dice land.
    const hotDiceReady = scoreSelection(values) > 0;
    return { ok: true, farkle: false, thrown, hotDice, hotDiceReady, gained };
  }

  bank(socketId, keep = []) {
    if (!this.isTurn(socketId)) return { ok: false, error: "It is not your turn." };
    if (this.phase !== "rolled") return { ok: false, error: "Throw the dice before banking." };

    const kept = this.scoreKeep(keep);
    if (!kept.ok) return kept;

    const player = this.currentPlayer();
    const total = this.turnScore + kept.points;
    const needed = this.bankThreshold(player);
    if (total < needed) {
      return {
        ok: false,
        error: player.entered
          ? `You need at least ${needed.toLocaleString()} points this turn to bank.`
          : `You need ${needed.toLocaleString()} points in one turn to get on the board.`,
      };
    }

    player.entered = true;
    player.score += total;
    this.turnScore = 0;

    if (player.score >= WINNING_SCORE) {
      this.winner = { id: player.id, name: player.name, score: player.score };
      this.phase = "lobby";
      this.dice = this.freshDice();
      return { ok: true, banked: total, won: true, player };
    }

    this.nextTurn();
    return { ok: true, banked: total, won: false, player };
  }

  // Turn total a player must reach before banking is allowed
  bankThreshold(player) {
    return player.entered ? MIN_BANK : ENTRY_SCORE;
  }

  // State sent to browsers. Socket ids stay on the server.
  publicState() {
    const current = this.currentPlayer();
    return {
      name: this.name,
      phase: this.phase,
      started: this.started,
      turnPlayerId: this.started && current ? current.id : null,
      turnScore: this.turnScore,
      dice: this.dice.map((d) => ({ value: d.value, held: d.held })),
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        host: p.host,
        entered: p.entered,
        connected: p.connected,
      })),
      winner: this.winner,
      winningScore: WINNING_SCORE,
      entryScore: ENTRY_SCORE,
      minBank: MIN_BANK,
      lastEvent: this.lastEvent,
    };
  }

  summary() {
    return {
      name: this.name,
      players: this.players.length,
      maxPlayers: MAX_PLAYERS,
      started: this.started,
      host: (this.players.find((p) => p.host) || {}).name || null,
    };
  }
}

Game.WINNING_SCORE = WINNING_SCORE;
Game.ENTRY_SCORE = ENTRY_SCORE;
Game.MIN_BANK = MIN_BANK;
Game.MAX_PLAYERS = MAX_PLAYERS;

module.exports = Game;
