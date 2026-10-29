// The 3D dice table shared by the single player game (farkle.js) and the online game (main.js).
//
// It draws the tray, the ledge where kept dice are set aside and six dice, and runs the physics.
// Every throw is simulated first and then played back on screen. That gives two kinds of throw:
//   roll(indexes)          the dice land however the physics takes them, the result is read off
//   roll(indexes, values)  the dice land on the given values, used when the server decides
// For the second kind each thrown die is drawn with its faces turned (a fixed quarter or half turn
// of the cube) so the wanted face is the one that ends up on top. The tumble is still the real one.
//
// The rest of the API matches the PluginDice tray, so a page can swap one for the other:
//   setState([{ value, held }]), getValues(), roll(), setSelectable(), getSelected(),
//   getSelectedValues(), setSelected(), clearSelection(), and the onSelect callback.
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";

export const DICE_COUNT = 6;
export const TRAY_SIZE = 13;
export const HELD_ROW_Z = -8.6;
const STEP = 1 / 60;
const MAX_ROLL_SECONDS = 8;
const SETTLE_FRAMES = 15;
const MAX_NUDGES = 4;

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

const validFace = (v) => Number.isInteger(v) && v >= 1 && v <= 6;

// Rotation that puts value on top, with an optional random twist around the vertical
export function orientationFor(value, jitter = 0) {
    const idx = FACE_VALUES.indexOf(validFace(value) ? value : 1);
    const q = new THREE.Quaternion().setFromUnitVectors(FACE_NORMALS[idx], UP);
    const yaw = new THREE.Quaternion().setFromAxisAngle(UP, (Math.random() - 0.5) * jitter);
    return q.premultiply(yaw);
}

// Which face points up for a rotation, and whether the die lies flat
const _v = new THREE.Vector3();
export function topFace(quaternion) {
    let best = -2;
    let index = 0;
    FACE_NORMALS.forEach((n, i) => {
        _v.copy(n).applyQuaternion(quaternion);
        if (_v.y > best) {
            best = _v.y;
            index = i;
        }
    });
    return { value: FACE_VALUES[index], normal: FACE_NORMALS[index], flat: best > 0.96 };
}

// The dice model is shared by every table on the page and only fetched once
let modelPromise = null;
const progressListeners = new Set();

// Loads public/dice.obj, centred and scaled to a unit cube. Falls back to drawn dice when the
// 2 MB model cannot be fetched, for example when the page is opened from disk.
function loadModel(onProgress) {
    if (onProgress) progressListeners.add(onProgress);
    if (!modelPromise) {
        modelPromise = (async () => {
            try {
                const materials = await new MTLLoader().loadAsync("/dice.mtl");
                materials.preload();
                const group = await new OBJLoader().setMaterials(materials).loadAsync("/dice.obj", (e) => {
                    if (e.lengthComputable && e.total) {
                        const pct = Math.round((e.loaded / e.total) * 100);
                        progressListeners.forEach((fn) => fn(pct));
                    }
                });
                let source = null;
                group.traverse((child) => {
                    if (child.isMesh && !source) source = child;
                });
                if (!source) throw new Error("dice.obj contains no mesh");

                const geometry = source.geometry;
                geometry.computeBoundingBox();
                const size = new THREE.Vector3();
                const center = new THREE.Vector3();
                geometry.boundingBox.getSize(size);
                geometry.boundingBox.getCenter(center);
                geometry.translate(-center.x, -center.y, -center.z);
                geometry.scale(1.02 / size.x, 1.02 / size.y, 1.02 / size.z);
                const baseMaterials = Array.isArray(source.material) ? source.material : [source.material];
                return { geometry, baseMaterials };
            } catch (err) {
                console.warn("Using drawn dice, could not load dice.obj:", err);
                return fallbackModel();
            } finally {
                progressListeners.forEach((fn) => fn(100));
                progressListeners.clear();
            }
        })();
    }
    return modelPromise;
}

