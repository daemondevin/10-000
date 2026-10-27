import * as THREE from "three";
import * as CANNON from "cannon-es";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";

// Rules, matching the melds listed on the rules page
const WINNING_SCORE = 10000;
// Points a player needs in one turn before their first bank, the entry roll
const ENTRY_SCORE = 1000;
// Smallest turn total a player can bank once they are on the board
const MIN_BANK = 400;
const DICE_COUNT = 6;
const TRAY_SIZE = 13;
const HELD_ROW_Z = -8.6;
const FARKLE_PAUSE_MS = 2200;

// Face normals in the dice's local space and the value printed on each face.
// These match public/dice.obj: +X shows 4, -X 3, +Y 1, -Y 6, +Z 2, -Z 5.
const FACE_NORMALS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];
const FACE_VALUES = [4, 3, 1, 6, 2, 5];
const UP = new THREE.Vector3(0, 1, 0);
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

// Three.js and physics state
let renderer, scene, camera, controls, world;
let diceMaterial, trayMaterial;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();
const dice = [];

// Game state. phase is one of: menu, idle, rolling, choosing, farkled, over
let phase = "menu";
let players = [];
let currentPlayer = 0;
let turnScore = 0;
let scoredThisThrow = false;
let hotDice = false;
let heldCount = 0;
let rollTime = 0;
let settleFrames = 0;
let farkleTimer = null;

// Scoring is shared with the online game and the server (public/scripts/scoring.js)
const { scoreSelection, hasScoringDice } = window.FarkleScoring;

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
  restDice();
}

function startGame(numPlayers) {
  clearTimeout(farkleTimer);
  players = [];
  for (let i = 0; i < numPlayers; i++) {
    players.push({ name: "P" + (i + 1), bank: 0, entered: ENTRY_SCORE === 0 });
  }
  currentPlayer = 0;
  $welcome.prop("hidden", true);
  if (welcomeParticles()) welcomeParticles().pause();
  $gameView.prop("hidden", false);
  updateSceneSize();
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
  const held = dice.filter((d) => d.state === "held").map((d) => d.value);
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
  restDice();
  phase = "idle";
  markCurrentRow();
  renderHolding();
  updateUI();
}

function nextPlayer() {
  currentPlayer = (currentPlayer + 1) % players.length;
  startTurn();
}

// Locks the selected dice in, sets them aside and adds their points
function lockSelection() {
  const sel = selection();
  if (!sel.valid) return false;
  turnScore += sel.points;
  scoredThisThrow = true;
  dice.filter((d) => d.state === "tray" && d.selected).forEach(holdDie);
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
    heldCount = 0;
    dice.forEach(returnDieToTray);
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
  themestrap.PluginAlert.create({
    type: 'success',
    title: `${player.name} banked ${App.number(turnScore)}`,
    message: `Total is now ${App.number(player.bank)}.`,
    showIcon: false,
    dismissible: false,
    autoDismiss: true,
    delay: 5000
  });
  //App.toast(`${player.name} banked ${App.number(turnScore)}`, `Total is now ${App.number(player.bank)}.`, "success");
  turnScore = 0;
  markCurrentRow();

  if (player.bank >= WINNING_SCORE) {
    gameOver(player);
    return;
  }
  nextPlayer();
}

function farkle() {
  phase = "farkled";
  const lost = turnScore;
  turnScore = 0;
  themestrap.PluginAlert.create({
    type: 'danger',
    title: 'Farkle!',
    message: lost ? `No scoring dice. ${App.number(lost)} points lost.` : "No scoring dice.",
    showIcon: false,
    dismissible: false,
    autoDismiss: true,
    delay: 5000
  });
  //App.toast("Farkle!", lost ? `No scoring dice. ${App.number(lost)} points lost.` : "No scoring dice.", "danger");
  updateUI();
  farkleTimer = setTimeout(nextPlayer, FARKLE_PAUSE_MS);
}

