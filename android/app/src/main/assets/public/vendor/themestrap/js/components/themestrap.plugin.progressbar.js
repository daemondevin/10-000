/**
 * Themestrap Progress Bar Plugin
 * Animated progress bars with scroll-triggered fill, color variants,
 * striped/animated patterns, indeterminate state, and an optional live value label.
 *
 * Part of the Themestrap component library.
 *
 * Markup anatomy
 *
 *   <!-- Minimal: 75% filled, primary color -->
 *   <div data-plugin-progress-bar data-plugin-options='{"value": 75}'></div>
 *
 *   <!-- Success color, striped -->
 *   <div data-plugin-progress-bar
 *        data-plugin-options='{"value": 60, "color": "success", "striped": true}'></div>
 *
 *   <!-- Animated stripes -->
 *   <div data-plugin-progress-bar
 *        data-plugin-options='{"value": 80, "color": "warning", "animated": true}'></div>
 *
 *   <!-- With value label -->
 *   <div data-plugin-progress-bar
 *        data-plugin-options='{"value": 45, "label": true}'></div>
 *
 *   <!-- Custom label format -->
 *   <div data-plugin-progress-bar
 *        data-plugin-options='{"value": 3, "label": true, "labelFormat": "{value} of 10"}'></div>
 *
 *   <!-- Indeterminate (loading) state -->
 *   <div data-plugin-progress-bar
 *        data-plugin-options='{"indeterminate": true, "color": "info"}'></div>
 *
 *   <!-- Large, square-cornered -->
 *   <div data-plugin-progress-bar
 *        data-plugin-options='{"value": 55, "size": "lg", "rounded": false}'></div>
 *
 *   <!-- Force init (no IntersectionObserver; fills immediately on DOMReady) -->
 *   <div data-plugin-progress-bar
 *        data-plugin-options='{"value": 90, "forceInit": true}'></div>
 *
 * Options (data-plugin-options JSON or JS object)
 *
 *   value         0           fill percentage: 0–100
 *   color         'primary'   variant: primary|secondary|tertiary|quaternary|success|warning|danger|info|dark
 *   striped       false       diagonal stripe pattern on the fill
 *   animated      false       animates the stripe pattern (implies striped: true)
 *   indeterminate false       endless back-and-forth animation; ignores value
 *   label         false       show the value as text inside the fill bar
 *   labelFormat   '{value}%'  token {value} is replaced with the rounded integer value
 *   duration      1200        fill transition duration in ms
 *   easing        'cubic-bezier(0.4, 0, 0.2, 1)'   CSS easing for the fill transition
 *   size          ''          height variant: ''(default 8px)|xs(3px)|sm(5px)|md(8px)|lg(16px)
 *   rounded       true        fully-rounded pill shape; false = square corners
 *   forceInit     false       skip IntersectionObserver; init immediately (dynIntObsInit)
 *   accY          0           IntersectionObserver rootMargin offset Y (dynIntObsInit)
 *
 * Public API (via instance: $el.data('__pluginProgressBar'))
 *
 *   instance.set(value)     — animate to a new 0–100 value
 *   instance.get()          — return the current target value
 *   instance.reset()        — animate back to 0
 *   instance.destroy()      — full teardown; restores original markup
 *
 * Events fired on the host element (native CustomEvent, bubbles)
 *
 *   progressbar:complete    — fires when the fill reaches 100 %
 *   progressbar:change      — fires on every set(); detail: { value, previous }
 *
 * Init.js wiring (dynIntObsInit — supports forceInit + accY)
 *
 *   if ($.isFunction($.fn['themestrapPluginProgressBar']) && $('[data-plugin-progress-bar]').length) {
 *       themestrap.fn.dynIntObsInit(
 *           '[data-plugin-progress-bar]:not(.manual)',
 *           'themestrapPluginProgressBar',
 *           themestrap.PluginProgressBar.defaults
 *       );
 *   }
 */
