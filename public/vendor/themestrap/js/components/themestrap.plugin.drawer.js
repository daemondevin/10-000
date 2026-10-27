/**
 * Themestrap Drawer Plugin
 * Accessible panel that slides in from any edge — bottom (default), top, left, or right.
 * Supports backdrop, drag-to-dismiss via a grab handle, scroll-lock, and focus trapping.
 * Part of the Themestrap component library for MODX 3.
 *
 * Markup anatomy:
 *
 *   <!-- Trigger (anywhere in the DOM) -->
 *   <button data-drawer-open="my-drawer">Open</button>
 *
 *   <!-- Drawer root -->
 *   <div data-plugin-drawer id="my-drawer"
 *        data-plugin-options='{"direction": "bottom"}'>
 *
 *     <!-- Backdrop (auto-injected if omitted) -->
 *     <div data-drawer-backdrop></div>
 *
 *     <!-- Panel -->
 *     <div data-drawer-panel>
 *
 *       <!-- [data-drawer-handle] is auto-injected for bottom/top drawers.
 *            Add it manually inside [data-drawer-panel] to control its position. -->
 *
 *       <h2 data-drawer-title>Drawer Title</h2>
 *       <p  data-drawer-description>Optional description.</p>
 *
 *       <!-- Content -->
 *
 *       <button data-drawer-close>Close</button>
 *     </div>
 *   </div>
 *
 * Public API (via stored instance):
 *   const drw = $('#my-drawer').data('__pluginDrawer');
 *   drw.open();
 *   drw.close();
 *   drw.toggle();
 *
 * Events fired on the drawer root element:
 *   drawer:open  — after the open transition starts  (receives instance as arg)
 *   drawer:close — after the close transition ends   (receives instance as arg)
 *
 * Init.js wiring (DOMReady-immediate — drawers must be ready before any trigger fires):
 *   if ($.isFunction($.fn['themestrapPluginDrawer']) && $('[data-plugin-drawer]').length) {
 *       $(() => {
 *           $('[data-plugin-drawer]:not(.manual)').each(function () {
 *               const $this = $(this);
 *               const opts  = themestrap.fn.getOptions($this.data('plugin-options')) || undefined;
 *               $this.themestrapPluginDrawer(opts);
 *           });
 *       });
 *   }
 */
