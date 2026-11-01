// Loading Overlay
(((themestrap = {}, $) => {

    const instanceName = '__pluginLoadingOverlay';

    const STYLE_ID = 'ts-loading-overlay-styles';
    if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
/* PluginLoadingOverlay */

/* Host positioning context (added to non-body hosts) */
.ts-lo-host { position: relative; }

body.ts-scroll-lock {
    overflow: hidden;
    /* Prevent layout shift from scrollbar disappearing */
    padding-right: var(--ts-scrollbar-width, 0px);
}

/* Overlay shell */
.ts-lo-overlay {
    --ts-lo-color:    #e8672a;
    --ts-lo-z:        9000;
    --ts-lo-size:     48px;
    --ts-lo-duration: 800ms;
    --ts-lo-fade:     200ms;

    position: absolute;
    inset: 0;
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--ts-lo-bg, var(--ts-lo-bg-default, rgba(255, 255, 255, 0.92)));
    z-index: var(--ts-lo-z);
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--ts-lo-fade) ease;
}

.ts-lo-overlay.is-visible {
    opacity: 1;
    pointer-events: auto;
}

/* Three-tier dark mode — media query first, then explicit classes */
@media (prefers-color-scheme: dark) {
    .ts-lo-overlay { --ts-lo-bg-default: rgba(14, 34, 56, 0.92); }
}
html.dark .ts-lo-overlay,
[data-bs-theme="dark"] .ts-lo-overlay { --ts-lo-bg-default: rgba(14, 34, 56, 0.92); }
[data-bs-theme="light"] .ts-lo-overlay { --ts-lo-bg-default: rgba(255, 255, 255, 0.92); }

/* Inner layout */
.ts-lo-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: .75rem;
    padding: 1.5rem;
}

/* Generic anim container — type styles override width/height as needed */
.ts-lo-anim {
    color: var(--ts-lo-color);
    width: var(--ts-lo-size);
    height: var(--ts-lo-size);
}

/* Message */
.ts-lo-message {
    margin: 0;
    font-size: .875rem;
    line-height: 1.45;
    color: inherit;
    text-align: center;
    max-width: 220px;
}

/* Progress */
.ts-lo-progress-track {
    width: 160px;
    height: 4px;
    background: rgba(128, 128, 128, 0.25);
    border-radius: 2px;
    overflow: hidden;
}

.ts-lo-progress-bar {
    height: 100%;
    width: 0%;
    background: var(--ts-lo-color);
    border-radius: 2px;
    transition: width .25s ease;
}

/* Keyframes */
@keyframes ts-lo-spin {
    to { transform: rotate(360deg); }
}

@keyframes ts-lo-pulse {
    0%, 100% { transform: scale(0.6); opacity: 0.5; }
    50%       { transform: scale(1);   opacity: 1;   }
}

@keyframes ts-lo-ripple {
    0%   { transform: scale(0.1); opacity: 0.8; }
    100% { transform: scale(1);   opacity: 0;   }
}

@keyframes ts-lo-bounce {
    0%, 80%, 100% { transform: scale(0.55); opacity: 0.45; }
    40%           { transform: scale(1);    opacity: 1;    }
}

@keyframes ts-lo-bars {
    0%, 40%, 100% { transform: scaleY(0.3); opacity: 0.4; }
    20%           { transform: scaleY(1);   opacity: 1;   }
}

/* Spinner */
.ts-lo--spinner .ts-lo-anim {
    border-radius: 50%;
    border: calc(var(--ts-lo-size) * 0.1) solid currentColor;
    border-right-color: transparent;
    animation: ts-lo-spin var(--ts-lo-duration) linear infinite;
}

/* Ring (dual-arc) */
.ts-lo--ring .ts-lo-anim {
    border-radius: 50%;
    border: calc(var(--ts-lo-size) * 0.1) solid transparent;
    border-top-color: currentColor;
    border-bottom-color: currentColor;
    animation: ts-lo-spin calc(var(--ts-lo-duration) * 1.25) linear infinite;
}

/* Pulse */
.ts-lo--pulse .ts-lo-anim {
    border-radius: 50%;
    background: currentColor;
    animation: ts-lo-pulse var(--ts-lo-duration) ease-in-out infinite;
}

/* Ripple (two expanding rings) */
.ts-lo--ripple .ts-lo-anim {
    position: relative;
}

.ts-lo--ripple .ts-lo-anim::before,
.ts-lo--ripple .ts-lo-anim::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: calc(var(--ts-lo-size) * 0.08) solid currentColor;
    animation: ts-lo-ripple var(--ts-lo-duration) ease-out infinite;
    opacity: 0;
}

