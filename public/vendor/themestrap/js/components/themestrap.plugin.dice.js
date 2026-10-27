/**
 * Themestrap Dice
 *
 * A tray of dice drawn with pure CSS pips. Throw some or all of them with a tumbling
 * animation, let the player pick dice by clicking or with the keyboard, and mark dice
 * as held (set aside). Built for dice games such as Farkle, Yahtzee or Liar's Dice, and
 * for anything that needs a die face on screen. No images, no vendor dependencies.
 *
 * Markup:
 *
 *   <div data-plugin-dice
 *        data-plugin-options='{"count": 6, "selectable": true}'></div>
 *
 *   The tray is generated inside the host. Starting faces can be given with "values",
 *   for example {"values": [1, 2, 3, 4, 5, 6]}. A null value draws an empty face.
 *
 * Public API (via stored instance):
 *   const dice = $('#tray').data('__pluginDice');
 *   dice.roll();                       // throw every die that is not held, random faces
 *   dice.roll([0, 2], [6, 1]);         // throw dice 0 and 2, landing on 6 and 1
 *   dice.roll().then(values => {});    // roll() returns a Promise of all values
 *   dice.getValues();                  // [3, 6, 1, null, 5, 2]
 *   dice.setValues([1, 1, 1]);         // set faces without animation
 *   dice.setState([{ value: 5, held: true }, ...]);
 *   dice.hold([0, 1]); dice.release([0]);
 *   dice.select(2, true); dice.toggle(2); dice.clearSelection();
 *   dice.getSelected();                // [2, 4] indexes
 *   dice.getSelectedValues();          // [1, 5]
 *   dice.setSelectable(true); dice.enable(); dice.disable();
 *   dice.isRolling();
 *   dice.destroy();
 *
 * Events (native CustomEvent, bubbling, dispatched on the host):
 *   ts.dice.select   detail: { instance, index, selected, selection, values }
 *   ts.dice.roll     detail: { instance, indexes }             (throw starts)
 *   ts.dice.rolled   detail: { instance, indexes, values }     (dice have landed)
 *
 * Keyboard (when selectable):
 *   Left / Right, Up / Down   move between dice      Home / End   first / last die
 *   Space / Enter             pick or drop the focused die
 *
 * CSS custom properties (all optional):
 *   --ts-dice-size, --ts-dice-gap, --ts-dice-radius, --ts-dice-bg, --ts-dice-border,
 *   --ts-dice-pip, --ts-dice-pip-one, --ts-dice-shadow, --ts-dice-selected,
 *   --ts-dice-selected-bg, --ts-dice-held-bg, --ts-dice-held-opacity, --ts-dice-focus-ring
 *
 * Init.js wiring:
 *   if (typeof $.fn['themestrapPluginDice'] === 'function' && $('[data-plugin-dice]').length) {
 *       themestrap.fn.intObsInit('[data-plugin-dice]:not(.manual)', 'themestrapPluginDice');
 *   }
 */
