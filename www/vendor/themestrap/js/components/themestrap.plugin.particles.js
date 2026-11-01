/**
 * Themestrap Particles
 *
 * A canvas particle background for heroes, sections and cards. Drifting dots that can
 * twinkle, link up into a network, swell or shrink under the pointer, and scatter on
 * click. Replaces particles.js with a single dependency-free plugin.
 *
 * The animation pauses when the element scrolls out of view or the tab is hidden,
 * redraws sharply on high-DPI screens, resizes with its host, and shows a still field
 * when the visitor asks for reduced motion.
 *
 * Markup:
 *
 *   <section class="hero">
 *     <div data-plugin-particles
 *          data-plugin-options='{"color": "#0088cc", "density": 160}'></div>
 *     …content…
 *   </section>
 *
 *   The host fills its nearest positioned ancestor (position: absolute, inset 0) unless
 *   "fill" is false, and never takes pointer events, so content above it stays clickable.
 *
 * Public API (via stored instance):
 *   const fx = $('#hero-particles').data('__pluginParticles');
 *   fx.pause(); fx.play(); fx.isPlaying();
 *   fx.burst(x, y, 6);           // add particles at a point inside the host
 *   fx.refresh();                // rebuild the field (after changing options)
 *   fx.setOptions({ color: ['#e8672a', '#2ab8c8'] }).refresh();
 *   fx.destroy();
 *
 * Events (native CustomEvent, bubbling, dispatched on the host):
 *   ts.particles.ready   detail: { instance, count }
 *
 * Init.js wiring:
 *   if (typeof $.fn['themestrapPluginParticles'] === 'function' && $('[data-plugin-particles]').length) {
 *       themestrap.fn.intObsInit('[data-plugin-particles]:not(.manual)', 'themestrapPluginParticles');
 *   }
 */
