// Single player or pass and play game in 3D. The table, the dice and the physics live in
// dice3d.js, shared with the online game. This file runs the turns and the score table.
import { DiceTable3D, DICE_COUNT } from "./dice3d.js";

// Rules, matching the melds listed on the rules page
const WINNING_SCORE = 10000;
// Points a player needs in one turn before their first bank, the entry roll
const ENTRY_SCORE = 1000;
// Smallest turn total a player can bank once they are on the board
const MIN_BANK = 400;
const FARKLE_PAUSE_MS = 2200;

// Page elements
const canvas = document.getElementById("game-area");
const $welcome = $("#welcome");
const $gameView = $("#game-view");
const $playerInput = $("#player-input");
const $tbody = $("#score-table tbody");
const $throwBtn = $("#throw-btn");
const $scoreBtn = $("#score-btn");
const $bankBtn = $("#bank-btn");
// Disabled buttons get no hover, so the bank hint lives on a wrapper that moves with the button
const $bankTip = $("#bank-tip");
const currentCounter = $("#current-score").themestrapPluginCounter({ from: 0, to: 0, speed: 600, thousandsSeparator: "," })[0];
const bankCounter = $("#bank-score").themestrapPluginCounter({ from: 0, to: 0, speed: 900, thousandsSeparator: "," })[0];

// The table fills the window, the score panel floats over its lower right corner
const table = new DiceTable3D({
  canvas,
  overlayHost: $gameView[0],
  fullscreen: true,
  // Frames the tray above and to the left of the score panel
  frame(camera, controls, aspect) {
    const wide = aspect > 1.25;
    controls.target.set(wide ? 4 : 0, 0, wide ? 2.5 : 5.5);
    camera.position.set(wide ? 4 : 0, wide ? 25 : 34, wide ? 20 : 22);
  },
  onSelect() {
    if (phase === "choosing") updateUI();
  },
});
// The table fills this array once the dice model has loaded
const dice = table.dice;

// Game state. phase is one of: menu, idle, rolling, choosing, farkled, over
let phase = "menu";
let players = [];
let currentPlayer = 0;
let turnScore = 0;
let scoredThisThrow = false;
let hotDice = false;
let farkleTimer = null;
let finalRound = null;

// Scoring is shared with the online game and the server (public/scripts/scoring.js)
const { scoreSelection, hasScoringDice, isSixOfAKind } = window.FarkleScoring;

// Menu and views

const numberInput = $playerInput.themestrapPluginNumberInput({ unit: "players", size: "lg" })[0];

function winnerDialog() {
  return $("#winner-dialog").data("__pluginDialog") || $("#winner-dialog").themestrapPluginDialog()[0];
}

$(".new-game-btn").on("click", () => {
  const numPlayers = (numberInput && numberInput.getValue()) || parseInt($playerInput.val(), 10) || 2;
  startGame(Math.min(Math.max(numPlayers, 1), 7));
});
$(".menu-btn").on("click", showMenu);
$("#play-again").on("click", () => {
  winnerDialog().close();
  startGame(players.length);
});
$("#to-menu").on("click", () => {
  winnerDialog().close();
  showMenu();
});

$throwBtn.on("click", onThrow);
$scoreBtn.on("click", onScore);
$bankBtn.on("click", onBank);

function showMenu() {
  clearTimeout(farkleTimer);
  phase = "menu";
  $gameView.prop("hidden", true);
  $welcome.prop("hidden", false);
  if (welcomeParticles()) welcomeParticles().play();
  table.setSelectable(false).rest();
}

function startGame(numPlayers) {
  clearTimeout(farkleTimer);
  players = [];
  for (let i = 0; i < numPlayers; i++) {
    players.push({ name: "P" + (i + 1), bank: 0, entered: ENTRY_SCORE === 0 });
  }
  currentPlayer = 0;
  finalRound = null;
  $welcome.prop("hidden", true);
  if (welcomeParticles()) welcomeParticles().pause();
  $gameView.prop("hidden", false);
  table.resize();
  buildScoreTable();
  bankCounter.setValue(0);
  currentCounter.setValue(0);
  startTurn();
}

function welcomeParticles() {
  return $welcome.find("[data-plugin-particles]").data("__pluginParticles") || null;
}

// Score table

const rows = [];

function buildScoreTable() {
  $throwBtn.add($scoreBtn).add($bankTip).detach();
  $tbody.empty();
  rows.length = 0;
  players.forEach((p) => {
    const $row = $("<tr></tr>");
    const $name = $('<td class="player"></td>');
    const $holding = $('<td class="holding"></td>');
    const $action = $('<td class="actions text-center"></td>');
    const $current = $('<td class="text-end current">0</td>');
    const $bank = $('<td class="text-end fw-bold bank">0</td>');
    $row.append($name, $holding, $action, $current, $bank);
    $tbody.append($row);
    const counter = $bank.themestrapPluginCounter({ from: 0, to: 0, speed: 900, thousandsSeparator: "," })[0];
    rows.push({ $row, $name, $holding, $action, $current, $bank, counter, shown: 0 });
  });
}