function gameOver(winner) {
  phase = "over";
  updateUI();
  $("#winner-title").text(`${winner.name} wins!`);
  const $list = $("#winner-standings").empty();
  [...players].sort((a, b) => b.bank - a.bank).forEach((p) => {
    $list.append(
      $('<li class="list-group-item d-flex"></li>')
        .append($('<span class="ms-2 me-auto"></span>').text(p.name), $('<span class="fw-bold"></span>').text(App.number(p.bank)))
    );
  });
  winnerDialog().open();
}

// Dice interaction

let downPos = null;
canvas.addEventListener("pointerdown", (e) => {
  downPos = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener("pointerup", (e) => {
  if (!downPos) return;
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  downPos = null;
  // A drag rotates the camera, only a click toggles a die
  if (moved < 6) onDiceClick(e);
});

function onDiceClick(event) {
  if (phase !== "choosing") return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(dice.map((d) => d.mesh), true);
  if (!hits.length) return;

  let obj = hits[0].object;
  while (obj && obj.userData.dieIndex === undefined) obj = obj.parent;
  if (!obj) return;
  const die = dice[obj.userData.dieIndex];
  if (die.state !== "tray") return;

  die.selected = !die.selected;
  setGlow(die);
  updateUI();
}

function setGlow(die) {
  const color = die.selected ? 0xff0000 : 0x000000;
  die.materials.forEach((m) => {
    if (m.emissive) m.emissive.setHex(color);
  });
}

function holdDie(die) {
  die.state = "held";
  die.selected = false;
  setGlow(die);
  if (die.body.world) world.removeBody(die.body);
  die.body.velocity.setZero();
  die.body.angularVelocity.setZero();
  const q = orientationFor(die.value, 0);
  die.body.quaternion.set(q.x, q.y, q.z, q.w);
  die.body.position.set(-3.75 + heldCount * 1.5, 0.5, HELD_ROW_Z);
  heldCount++;
}

function returnDieToTray(die) {
  die.state = "tray";
  die.selected = false;
  setGlow(die);
  if (!die.body.world) world.addBody(die.body);
}

// Lays the dice out in a tidy row showing one to six
function restDice() {
  heldCount = 0;
  dice.forEach((d, i) => {
    returnDieToTray(d);
    d.value = null;
    d.rolling = false;
    const q = orientationFor(i + 1, 0.6);
    const b = d.body;
    b.velocity.setZero();
    b.angularVelocity.setZero();
    b.position.set(-3.75 + i * 1.5, 0.5, 0);
    b.quaternion.set(q.x, q.y, q.z, q.w);
    b.wakeUp();
  });
}

function orientationFor(value, jitter) {
  const idx = FACE_VALUES.indexOf(value);
  const q = new THREE.Quaternion().setFromUnitVectors(FACE_NORMALS[idx], UP);
  const yaw = new THREE.Quaternion().setFromAxisAngle(UP, (Math.random() - 0.5) * jitter);
  return q.premultiply(yaw);
}

// Rolling

function throwDice(list) {
  clearTimeout(farkleTimer);
  phase = "rolling";
  scoredThisThrow = false;
  rollTime = 0;
  settleFrames = 0;
  list.forEach((d, k) => {
    d.value = null;
    d.rolling = true;
    d.nudges = 0;
    throwDie(d, k);
  });
  updateUI();
}

function throwDie(d, k) {
  const b = d.body;
  if (!b.world) world.addBody(b);
  b.velocity.setZero();
  b.angularVelocity.setZero();
  b.position.set(4 + Math.random() * 1.2, 4 + k * 1.3, -4.5 + k * 1.6 + (Math.random() - 0.5) * 0.6);
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2),
  );
  b.quaternion.set(q.x, q.y, q.z, q.w);
  b.velocity.set(-(10 + Math.random() * 8), -4 - Math.random() * 4, (Math.random() - 0.5) * 6);
  b.angularVelocity.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30);
  b.wakeUp();
}

