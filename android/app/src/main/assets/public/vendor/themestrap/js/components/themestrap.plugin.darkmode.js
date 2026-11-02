/**
 * Themestrap Dark Mode Toggle
 *
 * Toggles light / dark theme on the document by adding or removing the
 * `dark` class on the <html> element. Also sets a `data-theme` attribute 
 * and `data-bs-theme` attribute so Bootstrap 5.3 native components pick 
 * up the theme too.
 *
 * Resolution order on first paint:
 *   1. localStorage[options.storageKey]            // explicit user choice
 *   2. window.matchMedia('(prefers-color-scheme: dark)')
 *   3. light
 *
 * The plugin runs its theme-apply step the moment the script executes
 * (before DOMReady) so the correct class is on <html> as early as
 * possible, minimizing flash-of-unstyled-content.
 *
 * Persistence:
 *   - Manual clicks save to localStorage.
 *   - Optionally also writes a cookie (off by default) so the server can
 *     read the theme at render time. Enable by setting
 *     `PluginDarkMode.defaults.cookieEnabled = true` before the first
 *     instance is created. See the cookie* options below for tuning.
 *   - Until a manual click has occurred, the page follows OS-level
 *     `prefers-color-scheme` changes in real time.
 *   - `storage` events propagate theme changes between tabs.
 *
 * Markup (auto-init via [data-plugin-darkmode]):
 *   <button data-plugin-darkmode></button>
 *
 *   The plugin injects an SVG sun (light mode) or moon (dark mode) so the
 *   icon reflects the *current* theme.
 *
 * Programmatic API:
 *   themestrap.PluginDarkMode.getTheme()       // 'light' | 'dark'
 *   themestrap.PluginDarkMode.setTheme('dark') // persist + apply
 *   themestrap.PluginDarkMode.toggle()         // flip current theme
 *   themestrap.PluginDarkMode.reset()          // clear override, follow OS
 *   themestrap.PluginDarkMode.apply()          // re-run resolution order
 *
 * Init.js wiring:
 *   if ($.isFunction($.fn['themestrapPluginDarkMode']) && $('[data-plugin-darkmode]').length) {
 *       themestrap.fn.intObsInit('[data-plugin-darkmode]:not(.manual)', 'themestrapPluginDarkMode');
 *   }
 *
 * Optional FOUC-proof head snippet (place BEFORE any CSS in <head>):
 *   <script>
 *     (function(){
 *       try {
 *         var s = localStorage.getItem('themestrap-theme'),
 *             d = matchMedia('(prefers-color-scheme: dark)').matches,
 *             t = s || (d ? 'dark' : 'light'),
 *             h = document.documentElement;
 *         if (t === 'dark') h.classList.add('dark');
 *         h.setAttribute('data-theme', t);
 *         h.setAttribute('data-bs-theme', t);
 *       } catch(e) {}
 *     })();
 *   </script>
 */