(((themestrap = {}, $) => {
    const instanceName = '__pluginDrawer';

    const FOCUSABLE = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable="true"]',
    ].join(', ');

    let _seq = 0;
    const uid = (prefix) => `${prefix}-${++_seq}-${Math.random().toString(36).slice(2, 7)}`;

    const STYLE_ID = 'ts-drawer-styles';
    const CSS_TEXT = `/* PluginDrawer — Themestrap Drawer Styles
 *
 * Structure:
 *   .drawer-root                  [data-plugin-drawer] fixed full-screen container
 *   ├── [data-drawer-backdrop]    translucent overlay
 *   └── [data-drawer-panel]       the visible panel; slides in from an edge
 *       ├── [data-drawer-handle]  drag indicator (auto-injected for bottom/top)
 *       ├── [data-drawer-title]
 *       ├── [data-drawer-description]
 *       └── ...content...
 *
 * State classes (toggled by the plugin):
 *   .drawer-root.drawer-hidden    closed (display:none)
 *   .drawer-root.drawer-is-open   panel is in the DOM, pre-transition
 *   .drawer-root.drawer-open      panel is visible (transition target)
 *   .drawer-{bottom|top|left|right}  direction variant
 *
 * CSS custom properties (override at any scope level):
 *   --ts-drw-bg           Panel background
 *   --ts-drw-overlay      Backdrop colour
 *   --ts-drw-shadow-b/t/l/r  Direction-specific panel shadow
 *   --ts-drw-radius       Corner radius
 *   --ts-drw-handle       Handle pill colour
 *   --ts-drw-handle-hover Handle pill hover colour
 *   --ts-drw-text-muted   [data-drawer-description] colour
 *   --ts-drw-max-h        Max height for bottom/top drawers
 *   --ts-drw-side-w       Width for left/right drawers
 *   --ts-drw-pad          Panel padding
 *   --ts-drw-dur          Transition duration (keep in sync with transitionDuration option)
 *   --ts-drw-ease         Transition easing
 */

:root {
    --ts-drw-bg          : #ffffff;
    --ts-drw-overlay     : rgba(0, 0, 0, 0.5);
    --ts-drw-shadow-b    : 0 -4px 32px rgba(0, 0, 0, 0.12), 0 -1px 4px rgba(0, 0, 0, 0.06);
    --ts-drw-shadow-t    : 0  4px 32px rgba(0, 0, 0, 0.12);
    --ts-drw-shadow-l    : 4px  0  32px rgba(0, 0, 0, 0.12);
    --ts-drw-shadow-r    : -4px 0  32px rgba(0, 0, 0, 0.12);
    --ts-drw-radius      : 1rem;
    --ts-drw-handle      : rgba(0, 0, 0, 0.18);
    --ts-drw-handle-hover: rgba(0, 0, 0, 0.30);
    --ts-drw-text-muted  : #6b7280;
    --ts-drw-max-h       : 85svh;
    --ts-drw-side-w      : min(380px, 85vw);
    --ts-drw-pad         : 1.5rem;
    --ts-drw-dur         : 320ms;
    --ts-drw-ease        : cubic-bezier(0.32, 0.72, 0, 1);
}


/* Root container */
.drawer-root {
    position  : fixed;
    inset     : 0;
    z-index   : 1060;
    isolation : isolate;

    &.drawer-hidden {
        display        : none;
        pointer-events : none;
        visibility     : hidden;
    }
}


/* Backdrop */
[data-drawer-backdrop] {
    position                : absolute;
    inset                   : 0;
    z-index                 : 0;
    background              : var(--ts-drw-overlay);
    backdrop-filter         : blur(2px);
    -webkit-backdrop-filter : blur(2px);
    opacity                 : 0;
    transition              : opacity var(--ts-drw-dur) ease;

    .drawer-open & {
        opacity : 1;
    }
}


/* Panel — shared base */
[data-drawer-panel] {
    position            : absolute;
    z-index             : 1;
    background          : var(--ts-drw-bg);
    overflow-y          : auto;
    overscroll-behavior : contain;
    transition          : transform var(--ts-drw-dur) var(--ts-drw-ease);
    will-change         : transform;
    scrollbar-width     : thin;

    &::-webkit-scrollbar       { width: 4px; }
    &::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.18); border-radius: 2px; }
}


/* Bottom drawer */
.drawer-bottom [data-drawer-panel] {
    bottom        : 0;
    left          : 0;
    right         : 0;
    max-height    : var(--ts-drw-max-h);
    border-radius : var(--ts-drw-radius) var(--ts-drw-radius) 0 0;
    box-shadow    : var(--ts-drw-shadow-b);
    padding       : 0 var(--ts-drw-pad) calc(var(--ts-drw-pad) + env(safe-area-inset-bottom, 0px));
    transform     : translateY(100%);
}
.drawer-bottom.drawer-open [data-drawer-panel] { transform: translateY(0); }


/* Top drawer */
.drawer-top [data-drawer-panel] {
    top           : 0;
    left          : 0;
    right         : 0;
    max-height    : var(--ts-drw-max-h);
    border-radius : 0 0 var(--ts-drw-radius) var(--ts-drw-radius);
    box-shadow    : var(--ts-drw-shadow-t);
    padding       : calc(var(--ts-drw-pad) + env(safe-area-inset-top, 0px)) var(--ts-drw-pad) 0;
    transform     : translateY(-100%);
}
.drawer-top.drawer-open [data-drawer-panel] { transform: translateY(0); }


/* Left drawer */
.drawer-left [data-drawer-panel] {
    top           : 0;
    left          : 0;
    bottom        : 0;
    height        : 100%;
    width         : var(--ts-drw-side-w);
    border-radius : 0 var(--ts-drw-radius) var(--ts-drw-radius) 0;
    box-shadow    : var(--ts-drw-shadow-l);
    padding       : calc(var(--ts-drw-pad) + env(safe-area-inset-top, 0px))
                    var(--ts-drw-pad)
                    calc(var(--ts-drw-pad) + env(safe-area-inset-bottom, 0px))
                    calc(var(--ts-drw-pad) + env(safe-area-inset-left, 0px));
    transform     : translateX(-100%);
}
.drawer-left.drawer-open [data-drawer-panel] { transform: translateX(0); }


/* Right drawer */
.drawer-right [data-drawer-panel] {
    top           : 0;
    right         : 0;
    bottom        : 0;
    height        : 100%;
    width         : var(--ts-drw-side-w);
    border-radius : var(--ts-drw-radius) 0 0 var(--ts-drw-radius);
    box-shadow    : var(--ts-drw-shadow-r);
    padding       : calc(var(--ts-drw-pad) + env(safe-area-inset-top, 0px))
                    calc(var(--ts-drw-pad) + env(safe-area-inset-right, 0px))
                    calc(var(--ts-drw-pad) + env(safe-area-inset-bottom, 0px))
                    var(--ts-drw-pad);
    transform     : translateX(100%);
}
.drawer-right.drawer-open [data-drawer-panel] { transform: translateX(0); }


/* Drag handle — renders as a sticky full-width bar with a centred pill */
[data-drawer-handle] {
    display             : flex;
    align-items         : center;
    justify-content     : center;
    width               : auto;
    background          : var(--ts-drw-bg);
    cursor              : grab;
    touch-action        : none;
    user-select         : none;
    -webkit-user-select : none;
    flex-shrink         : 0;

    &::before {
        content       : '';
        display       : block;
        width         : 48px;
        height        : 4px;
        background    : var(--ts-drw-handle);
        border-radius : 2px;
        transition    : background 0.15s ease;
    }

    &:hover::before { background: var(--ts-drw-handle-hover); }
    &:active        { cursor: grabbing; }
    &:active::before{ background: var(--ts-drw-handle-hover); }
}

/* Bottom drawer handle — sticky top strip */
.drawer-bottom [data-drawer-handle] {
    position  : sticky;
    top       : 0;
    z-index   : 2;
    padding   : 0.875rem 0;
    /* bleed to panel edges so the bg fills edge-to-edge */
    margin    : 0 calc(var(--ts-drw-pad) * -1);
}

/* Top drawer handle — sticky bottom strip */
.drawer-top [data-drawer-handle] {
    position  : sticky;
    bottom    : 0;
    z-index   : 2;
    padding   : 0.875rem 0;
    margin    : 0 calc(var(--ts-drw-pad) * -1);
}

/* Side drawers — no visual handle (backdrop / close button preferred) */
.drawer-left  [data-drawer-handle],
.drawer-right [data-drawer-handle] {
    display : none;
}


/* Typography helpers */
[data-drawer-title] {
    font-size    : 1.25rem;
    font-weight  : 600;
    line-height  : 1.3;
    margin-top   : 0;
    margin-bottom: 0.5rem;
    color        : inherit;
}

[data-drawer-description] {
    font-size    : 0.9375rem;
    color        : var(--ts-drw-text-muted);
    margin-bottom: 1.5rem;
    line-height  : 1.5;
}


/* Scroll-lock utility — shared with PluginDialog; redundant definition is harmless */
body.ts-scroll-lock {
    overflow      : hidden;
    padding-right : var(--ts-scrollbar-width, 0px);
}


/* Dark mode — tier 1: system preference */
@media (prefers-color-scheme: dark) {
    :root {
        --ts-drw-bg          : #1e2939;
        --ts-drw-overlay     : rgba(0, 0, 0, 0.70);
        --ts-drw-shadow-b    : 0 -4px 32px rgba(0, 0, 0, 0.45);
        --ts-drw-shadow-t    : 0  4px 32px rgba(0, 0, 0, 0.45);
        --ts-drw-shadow-l    : 4px  0  32px rgba(0, 0, 0, 0.45);
        --ts-drw-shadow-r    : -4px 0  32px rgba(0, 0, 0, 0.45);
        --ts-drw-handle      : rgba(255, 255, 255, 0.22);
        --ts-drw-handle-hover: rgba(255, 255, 255, 0.38);
        --ts-drw-text-muted  : #9ca3af;
    }

    [data-drawer-panel]::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
    }
}

/* Dark mode — tier 2: explicit class/attribute */
html.dark,
[data-bs-theme="dark"] {
    --ts-drw-bg          : #1e2939;
    --ts-drw-overlay     : rgba(0, 0, 0, 0.70);
    --ts-drw-shadow-b    : 0 -4px 32px rgba(0, 0, 0, 0.45);
    --ts-drw-shadow-t    : 0  4px 32px rgba(0, 0, 0, 0.45);
    --ts-drw-shadow-l    : 4px  0  32px rgba(0, 0, 0, 0.45);
    --ts-drw-shadow-r    : -4px 0  32px rgba(0, 0, 0, 0.45);
    --ts-drw-handle      : rgba(255, 255, 255, 0.22);
    --ts-drw-handle-hover: rgba(255, 255, 255, 0.38);
    --ts-drw-text-muted  : #9ca3af;
}

html.dark [data-drawer-panel]::-webkit-scrollbar-thumb,
[data-bs-theme="dark"] [data-drawer-panel]::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
}

/* Dark mode — tier 3: explicit light override */
[data-bs-theme="light"] {
    --ts-drw-bg          : #ffffff;
    --ts-drw-overlay     : rgba(0, 0, 0, 0.50);
    --ts-drw-shadow-b    : 0 -4px 32px rgba(0, 0, 0, 0.12), 0 -1px 4px rgba(0, 0, 0, 0.06);
    --ts-drw-shadow-t    : 0  4px 32px rgba(0, 0, 0, 0.12);
    --ts-drw-shadow-l    : 4px  0  32px rgba(0, 0, 0, 0.12);
    --ts-drw-shadow-r    : -4px 0  32px rgba(0, 0, 0, 0.12);
    --ts-drw-handle      : rgba(0, 0, 0, 0.18);
    --ts-drw-handle-hover: rgba(0, 0, 0, 0.30);
    --ts-drw-text-muted  : #6b7280;
}


/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
    [data-drawer-backdrop],
    [data-drawer-panel] {
        transition-duration : 0.01ms !important;
    }
}`;

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = CSS_TEXT;
        (document.head || document.documentElement).appendChild(style);
    }

    class PluginDrawer {
        constructor($el, opts) {
            return this.initialize($el, opts);
        }

        initialize($el, opts) {
            if ($el.data(instanceName)) {
                return this;
            }

            this.$el            = $el;
            this.$panel         = null;
            this.$backdrop      = null;
            this.$handle        = null;
            this.$previousFocus = null;
            this.isOpen         = false;
            this._uid           = uid('drawer');
            this._drag          = null;
            this._closeTimer    = null;

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
            this.options = $.extend(true, {}, PluginDrawer.defaults, opts, {
                wrapper: this.$el,
            });
            return this;
        }

        build() {
            injectStyles();

            const self = this;
            const $el  = self.$el;
            const opts = self.options;
            const dir  = opts.direction;

            // ARIA role and modal flag
            if (!$el.attr('role')) $el.attr('role', 'dialog');
            $el.attr('aria-modal', 'true');

            // Auto-wire title → aria-labelledby
            const $title = $el.find('[data-drawer-title]').first();
            if ($title.length && !$el.attr('aria-labelledby')) {
                const id = $title.attr('id') || uid('drawer-title');
                $title.attr('id', id);
                $el.attr('aria-labelledby', id);
            }

            // Auto-wire description → aria-describedby
            const $desc = $el.find('[data-drawer-description]').first();
            if ($desc.length && !$el.attr('aria-describedby')) {
                const id = $desc.attr('id') || uid('drawer-desc');
                $desc.attr('id', id);
                $el.attr('aria-describedby', id);
            }

            // Backdrop — auto-inject when missing
            if (opts.backdrop) {
                self.$backdrop = $el.find('[data-drawer-backdrop]');
                if (!self.$backdrop.length) {
                    self.$backdrop = $('<div data-drawer-backdrop></div>');
                    $el.prepend(self.$backdrop);
                }
            }

            // Panel
            self.$panel = $el.find('[data-drawer-panel]');

            // Handle — auto-inject for bottom/top; left/right have no grab handle by default
            if (opts.showHandle && (dir === 'bottom' || dir === 'top')) {
                self.$handle = $el.find('[data-drawer-handle]');
                if (!self.$handle.length) {
                    self.$handle = $('<div data-drawer-handle role="presentation"></div>');
                    if (dir === 'bottom') {
                        self.$panel.prepend(self.$handle);
                    } else {
                        // Top drawer: handle belongs at the bottom of the panel
                        self.$panel.append(self.$handle);
                    }
                }
            }

            // Direction and root classes
            $el
                .addClass(`drawer-root drawer-${dir}`)
                .attr('aria-hidden', 'true')
                .attr('tabindex', '-1');

            if (!$el.hasClass('drawer-is-open')) {
                $el.addClass('drawer-hidden');
            }

            return this;
        }

        events() {
            const self     = this;
            const $el      = self.$el;
            const opts     = self.options;
            const drawerId = $el.attr('id');

            // External open triggers
            if (drawerId) {
                $(document).on(
                    `click.drawer.${self._uid}`,
                    `[data-drawer-open="${drawerId}"]`,
                    function (e) {
                        e.preventDefault();
                        self.open();
                    }
                );
            }

            // Internal close triggers
            $el.on('click.drawer', '[data-drawer-close]', function (e) {
                e.preventDefault();
                self.close();
            });

            // Backdrop click
            if (opts.closeOnBackdrop && self.$backdrop && self.$backdrop.length) {
                $el.on('click.drawer.backdrop', function (e) {
                    if ($(e.target).is('[data-drawer-backdrop]')) {
                        self.close();
                    }
                });
            }

            // Escape key
            if (opts.closeOnEscape) {
                $(document).on(`keydown.drawer.${self._uid}`, function (e) {
                    if (self.isOpen && (e.key === 'Escape' || e.keyCode === 27)) {
                        e.preventDefault();
                        self.close();
                    }
                });
            }

            // Drag to dismiss (handle only; avoids interfering with panel scroll)
            if (opts.draggable && self.$handle && self.$handle.length) {
                self._bindDrag();
            }

            return this;
        }

        _bindDrag() {
            const self     = this;
            const $el      = self.$el;
            const $panel   = self.$panel;
            const opts     = self.options;
            const dir      = opts.direction;
            const handleEl = self.$handle[0];
            const isVert   = dir === 'bottom' || dir === 'top';

            handleEl.addEventListener('pointerdown', function (e) {
                if (!self.isOpen) return;

                // Capture so pointermove/up keep firing even outside the handle
                handleEl.setPointerCapture(e.pointerId);

                self._drag = {
                    startX  : e.clientX,
                    startY  : e.clientY,
                    lastX   : e.clientX,
                    lastY   : e.clientY,
                    lastTime: Date.now(),
                    velocity: 0,
                    delta   : 0,
                };

                // Disable CSS transition while dragging for a 1:1 feel
                $panel.css('transition', 'none');
            });

            handleEl.addEventListener('pointermove', function (e) {
                if (!self._drag) return;

                const d   = self._drag;
                const now = Date.now();
                const dt  = now - d.lastTime;

                // Raw displacement from the drag origin
                let raw = isVert ? (e.clientY - d.startY) : (e.clientX - d.startX);

                // Clamp: only allow movement toward the dismiss edge
                if (dir === 'bottom' && raw < 0) raw = 0;
                if (dir === 'top'    && raw > 0) raw = 0;

                d.delta = raw;

                // Instantaneous velocity in px/ms
                if (dt > 0) {
                    d.velocity = isVert
                        ? (e.clientY - d.lastY) / dt
                        : (e.clientX - d.lastX) / dt;
                }

                d.lastX    = e.clientX;
                d.lastY    = e.clientY;
                d.lastTime = now;

                $panel.css('transform', isVert
                    ? `translateY(${raw}px)`
                    : `translateX(${raw}px)`
                );
            });

            handleEl.addEventListener('pointerup', function () {
                if (!self._drag) return;

                const d        = self._drag;
                const absDelta = Math.abs(d.delta);
                const absVel   = Math.abs(d.velocity);
                const size     = isVert ? $panel.outerHeight() : $panel.outerWidth();

                self._drag = null;

                // Re-enable CSS transition
                $panel.css('transition', '');

                const shouldClose = absDelta > size * opts.dragThreshold
                                 || absVel   > opts.velocityThreshold;

                if (shouldClose) {
                    // Continue animating from the current drag position to fully off-screen.
                    // The panel already has an inline transform from the drag — the transition
                    // will now run from there to the destination.
                    const sign = (dir === 'bottom') ? 1 : -1;
                    const dest = isVert
                        ? `translateY(${sign * size}px)`
                        : `translateX(${sign * size}px)`;

                    $panel.css('transform', dest);

                    // Fade the backdrop out in sync by removing drawer-open
                    $el.removeClass('drawer-open');

                    // Schedule DOM cleanup after the transition finishes
                    clearTimeout(self._closeTimer);
                    self._closeTimer = setTimeout(() => {
                        self._finishClose();
                    }, opts.transitionDuration + 50);

                } else {
                    // Snap the panel back to the fully-open position
                    $panel.css('transform', '');
                }
            });

            handleEl.addEventListener('pointercancel', function () {
                if (!self._drag) return;
                self._drag = null;
                $panel.css({ transition: '', transform: '' });
            });
        }

        open() {
            const self = this;
            const $el  = self.$el;
            const opts = self.options;

            if (self.isOpen) return this;
            self.isOpen = true;

            // Cancel any pending close-cleanup from a prior close() call
            clearTimeout(self._closeTimer);

            // Clear any leftover inline transform from a drag-dismiss
            self.$panel.css('transform', '');

            self.$previousFocus = $(document.activeElement);

            if (opts.scrollLock) {
                $('body').addClass('ts-scroll-lock');
            }

            // Step 1 — reveal the root (removes display:none)
            $el
                .removeClass('drawer-hidden')
                .addClass('drawer-is-open')
                .attr('aria-hidden', 'false');

            // Step 2 — force a reflow so the browser registers the display change
            //          before the transition-triggering class is added
            void $el[0].offsetHeight;

            // Step 3 — add drawer-open; the CSS transition fires
            $el.addClass('drawer-open');

            // Move focus into the drawer after the transition has started
            setTimeout(() => self._focusFirst(), 50);

            // Focus trap
            $el.on('keydown.drawer.trap', (e) => {
                if (e.key === 'Tab' || e.keyCode === 9) {
                    self._trapFocus(e);
                }
            });

            if (typeof opts.onOpen === 'function') opts.onOpen.call(self, $el);
            $el.trigger('drawer:open', [self]);

            return this;
        }

        close() {
            const self = this;
            const $el  = self.$el;
            const opts = self.options;

            if (!self.isOpen) return this;

            $el.off('keydown.drawer.trap');

            // Remove drawer-open — CSS transition slides the panel back off-screen
            // and fades the backdrop out simultaneously
            $el.removeClass('drawer-open');

            // Schedule DOM cleanup after the transition completes
            clearTimeout(self._closeTimer);
            self._closeTimer = setTimeout(() => {
                self._finishClose();
            }, opts.transitionDuration + 50);

            return this;
        }

        toggle() {
            return this.isOpen ? this.close() : this.open();
        }

        _finishClose() {
            const self = this;
            const $el  = self.$el;
            const opts = self.options;

            // Guard: open() may have been called during the close transition
            if (!self.isOpen) return;
            self.isOpen = false;

            // Clear any inline transform set by a drag-dismiss
            self.$panel.css('transform', '');

            $el
                .addClass('drawer-hidden')
                .removeClass('drawer-is-open')
                .attr('aria-hidden', 'true');

            if (opts.scrollLock) {
                $('body').removeClass('ts-scroll-lock');
            }

            // Restore focus to the element that triggered the open
            if (self.$previousFocus && self.$previousFocus.length) {
                self.$previousFocus.trigger('focus');
                self.$previousFocus = null;
            }

            if (typeof opts.onClose === 'function') opts.onClose.call(self, $el);
            $el.trigger('drawer:close', [self]);
        }

        _focusFirst() {
            const focusable = this._focusable();
            if (focusable.length) {
                focusable.first().trigger('focus');
            } else {
                this.$el.trigger('focus');
            }
        }

        _trapFocus(e) {
            const focusable = this._focusable();
            if (!focusable.length) return;

            const $first   = focusable.first();
            const $last    = focusable.last();
            const $current = $(document.activeElement);

            if (e.shiftKey) {
                if ($current.is($first)) {
                    e.preventDefault();
                    $last.trigger('focus');
                }
            } else {
                if ($current.is($last)) {
                    e.preventDefault();
                    $first.trigger('focus');
                }
            }
        }

        _focusable() {
            return this.$el.find(FOCUSABLE).filter(':visible').not('[data-drawer-backdrop]');
        }

        destroy() {
            const self = this;
            const $el  = self.$el;

            clearTimeout(self._closeTimer);

            if (self.isOpen) {
                self.isOpen = false;
                $('body').removeClass('ts-scroll-lock');
            }

            $(document).off(`click.drawer.${self._uid}`);
            $(document).off(`keydown.drawer.${self._uid}`);
            $el.off('.drawer');

            $el
                .removeData(instanceName)
                .removeAttr('role aria-modal aria-hidden aria-labelledby aria-describedby tabindex')
                .removeClass('drawer-root drawer-hidden drawer-is-open drawer-open drawer-bottom drawer-top drawer-left drawer-right');

            return this;
        }
    }

    PluginDrawer.defaults = {
        direction         : 'bottom',  // 'bottom' | 'top' | 'left' | 'right'
        closeOnBackdrop   : true,      // close when [data-drawer-backdrop] is clicked
        closeOnEscape     : true,      // close on Escape key
        backdrop          : true,      // ensure a [data-drawer-backdrop] element exists
        scrollLock        : true,      // add .ts-scroll-lock to <body> while open
        showHandle        : true,      // auto-inject drag handle for bottom/top drawers
        draggable         : true,      // enable drag-to-dismiss via the handle
        dragThreshold     : 0.4,       // dismiss if drag displacement > 40% of panel size
        velocityThreshold : 0.5,       // dismiss if swipe velocity exceeds 0.5 px/ms
        transitionDuration: 320,       // ms — must match --ts-drw-dur
        onOpen            : null,      // callback($el) — fires after open transition starts
        onClose           : null,      // callback($el) — fires after close transition ends
    };

    $.extend(themestrap, { PluginDrawer });

    $.fn.themestrapPluginDrawer = function (opts) {
        return this.map(function () {
            const $this = $(this);
            if ($this.data(instanceName)) {
                return $this.data(instanceName);
            }
            return new PluginDrawer($this, opts);
        });
    };

})).apply(this, [window.themestrap, jQuery]);