function markCurrentRow() {
  players.forEach((p, i) => {
    const row = rows[i];
    const active = i === currentPlayer;
    row.$row.toggleClass("is-turn", active);
    row.$name.empty().append(
      $('<i aria-hidden="true"></i>').addClass(active ? "bi bi-person-fill-up me-1" : "bi bi-person me-1"),
      document.createTextNode(p.name)
    );
    if (!p.entered) row.$name.append(' <span class="badge rounded-pill text-bg-secondary ms-1" title="Needs ' + App.number(ENTRY_SCORE) + ' in one turn">not on board</span>');
    if (finalRound && finalRound.leader === i) row.$name.append(' <span class="badge rounded-pill text-bg-warning ms-1" title="Highest score, the one to beat"><i class="bi bi-trophy-fill me-1" aria-hidden="true"></i>to beat</span>');
    if (finalRound && finalRound.remaining.has(i)) row.$name.append(' <span class="badge rounded-pill text-bg-info ms-1" title="One last turn to beat the leader">last turn</span>');
    row.$current.text(active ? App.number(turnScore) : "0");
    if (row.shown !== p.bank) {
      row.shown = p.bank;
      row.counter.replay(p.bank);
    }
    if (!active) row.$holding.empty();
  });
  rows[currentPlayer].$action.append($throwBtn, $scoreBtn, $bankTip);
  const el = rows[currentPlayer].$row[0];
  if (el) el.scrollIntoView({ block: "nearest" });
}

function renderHolding() {
  // In the order they were set aside
  const held = table.heldOrder.map((i) => dice[i].value);
  const $cell = rows[currentPlayer].$holding.empty();
  held.forEach((v) => $cell.append($('<i aria-hidden="true"></i>').addClass(`bi bi-dice-${v}`)));
  $cell.attr("aria-label", held.length ? `Set aside: ${held.join(", ")}` : "Nothing set aside");
}

function selection() {
  const values = dice.filter((d) => d.state === "tray" && d.selected).map((d) => d.value);
  const points = scoreSelection(values);
  return { count: values.length, points, valid: values.length > 0 && points > 0 };
}

function updateUI() {
  if (!players.length) return;
  const player = players[currentPlayer];
  const sel = selection();
  const pending = turnScore + (sel.valid ? sel.points : 0);
  const selectionOk = sel.count === 0 || sel.valid;
  const keptSomething = scoredThisThrow || sel.valid;
  const needed = player.entered ? MIN_BANK : ENTRY_SCORE;
  const canBankAmount = pending >= needed;

  const canThrow = phase === "idle" || (phase === "choosing" && keptSomething && selectionOk);
  const canScore = phase === "choosing" && sel.valid;
  const canBank = phase === "choosing" && keptSomething && selectionOk && pending > 0 && canBankAmount;

  $throwBtn.prop("disabled", !canThrow);
  $scoreBtn.prop("disabled", !canScore);
  $bankBtn.prop("disabled", !canBank);

  const left = dice.filter((d) => d.state === "tray" && !d.selected).length;
  if (phase === "choosing" && keptSomething && selectionOk) {
    const n = left === 0 || hotDice ? DICE_COUNT : left;
    $throwBtn.find(".label-text").text(`Throw ${n}`);
  } else {
    $throwBtn.find(".label-text").text("Throw");
  }
  $scoreBtn.find(".label-text").text(canScore ? `Score +${App.number(sel.points)}` : sel.count && !sel.valid ? "Not scoring" : "Score");
  let bankText = "Bank";
  if (canBank) bankText = `Bank ${App.number(pending)}`;
  else if (phase === "choosing" && keptSomething && selectionOk && !canBankAmount) bankText = `Need ${App.number(needed)}`;
  $bankBtn.find(".label-text").text(bankText);
  App.setTooltip($bankTip, player.entered
    ? `Bank at least ${App.number(MIN_BANK)} per turn.`
    : `Score ${App.number(ENTRY_SCORE)} in one turn to get on the board.`);

  if (currentCounter.shown !== pending) {
    currentCounter.shown = pending;
    currentCounter.replay(pending);
  }
  if (bankCounter.shown !== player.bank) {
    bankCounter.shown = player.bank;
    bankCounter.replay(player.bank);
  }
  rows[currentPlayer].$current.text(App.number(pending));
}

// Turn flow

function startTurn() {
  turnScore = 0;
  scoredThisThrow = false;
  hotDice = false;
  table.setSelectable(false).rest();
  phase = "idle";
  markCurrentRow();
  renderHolding();
  updateUI();
}

function nextPlayer() {
  currentPlayer = (currentPlayer + 1) % players.length;
  startTurn();
  if (finalRound) {
    const leader = players[finalRound.leader];
    const toTop = finalRound.target - players[currentPlayer].bank + 1;
    App.toast(`${players[currentPlayer].name}'s last turn`, `Score ${App.number(toTop)} to beat ${leader.name}.`, "info", { delay: 4500 });
  }
}

// Ends the turn after a bank or a farkle. In the final round the player is crossed off,
// and once everyone has had their last turn the leader wins.
function endTurn() {
  if (finalRound) {
    finalRound.remaining.delete(currentPlayer);
    if (!finalRound.remaining.size) {
      gameOver(players[finalRound.leader]);
      return;
    }
  }
  nextPlayer();
}