(((themestrap = {}, $) => {
    const instanceName = '__darkMode';

    // Sun / moon SVGs (uses currentColor so the icon picks up the button's text color).
    const ICON_SUN = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><g stroke-linejoin="round" stroke-linecap="round" stroke-width="1.5" fill="none" stroke="currentColor"><path d="M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0m-4-9v2m0 14.004v2M5 12H3m18 0h-2m0-7-2 2M5 5l2 2m0 10-2 2m14 0-2-2"></path></g></svg>';
    const ICON_MOON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><path visibility="visible" fill="currentColor" fill-rule="evenodd" stroke-linecap="round" stroke-linejoin="round" d="M12,2.5C17.22,2.5,21.5,6.78,21.5,12C21.5,17.22,17.22,21.5,12,21.5C6.78,21.5,2.5,17.22,2.5,12C2.5,6.78,6.78,2.5,12,2.5 M12.1,4C7.68,4,4.1,7.58,4.1,12C4.1,16.42,7.68,20,12.1,20C16.52,20,20.1,16.42,20.1,12C20.1,7.58,16.52,4,12.1,4 M12.6,14C13.43,14,14.1,14.67,14.1,15.5C14.1,16.33,13.43,17,12.6,17C11.77,17,11.1,16.33,11.1,15.5C11.1,14.67,11.77,14,12.6,14 M8.1,11C8.65,11,9.1,11.45,9.1,12C9.1,12.55,8.65,13,8.1,13C7.55,13,7.1,12.55,7.1,12C7.1,11.45,7.55,11,8.1,11 M14.5,8C15.28,8,16,8.72,16,9.5C16,10.28,15.28,11,14.5,11C13.72,11,13,10.28,13,9.5C13,8.72,13.72,8,14.5,8 M14.45,8.8C14.02,8.8,13.7,9.12,13.7,9.55C13.7,9.98,14.02,10.3,14.45,10.3C14.88,10.3,15.2,9.98,15.2,9.55C15.2,9.12,14.88,8.8,14.45,8.8"></path></g></svg>';

    // Module-level config. Live instances may override per-element, but the
    // *global* theme application uses these. They are mutable through
    // `PluginDarkMode.defaults.*` before the first instance is constructed.
    const config = {
        storageKey:    'themestrap-theme',
        darkClass:     'dark',
        dataAttribute: 'data-theme',
        bsThemeAttribute: 'data-bs-theme',

        // Cookie sync (server-side theme support). Off by default - opt-in
        // because cookies travel on every HTTP request and not every site
        // needs server-side theme awareness.
        cookieEnabled:  false,
        cookieName:     'themestrap-theme',
        cookieMaxAge:   31536000,    // 1 year, in seconds
        cookiePath:     '/',
        cookieSameSite: 'lax',
    };

    // Set of live instances; we notify each on theme change so every toggle
    // button on the page agrees on icon / aria state.
    const instances = new Set();

    function safeRead() {
        try { return window.localStorage?.getItem(config.storageKey) || null; }
        catch { return null; }
    }

    function safeWrite(value) {
        try { window.localStorage?.setItem(config.storageKey, value); }
        catch { /* private mode, quota, etc.  fail silently */ }
    }

    function safeClear() {
        try { window.localStorage?.removeItem(config.storageKey); }
        catch { /* same */ }
    }

    // Cookie helpers - all guarded so they cannot break the plugin if the
    // host environment forbids document.cookie writes.
    function writeCookie(value) {
        if (!config.cookieEnabled) return;
        try {
            const parts = [
                `${encodeURIComponent(config.cookieName)}=${encodeURIComponent(value)}`,
                `path=${config.cookiePath}`,
                `max-age=${config.cookieMaxAge}`,
                `samesite=${config.cookieSameSite}`,
            ];
            // Auto-flag Secure when SameSite=None (browsers reject otherwise)
            // and when the page itself is on https.
            if (config.cookieSameSite.toLowerCase() === 'none'
                    || (typeof location !== 'undefined' && location.protocol === 'https:')) {
                parts.push('secure');
            }
            document.cookie = parts.join('; ');
        } catch { /* SecurityError, etc. - fail silently */ }
    }

    function clearCookie() {
        if (!config.cookieEnabled) return;
        try {
            document.cookie =
                `${encodeURIComponent(config.cookieName)}=; ` +
                `path=${config.cookiePath}; max-age=0; samesite=${config.cookieSameSite}`;
        } catch { /* same */ }
    }

    function systemPrefersDark() {
        return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    function resolveTheme() {
        const stored = safeRead();
        if (stored === 'dark' || stored === 'light') return stored;
        return systemPrefersDark() ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        const html = document.documentElement;
        const isDark = theme === 'dark';

        html.classList.toggle(config.darkClass, isDark);

        if (config.dataAttribute) {
            html.setAttribute(config.dataAttribute, theme);
        }
        if (config.bsThemeAttribute) {
            html.setAttribute(config.bsThemeAttribute, theme);
        }

        // Refresh every live instance so the icon and aria state are in sync.
        instances.forEach((inst) => inst._refreshUI && inst._refreshUI(theme));
    }

    // Early-apply
    // Run immediately on script load, before DOMReady, so the correct class
    // is on <html> as early as the parser will allow. Wrapped in try/catch
    // because the script might run in odd contexts (very early errors here
    // would block the rest of the plugin from registering).
    try { applyTheme(resolveTheme()); } catch (e) { /* no-op */ }

    // System-preference listener
    // Track OS-level theme changes, but only honor them when the user
    // hasn't pinned a preference via a manual toggle (no localStorage value).
    const mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    if (mql) {
        const handler = (e) => {
            if (!safeRead()) applyTheme(e.matches ? 'dark' : 'light');
        };
        if (typeof mql.addEventListener === 'function') {
            mql.addEventListener('change', handler);
        } else if (typeof mql.addListener === 'function') {
            // Safari < 14 fallback
            mql.addListener(handler);
        }
    }

    // Cross-tab sync
    // When the user toggles theme in another tab, mirror it here.
    window.addEventListener('storage', (e) => {
        if (e.key !== config.storageKey) return;
        if (e.newValue === 'dark' || e.newValue === 'light') {
            applyTheme(e.newValue);
        } else if (e.newValue === null) {
            // Preference was cleared elsewhere  fall back to system.
            applyTheme(systemPrefersDark() ? 'dark' : 'light');
        }
    });

    class PluginDarkMode {

        constructor($el, opts) {
            return this.initialize($el, opts);
        }

        initialize($el, opts) {
            if ($el.data(instanceName)) {
                return $el.data(instanceName);
            }

            this.$el = $el;

            this
                .setData()
                .setOptions(opts)
                .build()
                .events();

            instances.add(this);
            return this;
        }

        setData() {
            this.$el.data(instanceName, this);
            return this;
        }

        setOptions(opts) {
            const attrOpts = themestrap.fn.getOptions(this.$el.data('plugin-darkmode-options'));

            this.options = $.extend(true, {}, PluginDarkMode.defaults, opts, attrOpts, {
                wrapper: this.$el,
            });

            // Per-instance options may override the module-level config. The
            // first instance wins; subsequent overrides re-apply the theme
            // using the new attributes/class names.
            let configChanged = false;
            [
                'storageKey', 'darkClass', 'dataAttribute', 'bsThemeAttribute',
                'cookieEnabled', 'cookieName', 'cookieMaxAge', 'cookiePath', 'cookieSameSite',
            ].forEach((k) => {
                if (this.options[k] !== undefined && this.options[k] !== config[k]) {
                    config[k] = this.options[k];
                    configChanged = true;
                }
            });
            if (configChanged) {
                applyTheme(resolveTheme());
                // If cookie sync was just turned on, write the current theme
                // so the server sees it on the next request without waiting
                // for the user to toggle.
                if (config.cookieEnabled) {
                    writeCookie(PluginDarkMode.getTheme());
                }
            }

            return this;
        }

        build() {
            // If element is a <button> make sure it has type="button" so it
            // doesn't accidentally submit a wrapping form.
            if (this.$el.is('button') && !this.$el.attr('type')) {
                this.$el.attr('type', 'button');
            }
            // Non-button elements get keyboard semantics.
            if (!this.$el.is('button, a, [role]')) {
                this.$el.attr('role', 'button');
                if (this.$el.attr('tabindex') === undefined) {
                    this.$el.attr('tabindex', '0');
                }
            }

            this._refreshUI(PluginDarkMode.getTheme());
            return this;
        }

        events() {
            const self = this;

            self.$el.on('click.darkmode', function (e) {
                e.preventDefault();
                PluginDarkMode.toggle();
            });

            // Keyboard activation for non-button toggles. Buttons handle
            // space/enter natively.
            if (!self.$el.is('button')) {
                self.$el.on('keydown.darkmode', function (e) {
                    if (e.key === ' ' || e.key === 'Enter' || e.key === 'Spacebar') {
                        e.preventDefault();
                        PluginDarkMode.toggle();
                    }
                });
            }

            return this;
        }

        // Called by the module-level applyTheme() whenever the theme changes.
        // Updates the icon, aria-pressed and aria-label so the button always
        // reflects current state.
        _refreshUI(theme) {
            const o = this.options;
            const isDark = theme === 'dark';

            if (o.renderIcon) {
                // Sun icon when in LIGHT mode, moon when in DARK mode  the
                // icon represents the current theme, not the action.
                this.$el.html(isDark ? o.iconMoon : o.iconSun);
            }

            // Aria label describes what clicking will *do*.
            const label = isDark ? o.ariaLabelLight : o.ariaLabelDark;
            this.$el.attr({
                'aria-label': label,
                'title': label,
                'aria-pressed': isDark ? 'true' : 'false',
            });

            // Themeable hook classes for styling the toggle itself.
            this.$el
                .toggleClass('is-dark', isDark)
                .toggleClass('is-light', !isDark);

            if (typeof o.onChange === 'function') {
                o.onChange.call(this, theme);
            }

            return this;
        }

        destroy() {
            this.$el.off('.darkmode').removeData(instanceName);
            instances.delete(this);
            return this;
        }

        // Static API
        // All callable without an element instance, e.g. from a settings menu,
        // a keyboard shortcut handler, or another plugin.
        static getTheme() {
            return document.documentElement.classList.contains(config.darkClass) ? 'dark' : 'light';
        }

        static setTheme(theme) {
            if (theme !== 'dark' && theme !== 'light') return;
            safeWrite(theme);
            writeCookie(theme);
            applyTheme(theme);
        }

        static toggle() {
            PluginDarkMode.setTheme(PluginDarkMode.getTheme() === 'dark' ? 'light' : 'dark');
        }

        // Clear any saved override and revert to OS preference.
        static reset() {
            safeClear();
            clearCookie();
            applyTheme(systemPrefersDark() ? 'dark' : 'light');
        }

        // Re-run the full resolution order. Useful after manually changing
        // PluginDarkMode.defaults.storageKey or similar.
        static apply() {
            applyTheme(resolveTheme());
        }
    }

    PluginDarkMode.defaults = {
        // localStorage key. Override before first init to share theme state
        // across multiple Themestrap projects on the same domain.
        storageKey:       'themestrap-theme',

        // Class added to <html> when dark mode is active. Must match the
        // selector Themestrap CSS uses - leave at 'dark' for stock theme.
        darkClass:        'dark',

        // Attribute set on <html> reflecting the current theme.
        // Set to null/false to disable.
        dataAttribute:    'data-theme',

        // Bootstrap 5.3 native theme attribute. Harmless on older Bootstrap.
        // Set to null/false to disable.
        bsThemeAttribute: 'data-bs-theme',

        // Cookie sync. Off by default - turn on for server-side awareness
        // (e.g. when MODX needs to know the theme at render time). When
        // enabled, every setTheme/toggle/reset call also writes (or clears)
        // the cookie alongside localStorage.
        cookieEnabled:    true,
        cookieName:       'themestrap-theme',
        cookieMaxAge:     31536000,    // 1 year, in seconds
        cookiePath:       '/',
        cookieSameSite:   'lax',       // 'lax' | 'strict' | 'none'

        // Whether to inject the SVG icon into the toggle button. Disable if
        // you want to render your own icon/label markup inside the button.
        renderIcon:       true,
        iconSun:          ICON_SUN,
        iconMoon:         ICON_MOON,

        // Accessible labels  describe the *action* of clicking.
        ariaLabelLight:   'Switch to light mode',
        ariaLabelDark:    'Switch to dark mode',

        // function(theme) {  }   called on every theme change for this
        // instance (after the DOM has been updated).
        onChange:         null,
    };

    $.extend(themestrap, { PluginDarkMode });

    $.fn.themestrapPluginDarkMode = function (opts) {
        return this.map(function () {
            const $this = $(this);

            if ($this.data(instanceName)) {
                return $this.data(instanceName);
            }

            return new PluginDarkMode($this, opts);
        });
    };

})).apply(this, [window.themestrap, jQuery]);