// Dice
(((themestrap = {}, $) => {
    const instanceName = '__pluginDice';
    const STYLE_ID     = 'ts-dice-styles';
    const EVT_SELECT   = 'ts.dice.select';
    const EVT_ROLL     = 'ts.dice.roll';
    const EVT_ROLLED   = 'ts.dice.rolled';

    let instanceCount = 0;
    let seq           = 0;

    // Which of the nine pip cells (row by row, 1 to 9) are shown for each face
    const FACES = {
        1: [5],
        2: [3, 7],
        3: [3, 5, 7],
        4: [1, 3, 7, 9],
        5: [1, 3, 5, 7, 9],
        6: [1, 3, 4, 6, 7, 9]
    };

    const LIGHT = `
        --dc-bg:           var(--ts-dice-bg, #fffdf8);
        --dc-border:       var(--ts-dice-border, rgba(0,0,0,.16));
        --dc-pip:          var(--ts-dice-pip, #1b1f24);
        --dc-pip-one:      var(--ts-dice-pip-one, #c62828);
        --dc-shadow:       var(--ts-dice-shadow, 0 2px 0 rgba(0,0,0,.12), 0 6px 14px rgba(0,0,0,.10));
        --dc-selected:     var(--ts-dice-selected, #21a366);
        --dc-selected-bg:  var(--ts-dice-selected-bg, #e3f7ec);
        --dc-held-bg:      var(--ts-dice-held-bg, #d9dde3);
        --dc-ring:         var(--ts-dice-focus-ring, 0 0 0 3px rgba(0,168,159,.35));
    `;
    const DARK = `
        --dc-bg:           var(--ts-dice-bg, #f4f1ea);
        --dc-border:       var(--ts-dice-border, rgba(255,255,255,.22));
        --dc-pip:          var(--ts-dice-pip, #14181d);
        --dc-pip-one:      var(--ts-dice-pip-one, #d32f2f);
        --dc-shadow:       var(--ts-dice-shadow, 0 2px 0 rgba(0,0,0,.45), 0 8px 18px rgba(0,0,0,.35));
        --dc-selected:     var(--ts-dice-selected, #2fd08a);
        --dc-selected-bg:  var(--ts-dice-selected-bg, #d4f5e4);
        --dc-held-bg:      var(--ts-dice-held-bg, #7d8794);
        --dc-ring:         var(--ts-dice-focus-ring, 0 0 0 3px rgba(0,199,190,.45));
    `;

    const pipRules = Object.keys(FACES).map((v) =>
        FACES[v].map((cell) => `.ts-die[data-value="${v}"] .ts-pip:nth-child(${cell})`).join(',\n        ') +
        ' { opacity: 1; transform: scale(1); }'
    ).join('\n        ');

    const CSS_TEXT = `
        .ts-dice { ${LIGHT} }
        @media (prefers-color-scheme: dark) { .ts-dice { ${DARK} } }
        html.dark .ts-dice,
        [data-bs-theme="dark"] .ts-dice { ${DARK} }
        [data-bs-theme="light"] .ts-dice { ${LIGHT} }

        .ts-dice {
            --dc-size: var(--ts-dice-size, 3.25rem);
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: var(--ts-dice-gap, .75rem);
        }
        .ts-dice--sm { --dc-size: var(--ts-dice-size, 2.25rem); gap: var(--ts-dice-gap, .5rem); }
        .ts-dice--lg { --dc-size: var(--ts-dice-size, 4.5rem); gap: var(--ts-dice-gap, 1rem); }
        .ts-dice--center { justify-content: center; }

        .ts-die {
            position: relative;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: repeat(3, 1fr);
            width: var(--dc-size);
            height: var(--dc-size);
            padding: calc(var(--dc-size) * .14);
            margin: 0;
            background: var(--dc-bg);
            border: 1px solid var(--dc-border);
            border-radius: var(--ts-dice-radius, calc(var(--dc-size) * .2));
            box-shadow: var(--dc-shadow);
            color: var(--dc-pip);
            cursor: default;
            transition: transform .15s ease, box-shadow .15s ease, background-color .15s ease, opacity .2s ease;
            -webkit-tap-highlight-color: transparent;
            font: inherit;
            line-height: 1;
            user-select: none;
        }
        .ts-die:focus { outline: none; }
        .ts-die:focus-visible { box-shadow: var(--dc-shadow), var(--dc-ring); }

        .ts-pip {
            display: block;
            align-self: center;
            justify-self: center;
            width: 72%;
            aspect-ratio: 1;
            border-radius: 50%;
            background: currentColor;
            opacity: 0;
            transform: scale(.4);
            transition: opacity .12s ease, transform .12s ease;
        }
        .ts-die[data-value="1"] .ts-pip { color: var(--dc-pip-one); width: 92%; }
        .ts-dice--plain .ts-die[data-value="1"] .ts-pip { color: var(--dc-pip); width: 72%; }
        ${pipRules}

        .ts-die.is-empty { opacity: .45; }
        .ts-die.is-selectable { cursor: pointer; }
        .ts-die.is-selectable:hover { transform: translateY(-2px); }
        .ts-die.is-selected {
            background: var(--dc-selected-bg);
            border-color: var(--dc-selected);
            box-shadow: var(--dc-shadow), 0 0 0 3px var(--dc-selected);
            transform: translateY(-3px);
        }
        .ts-die.is-held {
            background: var(--dc-held-bg);
            opacity: var(--ts-dice-held-opacity, .6);
            transform: none;
            cursor: default;
        }
        .ts-die.is-rolling { animation: ts-dice-tumble var(--dc-tumble, .28s) linear infinite; }
        .ts-die.is-landed { animation: ts-dice-land .26s ease-out; }

        @keyframes ts-dice-tumble {
            0%   { transform: translate(0, 0) rotate(0deg); }
            25%  { transform: translate(-3px, -4px) rotate(-14deg); }
            50%  { transform: translate(2px, -6px) rotate(10deg); }
            75%  { transform: translate(3px, -2px) rotate(-8deg); }
            100% { transform: translate(0, 0) rotate(0deg); }
        }
        @keyframes ts-dice-land {
            0%   { transform: scale(1.12); }
            60%  { transform: scale(.96); }
            100% { transform: scale(1); }
        }

        .ts-dice-sr {
            position: absolute !important;
            width: 1px; height: 1px;
            margin: -1px; padding: 0; border: 0;
            overflow: hidden;
            clip: rect(0 0 0 0);
            white-space: nowrap;
        }

        @media (prefers-reduced-motion: reduce) {
            .ts-die, .ts-pip { transition: none; }
            .ts-die.is-rolling, .ts-die.is-landed { animation: none; }
            .ts-die.is-selectable:hover, .ts-die.is-selected { transform: none; }
        }
    `;

    const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const randomFace = () => 1 + Math.floor(Math.random() * 6);
    const validFace = (v) => Number.isInteger(v) && v >= 1 && v <= 6;
    const toIndexes = (v) => (Array.isArray(v) ? v : [v]).map(Number).filter(Number.isInteger);

    class PluginDice {
        constructor($el, opts) {
            return this.initialize($el, opts);
        }

        initialize($el, opts) {
            if ($el.data(instanceName)) {
                return this;
            }

            this.$el      = $el;
            this._uid     = ++seq;
            this._ns      = `.tsdice${this._uid}`;
            this._dice    = [];
            this._rolling = null;

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
            this.options = $.extend(true, {}, PluginDice.defaults, opts, {
                wrapper: this.$el
            });
            const count = parseInt(this.options.count, 10);
            this.options.count = Number.isInteger(count) && count > 0 ? Math.min(count, 50) : PluginDice.defaults.count;
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

            self._initialHTML = self.$el.html();
            self.$el.empty().addClass('ts-dice').attr({ role: 'group', 'aria-label': o.labels.group });
            if (o.size === 'sm' || o.size === 'lg') self.$el.addClass(`ts-dice--${o.size}`);
            if (o.center) self.$el.addClass('ts-dice--center');
            if (!o.redOne) self.$el.addClass('ts-dice--plain');

            const values = Array.isArray(o.values) ? o.values : [];
            const held   = Array.isArray(o.held) ? o.held : [];

            for (let i = 0; i < o.count; i++) {
                const $die = $('<button type="button" class="ts-die"></button>').attr('data-index', i);
                for (let p = 0; p < 9; p++) $die.append('<span class="ts-pip" aria-hidden="true"></span>');
                self.$el.append($die);
                self._dice.push({
                    $el: $die,
                    value: validFace(values[i]) ? values[i] : null,
                    held: Boolean(held[i]),
                    selected: false
                });
            }

            // A polite live region announces throws to screen readers
            self.$live = $('<span class="ts-dice-sr" aria-live="polite"></span>').appendTo(self.$el);

            self._dice.forEach((d, i) => self._paint(i));
            self._syncFocus();
            return this;
        }

        events() {
            const self = this;

            self.$el.on(`click${self._ns}`, '.ts-die', function (e) {
                e.preventDefault();
                self._focusIndex = Number(this.getAttribute('data-index'));
                self.toggle(self._focusIndex);
            });

            self.$el.on(`keydown${self._ns}`, '.ts-die', function (e) {
                if (!self.options.selectable) return;
                const i    = Number(this.getAttribute('data-index'));
                const last = self._dice.length - 1;
                let next   = null;

                switch (e.key) {
                    case 'ArrowRight':
                    case 'ArrowDown':  next = i >= last ? 0 : i + 1; break;
                    case 'ArrowLeft':
                    case 'ArrowUp':    next = i <= 0 ? last : i - 1; break;
                    case 'Home':       next = 0; break;
                    case 'End':        next = last; break;
                    default: return;
                }
                e.preventDefault();
                self._focusIndex = next;
                self._syncFocus();
                self._dice[next].$el[0].focus();
            });

            return this;
        }

        // Faces and state

        getValues() {
            return this._dice.map((d) => d.value);
        }

        setValues(values) {
            const list = Array.isArray(values) ? values : [];
            this._dice.forEach((d, i) => {
                if (i < list.length) {
                    d.value = validFace(list[i]) ? list[i] : null;
                    if (d.value === null) d.selected = false;
                    this._paint(i);
                }
            });
            return this;
        }

        getState() {
            return this._dice.map((d) => ({ value: d.value, held: d.held, selected: d.selected }));
        }

        // Accepts [{ value, held }]. Dice whose face or held state changes lose their selection.
        setState(state) {
            const list = Array.isArray(state) ? state : [];
            this._dice.forEach((d, i) => {
                const s = list[i];
                if (!s) return;
                const value = validFace(s.value) ? s.value : null;
                const held  = Boolean(s.held);
                if (value !== d.value || held !== d.held) d.selected = false;
                d.value = value;
                d.held  = held;
                this._paint(i);
            });
            this._syncFocus();
            return this;
        }

        hold(indexes, held = true) {
            toIndexes(indexes).forEach((i) => {
                const d = this._dice[i];
                if (!d) return;
                d.held = Boolean(held);
                if (d.held) d.selected = false;
                this._paint(i);
            });
            this._syncFocus();
            return this;
        }

        release(indexes) {
            return this.hold(indexes, false);
        }

        // Selection

        _canSelect(i) {
            const d = this._dice[i];
            return Boolean(d && this.options.selectable && !this._disabled && !this._rolling && !d.held && d.value !== null);
        }

        select(index, selected = true) {
            const i = Number(index);
            if (!this._canSelect(i)) return this;
            const d = this._dice[i];
            if (d.selected === Boolean(selected)) return this;
            d.selected = Boolean(selected);
            this._paint(i);
            this._emit(EVT_SELECT, { index: i, selected: d.selected, selection: this.getSelected(), values: this.getSelectedValues() });
            if (typeof this.options.onSelect === 'function') this.options.onSelect.call(this, i, d.selected, this.getSelected());
            return this;
        }

        toggle(index) {
            const d = this._dice[Number(index)];
            return d ? this.select(index, !d.selected) : this;
        }

        getSelected() {
            return this._dice.reduce((acc, d, i) => (d.selected ? acc.concat(i) : acc), []);
        }

        getSelectedValues() {
            return this.getSelected().map((i) => this._dice[i].value);
        }

        clearSelection() {
            this._dice.forEach((d, i) => {
                if (d.selected) {
                    d.selected = false;
                    this._paint(i);
                }
            });
            return this;
        }

        setSelectable(on) {
            this.options.selectable = Boolean(on);
            if (!this.options.selectable) this.clearSelection();
            this._dice.forEach((d, i) => this._paint(i));
            this._syncFocus();
            return this;
        }

        enable() {
            this._disabled = false;
            this._dice.forEach((d, i) => this._paint(i));
            this._syncFocus();
            return this;
        }

        disable() {
            this._disabled = true;
            this._dice.forEach((d, i) => this._paint(i));
            this._syncFocus();
            return this;
        }

        // Rolling

        isRolling() {
            return Boolean(this._rolling);
        }

        // Throws the given dice (default: every die that is not held). Final faces come from
        // values when given, otherwise they are random. Resolves with all values once landed.
        roll(indexes, values) {
            const self = this;
            const o    = self.options;

            let list = indexes == null
                ? self._dice.reduce((acc, d, i) => (d.held ? acc : acc.concat(i)), [])
                : toIndexes(indexes).filter((i) => self._dice[i]);
            list = [...new Set(list)];

            const finals = list.map((i, k) => {
                const v = Array.isArray(values) ? values[k] : null;
                return validFace(v) ? v : randomFace();
            });

            if (self._rolling) self._finishRoll(true);

            list.forEach((i) => {
                const d = self._dice[i];
                d.selected = false;
                d.$el.removeClass('is-landed').addClass('is-rolling').attr('aria-busy', 'true');
                d.$el[0].style.setProperty('--dc-tumble', `${0.22 + Math.random() * 0.14}s`);
            });
            self._dice.forEach((d, i) => self._paint(i));

            self._emit(EVT_ROLL, { indexes: list.slice() });
            if (typeof o.onRoll === 'function') o.onRoll.call(self, list.slice());

            const duration = reducedMotion() ? 0 : Math.max(0, Number(o.rollDuration) || 0);

            return new Promise((resolve) => {
                const spin = duration > 0
                    ? setInterval(() => {
                        list.forEach((i) => {
                            self._dice[i].$el.attr('data-value', randomFace());
                        });
                    }, Math.max(30, Number(o.rollInterval) || 80))
                    : null;

                const done = () => {
                    clearInterval(spin);
                    list.forEach((i, k) => {
                        const d = self._dice[i];
                        d.value = finals[k];
                        d.$el.removeClass('is-rolling').removeAttr('aria-busy');
                        d.$el[0].style.removeProperty('--dc-tumble');
                        if (duration > 0) d.$el.addClass('is-landed');
                    });
                    self._rolling = null;
                    self._dice.forEach((d, i) => self._paint(i));
                    self._syncFocus();
                    self._announce(list);

                    const all = self.getValues();
                    self._emit(EVT_ROLLED, { indexes: list.slice(), values: all });
                    if (typeof o.onRolled === 'function') o.onRolled.call(self, all, list.slice());
                    resolve(all);
                };

                self._rolling = { timer: setTimeout(done, duration), done, spin };
            });
        }

        // Ends a running throw at once (used when a new throw starts mid animation)
        _finishRoll() {
            if (!this._rolling) return;
            clearTimeout(this._rolling.timer);
            this._rolling.done();
        }

        // Rendering

        _paint(i) {
            const d   = this._dice[i];
            const o   = this.options;
            const $el = d.$el;
            const selectable = this._canSelect(i);

            $el.attr('data-value', d.value === null ? '' : d.value);
            if (d.value === null && o.emptyFace === 'index') $el.attr('data-value', (i % 6) + 1);

            $el.toggleClass('is-empty', d.value === null)
               .toggleClass('is-held', d.held)
               .toggleClass('is-selected', d.selected)
               .toggleClass('is-selectable', selectable);

            if (o.selectable) {
                $el.attr('aria-pressed', d.selected ? 'true' : 'false');
                $el.attr('aria-disabled', selectable ? 'false' : 'true');
            } else {
                $el.removeAttr('aria-pressed').attr('aria-disabled', 'true');
            }

            const parts = [o.labels.die.replace('{n}', i + 1) + ':', d.value === null ? o.labels.empty : String(d.value)];
            if (d.held) parts.push(o.labels.held);
            if (d.selected) parts.push(o.labels.selected);
            $el.attr('aria-label', parts.join(' '));
        }

        // Only one die is in the tab order at a time (roving tabindex)
        _syncFocus() {
            const focusable = this._dice.map((d, i) => i).filter((i) => this._canSelect(i));
            if (!focusable.includes(this._focusIndex)) this._focusIndex = focusable.length ? focusable[0] : null;
            this._dice.forEach((d, i) => d.$el.attr('tabindex', i === this._focusIndex ? '0' : '-1'));
        }

        _announce(list) {
            if (!this.$live) return;
            const text = list.map((i) => this._dice[i].value).join(', ');
            this.$live.text(text ? `${this.options.labels.rolled} ${text}` : '');
        }

        _emit(name, detail) {
            this.$el[0].dispatchEvent(new CustomEvent(name, {
                bubbles: true,
                detail: Object.assign({ instance: this }, detail)
            }));
        }

        destroy() {
            const self = this;
            if (self._rolling) {
                clearTimeout(self._rolling.timer);
                clearInterval(self._rolling.spin);
                self._rolling = null;
            }
            self.$el.off(self._ns);
            self.$el
                .removeClass('ts-dice ts-dice--sm ts-dice--lg ts-dice--center ts-dice--plain')
                .removeAttr('role aria-label')
                .html(self._initialHTML)
                .removeData(instanceName);
            self._dice = [];

            instanceCount--;
            if (instanceCount <= 0) {
                instanceCount = 0;
                const styleEl = document.getElementById(STYLE_ID);
                if (styleEl) styleEl.remove();
            }
            return this;
        }
    }

    PluginDice.defaults = {
        count:        6,          // number of dice in the tray
        values:       [],         // starting faces, null or missing for an empty face
        held:         [],         // starting held flags
        selectable:   false,      // dice can be picked by click or keyboard
        size:         'md',       // 'sm' | 'md' | 'lg', or set --ts-dice-size
        center:       false,      // center the dice in the tray
        redOne:       true,       // draw the single pip of a one larger and in red
        emptyFace:    'blank',    // 'blank' draws no pips, 'index' shows faces 1 to 6 in order
        rollDuration: 900,        // ms a throw tumbles before landing (0 lands at once)
        rollInterval: 80,         // ms between face changes while tumbling
        labels: {
            group:    'Dice',
            die:      'Die {n}',
            empty:    'not thrown',
            held:     'set aside',
            selected: 'selected',
            rolled:   'Rolled'
        },
        onSelect:     null,       // function (index, selected, selection) {}
        onRoll:       null,       // function (indexes) {}
        onRolled:     null        // function (values, indexes) {}
    };

    $.extend(themestrap, { PluginDice });

    // jQuery bridge. Accepts an options object or a method name with arguments:
    //   $('#tray').themestrapPluginDice('roll', [0, 1]);
    $.fn.themestrapPluginDice = function (opts) {
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
            return new PluginDice($this, typeof opts === 'object' ? opts : undefined);
        });
    };

})).apply(this, [window.themestrap, jQuery]);