function fallbackModel() {
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

export class DiceTable3D {
    // options:
    //   canvas       the <canvas> to draw on (required)
    //   overlayHost  element that shows the loading overlay while the model downloads
    //   fullscreen   true sizes the table to the window, false to the canvas's parent element
    //   frame        function (camera, controls, aspect) that places the camera, optional
    //   selectColor  glow for picked dice
    //   onSelect     function (selection) called when the player picks or drops a die
    constructor (options) {
        this.options = Object.assign(
            { canvas: null, overlayHost: null, fullscreen: false, frame: null, selectColor: 0xff0000, onSelect: null },
            options,
        );
        this.canvas = this.options.canvas;
        this.dice = [];
        this.heldOrder = [];
        this.selectable = false;
        this.rolling = false;
        this._playback = null;
        this._running = false;
        this._raycaster = new THREE.Raycaster();
        this._pointer = new THREE.Vector2();
        this._clock = new THREE.Clock();

        this._initPhysics();
        this._initScene();
        this._createTray();
        this._bindPointer();
        this.ready = this._createDice();
        this.resume();
    }

    // Setup

    _initPhysics() {
        this.world = new CANNON.World({ allowSleep: true, gravity: new CANNON.Vec3(0, -50, 0) });
        this.diceMaterial = new CANNON.Material("dice");
        this.trayMaterial = new CANNON.Material("tray");
        this.world.addContactMaterial(new CANNON.ContactMaterial(this.diceMaterial, this.trayMaterial, { friction: 0.3, restitution: 0.35 }));
        this.world.addContactMaterial(new CANNON.ContactMaterial(this.diceMaterial, this.diceMaterial, { friction: 0.2, restitution: 0.4 }));
    }

    _initScene() {
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, canvas: this.canvas });
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer = renderer;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

        const controls = new OrbitControls(this.camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.2;
        controls.enablePan = false;
        controls.minDistance = 8;
        controls.maxDistance = 45;
        controls.maxPolarAngle = Math.PI / 2.2;
        this.controls = controls;

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x223322, 0.6));
        const sun = new THREE.DirectionalLight(0xffffff, 2.2);
        sun.position.set(6, 20, 8);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 60 });
        sun.shadow.bias = -0.0005;
        this.scene.add(sun);

        this._onResize = () => this.resize();
        if (this.options.fullscreen) {
            window.addEventListener("resize", this._onResize);
        } else if (window.ResizeObserver && this.canvas.parentElement) {
            this._resizeObserver = new ResizeObserver(this._onResize);
            this._resizeObserver.observe(this.canvas.parentElement);
        }
        this.resize();
    }

    _createTray() {
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(TRAY_SIZE, TRAY_SIZE),
            new THREE.MeshStandardMaterial({ color: 0x1d5e33, roughness: 0.95 }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        const border = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.PlaneGeometry(TRAY_SIZE, TRAY_SIZE)),
            new THREE.LineBasicMaterial({ color: 0x2185d0 }),
        );
        border.rotation.x = -Math.PI / 2;
        border.position.y = 0.01;
        this.scene.add(border);

        // Ledge where kept dice are set aside
        const ledge = new THREE.Mesh(
            new THREE.PlaneGeometry(10, 2),
            new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.9 }),
        );
        ledge.rotation.x = -Math.PI / 2;
        ledge.position.set(0, 0, HELD_ROW_Z);
        ledge.receiveShadow = true;
        this.scene.add(ledge);

        const floorBody = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane(), material: this.trayMaterial });
        floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(floorBody);

        // Invisible walls and a ceiling keep every die inside the tray
        const half = TRAY_SIZE / 2;
        const t = 2;
        const h = 20;
        const span = half + t;
        const wall = (x, y, z, hx, hy, hz) => {
            const body = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)), material: this.trayMaterial });
            body.position.set(x, y, z);
            this.world.addBody(body);
        };
        wall(-half - t / 2, h / 2, 0, t / 2, h / 2, span);
        wall(half + t / 2, h / 2, 0, t / 2, h / 2, span);
        wall(0, h / 2, -half - t / 2, span, h / 2, t / 2);
        wall(0, h / 2, half + t / 2, span, h / 2, t / 2);
        wall(0, h + 1, 0, span, 1, span);
    }

    async _createDice() {
        let overlay = null;
        const host = this.options.overlayHost;
        if (host && typeof $ === "function" && typeof $.fn.themestrapPluginLoadingOverlay === "function") {
            overlay = $(host).themestrapPluginLoadingOverlay({
                type: "bars",
                message: "Loading the dice…",
                progress: true,
                color: "#2185d0",
                scrollLock: false,
            })[0];
            overlay.show();
        }
        const model = await loadModel(overlay ? (pct) => overlay.setProgress(pct) : null);
        if (overlay) {
            overlay.setProgress(100);
            overlay.hide();
        }

        for (let i = 0; i < DICE_COUNT; i++) {
            // Each die gets its own materials so the selection glow is per die
            const materials = model.baseMaterials.map((m) => m.clone());
            const mesh = new THREE.Mesh(model.geometry, materials.length === 1 ? materials[0] : materials);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.dieIndex = i;
            this.scene.add(mesh);

            const body = new CANNON.Body({
                mass: 1,
                shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
                material: this.diceMaterial,
                sleepTimeLimit: 0.2,
                sleepSpeedLimit: 0.15,
                linearDamping: 0.1,
                angularDamping: 0.1,
            });
            this.world.addBody(body);

            this.dice.push({
                index: i,
                mesh,
                body,
                materials,
                // Turn applied to the drawn die on top of the physics body, see roll()
                offset: new THREE.Quaternion(),
                frame: null,
                state: "tray",
                selected: false,
                value: null,
                nudges: 0,
            });
        }
        this.rest();
        if (this._pendingState) {
            const pending = this._pendingState;
            this._pendingState = null;
            this.setState(pending);
        }
        return this;
    }

    // Camera and size

    _size() {
        if (this.options.fullscreen) return { w: window.innerWidth, h: window.innerHeight };
        const box = this.canvas.parentElement || this.canvas;
        return { w: Math.max(1, box.clientWidth), h: Math.max(1, box.clientHeight) };
    }

    resize() {
        const { w, h } = this._size();
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        // An embedded canvas is sized by CSS, only its drawing buffer follows the parent
        this.renderer.setSize(w, h, this.options.fullscreen);
        this.frame();
    }

    // Points the camera at the tray and the ledge
    frame() {
        const aspect = this.camera.aspect;
        if (typeof this.options.frame === "function") {
            this.options.frame(this.camera, this.controls, aspect);
        } else {
            this._fit();
        }
        this.controls.update();
    }

    // Moves the camera in as close as it can while the whole tray and the ledge stay in view,
    // whatever the shape of the canvas
    _fit() {
        const half = TRAY_SIZE / 2 + 0.2;
        const corners = [];
        for (const x of [-half, half]) {
            for (const z of [half, HELD_ROW_Z - 1.1]) {
                for (const y of [0, 1.2]) corners.push(new THREE.Vector3(x, y, z));
            }
        }
        const target = new THREE.Vector3(0, 0, (half + HELD_ROW_Z - 1.1) / 2);
        const direction = new THREE.Vector3(0, 0.86, 0.51).normalize();
        const p = new THREE.Vector3();
        const fits = (distance) => {
            this.camera.position.copy(target).addScaledVector(direction, distance);
            this.camera.lookAt(target);
            this.camera.updateMatrixWorld();
            return corners.every((c) => {
                p.copy(c).project(this.camera);
                return Math.abs(p.x) < 0.97 && Math.abs(p.y) < 0.97;
            });
        };
        let lo = 5;
        let hi = 120;
        for (let i = 0; i < 24; i++) {
            const mid = (lo + hi) / 2;
            if (fits(mid)) hi = mid;
            else lo = mid;
        }
        fits(hi);
        this.controls.target.copy(target);
    }

    // Render loop

    resume() {
        if (this._running) return;
        this._running = true;
        this._clock.getDelta();
        const tick = () => {
            if (!this._running) return;
            this._raf = requestAnimationFrame(tick);
            this._tick(this._clock.getDelta());
        };
        tick();
    }

    pause() {
        this._running = false;
        cancelAnimationFrame(this._raf);
    }

    // dt is the real time since the last frame. A throw plays back in real time, skipping
    // recorded frames on a slow machine instead of slowing down.
    _tick(dt) {
        if (this._playback) this._advancePlayback(Math.min(dt, 0.5));
        else this.world.fixedStep(STEP, 5);

        for (const d of this.dice) {
            if (d.frame) {
                d.mesh.position.set(d.frame[0], d.frame[1], d.frame[2]);
                d.mesh.quaternion.set(d.frame[3], d.frame[4], d.frame[5], d.frame[6]);
            } else {
                d.mesh.position.copy(d.body.position);
                d.mesh.quaternion.copy(d.body.quaternion);
            }
            d.mesh.quaternion.multiply(d.offset);
        }
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    destroy() {
        this.pause();
        window.removeEventListener("resize", this._onResize);
        if (this._resizeObserver) this._resizeObserver.disconnect();
        this.canvas.removeEventListener("pointerdown", this._onDown);
        this.canvas.removeEventListener("pointerup", this._onUp);
        this.controls.dispose();
        this.renderer.dispose();
    }

    // Picking dice

    _bindPointer() {
        let downPos = null;
        this._onDown = (e) => {
            downPos = { x: e.clientX, y: e.clientY };
        };
        this._onUp = (e) => {
            if (!downPos) return;
            const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
            downPos = null;
            // A drag turns the camera, only a click picks a die
            if (moved < 6) this._pick(e);
        };
        this.canvas.addEventListener("pointerdown", this._onDown);
        this.canvas.addEventListener("pointerup", this._onUp);
    }

    // The die under a screen point, or null
    dieAt(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        this._pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this._pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        this._raycaster.setFromCamera(this._pointer, this.camera);
        const hits = this._raycaster.intersectObjects(this.dice.map((d) => d.mesh), true);
        if (!hits.length) return null;
        let obj = hits[0].object;
        while (obj && obj.userData.dieIndex === undefined) obj = obj.parent;
        return obj ? this.dice[obj.userData.dieIndex] : null;
    }

    // Screen position of a die's centre, handy for tests and hints
    screenPosition(index) {
        const d = this.dice[index];
        const rect = this.canvas.getBoundingClientRect();
        const v = d.mesh.position.clone().project(this.camera);
        return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
    }

    _pick(event) {
        if (!this.selectable || this.rolling) return;
        const die = this.dieAt(event.clientX, event.clientY);
        if (!die || die.state !== "tray" || die.value === null) return;
        die.selected = !die.selected;
        this._glow(die);
        if (typeof this.options.onSelect === "function") this.options.onSelect(this.getSelected(), die.index, die.selected);
    }

    _glow(die) {
        const color = die.selected ? this.options.selectColor : 0x000000;
        die.materials.forEach((m) => {
            if (m.emissive) m.emissive.setHex(color);
        });
    }

    setSelectable(on) {
        this.selectable = Boolean(on);
        if (!this.selectable) this.clearSelection();
        return this;
    }

    getSelected() {
        return this.dice.filter((d) => d.selected).map((d) => d.index);
    }

    getSelectedValues() {
        return this.dice.filter((d) => d.selected).map((d) => d.value);
    }

    clearSelection() {
        this.dice.forEach((d) => {
            if (d.selected) {
                d.selected = false;
                this._glow(d);
            }
        });
        return this;
    }

    // Shows exactly these dice as picked, without onSelect and whether or not picking is on.
    // Used to mirror another player's picks.
    setSelected(indexes) {
        const wanted = new Set(Array.isArray(indexes) ? indexes : []);
        this.dice.forEach((d) => {
            const on = wanted.has(d.index) && d.state === "tray" && d.value !== null;
            if (d.selected !== on) {
                d.selected = on;
                this._glow(d);
            }
        });
        return this;
    }

    // Placing dice

    getValues() {
        return this.dice.map((d) => d.value);
    }

    isRolling() {
        return this.rolling;
    }

    // Lays the dice out in a tidy row in the tray showing value, or one to six when empty
    _placeInTray(d, value, jitter = 0.6) {
        d.state = "tray";
        d.selected = false;
        this._glow(d);
        d.value = validFace(value) ? value : null;
        d.offset.identity();
        d.frame = null;
        d.nudges = 0;
        const b = d.body;
        if (!b.world) this.world.addBody(b);
        const q = orientationFor(d.value || d.index + 1, jitter);
        b.velocity.setZero();
        b.angularVelocity.setZero();
        b.position.set(-3.75 + d.index * 1.5, 0.5, 0);
        b.quaternion.set(q.x, q.y, q.z, q.w);
        b.wakeUp();
    }

    // Puts a die on the ledge, out of the physics world, showing its value
    _placeOnLedge(d) {
        d.state = "held";
        d.selected = false;
        this._glow(d);
        d.offset.identity();
        d.frame = null;
        if (d.body.world) this.world.removeBody(d.body);
        d.body.velocity.setZero();
        d.body.angularVelocity.setZero();
        const q = orientationFor(d.value, 0);
        d.body.quaternion.set(q.x, q.y, q.z, q.w);
        if (!this.heldOrder.includes(d.index)) this.heldOrder.push(d.index);
        this._layoutLedge();
    }

    _layoutLedge() {
        this.heldOrder.forEach((i, slot) => {
            this.dice[i].body.position.set(-3.75 + slot * 1.5, 0.5, HELD_ROW_Z);
        });
    }

    // Every die back in the tray, empty, in a row
    rest() {
        this.heldOrder = [];
        this.dice.forEach((d) => this._placeInTray(d, null));
        return this;
    }

    // Sets dice aside on the ledge in the order given
    hold(indexes) {
        (Array.isArray(indexes) ? indexes : [indexes]).forEach((i) => {
            const d = this.dice[i];
            if (d && d.state !== "held") this._placeOnLedge(d);
        });
        return this;
    }

    // Brings every held die back into the tray, for Hot Dice
    releaseAll() {
        this.heldOrder = [];
        this.dice.forEach((d) => {
            if (d.state === "held") this._placeInTray(d, d.value, 0.3);
        });
        return this;
    }

    // Matches the table to [{ value, held }] from the game. Dice that already show the right
    // thing stay where they are, so dice that just landed are not tidied away.
    setState(list) {
        if (!this.dice.length) {
            this._pendingState = list;
            return this;
        }
        if (this.rolling) return this;
        const state = Array.isArray(list) ? list : [];
        // Dice no longer held leave the ledge order first so the rest close up
        this.heldOrder = this.heldOrder.filter((i) => state[i] && state[i].held);
        this.dice.forEach((d, i) => {
            const s = state[i];
            if (!s) return;
            const value = validFace(s.value) ? s.value : null;
            if (s.held) {
                if (d.state !== "held" || d.value !== value) {
                    d.value = value;
                    this._placeOnLedge(d);
                }
            } else if (d.state === "held" || d.value !== value) {
                this._placeInTray(d, value);
            }
        });
        this._layoutLedge();
        return this;
    }

    // Throwing

    _launch(d, k) {
        const b = d.body;
        if (!b.world) this.world.addBody(b);
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
    _nudge(d) {
        d.nudges++;
        d.body.wakeUp();
        d.body.velocity.set((Math.random() - 0.5) * 4, 8, (Math.random() - 0.5) * 4);
        d.body.angularVelocity.set((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15);
    }

    // Runs the whole throw at once and records every frame for every die in the world
    _simulate(thrown) {
        const recorded = this.dice.filter((d) => d.body.world || thrown.includes(d));
        thrown.forEach((d, k) => {
            d.state = "tray";
            d.selected = false;
            this._glow(d);
            d.offset.identity();
            d.nudges = 0;
            this._launch(d, k);
        });

        const tracks = new Map(recorded.map((d) => [d, []]));
        const record = () => {
            recorded.forEach((d) => {
                const p = d.body.position;
                const q = d.body.quaternion;
                tracks.get(d).push(p.x, p.y, p.z, q.x, q.y, q.z, q.w);
            });
        };
        const quat = new THREE.Quaternion();
        const flat = (d) => topFace(quat.set(d.body.quaternion.x, d.body.quaternion.y, d.body.quaternion.z, d.body.quaternion.w)).flat;

        let time = 0;
        let settled = 0;
        let frames = 0;
        for (; ;) {
            this.world.step(STEP);
            time += STEP;
            frames++;
            record();
            const still = thrown.every((d) => d.body.velocity.lengthSquared() < 0.02 && d.body.angularVelocity.lengthSquared() < 0.02);
            settled = still ? settled + 1 : 0;
            const timedOut = time > MAX_ROLL_SECONDS;
            if (settled < SETTLE_FRAMES && !timedOut) continue;

            let cocked = false;
            for (const d of thrown) {
                if (!flat(d) && d.nudges < MAX_NUDGES && !timedOut) {
                    this._nudge(d);
                    cocked = true;
                }
            }
            if (cocked) {
                settled = 0;
                continue;
            }
            break;
        }
        // Trim the still frames at the end, a short pause on screen is enough
        const keep = Math.max(1, frames - SETTLE_FRAMES + 4);
        thrown.forEach((d) => {
            d.body.velocity.setZero();
            d.body.angularVelocity.setZero();
            d.body.sleep();
        });
        return { tracks, frames: keep };
    }

    // Throws the dice at indexes (default: every die not held). With values, each die lands on
    // its value. Resolves with the thrown dice's values once they come to rest on screen.
    roll(indexes, values) {
        if (!this.dice.length) return this.ready.then(() => this.roll(indexes, values));
        const list = (Array.isArray(indexes) ? indexes : this.dice.filter((d) => d.state !== "held").map((d) => d.index))
            .map((i) => this.dice[i])
            .filter(Boolean);
        if (!list.length) return Promise.resolve([]);

        this.rolling = true;
        list.forEach((d) => {
            if (d.state === "held") {
                this.heldOrder = this.heldOrder.filter((i) => i !== d.index);
            }
        });
        this._layoutLedge();

        const { tracks, frames } = this._simulate(list);

        const q = new THREE.Quaternion();
        const result = list.map((d, k) => {
            const b = d.body.quaternion;
            const top = topFace(q.set(b.x, b.y, b.z, b.w));
            const wanted = Array.isArray(values) && validFace(values[k]) ? values[k] : null;
            if (wanted && wanted !== top.value) {
                // Turn the drawn die so the wanted face sits where the landing face is
                const from = FACE_NORMALS[FACE_VALUES.indexOf(wanted)];
                d.offset.setFromUnitVectors(from, top.normal);
            } else {
                d.offset.identity();
            }
            d.value = wanted || top.value;
            return d.value;
        });

        return new Promise((resolve) => {
            this._playback = { time: 0, frames, tracks, resolve, result };
        });
    }

    _advancePlayback(dt) {
        const pb = this._playback;
        pb.time += dt;
        const f = Math.min(Math.floor(pb.time / STEP), pb.frames - 1);
        pb.tracks.forEach((arr, d) => {
            const i = f * 7;
            d.frame = arr.slice(i, i + 7);
        });
        if (f < pb.frames - 1) return;

        // Landed: hand the dice back to the physics bodies, which already rest where the
        // recording ended (the last frames were trimmed, so snap the bodies to the shown frame)
        pb.tracks.forEach((arr, d) => {
            const i = f * 7;
            d.body.position.set(arr[i], arr[i + 1], arr[i + 2]);
            d.body.quaternion.set(arr[i + 3], arr[i + 4], arr[i + 5], arr[i + 6]);
            d.frame = null;
        });
        this._playback = null;
        this.rolling = false;
        pb.resolve(pb.result);
    }
}