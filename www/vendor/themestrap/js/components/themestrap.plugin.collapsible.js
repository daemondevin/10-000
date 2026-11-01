// Collapsible
(((themestrap = {}, $) => {

    const instanceName = '__pluginCollapsible';

    const STYLE_ID = 'ts-collapsible-styles';
    // CSS_TEXT is injected lazily by injectStyles() on first build (see below),
    // so loading this script never adds CSS to pages that don't use the plugin.
    const CSS_TEXT = `
/* Themestrap — PluginCollapsible */
.ts-collapsible {
    --ts-c-duration:  300ms;
    --ts-c-easing:    ease;
}

/* The outer clipping shell */
.ts-collapsible__content-shell {
    overflow: hidden;
    height: 0;
    transition: height var(--ts-c-duration) var(--ts-c-easing);
    will-change: height;
}

/*
 * IMPORTANT: when open, height must be 'auto' (not just overflow:visible)
 * so that clearing the JS inline style doesn't revert to the height:0 rule
 * above. The JS animates px→px then removes the inline style; CSS height:auto
 * takes over cleanly from there.
 */
.ts-collapsible--open > .ts-collapsible__content-shell {
    height: auto;
    overflow: visible;
}

/* Trigger chevron — rotates when open */
.ts-collapsible__trigger [data-collapsible-chevron] {
    display: inline-block;
    transition: transform var(--ts-c-duration) var(--ts-c-easing);
}

.ts-collapsible--open .ts-collapsible__trigger [data-collapsible-chevron] {
    transform: rotate(180deg);
}

/* Disabled state */
.ts-collapsible--disabled .ts-collapsible__trigger {
    cursor: not-allowed;
    opacity: 0.5;
    pointer-events: none;
}
`;

    // Inject the stylesheet only when the plugin is actually used (called
    // from build()), so loading the script never adds CSS to unused pages.
    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = CSS_TEXT;
        (document.head || document.documentElement).appendChild(style);
    }

    class PluginCollapsible {

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
            this.options = $.extend(true, {}, PluginCollapsible.defaults, opts, {
                wrapper: this.$el
            });
            return this;
        }

        build() {
            // Inject component CSS lazily - only when an instance is built.
            injectStyles();
            const self    = this;
            const $el     = self.$el;
            const options = self.options;

            $el.addClass('ts-collapsible');

            // CSS custom properties
            if (options.duration !== PluginCollapsible.defaults.duration) {
                $el.css('--ts-c-duration', options.duration);
            }
            if (options.easing !== PluginCollapsible.defaults.easing) {
                $el.css('--ts-c-easing', options.easing);
            }

            // Identify / validate trigger 
            self.$trigger = $el.find('[data-collapsible-trigger]').first();
            if (!self.$trigger.length) {
                // Fallback: first button/a inside root
                self.$trigger = $el.find('button, a').first();
            }
            self.$trigger.addClass('ts-collapsible__trigger');

            // Wrap content element
            self.$content = $el.find('[data-collapsible-content]').first();

            if (!self.$content.length) {
                // Nothing to collapse
                return this;
            }

            // Wrap with the clipping shell if not already done
            if (!self.$content.parent().hasClass('ts-collapsible__content-shell')) {
                self.$content.wrap('<div class="ts-collapsible__content-shell"></div>');
                self.$content.addClass('ts-collapsible__content-inner');
            }

            self.$shell = self.$content.parent();

            // Disabled state 
            if (options.disabled) {
                $el.addClass('ts-collapsible--disabled');
                self.$trigger.attr('aria-disabled', 'true');
            }

            // Instant init — no animation
            self._setOpen(options.defaultOpen, false);

            return this;
        }

        events() {
            const self = this;

            self.$trigger.on('click.collapsible', function(e) {
                e.preventDefault();
                if (self.options.disabled) return;
                self.toggle();
            });

            // Keyboard: Space / Enter on non-button triggers
            self.$trigger.on('keydown.collapsible', function(e) {
                if (e.key === ' ' || e.key === 'Enter') {
                    if ($(this).is('button')) return; // browser fires click natively
                    e.preventDefault();
                    if (!self.options.disabled) self.toggle();
                }
            });

            return this;
        }

        /**
         * Opens the collapsible.
         * @returns {PluginCollapsible}
         */
        open() {
            this._setOpen(true, true);
            return this;
        }

        /**
         * Closes the collapsible.
         * @returns {PluginCollapsible}
         */
        close() {
            this._setOpen(false, true);
            return this;
        }

        /**
         * Toggles the collapsible between open and closed.
         * @returns {PluginCollapsible}
         */
        toggle() {
            return this._isOpen ? this.close() : this.open();
        }

        /**
         * Returns true if the collapsible is currently open.
         * @returns {boolean}
         */
        isOpen() {
            return !!this._isOpen;
        }

        /**
         * Enables or disables the trigger without destroying the instance.
         * @param {boolean} state
         * @returns {PluginCollapsible}
         */
        setDisabled(state) {
            this.options.disabled = !!state;
            this.$el.toggleClass('ts-collapsible--disabled', this.options.disabled);
            this.$trigger.attr('aria-disabled', this.options.disabled ? 'true' : null);
            return this;
        }

        destroy() {
            const self = this;

            self.$trigger.off('.collapsible');

            // Unwrap the shell
            if (self.$shell && self.$shell.length) {
                self.$content.unwrap();
            }

            self.$el
                .removeClass('ts-collapsible ts-collapsible--open ts-collapsible--disabled')
                .css({ '--ts-c-duration': '', '--ts-c-easing': '' });

            if (self.$trigger) {
                self.$trigger
                    .removeClass('ts-collapsible__trigger')
                    .removeAttr('aria-expanded aria-controls aria-disabled');
            }

            if (self.$content) {
                self.$content.removeClass('ts-collapsible__content-inner');
            }

            self.$el.removeData(instanceName);

            return this;
        }

        /**
         * Core open/close state machine.
         *
         * @param {boolean} open    — desired state
         * @param {boolean} animate — whether to run the height transition
         */
        _setOpen(open, animate) {
            const self     = this;
            const $el      = self.$el;
            const $shell   = self.$shell;
            const $content = self.$content;

            if (!$shell || !$shell.length) return;

            // Cancel any in-flight animation
            clearTimeout(self._timer);

            const duration = self._parseDuration(self.options.duration);
            if (open) {
                // OPENING
                self._isOpen = true;
                $el.addClass('ts-collapsible--open');
                self.$trigger
                    .attr('aria-expanded', 'true')
                    .attr('aria-controls', $content.attr('id') || null);

                if (animate) {
                    //
                    // 1. Temporarily suppress the CSS height:auto rule so we can
                    //    animate from 0 → measured px. We do this by locking the
                    //    shell at 0 with an inline style (inline beats the class).
                    //
                    $shell.css({ overflow: 'hidden', height: '0px' });

                    // 2. Measure the natural height of the inner content.
                    const targetH = $content[0].scrollHeight;

                    // 3. Force a reflow so the browser registers the 0px baseline
                    //    before we change it (otherwise no transition fires).
                    $shell[0].offsetHeight; // eslint-disable-line no-unused-expressions

                    // 4. Animate to target height.
                    $shell.css('height', targetH + 'px');

                    $el.trigger('open.ts.collapsible');

                    // 5. After the transition, clear the inline style.
                    //    Because .ts-collapsible--open > .ts-collapsible__content-shell
                    //    has { height: auto; overflow: visible }, the shell now
                    //    sits at auto — not at 0 — so the content stays visible.
                    self._timer = setTimeout(() => {
                        $shell.css({ height: '', overflow: '' });
                        $el.trigger('opened.ts.collapsible');
                    }, duration);

                } else {
                    // Instant open: clear inline styles; CSS height:auto takes over.
                    $shell.css({ height: '', overflow: '' });
                }

            } else {
                // CLOSING 
                self._isOpen = false;
                self.$trigger.attr('aria-expanded', 'false');

                if (animate) {
                    //
                    // 1. The shell may currently be at height:auto (CSS rule from
                    //    --open class). We cannot transition auto → 0, so we must
                    //    first lock it to a pixel value.
                    //
                    //    scrollHeight gives the full inner height regardless of
                    //    current overflow/height values.
                    //
                    const currentH = $shell[0].scrollHeight;

                    // 2. Pin to px (inline style beats the CSS height:auto rule).
                    $shell.css({ overflow: 'hidden', height: currentH + 'px' });

                    // 3. Remove --open class NOW so the CSS height:auto rule no
                    //    longer fights our inline style during the transition.
                    $el.removeClass('ts-collapsible--open');

                    // 4. Force reflow so the browser sees currentH before we move.
                    $shell[0].offsetHeight; // eslint-disable-line no-unused-expressions

                    // 5. Animate to 0.
                    $shell.css('height', '0');

                    $el.trigger('close.ts.collapsible');

                    self._timer = setTimeout(() => {
                        // Inline overflow:hidden is now redundant (CSS height:0 on
                        // the shell rule handles clipping), but we clear it cleanly.
                        $shell.css('overflow', '');
                        $el.trigger('closed.ts.collapsible');
                    }, duration);

                } else {
                    // Instant close.
                    $shell.css({ height: '0', overflow: '' });
                    $el.removeClass('ts-collapsible--open');
                }
            }

            $el.trigger('change.ts.collapsible', [open]);
        }

        /**
         * Converts a CSS duration string like '300ms' or '0.3s' to milliseconds.
         * @param {string} str
         * @returns {number}
         */
        _parseDuration(str) {
            if (typeof str === 'number') return str;
            if (!str) return 300;
            const s = str.trim();
            if (s.endsWith('ms')) return parseFloat(s);
            if (s.endsWith('s'))  return parseFloat(s) * 1000;
            return parseFloat(s) || 300;
        }

    }

    PluginCollapsible.defaults = {
        /**
         * Whether the collapsible is open on initialization.
         */
        defaultOpen: false,

        /**
         * When true the trigger is inert and the panel cannot be toggled.
         */
        disabled: false,

        /**
         * Height-transition duration. Accepts any CSS <time> string ('300ms',
         * '0.3s') or a plain millisecond number (300). Maps to --ts-c-duration.
         */
        duration: '300ms',

        /**
         * CSS easing for the height transition. Maps to --ts-c-easing.
         */
        easing: 'ease'
    };

    $.extend(themestrap, { PluginCollapsible });

    $.fn.themestrapPluginCollapsible = function(opts) {
        return this.map(function() {
            const $this = $(this);
            if ($this.data(instanceName)) {
                return $this.data(instanceName);
            } else {
                return new PluginCollapsible($this, opts);
            }
        });
    };

})).apply(this, [window.themestrap, jQuery]);