.ts-lo--ripple .ts-lo-anim::after {
    animation-delay: calc(var(--ts-lo-duration) * -0.5);
}

/* Dots (three bouncing dots) */
.ts-lo--dots .ts-lo-anim {
    display: flex;
    align-items: center;
    gap: calc(var(--ts-lo-size) * 0.18);
    width: auto;
    height: auto;
}

.ts-lo--dots .ts-lo-dot {
    display: block;
    width: calc(var(--ts-lo-size) * 0.28);
    height: calc(var(--ts-lo-size) * 0.28);
    border-radius: 50%;
    background: currentColor;
    animation: ts-lo-bounce var(--ts-lo-duration) ease-in-out infinite;
}

.ts-lo--dots .ts-lo-dot:nth-child(2) { animation-delay: calc(var(--ts-lo-duration) * 0.16); }
.ts-lo--dots .ts-lo-dot:nth-child(3) { animation-delay: calc(var(--ts-lo-duration) * 0.32); }

/* Bars (five equalizer bars) */
.ts-lo--bars .ts-lo-anim {
    display: flex;
    align-items: flex-end;
    gap: calc(var(--ts-lo-size) * 0.1);
    width: auto;
    height: auto;
}

.ts-lo--bars .ts-lo-bar {
    display: block;
    width: calc(var(--ts-lo-size) * 0.15);
    height: var(--ts-lo-size);
    border-radius: 3px;
    background: currentColor;
    animation: ts-lo-bars var(--ts-lo-duration) ease-in-out infinite;
    transform-origin: bottom center;
}

.ts-lo--bars .ts-lo-bar:nth-child(2) { animation-delay: calc(var(--ts-lo-duration) * 0.10); }
.ts-lo--bars .ts-lo-bar:nth-child(3) { animation-delay: calc(var(--ts-lo-duration) * 0.20); }
.ts-lo--bars .ts-lo-bar:nth-child(4) { animation-delay: calc(var(--ts-lo-duration) * 0.30); }
.ts-lo--bars .ts-lo-bar:nth-child(5) { animation-delay: calc(var(--ts-lo-duration) * 0.40); }

/* Orbit (two dots orbiting a shared axis) */
.ts-lo--orbit .ts-lo-anim {
    position: relative;
    animation: ts-lo-spin var(--ts-lo-duration) linear infinite;
}

.ts-lo--orbit .ts-lo-anim::before,
.ts-lo--orbit .ts-lo-anim::after {
    content: '';
    position: absolute;
    width: calc(var(--ts-lo-size) * 0.24);
    height: calc(var(--ts-lo-size) * 0.24);
    border-radius: 50%;
    background: currentColor;
    left: 50%;
    transform: translateX(-50%);
}