//Progress bar
(((themestrap = {}, $) => {
    const instanceName = '__pluginProgressBar';
	
    const STYLE_ID = 'ts-progress-bar-styles';

    const CSS_TEXT = `/* Themestrap — PluginProgressBar */

/* Host element */
.ts-progress {
    display         : block;
    width           : 100%;
    height          : 8px;
    overflow        : hidden;
    background      : transparent;
    border-radius   : 9999px;
    -webkit-mask-image: -webkit-radial-gradient(white, black);
}

/* Size variants */
.ts-progress--xs  { height: 3px;  }
.ts-progress--sm  { height: 5px;  }
.ts-progress--md  { height: 8px;  }
.ts-progress--lg  { height: 16px; }

/* Square corners */
.ts-progress--square,
.ts-progress--square .ts-progress-track,
.ts-progress--square .ts-progress-fill {
    border-radius: 0;
}

/* Track (the gray background rail) */
.ts-progress-track {
    width         : 100%;
    height        : 100%;
    background    : var(--dark-rgba-10, rgba(33, 37, 41, 0.1));
    border-radius : inherit;
    overflow      : hidden;
    position      : relative;
}

/* Fill bar */
.ts-progress-fill {
    height          : 100%;
    width           : 0;
    min-width       : 0;
    background      : var(--primary, #0088CC);
    border-radius   : inherit;
    position        : relative;
    display         : flex;
    align-items     : center;
    justify-content : flex-end;
    overflow        : hidden;
    will-change     : width;
}

/* Color variants */
.ts-progress-fill--primary   	{ background: var(--primary, #0088CC); }
.ts-progress-fill--secondary 	{ background: var(--secondary, #e36159); }
.ts-progress-fill--tertiary 	{ background: var(--tertiary, #2BAAB1); }
.ts-progress-fill--quaternary	{ background: var(--quaternary, #383f48); }
.ts-progress-fill--success   	{ background: var(--success, #87bb53); }
.ts-progress-fill--warning   	{ background: var(--warning, #f4bf75); }
.ts-progress-fill--danger    	{ background: var(--danger, #ff6159); }
.ts-progress-fill--info     	{ background: var(--info, #61a6d6); }
.ts-progress-fill--dark      	{ background: var(--dark, #212529); }

/* Striped pattern */
.ts-progress-fill--striped {
    background-image: linear-gradient(
        45deg,
        rgba(255, 255, 255, 0.15) 25%,
        transparent              25%,
        transparent              50%,
        rgba(255, 255, 255, 0.15) 50%,
        rgba(255, 255, 255, 0.15) 75%,
        transparent              75%,
        transparent
    );
    background-size: 1rem 1rem;
}

/* Animated stripe sweep */
@keyframes ts-progress-stripes {
    from { background-position: 1rem 0; }
    to   { background-position: 0 0;    }
}
.ts-progress-fill--animated {
    animation: ts-progress-stripes 1s linear infinite;
}

/* Indeterminate */
@keyframes ts-progress-indeterminate {
    0%   { left: -35%;  right: 100%; }
    60%  { left: 100%;  right: -90%; }
    100% { left: 100%;  right: -90%; }
}
@keyframes ts-progress-indeterminate-short {
    0%   { left: -200%; right: 100%; }
    60%  { left: 107%;  right:  -8%; }
    100% { left: 107%;  right:  -8%; }
}

.ts-progress-fill--indeterminate {
    width    : 100%;
    overflow : visible;
    display  : block;
}
.ts-progress-fill--indeterminate::before,
.ts-progress-fill--indeterminate::after {
    content    : '';
    position   : absolute;
    top        : 0;
    bottom     : 0;
    background : inherit;
}
.ts-progress-fill--indeterminate::before {
    animation: ts-progress-indeterminate 2.1s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite;
}
.ts-progress-fill--indeterminate::after {
    animation      : ts-progress-indeterminate-short 2.1s cubic-bezier(0.165, 0.84, 0.44, 1) infinite;
    animation-delay: 1.15s;
}

/* Value label */
.ts-progress-label {
    font-size      : 10px;
    font-weight    : 700;
    color          : var(--light-rgba-90, rgba(255, 255, 255, 0.9));
    white-space    : nowrap;
    padding        : 0 6px;
    letter-spacing : 0.03em;
    pointer-events : none;
    user-select    : none;
}

/* Hide label at tiny sizes where there's no room */
.ts-progress--xs .ts-progress-label,
.ts-progress--sm .ts-progress-label { display: none; }

/* Reduced-motion overrides */
@media (prefers-reduced-motion: reduce) {
    .ts-progress-fill {
        transition : none !important;
    }
    .ts-progress-fill--animated {
        animation: none;
    }
    .ts-progress-fill--indeterminate::before,
    .ts-progress-fill--indeterminate::after {
        animation: none;
    }
}`;

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style       = document.createElement('style');
        style.id          = STYLE_ID;
        style.textContent = CSS_TEXT;
        (document.head || document.documentElement).appendChild(style);
    }

    class PluginProgressBar {

        constructor($el, opts) {
            return this.initialize($el, opts);
        }

        initialize($el, opts) {
            if ($el.data(instanceName)) {
                return this;
            }

            this.$el          = $el;
            this.initialHTML  = $el.html();
            this.initialClass = $el.attr('class') || '';
            this._targetValue = 0;
            this._raf         = null;

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
            this.options = $.extend(true, {}, PluginProgressBar.defaults, opts, {
                wrapper: this.$el
            });
            return this;
        }

        build() {
            const self = this;
            const o    = self.options;

            injectStyles();

            const value = Math.min(100, Math.max(0, parseFloat(o.value) || 0));
            self._targetValue = value;

            /* Host element classes */
            const hostClasses = ['ts-progress'];
            if (o.size)            hostClasses.push('ts-progress--' + o.size);
            if (o.rounded === false) hostClasses.push('ts-progress--square');

            /* Fill element classes */
            const fillClasses = ['ts-progress-fill'];
            if (o.color)                          fillClasses.push('ts-progress-fill--' + o.color);
            if (o.striped || o.animated)          fillClasses.push('ts-progress-fill--striped');
            if (o.animated && !o.indeterminate)   fillClasses.push('ts-progress-fill--animated');
            if (o.indeterminate)                  fillClasses.push('ts-progress-fill--indeterminate');

            /* Inline style for the fill — indeterminate starts at 100 %, determinate at 0 % */
            const fillStyle = o.indeterminate
                ? 'width:100%;'
                : 'width:0;transition:width ' + o.duration + 'ms ' + o.easing + ';';

            /* Optional label */
            const labelHtml = (o.label && !o.indeterminate)
                ? '<span class="ts-progress-label">' + self._formatLabel(0) + '</span>'
                : '';

            self.$el
                .addClass(hostClasses.join(' '))
                .attr({
                    role             : 'progressbar',
                    'aria-valuemin'  : '0',
                    'aria-valuemax'  : '100',
                    'aria-valuenow'  : o.indeterminate ? '' : '0',
                    'aria-busy'      : o.indeterminate ? 'true' : null,
                })
                .html(
                    '<div class="ts-progress-track">' +
                        '<div class="' + fillClasses.join(' ') + '" style="' + fillStyle + '">' +
                            labelHtml +
                        '</div>' +
                    '</div>'
                );

            self.$fill  = self.$el.find('.ts-progress-fill');
            self.$label = self.$el.find('.ts-progress-label');

            if (!o.indeterminate) {
                /* Double-rAF so the browser paints 0 % before the transition begins */
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        self.$fill.css('width', value + '%');
                        self.$el.attr('aria-valuenow', value);
                        if (o.label) {
                            self._animateLabel(0, value, o.duration);
                        }
                        if (value >= 100) {
                            self._dispatchEvent('progressbar:complete', { value });
                        }
                    });
                });
            }

            return this;
        }

        events() {
            return this;
        }

        /**
         * Animate the fill to a new value (0–100).
         * Fires progressbar:change and, if value reaches 100, progressbar:complete.
         */
        set(value) {
            const self = this;
            const o    = self.options;

            if (o.indeterminate) return this;

            const previous = self._targetValue;
            const next     = Math.min(100, Math.max(0, parseFloat(value) || 0));
            self._targetValue = next;

            self.$fill.css('width', next + '%');
            self.$el.attr('aria-valuenow', next);

            if (o.label) {
                self._animateLabel(previous, next, o.duration);
            }

            self._dispatchEvent('progressbar:change', { value: next, previous });

            if (next >= 100) {
                self._dispatchEvent('progressbar:complete', { value: next });
            }

            return this;
        }

        /** Return the current target fill value. */
        get() {
            return this._targetValue;
        }

        /** Animate fill back to 0. */
        reset() {
            return this.set(0);
        }

        _formatLabel(value) {
            return this.options.labelFormat.replace('{value}', Math.round(value));
        }

        /**
         * Counts the label text from `from` to `to` over `duration` ms
         * using an ease-in-out quad curve.
         */
        _animateLabel(from, to, duration) {
            const self  = this;
            if (!self.$label.length) return;

            if (self._raf) {
                cancelAnimationFrame(self._raf);
                self._raf = null;
            }

            const startTime = performance.now();

            const tick = (now) => {
                const t      = Math.min((now - startTime) / duration, 1);
                const eased  = t < 0.5
                    ? 2 * t * t
                    : 1 - Math.pow(-2 * t + 2, 2) / 2;
                const current = from + (to - from) * eased;
                self.$label.text(self._formatLabel(current));
                if (t < 1) {
                    self._raf = requestAnimationFrame(tick);
                } else {
                    self._raf = null;
                    self.$label.text(self._formatLabel(to));
                }
            };

            self._raf = requestAnimationFrame(tick);
        }

        _dispatchEvent(name, detail) {
            const el = this.$el[0];
            if (!el) return;
            el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, cancelable: false }));
        }

        destroy() {
            const self = this;

            if (self._raf) {
                cancelAnimationFrame(self._raf);
                self._raf = null;
            }

            self.$el
                .html(self.initialHTML)
                .off('.progressbar')
                .removeAttr('role aria-valuemin aria-valuemax aria-valuenow aria-busy');

            if (self.initialClass) {
                self.$el.attr('class', self.initialClass);
            } else {
                self.$el.removeAttr('class');
            }

            self.$el.removeData(instanceName);
            return this;
        }
    }

    PluginProgressBar.defaults = {
        value         : 0,
        color         : 'primary',
        striped       : false,
        animated      : false,
        indeterminate : false,
        label         : false,
        labelFormat   : '{value}%',
        duration      : 1200,
        easing        : 'cubic-bezier(0.4, 0, 0.2, 1)',
        size          : '',
        rounded       : true,
        forceInit     : false,
        accY          : 0,
    };

    $.extend(themestrap, { PluginProgressBar });

    /**
     * jQuery plugin bridge.
     * Accepts an options object or a string command ('set', 'get', 'reset', 'destroy').
     *
     * Examples:
     *   $('[data-plugin-progress-bar]').themestrapPluginProgressBar({ value: 70 });
     *   $('#bar').themestrapPluginProgressBar('set', 90);
     *   $('#bar').themestrapPluginProgressBar('reset');
     */
    $.fn.themestrapPluginProgressBar = function(opts, arg) {
        return this.map(function() {
            const $this    = $(this);
            const instance = $this.data(instanceName);

            if (typeof opts === 'string') {
                if (instance && $.isFunction(instance[opts])) {
                    return instance[opts](arg);
                }
                return instance;
            }

            if (instance) {
                return instance;
            }

            return new PluginProgressBar($this, opts);
        });
    };

})).apply(this, [window.themestrap, jQuery]);