// Pops a die that came to rest leaning on an edge or another die
function nudgeDie(d) {
  d.nudges++;
  d.body.wakeUp();
  d.body.velocity.set((Math.random() - 0.5) * 4, 8, (Math.random() - 0.5) * 4);
  d.body.angularVelocity.set((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15);
}

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
function readTopFace(d) {
  const bq = d.body.quaternion;
  _q.set(bq.x, bq.y, bq.z, bq.w);
  let best = -2;
  let value = 0;
  FACE_NORMALS.forEach((n, i) => {
    _v.copy(n).applyQuaternion(_q);
    if (_v.y > best) {
      best = _v.y;
      value = FACE_VALUES[i];
    }
  });
  return { value, flat: best > 0.96 };
}

function updateRoll(dt) {
  rollTime += dt;
  const rolling = dice.filter((d) => d.rolling);
  const still = rolling.every(
    (d) => d.body.velocity.lengthSquared() < 0.02 && d.body.angularVelocity.lengthSquared() < 0.02,
  );
  settleFrames = still ? settleFrames + 1 : 0;

  const timedOut = rollTime > 8;
  if (settleFrames < 15 && !timedOut) return;

  let cocked = false;
  for (const d of rolling) {
    if (!readTopFace(d).flat && d.nudges < 4 && !timedOut) {
      nudgeDie(d);
      cocked = true;
    }
  }
  if (cocked) {
    settleFrames = 0;
    return;
  }

  rolling.forEach((d) => {
    d.value = readTopFace(d).value;
    d.rolling = false;
  });
  onRollSettled();
}

function onRollSettled() {
  const values = dice.filter((d) => d.state === "tray").map((d) => d.value);
  if (!hasScoringDice(values)) {
    farkle();
    return;
  }
  phase = "choosing";
  // Hot Dice: every die just thrown can be kept in a scoring meld. Say so as soon as they land.
  if (scoreSelection(values) > 0) {
    themestrap.PluginAlert.create({
      type: 'warning',
      title: 'Hot Dice!',
      message: 'Every die you threw scores. Keep them all to throw all six again, or bank.',
      showIcon: false,
      dismissible: false,
      autoDismiss: true,
      delay: 5000
    });
    //App.toast("Hot Dice!", "Every die you threw scores. Keep them all to throw all six again, or bank.", "warning", { delay: 4500 });
  }
  updateUI();
}

// Rendering

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  world.fixedStep(1 / 60, 5);
  for (const d of dice) {
    d.mesh.position.copy(d.body.position);
    d.mesh.quaternion.copy(d.body.quaternion);
  }
  if (phase === "rolling") updateRoll(dt);
  controls.update();
  renderer.render(scene, camera);
}

// Frames the tray above and to the left of the score panel
function frameTray() {
  const wide = camera.aspect > 1.25;
  controls.target.set(wide ? 4 : 0, 0, wide ? 2.5 : 5.5);
  camera.position.set(wide ? 4 : 0, wide ? 25 : 34, wide ? 20 : 22);
  controls.update();
}

function updateSceneSize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  frameTray();
}

// Scene setup

function initScene() {
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, canvas });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.2;
  controls.enablePan = false;
  controls.minDistance = 8;
  controls.maxDistance = 45;
  controls.maxPolarAngle = Math.PI / 2.2;

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x223322, 0.6));

  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(6, 20, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 60 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  window.addEventListener("resize", updateSceneSize);
  updateSceneSize();
}

function initPhysics() {
  world = new CANNON.World({ allowSleep: true, gravity: new CANNON.Vec3(0, -50, 0) });
  diceMaterial = new CANNON.Material("dice");
  trayMaterial = new CANNON.Material("tray");
  world.addContactMaterial(new CANNON.ContactMaterial(diceMaterial, trayMaterial, { friction: 0.3, restitution: 0.35 }));
  world.addContactMaterial(new CANNON.ContactMaterial(diceMaterial, diceMaterial, { friction: 0.2, restitution: 0.4 }));
}

