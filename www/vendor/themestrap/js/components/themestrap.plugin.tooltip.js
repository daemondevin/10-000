/**
 * Themestrap Tooltip Plugin
 * JS-powered tooltips with CSS-variable theming, auto-flip, ARIA, and touch support.
 *
 * Part of the Themestrap component library for MODX 3
 *
 * Markup anatomy
 *
 *   <!-- Minimal: text from attribute value -->
 *   <button data-plugin-tooltip="Save your work before continuing.">Save</button>
 *
 *   <!-- With options: variant, position, HTML content -->
 *   <span data-plugin-tooltip="Pro tip"
 *         data-plugin-options='{"type":"primary","location":"bottom","delay":[200,0]}'>
 *     Hover me
 *   </span>
 *
 *   <!-- HTML content via options (html:true required) -->
 *   <a href="#"
 *      data-plugin-tooltip=""
 *      data-plugin-options='{"content":"<strong>Bold</strong> tip","html":true}'>
 *     Link
 *   </a>
 *
 * Options (data-plugin-options JSON or JS object)
 *
 *   content   ''           tooltip text; falls back to data-plugin-tooltip value
 *   type      'default'    variant: default|primary|secondary|tertiary|quaternary|
 *                                   dark|light|success|warning|danger|info
 *   location  'top'        preferred side: top|bottom|left|right (auto-flips if no room)
 *   offset    8            px gap between trigger edge and tooltip
 *   arrow     true         show a pointing CSS arrow
 *   html      false        render content as HTML (sanitise on your own server)
 *   maxWidth  260          max-width in px
 *   delay     [100, 0]     [showDelayMs, hideDelayMs]; number applies to both
 *   onShow    null         callback(instance) — fires after show
 *   onHide    null         callback(instance) — fires after hide
 *
 * Public API (via instance: $el.data('__pluginTooltip'))
 *
 *   instance.show()              — force show
 *   instance.hide()              — force hide
 *   instance.toggle()            — show/hide
 *   instance.update()            — reposition without changing visibility
 *   instance.setContent(text)    — update content live
 *   instance.destroy()           — full teardown
 *
 * Events fired on the trigger element
 *
 *   tooltip:show   (jQuery event, [instance])
 *   tooltip:hide   (jQuery event, [instance])
 *
 * Init.js wiring
 *
 *   if ($.isFunction($.fn['themestrapPluginTooltip']) && $('[data-plugin-tooltip]').length) {
 *       $(() => {
 *           $('[data-plugin-tooltip]:not(.manual)').each(function () {
 *               const $this = $(this);
 *               const opts  = themestrap.fn.getOptions($this.data('plugin-options')) || undefined;
 *               $this.themestrapPluginTooltip(opts);
 *           });
 *       });
 *   }
 */