// Particles
(((themestrap = {}, $) => {
    const instanceName = '__pluginParticles';
    const STYLE_ID     = 'ts-particles-styles';
    const EVT_READY    = 'ts.particles.ready';
    const AREA         = 800 * 800;   // density counts particles per 800 by 800 px of host

    let instanceCount = 0;
    let seq           = 0;

    const CSS_TEXT = `
        .ts-particles {
            pointer-events: none;
            overflow: hidden;
        }
        .ts-particles--fill {
            position: absolute;
            inset: 0;
            z-index: var(--ts-particles-z, 0);
        }
        .ts-particles > canvas {
            display: block;
            width: 100%;
            height: 100%;
        }
        .ts-particles-host { position: relative; }
    `;

    const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rand  = (min, max) => min + Math.random() * (max - min);
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    // Accepts #rgb, #rrggbb, rgb() or any CSS color the canvas understands
    const parseColor = (color) => {
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillStyle = String(color);
        const hex = ctx.fillStyle;
        if (hex.charAt(0) === '#') {
            const n = parseInt(hex.slice(1), 16);
            return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
        }
        const m = hex.match(/\d+(\.\d+)?/g) || [0, 0, 0];
        return { r: +m[0], g: +m[1], b: +m[2] };
    };

    const DIRECTIONS = {
        top:    [0, -1], 'top-right':    [0.7, -0.7], right:  [1, 0], 'bottom-right': [0.7, 0.7],
        bottom: [0, 1],  'bottom-left':  [-0.7, 0.7], left:   [-1, 0], 'top-left':    [-0.7, -0.7]
    };

    class PluginParticles {
        constructor($el, opts) {
            return this.initialize($el, opts);
        }

        initialize($el, opts) {
            if ($el.data(instanceName)) {
                return this;
            }

            this.$el       = $el;
            this._uid      = ++seq;
            this._ns       = `.tsparticles${this._uid}`;
            this._parts    = [];
            this._pointer  = { x: null, y: null };
            this._raf      = null;
            this._visible  = true;
            this._paused   = false;

            this
                .setData()
                .setOptions(opts)
                .build()
                .events();

            return this;
        }

        setData() {
            this.$el.data(instanceName, this);
            return this;
        }

        setOptions(opts) {
            this.options = $.extend(true, {}, this.options || PluginParticles.defaults, opts, {
                wrapper: this.$el
            });
            const colors = Array.isArray(this.options.color) ? this.options.color : [this.options.color];
            this._colors = colors.map(parseColor);
            this._links  = parseColor(this.options.links.color || colors[0]);
            return this;
        }

        build() {
            const self = this;
            const o    = self.options;

            instanceCount++;
            if (!document.getElementById(STYLE_ID)) {
                const style       = document.createElement('style');
                style.id          = STYLE_ID;
                style.textContent = CSS_TEXT;
                document.head.appendChild(style);
            }

            self.$el.addClass('ts-particles').attr('aria-hidden', 'true');
            if (o.fill) {
                self.$el.addClass('ts-particles--fill');
                const $parent = self.$el.parent();
                if ($parent.length && $parent.css('position') === 'static') {
                    $parent.addClass('ts-particles-host');
                    self._hostClassAdded = true;
                }
            }

            self.canvas = document.createElement('canvas');
            self.ctx    = self.canvas.getContext('2d');
            self.$el.append(self.canvas);

            self._resize();
            self._populate();
            self._draw();
            if (!reducedMotion()) self._loop();

            self._emit(EVT_READY, { count: self._parts.length });
            return this;
        }

        events() {
            const self = this;
            const o    = self.options;

            if (typeof ResizeObserver === 'function') {
                self._ro = new ResizeObserver(() => {
                    self._resize();
                    self._populate(true);
                    self._draw();
                });
                self._ro.observe(self.$el[0]);
            } else {
                $(window).on(`resize${self._ns}`, () => { self._resize(); self._populate(true); self._draw(); });
            }

            if (typeof IntersectionObserver === 'function') {
                self._io = new IntersectionObserver((entries) => {
                    self._visible = entries[0].isIntersecting;
                    self._syncLoop();
                });
                self._io.observe(self.$el[0]);
            }

            $(document).on(`visibilitychange${self._ns}`, () => self._syncLoop());

            // The canvas ignores the pointer, so movement is read from the window and mapped in
            if (o.hover.mode || o.click.mode) {
                $(window).on(`pointermove${self._ns}`, (e) => {
                    const r = self.canvas.getBoundingClientRect();
                    const x = e.clientX - r.left;
                    const y = e.clientY - r.top;
                    const inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
                    self._pointer.x = inside ? x : null;
                    self._pointer.y = inside ? y : null;
                });
                $(document).on(`pointerleave${self._ns}`, () => { self._pointer.x = self._pointer.y = null; });
            }

            if (o.click.mode) {
                $(window).on(`pointerdown${self._ns}`, (e) => {
                    const r = self.canvas.getBoundingClientRect();
                    const x = e.clientX - r.left;
                    const y = e.clientY - r.top;
                    if (x < 0 || y < 0 || x > r.width || y > r.height) return;
                    if (o.click.mode === 'push') self.burst(x, y, o.click.count);
                    if (o.click.mode === 'repulse') self._shove(x, y);
                });
            }

            return this;
        }

        // Field setup

        _resize() {
            const el   = this.$el[0];
            const dpr  = Math.min(window.devicePixelRatio || 1, 2);
            this._w    = Math.max(1, el.clientWidth);
            this._h    = Math.max(1, el.clientHeight);
            this._dpr  = dpr;
            this.canvas.width  = Math.round(this._w * dpr);
            this.canvas.height = Math.round(this._h * dpr);
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        _target() {
            const o = this.options;
            if (Number.isFinite(o.count) && o.count > 0) return Math.round(o.count);
            const n = Math.round((this._w * this._h / AREA) * o.density);
            return clamp(n, 0, o.maxParticles);
        }

        // keep: keep existing particles that still fit the new size
        _populate(keep) {
            const target = this._target();
            if (keep) {
                this._parts = this._parts.filter((p) => p.x <= this._w + p.r && p.y <= this._h + p.r);
            } else {
                this._parts = [];
            }
            while (this._parts.length < target) this._parts.push(this._spawn());
            if (this._parts.length > target) this._parts.length = target;
        }

        _spawn(x, y) {
            const o     = this.options;
            const r     = o.sizeRandom ? rand(o.size * 0.15, o.size) : o.size;
            const alpha = o.opacityRandom ? rand(o.opacity * 0.15, o.opacity) : o.opacity;
            const speed = o.speed * (o.speedRandom ? rand(0.2, 1) : 1);
            let vx, vy;
            const dir = DIRECTIONS[o.direction];
            if (dir) {
                vx = dir[0] * speed + (o.speedRandom ? rand(-0.2, 0.2) * speed : 0);
                vy = dir[1] * speed + (o.speedRandom ? rand(-0.2, 0.2) * speed : 0);
            } else {
                const a = rand(0, Math.PI * 2);
                vx = Math.cos(a) * speed;
                vy = Math.sin(a) * speed;
            }
            return {
                x: x != null ? x : rand(0, this._w),
                y: y != null ? y : rand(0, this._h),
                vx, vy,
                r, baseR: r,
                a: alpha, baseA: alpha,
                twinkle: rand(0, Math.PI * 2),
                color: this._colors[Math.floor(Math.random() * this._colors.length)],
                pushX: 0, pushY: 0
            };
        }

        // Animation

        _loop() {
            if (this._raf) return;
            let last = performance.now();
            const tick = (now) => {
                const dt = Math.min(3, (now - last) / 16.667);
                last = now;
                this._step(dt);
                this._draw();
                this._raf = requestAnimationFrame(tick);
            };
            this._raf = requestAnimationFrame(tick);
        }

        _stop() {
            if (this._raf) cancelAnimationFrame(this._raf);
            this._raf = null;
        }

        _syncLoop() {
            const run = this._visible && !this._paused && !document.hidden && !reducedMotion();
            if (run) this._loop(); else this._stop();
        }

        _step(dt) {
            const o  = this.options;
            const w  = this._w;
            const h  = this._h;
            const px = this._pointer.x;
            const py = this._pointer.y;
            const hv = o.hover;

            for (const p of this._parts) {
                p.x += (p.vx + p.pushX) * dt;
                p.y += (p.vy + p.pushY) * dt;
                p.pushX *= 0.9;
                p.pushY *= 0.9;

                if (o.outMode === 'bounce') {
                    if (p.x < p.r || p.x > w - p.r) { p.vx = -p.vx; p.x = clamp(p.x, p.r, w - p.r); }
                    if (p.y < p.r || p.y > h - p.r) { p.vy = -p.vy; p.y = clamp(p.y, p.r, h - p.r); }
                } else {
                    if (p.x < -p.r) p.x = w + p.r; else if (p.x > w + p.r) p.x = -p.r;
                    if (p.y < -p.r) p.y = h + p.r; else if (p.y > h + p.r) p.y = -p.r;
                }

                let alpha = p.baseA;
                if (o.twinkle.enable) {
                    p.twinkle += 0.05 * o.twinkle.speed * dt;
                    const t = (Math.sin(p.twinkle) + 1) / 2;
                    alpha = o.twinkle.min + (p.baseA - o.twinkle.min) * t;
                }

                let radius = p.baseR;
                if (px !== null && hv.mode) {
                    const dx   = p.x - px;
                    const dy   = p.y - py;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < hv.distance) {
                        const k = 1 - dist / hv.distance;
                        if (hv.mode === 'bubble') {
                            radius = p.baseR + (hv.size - p.baseR) * k;
                            alpha  = alpha + (hv.opacity - alpha) * k;
                        } else if (hv.mode === 'repulse' && dist > 0) {
                            p.pushX += (dx / dist) * k * hv.strength * dt;
                            p.pushY += (dy / dist) * k * hv.strength * dt;
                        }
                    }
                }
                p.r = Math.max(0, radius);
                p.a = clamp(alpha, 0, 1);
            }
        }

        _draw() {
            const ctx = this.ctx;
            const o   = this.options;
            ctx.clearRect(0, 0, this._w, this._h);

            if (o.links.enable) this._drawLinks();

            for (const p of this._parts) {
                if (p.r <= 0.05 || p.a <= 0.01) continue;
                ctx.beginPath();
                ctx.fillStyle = `rgba(${p.color.r},${p.color.g},${p.color.b},${p.a})`;
                if (o.shape === 'square') {
                    ctx.rect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
                } else {
                    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                }
                ctx.fill();
            }
        }

        _drawLinks() {
            const ctx   = this.ctx;
            const l     = this.options.links;
            const parts = this._parts;
            const max   = l.distance;
            const c     = this._links;
            ctx.lineWidth = l.width;

            for (let i = 0; i < parts.length; i++) {
                const a = parts[i];
                for (let j = i + 1; j < parts.length; j++) {
                    const b  = parts[j];
                    const dx = a.x - b.x;
                    if (dx > max || dx < -max) continue;
                    const dy = a.y - b.y;
                    if (dy > max || dy < -max) continue;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist >= max) continue;
                    ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${l.opacity * (1 - dist / max)})`;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }

            // Grab mode draws lines from the pointer to nearby particles
            const hv = this.options.hover;
            if (hv.mode === 'grab' && this._pointer.x !== null) {
                for (const p of parts) {
                    const dx = p.x - this._pointer.x;
                    const dy = p.y - this._pointer.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist >= hv.distance) continue;
                    ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${l.opacity * (1 - dist / hv.distance)})`;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(this._pointer.x, this._pointer.y);
                    ctx.stroke();
                }
            }
        }

        _shove(x, y) {
            const c = this.options.click;
            for (const p of this._parts) {
                const dx   = p.x - x;
                const dy   = p.y - y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                if (dist > c.distance) continue;
                const k = (1 - dist / c.distance) * c.strength;
                p.pushX += (dx / dist) * k;
                p.pushY += (dy / dist) * k;
            }
            if (reducedMotion()) { this._step(1); this._draw(); }
        }

        // Public API

        // Adds particles at a point. The oldest particles make room once maxParticles is reached.
        burst(x, y, count) {
            const n = Math.max(0, Math.round(count == null ? this.options.click.count : count));
            for (let i = 0; i < n; i++) this._parts.push(this._spawn(x, y));
            const over = this._parts.length - this.options.maxParticles;
            if (over > 0) this._parts.splice(0, over);
            if (!this._raf) this._draw();
            return this;
        }

        pause() {
            this._paused = true;
            this._syncLoop();
            return this;
        }

        play() {
            this._paused = false;
            this._syncLoop();
            return this;
        }

        isPlaying() {
            return Boolean(this._raf);
        }

        refresh() {
            this._resize();
            this._populate();
            this._draw();
            this._syncLoop();
            return this;
        }

        _emit(name, detail) {
            this.$el[0].dispatchEvent(new CustomEvent(name, {
                bubbles: true,
                detail: Object.assign({ instance: this }, detail)
            }));
        }

        destroy() {
            const self = this;
            self._stop();
            if (self._ro) self._ro.disconnect();
            if (self._io) self._io.disconnect();
            $(window).off(self._ns);
            $(document).off(self._ns);
            $(self.canvas).remove();
            if (self._hostClassAdded) self.$el.parent().removeClass('ts-particles-host');
            self.$el.removeClass('ts-particles ts-particles--fill').removeAttr('aria-hidden').removeData(instanceName);
            self._parts = [];

            instanceCount--;
            if (instanceCount <= 0) {
                instanceCount = 0;
                const styleEl = document.getElementById(STYLE_ID);
                if (styleEl) styleEl.remove();
            }
            return this;
        }
    }

    PluginParticles.defaults = {
        density:       80,          // particles per 800 by 800 px of host
        count:         null,        // fixed number of particles, overrides density
        maxParticles:  400,         // upper bound for density and for particles added by push or burst()
        color:         '#0088cc',   // a CSS color or an array of colors picked at random
        shape:         'circle',    // 'circle' or 'square'
        size:          3,           // largest radius in px
        sizeRandom:    true,        // radius between 15% and 100% of size
        opacity:       0.8,         // largest opacity
        opacityRandom: true,        // opacity between 15% and 100% of opacity
        twinkle: {
            enable:    true,        // fade each particle in and out
            speed:     1,
            min:       0
        },
        speed:         0.6,         // px per frame at 60 fps
        speedRandom:   true,
        direction:     'none',      // 'none' or top | top-right | right | bottom-right | bottom | bottom-left | left | top-left
        outMode:       'out',       // 'out' wraps around the edges, 'bounce' bounces off them
        links: {
            enable:    false,       // join nearby particles with lines
            distance:  130,
            color:     null,        // defaults to the first particle color
            opacity:   0.4,
            width:     1
        },
        hover: {
            mode:      'bubble',    // 'bubble', 'grab', 'repulse' or null
            distance:  150,
            size:      0,           // bubble: radius at the pointer
            opacity:   0,           // bubble: opacity at the pointer
            strength:  0.6          // repulse: push per frame
        },
        click: {
            mode:      'repulse',   // 'repulse', 'push' or null
            distance:  220,         // repulse reach in px
            strength:  9,           // repulse push
            count:     4            // push: particles added per click
        },
        fill:          true         // cover the nearest positioned ancestor
    };

    $.extend(themestrap, { PluginParticles });

    // jQuery bridge. Accepts an options object or a method name with arguments:
    //   $('#hero-particles').themestrapPluginParticles('pause');
    $.fn.themestrapPluginParticles = function (opts) {
        const args = Array.prototype.slice.call(arguments, 1);
        return this.map(function () {
            const $this = $(this);
            const inst  = $this.data(instanceName);
            if (inst) {
                if (typeof opts === 'string' && typeof inst[opts] === 'function') {
                    return inst[opts].apply(inst, args);
                }
                return inst;
            }
            return new PluginParticles($this, typeof opts === 'object' ? opts : undefined);
        });
    };

})).apply(this, [window.themestrap, jQuery]);