.ts-lo--orbit .ts-lo-anim::before { top: 0; }
.ts-lo--orbit .ts-lo-anim::after  { bottom: 0; opacity: 0.4; }
`;
        document.head.appendChild(style);
    }

    class PluginLoadingOverlay {

        constructor($el, opts) {
            return this.initialize($el, opts);
        }

        initialize($el, opts) {
            if ($el.data(instanceName)) {
                return this;
            }

            this.$el = $el;

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
            this.options = $.extend(true, {}, PluginLoadingOverlay.defaults, opts, {
                wrapper: this.$el
            });
            return this;
        }

        build() {
            const self    = this;
            const $el     = self.$el;
            const options = self.options;

            self._isBody  = $el.is('body');
            self._visible = false;

            // Give non-body hosts a positioning context so the absolute overlay fits
            if (!self._isBody) {
                const pos = $el.css('position');
                if (!pos || pos === 'static') {
                    $el.addClass('ts-lo-host');
                }
            }

            // Build the overlay element
            const $overlay = $('<div>', {
                class        : 'ts-lo-overlay',
                role         : 'status',
                'aria-live'  : 'polite',
                'aria-label' : options.ariaLabel,
                'aria-busy'  : 'false'
            });

            // CSS custom property overrides (only applied when option is non-null)
            const cssVars = {
                '--ts-lo-z'       : options.zIndex,
                '--ts-lo-size'    : self._resolveSize(options.size),
                '--ts-lo-duration': options.duration + 'ms',
                '--ts-lo-fade'    : options.fadeDuration + 'ms'
            };

            if (options.color)    cssVars['--ts-lo-color'] = options.color;
            if (options.backdrop) cssVars['--ts-lo-bg']    = options.backdrop;

            $overlay.css(cssVars);

            // Body-level overlays use fixed positioning to fill the viewport
            if (self._isBody) {
                $overlay.css('position', 'fixed');
            }

            // Optional backdrop blur
            if (options.blur) {
                $overlay.css({
                    'backdrop-filter'         : 'blur(' + options.blur + 'px)',
                    '-webkit-backdrop-filter' : 'blur(' + options.blur + 'px)'
                });
            }

            // Inner content wrapper
            const $inner = $('<div class="ts-lo-inner"></div>');

            // Loader animation element
            self.$animWrap = $(self._buildAnimHtml(options.type));
            $inner.append(self.$animWrap);

            // Message element (hidden by default when no message provided)
            self.$message = $('<p class="ts-lo-message"></p>');
            if (options.message) {
                self.$message.text(options.message);
            } else {
                self.$message.css('display', 'none');
            }
            $inner.append(self.$message);

            // Optional progress bar
            if (options.progress) {
                const $track = $(
                    '<div class="ts-lo-progress-track">' +
                        '<div class="ts-lo-progress-bar" role="progressbar"' +
                        ' aria-valuemin="0" aria-valuemax="100"></div>' +
                    '</div>'
                );
                self.$progressBar = $track.find('.ts-lo-progress-bar');
                $inner.append($track);
                self.setProgress(options.progressValue);
            }

            $overlay.append($inner);
            $el.append($overlay);
            self.$overlay = $overlay;

            // Auto-show deferred one tick so display:none→flex doesn't kill the transition
            if (options.autoShow) {
                setTimeout(() => self.show(), 0);
            }

            return this;
        }

        events() {
            return this;
        }

        // Public API

        show() {
            const self    = this;
            const options = self.options;

            if (self._visible) return this;
            self._visible = true;

            self.$overlay.attr('aria-busy', 'true');

            // Lock body scroll when overlaying the full page
            if (self._isBody && options.scrollLock) {
                $('body').addClass('ts-scroll-lock');
            }

            // display:flex → force reflow → add transition class
            self.$overlay.css('display', 'flex');
            self.$overlay[0].offsetHeight; // eslint-disable-line no-unused-expressions
            self.$overlay.addClass('is-visible');

            self.$el[0].dispatchEvent(new CustomEvent('show.ts.loadingoverlay', { bubbles: true }));

            clearTimeout(self._showTimer);
            self._showTimer = setTimeout(() => {
                self.$el[0].dispatchEvent(new CustomEvent('shown.ts.loadingoverlay', { bubbles: true }));
            }, options.fadeDuration);

            if (options.autoHide > 0) {
                clearTimeout(self._autoHideTimer);
                self._autoHideTimer = setTimeout(() => self.hide(), options.autoHide);
            }

            return this;
        }

        hide() {
            const self    = this;
            const options = self.options;

            if (!self._visible) return this;
            self._visible = false;

            clearTimeout(self._autoHideTimer);

            self.$overlay.removeClass('is-visible').attr('aria-busy', 'false');

            self.$el[0].dispatchEvent(new CustomEvent('hide.ts.loadingoverlay', { bubbles: true }));

            clearTimeout(self._hideTimer);
            self._hideTimer = setTimeout(() => {
                self.$overlay.css('display', '');

                if (self._isBody && options.scrollLock) {
                    $('body').removeClass('ts-scroll-lock');
                }

                self.$el[0].dispatchEvent(new CustomEvent('hidden.ts.loadingoverlay', { bubbles: true }));
            }, options.fadeDuration);

            return this;
        }

        toggle() {
            return this._visible ? this.hide() : this.show();
        }

        isVisible() {
            return !!this._visible;
        }

        /**
         * Update the message text at runtime.
         * Pass an empty string to hide the message element.
         * @param {string} msg
         */
        setMessage(msg) {
            this.options.message = msg;
            if (this.$message) {
                this.$message.text(msg).css('display', msg ? '' : 'none');
            }
            return this;
        }

        /**
         * Update the progress bar value (0–100).
         * Has no effect if the plugin was not initialized with progress:true.
         * @param {number} value
         */
        setProgress(value) {
            const pct = Math.min(100, Math.max(0, Number(value) || 0));
            this.options.progressValue = pct;
            if (this.$progressBar) {
                this.$progressBar.css('width', pct + '%').attr('aria-valuenow', pct);
            }
            return this;
        }

        /**
         * Swap the loader animation type at runtime.
         * @param {string} type — one of: spinner | ring | pulse | ripple | dots | bars | orbit
         */
        setType(type) {
            const $new = $(this._buildAnimHtml(type));
            if (this.$animWrap) {
                this.$animWrap.replaceWith($new);
            }
            this.$animWrap    = $new;
            this.options.type = type;
            return this;
        }

        /**
         * Change the loader size at runtime.
         * @param {string} size — 'sm' | 'md' | 'lg' or any CSS length value
         */
        setSize(size) {
            this.$overlay.css('--ts-lo-size', this._resolveSize(size));
            this.options.size = size;
            return this;
        }

        /**
         * Change the loader/message color at runtime.
         * Pass null to revert to the CSS default.
         * @param {string|null} color
         */
        setColor(color) {
            if (color) {
                this.$overlay.css('--ts-lo-color', color);
            } else {
                this.$overlay[0].style.removeProperty('--ts-lo-color');
            }
            this.options.color = color;
            return this;
        }

        /**
         * Change the overlay backdrop color at runtime.
         * Pass null to revert to the CSS default (dark-mode aware).
         * @param {string|null} color
         */
        setBackdrop(color) {
            if (color) {
                this.$overlay.css('--ts-lo-bg', color);
            } else {
                this.$overlay[0].style.removeProperty('--ts-lo-bg');
            }
            this.options.backdrop = color;
            return this;
        }

        destroy() {
            const self = this;

            clearTimeout(self._showTimer);
            clearTimeout(self._hideTimer);
            clearTimeout(self._autoHideTimer);

            if (self.$overlay) {
                self.$overlay.remove();
            }

            // Release body scroll lock if we were the one holding it
            if (self._isBody && self._visible && self.options.scrollLock) {
                $('body').removeClass('ts-scroll-lock');
            }

            self.$el
                .removeClass('ts-lo-host')
                .removeData(instanceName);

            return this;
        }

        _resolveSize(size) {
            const map = { sm: '32px', md: '48px', lg: '64px' };
            return map[size] || String(size);
        }

        _buildAnimHtml(type) {
            let inner = '';
            if (type === 'dots') {
                inner =
                    '<span class="ts-lo-dot"></span>' +
                    '<span class="ts-lo-dot"></span>' +
                    '<span class="ts-lo-dot"></span>';
            } else if (type === 'bars') {
                inner =
                    '<span class="ts-lo-bar"></span>' +
                    '<span class="ts-lo-bar"></span>' +
                    '<span class="ts-lo-bar"></span>' +
                    '<span class="ts-lo-bar"></span>' +
                    '<span class="ts-lo-bar"></span>';
            }
            return '<div class="ts-lo--' + type + '"><div class="ts-lo-anim">' + inner + '</div></div>';
        }

    }

    PluginLoadingOverlay.defaults = {
        /** Animation type: 'spinner' | 'ring' | 'pulse' | 'ripple' | 'dots' | 'bars' | 'orbit' */
        type         : 'spinner',

        /** Text label rendered below the animation. Empty string hides the message element. */
        message      : '',

        /** aria-label applied to the overlay element for screen readers. */
        ariaLabel    : 'Loading',

        /**
         * Overlay background color.
         * Accepts any CSS <color> string. null defers to the built-in CSS default,
         * which adapts automatically to dark / light mode.
         */
        backdrop     : null,

        /**
         * Loader and message text color.
         * null uses the built-in CSS default (#e8672a).
         */
        color        : null,

        /** Loader animation element size. 'sm' = 32px, 'md' = 48px, 'lg' = 64px, or any CSS length. */
        size         : 'md',

        /** Loader animation cycle duration in milliseconds. */
        duration     : 800,

        /** Overlay fade-in / fade-out transition duration in milliseconds. */
        fadeDuration : 200,

        /** Backdrop blur in pixels (0 = disabled). Uses CSS backdrop-filter. */
        blur         : 0,

        /** When true the overlay is shown immediately after initialization. */
        autoShow     : false,

        /** Milliseconds after which the overlay automatically hides. 0 = never. */
        autoHide     : 0,

        /** When true a progress bar is rendered inside the overlay. */
        progress     : false,

        /** Initial progress bar value (0–100). Only meaningful when progress:true. */
        progressValue: 0,

        /**
         * When true and the host element is <body>, body overflow is hidden
         * while the overlay is visible to prevent background scrolling.
         */
        scrollLock   : true,

        /** CSS z-index applied to the overlay element. */
        zIndex       : 9000
    };

    $.extend(themestrap, { PluginLoadingOverlay });

    $.fn.themestrapPluginLoadingOverlay = function(opts) {
        return this.map(function() {
            const $this = $(this);
            if ($this.data(instanceName)) {
                return $this.data(instanceName);
            } else {
                return new PluginLoadingOverlay($this, opts);
            }
        });
    };

})).apply(this, [window.themestrap, jQuery]);
