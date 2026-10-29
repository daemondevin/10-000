// Run with: npm test
// Checks the game rules directly, then plays through a server with several socket clients.
const assert = require("assert");
const crypto = require("crypto");
const { scoreSelection, hasScoringDice, isSixOfAKind } = require("../public/scripts/scoring.js");

process.env.PORT = "0";
process.env.LEAVE_GRACE_MS = "400";
// High enough that the random socket game never reaches it, the final round tests set scores directly
process.env.WINNING_SCORE = "50000";
const Game = require("../gamec");

// Makes every die the server throws show face until restore() is called
function loadDice(face) {
  const real = crypto.randomInt;
  crypto.randomInt = (min, max) => (min === 1 && max === 7 ? face : real(min, max));
  return () => (crypto.randomInt = real);
}

// Puts the current player in the middle of a turn: turnScore already scored, plus a fresh
// throw of 1 2 3 4 6 6 where keeping the 1 (index 0) adds 100
function midTurn(g, turnScore) {
  g.phase = "rolled";
  g.turnScore = turnScore;
  g.dice.forEach((d, i) => {
    d.value = [1, 2, 3, 4, 6, 6][i];
    d.held = false;
  });
}

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}\n       ${err.stack.split("\n").slice(0, 3).join("\n       ")}`);
    process.exitCode = 1;
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Indexes of dice worth keeping: ones, fives and any triple
function scoringKeep(dice) {
  const counts = {};
  dice.forEach((d) => {
    if (!d.held) counts[d.value] = (counts[d.value] || 0) + 1;
  });
  const keep = dice
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => !d.held && (d.value === 1 || d.value === 5 || counts[d.value] >= 3))
    .map(({ i }) => i);
  // Three pairs is the one meld with no 1s, 5s or triples, it needs all six dice
  const free = dice.map((d, i) => (d.held ? -1 : i)).filter((i) => i >= 0);
  if (!keep.length && free.length === 6 && scoreSelection(dice.map((d) => d.value)) > 0) return free;
  return keep;
}

async function engineTests() {
  console.log("scoring and game engine");

  await test("scoring matches the rules page", () => {
    const cases = [
      [[1], 100], [[5], 50], [[1, 1], 200], [[1, 5], 150],
      // Three of a kind, doubled for every extra die
      [[1, 1, 1], 1000], [[1, 1, 1, 1], 2000], [[1, 1, 1, 1, 1], 4000],
      [[2, 2, 2], 200], [[2, 2, 2, 2], 400], [[2, 2, 2, 2, 2], 800],
      [[3, 3, 3], 300], [[3, 3, 3, 3], 600], [[3, 3, 3, 3, 3], 1200],
      [[5, 5, 5, 5], 1000], [[6, 6, 6, 6, 6], 2400],
      [[1, 2, 3, 4, 5, 6], 750], [[2, 2, 3, 3, 6, 6], 1500],
      // Four of a kind plus a pair: three pairs when that is worth more
      [[2, 2, 2, 2, 6, 6], 1500], [[1, 1, 1, 1, 5, 5], 2100],
      [[3, 3, 3, 1, 5], 450], [[1, 2], 0], [[2, 3, 4, 6, 6, 3], 0],
    ];
    for (const [values, expected] of cases) assert.strictEqual(scoreSelection(values), expected, values.join(""));
    assert.strictEqual(hasScoringDice([2, 3, 4, 6, 6, 3]), false);
    assert.strictEqual(isSixOfAKind([4, 4, 4, 4, 4, 4]), true);
    assert.strictEqual(isSixOfAKind([4, 4, 4, 4, 4]), false, "five dice are not six of a kind");
    assert.strictEqual(isSixOfAKind([4, 4, 4, 4, 4, 1]), false);
  });

  await test("dice are independent objects", () => {
    const g = new Game("abcde");
    g.dice[0].held = true;
    assert.deepStrictEqual(g.dice.map((d) => d.held), [true, false, false, false, false, false]);
  });

  await test("only the host can start, names are cleaned and made unique", () => {
    const g = new Game("abcde");
    g.addPlayer("s1", "Ann");
    const second = g.addPlayer("s2", "  <b>ann</b> ");
    assert.strictEqual(second.player.name, "ann 2");
    assert.strictEqual(g.addPlayer("s3", "Ann").player.name, "Ann 3");
    assert.strictEqual(g.addPlayer("s4", "   ").ok, false);
    assert.strictEqual(g.start("s2").ok, false);
    assert.strictEqual(g.start("s1").ok, true);
    assert.strictEqual(g.addPlayer("s5", "Late").ok, false);
  });

  await test("keeping is validated against the current throw", () => {
    const g = new Game("abcde");
    g.addPlayer("s1", "Ann");
    g.start("s1");
    g.phase = "rolled";
    g.dice.forEach((d, i) => (d.value = [1, 2, 3, 4, 6, 6][i]));
    assert.strictEqual(g.roll("s1", [1]).ok, false, "a lone 2 does not score");
    assert.strictEqual(g.roll("s1", [0, 0]).ok, false, "duplicate index");
    assert.strictEqual(g.roll("s1", ["0"]).ok, false, "string index");
    assert.strictEqual(g.roll("s1", "nope").ok, false, "not an array");
    assert.strictEqual(g.roll("s2", [0]).ok, false, "not your turn");
    const r = g.roll("s1", [0]);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(g.dice[0].held, true);
    assert.strictEqual(g.dice.filter((d) => d.held).length, 1);
  });

  await test("hot dice gives all six back and keeps the points", () => {
    const g = new Game("abcde");
    g.addPlayer("s1", "Ann");
    g.start("s1");
    g.phase = "rolled";
    g.turnScore = 300;
    g.dice.forEach((d, i) => {
      d.value = [1, 5, 2, 2, 2, 1][i];
      d.held = i >= 2;
    });
    const r = g.roll("s1", [0, 1]);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.hotDice, true);
    assert.strictEqual(r.thrown.length, 6);
    // Six fresh dice: a farkle, an outright win on six of a kind, or 150 more for the 1 and the 5
    assert.ok(r.farkle || r.sixOfAKind || g.turnScore === 450);
  });

  await test("hot dice is reported as soon as every thrown die scores", () => {
    const g = new Game("abcde");
    g.addPlayer("s1", "Ann");
    g.start("s1");
    const seen = { ready: 0, notReady: 0 };
    for (let i = 0; i < 2000 && !(seen.ready && seen.notReady); i++) {
      g.beginTurn();
      g.phase = "rolled";
      g.dice.forEach((d, j) => {
        d.value = [1, 2, 2, 2, 3, 4][j];
        d.held = j > 0 && j < 4;
      });
      // Keep the 1, throw the 3 and the 4 again
      const r = g.roll("s1", [0]);
      assert.strictEqual(r.ok, true);
      if (r.farkle) continue;
      const values = r.thrown.map((k) => g.dice[k].value);
      assert.strictEqual(r.hotDiceReady, scoreSelection(values) > 0, `thrown ${values}`);
      if (r.hotDiceReady) seen.ready++; else seen.notReady++;
    }
    assert.ok(seen.ready && seen.notReady, "both outcomes were seen");
  });

  await test("a farkle wipes the turn total", () => {
    const g = new Game("abcde");
    g.addPlayer("s1", "Ann");
    g.start("s1");
    let farkled = false;
    for (let i = 0; i < 500 && !farkled; i++) {
      g.beginTurn();
      g.turnScore = 700;
      g.phase = "rolled";
      g.dice.forEach((d, j) => {
        d.value = [1, 2, 2, 3, 3, 4][j];
        d.held = j > 0 && j < 5;
      });
      const r = g.roll("s1", [0]);
      if (r.farkle) {
        farkled = true;
        assert.strictEqual(g.turnScore, 0);
        assert.strictEqual(r.lost, 800);
        assert.strictEqual(g.phase, "farkled");
      }
    }
    assert.ok(farkled, "one die left should farkle sometimes");
  });

  await test("playing alone, banking to the winning score wins at once", () => {
    const g = new Game("abcde");
    g.addPlayer("s1", "Ann");
    g.start("s1");
    const ann = g.currentPlayer();
    ann.score = Game.WINNING_SCORE - 500;
    ann.entered = true;
    midTurn(g, 400);
    const r = g.bank("s1", [0]);
    assert.strictEqual(r.won, true);
    assert.deepStrictEqual([g.winner.name, g.winner.reason, g.started], ["Ann", "score", false]);
    assert.strictEqual(g.start("s1").ok, true, "host can play again");
    assert.ok(g.players.every((p) => p.score === 0));
    assert.strictEqual(g.finalRound, null);
  });

  // Ann, Bob and Cy, with Ann to play and everyone on the board
  function threePlayers() {
    const g = new Game("abcde");
    ["Ann", "Bob", "Cy"].forEach((n, i) => g.addPlayer("s" + (i + 1), n));
    g.start("s1");
    g.turnIndex = 0;
    g.beginTurn();
    g.players.forEach((p) => (p.entered = true));
    return g;
  }
  const byName = (g, n) => g.players.find((p) => p.name === n);

  await test("reaching the winning score gives everyone else one last turn", () => {
    const g = threePlayers();
    byName(g, "Ann").score = Game.WINNING_SCORE - 500;
    byName(g, "Bob").score = 2000;
    byName(g, "Cy").score = 3000;

    midTurn(g, 400);
    let r = g.bank("s1", [0]);
    assert.deepStrictEqual([r.ok, r.won, r.finalRoundStarted], [true, false, true]);
    assert.strictEqual(g.started, true, "the game goes on");
    assert.deepStrictEqual(g.finalRound.remaining, [byName(g, "Bob").id, byName(g, "Cy").id]);
    assert.strictEqual(g.finalRound.target, Game.WINNING_SCORE);
    assert.ok(g.publicState().finalRound, "browsers see the final round");

    // Bob banks but stays behind, his last turn is used up
    assert.strictEqual(g.currentPlayer().name, "Bob");
    midTurn(g, 900);
    r = g.bank("s2", [0]);
    assert.deepStrictEqual([r.won, r.tookLead], [false, false]);
    assert.deepStrictEqual(g.finalRound.remaining, [byName(g, "Cy").id]);

    // Cy farkles, that ends the game and Ann wins
    assert.strictEqual(g.currentPlayer().name, "Cy");
    g.phase = "farkled";
    assert.strictEqual(g.finishTurn(), true);
    assert.deepStrictEqual([g.winner.name, g.winner.score, g.winner.reason, g.started], ["Ann", Game.WINNING_SCORE, "score", false]);
    assert.strictEqual(g.finalRound, null);
  });

  await test("topping the leader takes the lead, a tie does not", () => {
    const g = threePlayers();
    byName(g, "Ann").score = Game.WINNING_SCORE - 500;
    byName(g, "Bob").score = Game.WINNING_SCORE - 1000;
    byName(g, "Cy").score = Game.WINNING_SCORE - 1000;
    midTurn(g, 400);
    g.bank("s1", [0]);

    // Bob passes Ann, so Cy now has to beat Bob
    midTurn(g, 1400);
    let r = g.bank("s2", [0]);
    assert.strictEqual(r.tookLead, true);
    assert.deepStrictEqual([g.finalRound.leaderId, g.finalRound.target], [byName(g, "Bob").id, Game.WINNING_SCORE + 500]);

    // Cy only ties Bob, which is not enough
    midTurn(g, 1400);
    r = g.bank("s3", [0]);
    assert.deepStrictEqual([r.tookLead, r.won], [false, true]);
    assert.strictEqual(g.winner.name, "Bob");
  });

  await test("six of a kind wins at once, in the final round and before getting on the board", () => {
    // Before anyone is on the board
    let g = new Game("abcde");
    g.addPlayer("s1", "Ann");
    g.addPlayer("s2", "Bob");
    g.start("s1");
    let restore = loadDice(4);
    let r;
    try {
      r = g.roll(g.currentPlayer().socketId);
    } finally {
      restore();
    }
    assert.deepStrictEqual([r.ok, r.sixOfAKind, r.face], [true, true, 4]);
    assert.deepStrictEqual([g.winner.reason, g.winner.face, g.started], ["six", 4, false]);
    assert.ok(g.dice.every((d) => d.value === 4), "the winning dice stay on the table");

    // During the final round, a player who is far behind still wins outright
    g = threePlayers();
    byName(g, "Ann").score = Game.WINNING_SCORE - 500;
    midTurn(g, 400);
    g.bank("s1", [0]);
    assert.ok(g.finalRound);
    restore = loadDice(2);
    try {
      r = g.roll("s2");
    } finally {
      restore();
    }
    assert.strictEqual(r.sixOfAKind, true);
    assert.deepStrictEqual([g.winner.name, g.winner.reason, g.finalRound, g.started], ["Bob", "six", null, false]);

    // Hot dice throws all six again, and that can be six of a kind too
    g = threePlayers();
    g.phase = "rolled";
    g.dice.forEach((d, i) => {
      d.value = [1, 5, 2, 2, 2, 1][i];
      d.held = i >= 2;
    });
    restore = loadDice(6);
    try {
      r = g.roll("s1", [0, 1]);
    } finally {
      restore();
    }
    assert.deepStrictEqual([r.hotDice, r.sixOfAKind, g.winner.name], [true, true, "Ann"]);

    // Five dice of the same face is not six of a kind
    g = threePlayers();
    g.phase = "rolled";
    g.dice.forEach((d, i) => {
      d.value = [1, 2, 3, 4, 6, 6][i];
      d.held = false;
    });
    restore = loadDice(3);
    try {
      r = g.roll("s1", [0]);
    } finally {
      restore();
    }
    assert.deepStrictEqual([r.sixOfAKind, r.farkle, g.started], [undefined, false, true]);
  });

  await test("the last player still to go leaving ends the final round", () => {
    const g = threePlayers();
    byName(g, "Ann").score = Game.WINNING_SCORE - 500;
    midTurn(g, 400);
    g.bank("s1", [0]);
    g.removePlayerById(byName(g, "Cy").id);
    assert.strictEqual(g.started, true, "Bob still has his turn");
    assert.strictEqual(g.currentPlayer().name, "Bob");
    g.removePlayerById(byName(g, "Bob").id);
    assert.deepStrictEqual([g.started, g.winner && g.winner.name], [false, "Ann"]);
  });

  await test("first bank needs the entry roll, later banks need the minimum", () => {
    const g = new Game("abcde");
    g.addPlayer("s1", "Ann");
    g.start("s1");
    const setThrow = (turnScore) => {
      g.beginTurn();
      g.phase = "rolled";
      g.turnScore = turnScore;
      g.dice.forEach((d, i) => (d.value = [1, 2, 3, 4, 6, 6][i]));
    };
    const ann = g.currentPlayer();

    setThrow(Game.ENTRY_SCORE - 200);
    let r = g.bank("s1", [0]);
    assert.strictEqual(r.ok, false, "below the entry roll");
    assert.match(r.error, /get on the board/);
    assert.strictEqual(g.dice[0].held, false, "a refused bank keeps no dice");
    assert.strictEqual(ann.entered, false);

    setThrow(Game.ENTRY_SCORE - 100);
    r = g.bank("s1", [0]);
    assert.strictEqual(r.ok, true, "exactly the entry roll");
    assert.strictEqual(ann.entered, true);
    assert.strictEqual(ann.score, Game.ENTRY_SCORE);

    setThrow(Game.MIN_BANK - 200);
    r = g.bank("s1", [0]);
    assert.strictEqual(r.ok, false, "below the minimum once on the board");
    assert.match(r.error, /at least/);

    setThrow(Game.MIN_BANK - 100);
    assert.strictEqual(g.bank("s1", [0]).ok, true, "exactly the minimum");
    assert.strictEqual(ann.score, Game.ENTRY_SCORE + Game.MIN_BANK);
  });

  await test("leaving on your turn hands the dice on, host moves to the next player", () => {
    const g = new Game("abcde");
    g.addPlayer("s1", "Ann");
    g.addPlayer("s2", "Bob");
    g.addPlayer("s3", "Cy");
    g.start("s1");
    g.turnIndex = 0;
    g.beginTurn();
    g.removePlayerById(g.players[0].id);
    assert.strictEqual(g.players[0].host, true);
    assert.strictEqual(g.currentPlayer().name, "Bob");
    assert.strictEqual(g.phase, "start");
  });

  await test("publicState never exposes socket ids or tokens", () => {
    const g = new Game("abcde");
    g.addPlayer("secret-socket", "Ann");
    const json = JSON.stringify(g.publicState());
    assert.ok(!json.includes("secret-socket"));
    assert.ok(!json.includes(g.players[0].token));
  });
}

async function serverTests() {
  console.log("server with socket clients");
  const { io: ioClient } = require("socket.io-client");
  const { server, games } = require("../server");
  if (!server.listening) await new Promise((r) => server.once("listening", r));
  const base = `http://localhost:${server.address().port}`;

  const clients = [];
  function client(room, token) {
    const socket = ioClient(base, { forceNew: true, transports: ["websocket"] });
    const c = { socket, state: null, problems: [], msgs: [], me: null, events: [] };
    socket.on("state", (s) => (c.state = s));
    socket.on("problem", (p) => c.problems.push(p));
    socket.on("msg", (m) => c.msgs.push(m));
    socket.on("joined", (j) => (c.me = j));
    ["gamewon", "playerDisconect", "missing"].forEach((e) => socket.on(e, (d) => c.events.push([e, d])));
    socket.on("connect", () => socket.emit("watch", { room, token }));
    clients.push(c);
    return c;
  }
  async function until(fn, ms = 4000) {
    const start = Date.now();
    while (!fn()) {
      if (Date.now() - start > ms) throw new Error("timed out waiting");
      await wait(20);
    }
  }

  const { Name: room } = await (await fetch(`${base}/api/newgame`)).json();

  await test("game page is served for a real room, unknown rooms go to the lobby", async () => {
    const ok = await fetch(`${base}/${room}`, { redirect: "manual" });
    assert.strictEqual(ok.status, 200);
    const missing = await fetch(`${base}/zzzzz`, { redirect: "manual" });
    assert.strictEqual(missing.status, 302);
    const farkle = await fetch(`${base}/farkle.html`);
    assert.strictEqual(farkle.status, 200, "static files still served");
  });

  const a = client(room);
  const b = client(room);
  const c = client(room);
  await until(() => a.state && b.state && c.state);

  await test("players join, first is host, names reach everyone", async () => {
    a.socket.emit("playerjoin", { name: "Ann" });
    await until(() => a.me);
    b.socket.emit("playerjoin", { name: "Bob" });
    await until(() => b.me);
    c.socket.emit("playerjoin", { name: "<img src=x onerror=alert(1)>Cy" });
    await until(() => c.me && a.state.players.length === 3);
    assert.deepStrictEqual(a.state.players.map((p) => p.host), [true, false, false]);
    assert.ok(!c.me.name.includes("<"), "markup stripped from names");
  });

  await test("bad messages are answered with a problem, server stays up", async () => {
    b.socket.emit("GameStart");
    b.socket.emit("roll", null);
    b.socket.emit("roll", { keep: "x".repeat(10000) });
    b.socket.emit("bank", 42);
    b.socket.emit("msg", { toString: null });
    await until(() => b.problems.length >= 2);
    assert.strictEqual(a.state.started, false);
  });

  await test("chat relays to the other players only", async () => {
    a.socket.emit("msg", "hello table");
    await until(() => b.msgs.some((m) => m.msg === "hello table") && c.msgs.some((m) => m.msg === "hello table"));
    await wait(100);
    assert.ok(!a.msgs.some((m) => m.msg === "hello table"));
  });

  await test("host starts and turns run in order with banked scores adding up", async () => {
    a.socket.emit("GameStart");
    await until(() => a.state.started && b.state.started && c.state.started);
    const byId = Object.fromEntries([a, b, c].map((x) => [x.me.id, x]));
    let turnsDone = 0;
    let farkles = 0;
    let refusedOnce = false;
    const banked = {};
    let endedBySix = false;
    while (turnsDone < 9 && !endedBySix) {
      const turnId = a.state.turnPlayerId;
      const me = byId[turnId];
      const others = [a, b, c].filter((x) => x !== me);

      // Out of turn throws are refused
      const before = others[0].problems.length;
      others[0].socket.emit("roll", { keep: [] });
      await until(() => others[0].problems.length > before);

      // Keep every scoring die and roll on until the turn total is big enough to bank
      let keep = [];
      for (;;) {
        const seq = me.state.lastEvent ? me.state.lastEvent.seq : 0;
        me.socket.emit("roll", { keep });
        await until(() => me.state.lastEvent && me.state.lastEvent.seq > seq);
        if (me.state.lastEvent.type === "sixkind") {
          // About 1 in 7,800 throws of six dice, the game ends there
          endedBySix = true;
          break;
        }
        if (me.state.phase === "farkled") {
          farkles++;
          await until(() => a.state.turnPlayerId !== turnId && a.state.phase === "start", 6000);
          break;
        }
        keep = scoringKeep(me.state.dice);
        const points = scoreSelection(keep.map((i) => me.state.dice[i].value));
        assert.ok(points > 0, "a non farkle throw always has something to keep");
        const player = me.state.players.find((p) => p.id === turnId);
        const pending = me.state.turnScore + points;
        const needed = player.entered ? me.state.minBank : me.state.entryScore;
        if (pending < needed) {
          if (!refusedOnce) {
            // The server must refuse a bank below the threshold and leave the dice alone
            const before = me.problems.length;
            me.socket.emit("bank", { keep });
            await until(() => me.problems.length > before);
            assert.match(me.problems[me.problems.length - 1], /get on the board|at least/);
            refusedOnce = true;
          }
          continue;
        }
        me.socket.emit("bank", { keep });
        await until(() => a.state.turnPlayerId !== turnId && a.state.phase === "start");
        banked[turnId] = (banked[turnId] || 0) + pending;
        assert.ok(pending >= needed);
        break;
      }
      turnsDone++;
    }
    if (endedBySix) {
      console.log("       (the game ended early on a six of a kind, restarting)");
      a.socket.emit("GameStart");
      await until(() => a.state.started);
      return;
    }
    for (const p of a.state.players) assert.strictEqual(p.score, banked[p.id] || 0, `${p.name} score`);
    assert.ok(refusedOnce, "a low bank was tried and refused");
    console.log(`       (9 turns, ${farkles} farkles, scores ${a.state.players.map((p) => p.score).join(", ")})`);
  });

  await test("final round over sockets: last turns, a lead change, then the winner", async () => {
    const game = games.get(room);
    const clientOf = (id) => [a, b, c].find((x) => x.me.id === id);
    game.players.forEach((p) => (p.entered = true));
    const first = game.currentPlayer();
    const [second, third] = [1, 2].map((k) => game.players[(game.turnIndex + k) % 3]);
    first.score = Game.WINNING_SCORE - 500;
    second.score = Game.WINNING_SCORE - 600;
    third.score = 1000;

    let seq = a.state.lastEvent.seq;
    midTurn(game, 400);
    clientOf(first.id).socket.emit("bank", { keep: [0] });
    await until(() => a.state.lastEvent.seq > seq);
    assert.strictEqual(a.state.lastEvent.type, "final");
    assert.deepStrictEqual(a.state.finalRound.remaining, [second.id, third.id]);
    assert.strictEqual(a.state.turnPlayerId, second.id);

    seq = a.state.lastEvent.seq;
    midTurn(game, 900);
    clientOf(second.id).socket.emit("bank", { keep: [0] });
    await until(() => a.state.lastEvent.seq > seq);
    assert.deepStrictEqual([a.state.lastEvent.type, a.state.lastEvent.tookLead], ["bank", true]);
    assert.strictEqual(a.state.finalRound.leaderId, second.id);

    seq = a.state.lastEvent.seq;
    midTurn(game, 400);
    clientOf(third.id).socket.emit("bank", { keep: [0] });
    await until(() => a.state.lastEvent.seq > seq);
    assert.strictEqual(a.state.lastEvent.type, "won");
    assert.deepStrictEqual([a.state.started, a.state.winner.id, a.state.winner.reason], [false, second.id, "score"]);
    await until(() => c.events.some(([e, d]) => e === "gamewon" && d.id === second.id));

    a.socket.emit("GameStart");
    await until(() => a.state.started && a.state.finalRound === null);
  });

  await test("six of a kind over sockets wins on the spot", async () => {
    const turn = [a, b, c].find((x) => x.me.id === a.state.turnPlayerId);
    const seq = a.state.lastEvent.seq;
    const restore = loadDice(5);
    try {
      turn.socket.emit("roll", { keep: [] });
      await until(() => a.state.lastEvent.seq > seq);
    } finally {
      restore();
    }
    assert.deepStrictEqual([a.state.lastEvent.type, a.state.lastEvent.face], ["sixkind", 5]);
    assert.deepStrictEqual([a.state.started, a.state.winner.id, a.state.winner.reason], [false, turn.me.id, "six"]);
    assert.ok(a.state.dice.every((d) => d.value === 5), "browsers get the winning dice to show");
    await until(() => b.events.some(([e, d]) => e === "gamewon" && d.reason === "six"));

    a.socket.emit("GameStart");
    await until(() => a.state.started);
  });

  await test("a reload keeps the seat, a longer absence gives it up", async () => {
    const token = b.me.token;
    const id = b.me.id;
    b.socket.disconnect();
    await until(() => a.state.players.find((p) => p.id === id).connected === false);
    const b2 = client(room, token);
    await until(() => b2.me && b2.me.id === id);
    await until(() => a.state.players.find((p) => p.id === id).connected === true);

    c.socket.disconnect();
    await until(() => a.state.players.length === 2, 3000);
    assert.ok(a.events.some(([e, d]) => e === "playerDisconect" && d.name === c.me.name));
    assert.strictEqual(a.state.started, true);
    assert.ok(a.state.players.some((p) => p.id === a.state.turnPlayerId), "turn belongs to a remaining player");
  });

  await test("joining a running game is refused, empty games are removed", async () => {
    const late = client(room);
    await until(() => late.state);
    late.socket.emit("playerjoin", { name: "Late" });
    await until(() => late.problems.length);
    assert.match(late.problems[0], /already started/);

    clients.forEach((x) => x.socket.disconnect());
    await until(() => !games.has(room), 3000);
  });

  clients.forEach((x) => x.socket.disconnect());
  server.close();
  setTimeout(() => process.exit(process.exitCode || 0), 100).unref();
}

(async () => {
  await engineTests();
  await serverTests();
  console.log(process.exitCode ? "\nSome tests failed." : `\nAll ${passed} tests passed.`);
})();