function createTray() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(TRAY_SIZE, TRAY_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x1d5e33, roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(TRAY_SIZE, TRAY_SIZE)),
    new THREE.LineBasicMaterial({ color: 0x2185d0 }),
  );
  border.rotation.x = -Math.PI / 2;
  border.position.y = 0.01;
  scene.add(border);

  // Ledge where kept dice are set aside
  const ledge = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 2),
    new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.9 }),
  );
  ledge.rotation.x = -Math.PI / 2;
  ledge.position.set(0, 0, HELD_ROW_Z);
  ledge.receiveShadow = true;
  scene.add(ledge);

  const floorBody = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane(), material: trayMaterial });
  floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floorBody);

  // Invisible walls and a ceiling keep every die inside the tray
  const half = TRAY_SIZE / 2;
  const t = 2;
  const h = 20;
  const span = half + t;
  const wall = (x, y, z, hx, hy, hz) => {
    const body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)),
      material: trayMaterial,
    });
    body.position.set(x, y, z);
    world.addBody(body);
  };
  wall(-half - t / 2, h / 2, 0, t / 2, h / 2, span);
  wall(half + t / 2, h / 2, 0, t / 2, h / 2, span);
  wall(0, h / 2, -half - t / 2, span, h / 2, t / 2);
  wall(0, h / 2, half + t / 2, span, h / 2, t / 2);
  wall(0, h + 1, 0, span, 1, span);
}

// Dice meshes

// Loads public/dice.obj, centred and scaled to a unit cube
// onProgress receives 0 to 100 while the 2 MB model downloads
async function loadDiceModel(onProgress) {
  const materials = await new MTLLoader().loadAsync("dice.mtl");
  materials.preload();
  const group = await new OBJLoader().setMaterials(materials).loadAsync("dice.obj", (e) => {
    if (onProgress && e.lengthComputable && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
  });

  let source = null;
  group.traverse((child) => {
    if (child.isMesh && !source) source = child;
  });
  if (!source) throw new Error("dice.obj contains no mesh");

  const geometry = source.geometry;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(1.02 / size.x, 1.02 / size.y, 1.02 / size.z);

  const baseMaterials = Array.isArray(source.material) ? source.material : [source.material];
  return { geometry, baseMaterials };
}

// Drawn dice used when the model cannot be fetched, for example when the page is opened from disk
function fallbackDiceModel() {
  const pips = {
    1: [[0.5, 0.5]],
    2: [[0.27, 0.27], [0.73, 0.73]],
    3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
    4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
    5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
    6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
  };
  const baseMaterials = FACE_VALUES.map((value) => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#f7f5ef";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#111";
    for (const [x, y] of pips[value]) {
      ctx.beginPath();
      ctx.arc(x * 256, y * 256, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map, roughness: 0.35 });
  });
  return { geometry: new THREE.BoxGeometry(1, 1, 1), baseMaterials };
}

async function createDice() {
  // The model is large, so the table shows a loading overlay with progress until it arrives
  const $host = $gameView;
  const overlay = $host.themestrapPluginLoadingOverlay({
    type: "bars",
    message: "Loading the dice…",
    progress: true,
    color: "#2185d0",
    backdrop: "rgba(246, 246, 246, .85)",
    scrollLock: false
  })[0];
  overlay.show();

  let model;
  try {
    model = await loadDiceModel((pct) => overlay.setProgress(pct));
  } catch (err) {
    console.warn("Using drawn dice, could not load dice.obj:", err);
    model = fallbackDiceModel();
  }
  overlay.setProgress(100);
  overlay.hide();

  for (let i = 0; i < DICE_COUNT; i++) {
    // Each die gets its own materials so the selection glow is per die
    const materials = model.baseMaterials.map((m) => m.clone());
    const mesh = new THREE.Mesh(model.geometry, materials.length === 1 ? materials[0] : materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.dieIndex = i;
    scene.add(mesh);

    const body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
      material: diceMaterial,
      sleepTimeLimit: 0.2,
      sleepSpeedLimit: 0.15,
      linearDamping: 0.1,
      angularDamping: 0.1,
    });
    world.addBody(body);

    dice.push({ index: i, mesh, body, materials, state: "tray", selected: false, rolling: false, value: null, nudges: 0 });
  }
  restDice();
}


initPhysics();
initScene();
createTray();
animate();
createDice();