// Locks the selected dice in, sets them aside and adds their points
function lockSelection() {
  const sel = selection();
  if (!sel.valid) return false;
  turnScore += sel.points;
  scoredThisThrow = true;
  table.hold(dice.filter((d) => d.state === "tray" && d.selected).map((d) => d.index));
  // The player was told about Hot Dice when the dice landed (onRollSettled)
  if (dice.every((d) => d.state === "held")) hotDice = true;
  renderHolding();
  return true;
}

function onScore() {
  if (phase !== "choosing") return;
  lockSelection();
  updateUI();
}

function onThrow() {
  if ($throwBtn.prop("disabled") || dice.length < DICE_COUNT) return;

  if (phase === "idle") {
    throwDice(dice);
    return;
  }
  if (phase !== "choosing") return;

  const sel = selection();
  if (sel.count && !lockSelection()) return;
  if (!scoredThisThrow) return;

  if (hotDice) {
    hotDice = false;
    table.releaseAll();
    renderHolding();
  }
  throwDice(dice.filter((d) => d.state === "tray"));
}

function onBank() {
  if ($bankBtn.prop("disabled") || phase !== "choosing") return;
  const player = players[currentPlayer];
  const sel = selection();
  // Check the threshold before setting any dice aside
  if (turnScore + (sel.valid ? sel.points : 0) < (player.entered ? MIN_BANK : ENTRY_SCORE)) return;
  if (sel.count && !lockSelection()) return;

  player.entered = true;
  player.bank += turnScore;
  App.toast(`${player.name} banked ${App.number(turnScore)}`, `Total is now ${App.number(player.bank)}.`, "success");
  turnScore = 0;

  if (finalRound) {
    // Everyone else has to top the leader, a tie is not enough
    if (player.bank > finalRound.target) {
      finalRound.leader = currentPlayer;
      finalRound.target = player.bank;
      App.toast(`${player.name} took the lead!`, `${App.number(player.bank)} is now the score to beat.`, "warning", { delay: 4500 });
    }
  } else if (player.bank >= WINNING_SCORE) {
    if (players.length === 1) {
      markCurrentRow();
      gameOver(player);
      return;
    }
    // Every other player gets one more turn to beat this score
    const remaining = new Set();
    for (let i = 1; i < players.length; i++) remaining.add((currentPlayer + i) % players.length);
    finalRound = { leader: currentPlayer, target: player.bank, remaining };
    App.toast("Final round!", `${player.name} reached ${App.number(player.bank)}. Everyone else gets one last turn to beat it.`, "warning", { delay: 6000 });
  }
  markCurrentRow();
  endTurn();
}

function farkle() {
  phase = "farkled";
  table.setSelectable(false);
  const lost = turnScore;
  turnScore = 0;
  App.toast("Farkle!", lost ? `No scoring dice. ${App.number(lost)} points lost.` : "No scoring dice.", "danger");
  updateUI();
  farkleTimer = setTimeout(endTurn, FARKLE_PAUSE_MS);
}

// sixFace is set when the game was won by throwing six of a kind
function gameOver(winner, sixFace) {
  phase = "over";
  table.setSelectable(false);
  finalRound = null;
  markCurrentRow();
  updateUI();
  $("#winner-title").text(`${winner.name} wins!`);
  $("#winner-dialog [data-dialog-description]").text(sixFace
    ? `Threw six ${sixFace}s, an automatic win!`
    : "Final standings");
  const $list = $("#winner-standings").empty();
  // The winner leads the list even with fewer points, after a six of a kind
  [...players].sort((a, b) => (b === winner) - (a === winner) || b.bank - a.bank).forEach((p) => {
    $list.append(
      $('<li class="list-group-item d-flex"></li>')
        .append($('<span class="ms-2 me-auto"></span>').text(p.name), $('<span class="fw-bold"></span>').text(App.number(p.bank)))
    );
  });
  winnerDialog().open();
}

// Throwing

function throwDice(list) {
  clearTimeout(farkleTimer);
  phase = "rolling";
  scoredThisThrow = false;
  table.setSelectable(false);
  updateUI();
  table.roll(list.map((d) => d.index)).then(onRollSettled);
}

function onRollSettled() {
  const values = dice.filter((d) => d.state === "tray").map((d) => d.value);
  // Six of a kind in one throw wins outright, even in the final round
  if (isSixOfAKind(values)) {
    turnScore = 0;
    gameOver(players[currentPlayer], values[0]);
    return;
  }
  if (!hasScoringDice(values)) {
    farkle();
    return;
  }
  phase = "choosing";
  table.setSelectable(true);
  // Hot Dice: every die just thrown can be kept in a scoring meld. Say so as soon as they land.
  if (scoreSelection(values) > 0) {
    App.toast("Hot Dice!", "Every die you threw scores. Keep them all to throw all six again, or bank.", "warning", { delay: 4500 });
  }
  updateUI();
}

// For tests and the console
window.__farkle = { table, dice, onRollSettled, get phase() { return phase; } };