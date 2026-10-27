// Counter
(((themestrap = {}, $) => {
    const instanceName = '__pluginCounter';
    const STYLE_ID = 'themestrap-counter-styles';

    class PluginCounter {
        constructor($el, opts) {
            return this.initialize($el, opts);
        }

        initialize($el, opts) {
            if ($el.data(instanceName)) {
                return this;
            }

            this.$el = $el;
            this._raf = null;
            this._running = false;

            this
                .setData()
                .setOptions(opts)
                .build();

            return this;
        }

        setData() {
            this.$el.data(instanceName, this);
            return this;
        }

        setOptions(opts) {
            this.options = $.extend(true, {}, PluginCounter.defaults, opts, {
                wrapper: this.$el
            });
            return this;
        }

        build() {
            this._injectStyles();

            const $el = this.options.wrapper;
            const from  = parseFloat($el.data('from')  ?? this.options.from);
            const to    = parseFloat($el.data('to')    ?? this.options.to);
            const speed = parseInt($el.data('speed')   ?? this.options.speed, 10);

            if (isNaN(to)) {
                return this;
            }

            const startFrom = isNaN(from) ? 0 : from;
            this._count(startFrom, to, speed);

            return this;
        }

        // Core easing counter 
        _count(from, to, duration) {
            const self    = this;
            const $el     = this.options.wrapper;
            const opts    = this.options;
            const startTs = performance.now();
            const range   = to - from;
            const refresh = Math.max(opts.refreshInterval, 16);

            if (this._running) {
                cancelAnimationFrame(this._raf);
            }
            this._running = true;

            let lastTick = 0;

            const tick = (now) => {
                const elapsed = now - startTs;
                const progress = Math.min(elapsed / duration, 1);

                // Ease in-out quad
                const eased = progress < 0.5
                    ? 2 * progress * progress
                    : -1 + (4 - 2 * progress) * progress;

                if (now - lastTick >= refresh) {
                    lastTick = now;
                    const current = from + range * eased;

                    $el.text(self._format(current));

                    if ($.isFunction(opts.onUpdate)) {
                        opts.onUpdate.call($el[0], current);
                    }
                }

                if (progress < 1) {
                    self._raf = requestAnimationFrame(tick);
                } else {
                    self._running = false;
                    $el.text(self._format(to));

                    if ($.isFunction(opts.onComplete)) {
                        opts.onComplete.call($el[0], to);
                    }

                    self._applyAffix($el);
                }
            };

            this._raf = requestAnimationFrame(tick);
        }

        _format(value) {
            const opts = this.options;

            if ($.isFunction(opts.formatter)) {
                return opts.formatter(value, opts);
            }

            let str = value.toFixed(opts.decimals);

            if (opts.thousandsSeparator) {
                const parts = str.split('.');
                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, opts.thousandsSeparator);
                str = parts.join('.');
            }

            if (opts.comma) {
                str = str.replace('.', ',');
            }

            return str;
        }

        _applyAffix($el) {
            const opts = this.options;

            if ($el.data('append')) {
                const text = $el.data('append');
                if (opts.appendWrapper) {
                    const $w = $(opts.appendWrapper);
                    $w.append(text);
                    $el.html($el.html() + $w[0].outerHTML);
                } else {
                    $el.html($el.html() + text);
                }
            }

            if ($el.data('prepend')) {
                const text = $el.data('prepend');
                if (opts.prependWrapper) {
                    const $w = $(opts.prependWrapper);
                    $w.append(text);
                    $el.html($w[0].outerHTML + $el.html());
                } else {
                    $el.html(text + $el.html());
                }
            }
        }

        /**
         * Re-run the counter animation from its current displayed value to `to`.
         * Pass a new `to` value, or omit to replay with original targets.
         * @param {number} [to]
         */
        replay(to) {
            const $el   = this.options.wrapper;
            const speed = parseInt($el.data('speed') ?? this.options.speed, 10);
            const target = to != null
                ? parseFloat(to)
                : parseFloat($el.data('to') ?? this.options.to);

            const current = parseFloat($el.text().replace(/[^0-9.\-]/g, '')) || 0;
            this._count(current, target, speed);
            return this;
        }

        /**
         * Jump instantly to a value without animation.
         * @param {number} value
         */
        setValue(value) {
            if (this._running) {
                cancelAnimationFrame(this._raf);
                this._running = false;
            }
            this.$el.text(this._format(parseFloat(value)));
            return this;
        }

        /**
         * Stop the animation at its current position.
         */
        stop() {
            if (this._running) {
                cancelAnimationFrame(this._raf);
                this._running = false;
            }
            return this;
        }

        destroy() {
            this.stop();
            this.$el.removeData(instanceName);
            return this;
        }

        // Style injection 
        _injectStyles() {
            if (document.getElementById(STYLE_ID)) return;
            const $style = $('<style>', { id: STYLE_ID });
            $style.text([
                '[data-plugin-counter]{ display: inline-block; }'
            ].join('\n'));
            $('head').append($style);
        }
    }

    PluginCounter.defaults = {
        from:               0,
        to:                 null,      // required — or set via data-to
        speed:              3000,      // ms
        refreshInterval:    100,       // ms between text updates (min 16)
        decimals:           0,
        comma:              false,     // replace decimal point with comma
        thousandsSeparator: '',        // e.g. ',' or '.'
        appendWrapper:      false,     // selector/HTML for affix wrapper
        prependWrapper:     false,
        formatter:          null,      // (value, opts) => string
        onUpdate:           null,      // (currentValue) callback
        onComplete:         null       // (finalValue) callback
    };

    $.extend(themestrap, {
        PluginCounter
    });

    $.fn.themestrapPluginCounter = function(opts) {
        return this.map(function() {
            const $this = $(this);

            if ($this.data(instanceName)) {
                return $this.data(instanceName);
            } else {
                return new PluginCounter($this, opts);
            }
        });
    };

})).apply(this, [window.themestrap, jQuery]);