(((themestrap = {}, $) => {
    const instanceName = '__pluginTooltip';

    let _seq = 0;
    const uid = () => `ts-tt-${++_seq}`;

    const STYLE_ID = 'ts-tooltip-styles';

    const CSS_TEXT = `/* Themestrap — PluginTooltip */
/* Base */
.ts-tooltip-el {
    --ts-tt-bg    : rgba(0, 0, 0, 0.94);
    --ts-tt-color : var(--grey-500, #dbdbdb);

    position      : fixed;
    z-index       : 9999;
    pointer-events: none;

    padding       : 7px 13px;
    border-radius : 5px;
    font-size     : 0.8125rem;
    line-height   : 1.45;
    font-family   : inherit;
    max-width     : 260px;
    white-space   : normal;
    word-break    : break-word;
    text-align    : center;

    background    : var(--ts-tt-bg);
    color         : var(--ts-tt-color);
    box-shadow    : 0 4px 14px var(--dark-rgba-20, rgba(33, 37, 41, 0.2)), 0 0 0 1px var(--light-rgba-10, rgba(255, 255, 255, 0.1));

    opacity    : 0;
    transform  : scale(0.93);
    visibility : hidden;
    transition : opacity .15s ease, transform .15s ease, visibility 0s .15s;
    will-change: opacity, transform;
}

.ts-tooltip-el.ts-tt-visible {
    opacity    : 1;
    transform  : scale(1);
    visibility : visible;
    transition : opacity .15s ease, transform .15s ease, visibility 0s 0s;
}

/* Variants */
.ts-tooltip-el.ts-tt-primary    { --ts-tt-bg: var(--primary-rgba-90, rgba(0, 136, 204, 0.9)); --ts-tt-color: var(--light, #ffffff); }
.ts-tooltip-el.ts-tt-secondary  { --ts-tt-bg: var(--secondary-rgba-90, rgba(227, 97, 89, 0.9)); --ts-tt-color: var(--light, #ffffff); }
.ts-tooltip-el.ts-tt-tertiary   { --ts-tt-bg: var(--tertiary-rgba-90, rgba(43, 170, 177, 0.9)); --ts-tt-color: var(--light, #ffffff); }
.ts-tooltip-el.ts-tt-quaternary { --ts-tt-bg: var(--quaternary-rgba-90, rgba(56, 63, 72, 0.9)); --ts-tt-color: var(--light, #ffffff); }
.ts-tooltip-el.ts-tt-dark       { --ts-tt-bg: var(--dark-rgba-90, rgba(33, 37, 41, 0.9)); --ts-tt-color: var(--grey-700, #c1c1c1); }
.ts-tooltip-el.ts-tt-light      {
    --ts-tt-bg    : var(--light-rgba-90, rgba(255, 255, 255, 0.9));
    --ts-tt-color : var(--dark-300, #0a0c0d);
    box-shadow    : 0 4px 14px var(--dark-rgba-10, rgba(33, 37, 41, 0.1)), 0 0 0 1px var(--dark-rgba-70, rgba(33, 37, 41, 0.7));
}
.ts-tooltip-el.ts-tt-success    { --ts-tt-bg: rgba( 22, 163,  74, 0.95); --ts-tt-color: var(--light, #ffffff); }
.ts-tooltip-el.ts-tt-warning    { --ts-tt-bg: rgba(234, 179,   8, 0.95); --ts-tt-color: var(--dark-200, #101214); }
.ts-tooltip-el.ts-tt-danger     { --ts-tt-bg: rgba(220,  38,  38, 0.95); --ts-tt-color: var(--light, #ffffff); }
.ts-tooltip-el.ts-tt-info       { --ts-tt-bg: rgba( 59, 130, 246, 0.95); --ts-tt-color: var(--light, #ffffff); }

/* Arrow */
/* The arrow points from the tooltip toward the trigger.
   border-color uses --ts-tt-bg so variants are inherited automatically. */
.ts-tooltip-arrow {
    position     : absolute;
    width        : 0;
    height       : 0;
    border       : 5px solid transparent;
    pointer-events: none;
}

/* Tooltip above trigger — arrow at bottom, pointing down */
.ts-tooltip-el[data-tt-loc="top"] .ts-tooltip-arrow {
    top       : 100%;
    left      : 50%;
    transform : translateX(-50%);
    border-width : 5px 5px 0 5px;
    border-color : var(--ts-tt-bg) transparent transparent transparent;
}

/* Tooltip below trigger — arrow at top, pointing up */
.ts-tooltip-el[data-tt-loc="bottom"] .ts-tooltip-arrow {
    bottom    : 100%;
    left      : 50%;
    transform : translateX(-50%);
    border-width : 0 5px 5px 5px;
    border-color : transparent transparent var(--ts-tt-bg) transparent;
}

/* Tooltip left of trigger — arrow at right, pointing right */
.ts-tooltip-el[data-tt-loc="left"] .ts-tooltip-arrow {
    top       : 50%;
    left      : 100%;
    transform : translateY(-50%);
    border-width : 5px 0 5px 5px;
    border-color : transparent transparent transparent var(--ts-tt-bg);
}

/* Tooltip right of trigger — arrow at left, pointing left */
.ts-tooltip-el[data-tt-loc="right"] .ts-tooltip-arrow {
    top       : 50%;
    right     : 100%;
    transform : translateY(-50%);
    border-width : 5px 5px 5px 0;
    border-color : transparent var(--ts-tt-bg) transparent transparent;
}

/* Reduced-motion override */
@media (prefers-reduced-motion: reduce) {
    .ts-tooltip-el {
        transition : opacity .05s ease, visibility 0s .05s;
        transform  : none !important;
    }
    .ts-tooltip-el.ts-tt-visible {
        transition : opacity .05s ease, visibility 0s 0s;
    }
}`;

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id          = STYLE_ID;
        style.textContent = CSS_TEXT;
        (document.head || document.documentElement).appendChild(style);
    }

    /**
     * Compute `position: fixed` coordinates for the tooltip.
     * Auto-flips to the opposite side when the preferred side has insufficient space.
     *
     * @param  {Element} triggerEl   The trigger DOM element
     * @param  {Element} tooltipEl   The tooltip DOM element (must be in the DOM for measurement)
     * @param  {string}  location    Preferred side: top|bottom|left|right
     * @param  {number}  offset      px gap between trigger edge and tooltip
     * @returns {{ top: number, left: number, loc: string }}
     */
    function computePosition(triggerEl, tooltipEl, location, offset) {
        const r   = triggerEl.getBoundingClientRect();
        const vw  = window.innerWidth;
        const vh  = window.innerHeight;
        const ew  = tooltipEl.offsetWidth;
        const eh  = tooltipEl.offsetHeight;
        const pad = 8;   // minimum inset from viewport edge

        // Flip if there isn't enough room on the requested side
        let loc = location;
        if (loc === 'top'    && r.top            < eh + offset + pad) loc = 'bottom';
        if (loc === 'bottom' && r.bottom + eh + offset + pad > vh)    loc = 'top';
        if (loc === 'left'   && r.left           < ew + offset + pad) loc = 'right';
        if (loc === 'right'  && r.right + ew + offset + pad > vw)     loc = 'left';

        let top, left;

        switch (loc) {
            case 'top':
                top  = r.top    - eh - offset;
                left = r.left   + (r.width  / 2) - (ew / 2);
                break;
            case 'bottom':
                top  = r.bottom + offset;
                left = r.left   + (r.width  / 2) - (ew / 2);
                break;
            case 'left':
                top  = r.top    + (r.height / 2) - (eh / 2);
                left = r.left   - ew - offset;
                break;
            case 'right':
                top  = r.top    + (r.height / 2) - (eh / 2);
                left = r.right  + offset;
                break;
            default:
                top  = r.top    - eh - offset;
                left = r.left   + (r.width  / 2) - (ew / 2);
        }

        // Clamp so the tooltip never bleeds off-screen
        left = Math.max(pad, Math.min(vw - ew - pad, left));
        top  = Math.max(pad, Math.min(vh - eh - pad, top));

        return { top, left, loc };
    }

    class PluginTooltip {
        constructor($el, opts) {
            return this.initialize($el, opts);
        }

        initialize($el, opts) {
            if ($el.data(instanceName)) {
                return this;
            }

            this.$el             = $el;
            this.$tooltip        = null;
            this._uid            = uid();
            this._visible        = false;
            this._showTimer      = null;
            this._hideTimer      = null;
            this._addedTabindex  = false;

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
            const pluginOptions = themestrap.fn.getOptions(this.$el.data('plugin-options'));
            this.options = $.extend(true, {}, PluginTooltip.defaults, pluginOptions, opts, {
                wrapper: this.$el
            });

            // Normalize delay: a single number applies to both show and hide
            if (typeof this.options.delay === 'number') {
                this.options.delay = [this.options.delay, this.options.delay];
            }

            // Content fallback: the attribute value on the trigger element
            if (!this.options.content) {
                this.options.content = this.$el.attr('data-plugin-tooltip') || '';
            }

            return this;
        }

        build() {
            injectStyles();

            const self = this;
            const o    = self.options;

            if (!o.content) return this;

            // Create tooltip element and append to <body> so it escapes any
            // overflow:hidden or stacking-context ancestor on the trigger.
            const typeClass = o.type && o.type !== 'default' ? ` ts-tt-${o.type}` : '';

            self.$tooltip = $('<div>', {
                id   : self._uid,
                class: `ts-tooltip-el${typeClass}`,
                role : 'tooltip'
            }).appendTo(document.body);

            // Content node
            const $inner = $('<div>', { class: 'ts-tooltip-inner' });
            if (o.html) {
                $inner.html(o.content);
            } else {
                $inner.text(o.content);
            }
            $inner.appendTo(self.$tooltip);

            // Arrow
            if (o.arrow) {
                $('<span>', { class: 'ts-tooltip-arrow', 'aria-hidden': 'true' })
                    .appendTo(self.$tooltip);
            }

            // Max-width override (CSS default is 260px)
            if (o.maxWidth && o.maxWidth !== PluginTooltip.defaults.maxWidth) {
                self.$tooltip.css('max-width', typeof o.maxWidth === 'number'
                    ? `${o.maxWidth}px`
                    : o.maxWidth);
            }

            // ARIA: link trigger to its tooltip
            self.$el.attr('aria-describedby', self._uid);

            // Ensure keyboard access (focus triggers the tooltip)
            if (!self.$el.is('a[href], button, input, select, textarea, [tabindex]')) {
                self.$el.attr('tabindex', '0');
                self._addedTabindex = true;
            }

            return this;
        }

        events() {
            const self = this;
            const ns   = `.tooltip.${self._uid}`;

            if (!self.$tooltip) return this;

            // Mouse
            self.$el
                .on(`mouseenter${ns}`, () => self._scheduleShow())
                .on(`mouseleave${ns}`, () => self._scheduleHide());

            // Keyboard focus/blur
            self.$el
                .on(`focus${ns}`, () => self._scheduleShow())
                .on(`blur${ns}`,  () => self._scheduleHide());

            // Touch: tap to toggle; close on second tap
            self.$el.on(`touchend${ns}`, function(e) {
                if (self._visible) {
                    self.hide();
                } else {
                    // Prevent the ghost mouse event that would immediately
                    // re-trigger mouseenter on some browsers.
                    e.preventDefault();
                    self.show();
                }
            });

            // Close on outside tap (bound once, removed on hide)
            self._touchOutsideHandler = function(e) {
                if (!self._visible) return;
                if (!$(e.target).closest(self.$el).length) {
                    self.hide();
                }
            };

            // Reposition on scroll / resize
            $(window).on(`scroll${ns} resize${ns}`, function() {
                if (self._visible) self._position();
            });

            return this;
        }

        _scheduleShow() {
            const self = this;
            clearTimeout(self._hideTimer);
            self._hideTimer = null;

            if (self._visible) return this;

            const delay = self.options.delay[0];
            if (delay > 0) {
                self._showTimer = setTimeout(() => self.show(), delay);
            } else {
                self.show();
            }
            return this;
        }

        _scheduleHide() {
            const self = this;
            clearTimeout(self._showTimer);
            self._showTimer = null;

            if (!self._visible) return this;

            const delay = self.options.delay[1];
            if (delay > 0) {
                self._hideTimer = setTimeout(() => self.hide(), delay);
            } else {
                self.hide();
            }
            return this;
        }

        show() {
            const self = this;

            if (self._visible || !self.$tooltip) return this;
            self._visible = true;

            clearTimeout(self._showTimer);
            clearTimeout(self._hideTimer);

            // Position before revealing (element has layout even while invisible)
            self._position();
            self.$tooltip.addClass('ts-tt-visible');

            // Bind outside-tap handler to close on touch devices
            $(document).on(`touchend.tooltip-outside.${self._uid}`, self._touchOutsideHandler);

            self.$el.trigger('tooltip:show', [self]);
            if ($.isFunction(self.options.onShow)) {
                self.options.onShow.call(self);
            }

            return this;
        }

        hide() {
            const self = this;

            if (!self._visible || !self.$tooltip) return this;
            self._visible = false;

            clearTimeout(self._showTimer);
            clearTimeout(self._hideTimer);

            self.$tooltip.removeClass('ts-tt-visible');
            $(document).off(`touchend.tooltip-outside.${self._uid}`);

            self.$el.trigger('tooltip:hide', [self]);
            if ($.isFunction(self.options.onHide)) {
                self.options.onHide.call(self);
            }

            return this;
        }

        toggle() {
            return this._visible ? this.hide() : this.show();
        }

        /**
         * Recompute tooltip position without changing visibility.
         * Call after dynamic layout changes (accordion expand, tab switch, etc.).
         */
        update() {
            if (this._visible) this._position();
            return this;
        }

        /**
         * Replace tooltip content at runtime.
         * @param {string} content  Plain text (or HTML if options.html is true)
         */
        setContent(content) {
            const self = this;

            if (!self.$tooltip) return this;

            self.options.content = content;

            const $inner = self.$tooltip.find('.ts-tooltip-inner');
            if (self.options.html) {
                $inner.html(content);
            } else {
                $inner.text(content);
            }

            if (self._visible) self._position();
            return this;
        }

        _position() {
            const self = this;

            if (!self.$tooltip || !self.$tooltip.length) return this;

            const { top, left, loc } = computePosition(
                self.$el[0],
                self.$tooltip[0],
                self.options.location,
                self.options.offset
            );

            // Update the data attribute so CSS arrow direction rules apply
            self.$tooltip
                .attr('data-tt-loc', loc)
                .css({ top: `${top}px`, left: `${left}px` });

            return this;
        }

        destroy() {
            const self = this;
            const ns   = `.tooltip.${self._uid}`;

            clearTimeout(self._showTimer);
            clearTimeout(self._hideTimer);

            // Tear down all namespaced events
            self.$el.off(ns);
            $(window).off(ns);
            $(document).off(`touchend.tooltip-outside.${self._uid}`);

            // Restore trigger element
            self.$el.removeAttr('aria-describedby');
            if (self._addedTabindex) {
                self.$el.removeAttr('tabindex');
            }

            // Remove tooltip from DOM
            if (self.$tooltip) {
                self.$tooltip.remove();
                self.$tooltip = null;
            }

            self.$el.removeData(instanceName);
            return this;
        }
    }

    PluginTooltip.defaults = {
        content  : '',         // tooltip text; falls back to data-plugin-tooltip attribute value
        type     : 'default',  // variant: default|primary|secondary|tertiary|quaternary|
                               //          dark|light|success|warning|danger|info
        location : 'top',      // preferred position: top|bottom|left|right (auto-flips)
        offset   : 8,          // px gap between trigger edge and tooltip panel
        arrow    : true,       // show a pointing CSS triangle arrow
        html     : false,      // render content as HTML (sanitise externally)
        maxWidth : 260,        // max-width in px (or CSS length string)
        delay    : [100, 0],   // [showDelayMs, hideDelayMs]; number applies to both
        onShow   : null,       // callback(instance) — fires after show
        onHide   : null        // callback(instance) — fires after hide
    };

    $.extend(themestrap, { PluginTooltip });

    /**
     * jQuery plugin bridge.
     * Accepts an options object OR a string command ('show', 'hide', 'toggle',
     * 'update', 'destroy').
     *
     * Examples:
     *   $('[data-plugin-tooltip]').themestrapPluginTooltip();
     *   $('#tip').themestrapPluginTooltip({ type: 'danger', location: 'left' });
     *   $('#tip').themestrapPluginTooltip('show');
     */
    $.fn.themestrapPluginTooltip = function(opts) {
        return this.map(function() {
            const $this    = $(this);
            const instance = $this.data(instanceName);

            if (typeof opts === 'string') {
                if (instance && $.isFunction(instance[opts])) {
                    instance[opts]();
                } else if (instance) {
                    console.warn(`[PluginTooltip] Unknown command: "${opts}"`);
                }
                return instance;
            }

            if (instance) {
                return instance;
            }

            return new PluginTooltip($this, opts);
        });
    };

})).apply(this, [window.themestrap, jQuery]);
