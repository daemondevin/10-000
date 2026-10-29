// Shared page setup for 10,000 with Friends.
// Loaded after Themestrap on every page. Starts the plugins that themestrap.init.js does not
// wire up (drawers and tooltips), shows a loader until the page has finished loading, and
// offers small helpers to the page scripts.
(function ($) {
    "use strict";

    const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

    const App = {
        // Escapes text for the few places that take HTML, such as toast bodies
        esc(value) {
            return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ESC[c]);
        },

        number(value) {
            return Number(value || 0).toLocaleString();
        },

        // Fire and forget notification. Title and body are plain text.
        // PluginAlert has no "dark" type, its neutral grey stands in for it.
        toast(title, body, type = "info", options = {}) {
            if (!themestrap.PluginAlert) return;
            themestrap.PluginAlert.create(Object.assign({
                type: type === "dark" ? "neutral" : type,
                animation: 'fade',
                title: App.esc(title),
                message: App.esc(body),
                showIcon: false,
                dismissible: false,
                autoDismiss: true,
                pauseOnHover: false,
                delay: 5000
            }, options));
        },

        // Tooltips for every [data-plugin-tooltip] in scope that does not have one yet
        tooltips(scope) {
            if (typeof $.fn.themestrapPluginTooltip !== "function") return;
            $(scope || document).find("[data-plugin-tooltip]:not(.manual)").each(function () {
                const $el = $(this);
                $el.themestrapPluginTooltip(themestrap.fn.getOptions($el.data("plugin-options")));
            });
        },

        // Updates a tooltip's text, creating the tooltip when needed
        setTooltip($el, text) {
            $el = $($el);
            $el.attr("data-plugin-tooltip", text);
            const tip = $el.data("__pluginTooltip");
            if (tip) tip.setContent(text);
        },

        drawers() {
            if (typeof $.fn.themestrapPluginDrawer !== "function") return;
            $("[data-plugin-drawer]").each(function () {
                const $el = $(this);
                $el.themestrapPluginDrawer(themestrap.fn.getOptions($el.data("plugin-options")));
            });
        },

        drawer(id) {
            return $("#" + id).data("__pluginDrawer") || null;
        },

        // Full page overlay. Returns the PluginLoadingOverlay instance.
        loader(message, options = {}) {
            if (typeof $.fn.themestrapPluginLoadingOverlay !== "function") return null;
            const $body = $("body");
            let overlay = $body.data("__pluginLoadingOverlay");
            if (!overlay) {
                overlay = $body.themestrapPluginLoadingOverlay(Object.assign({
                    type: "dots",
                    color: "#2185d0",
                    message: message || ""
                }, options))[0];
            } else if (message != null) {
                overlay.setMessage(message);
            }
            return overlay;
        },

        storage: {
            // Per tab, so two tabs can be two players
            session: themestrap.fn.createStorage({ backend: storageBackend("sessionStorage") }),
            // Per browser, for conveniences such as the last name used
            local: themestrap.fn.createStorage({ backend: storageBackend("localStorage") })
        }
    };

    // Falls back to memory when a browser blocks storage (private windows, strict settings)
    function storageBackend(name) {
        try {
            const probe = "__app_probe__";
            window[name].setItem(probe, probe);
            window[name].removeItem(probe);
            return name;
        } catch (e) {
            return "memory";
        }
    }

    window.App = App;

    // Light and dark theme. Set before the toggles are built so every toggle picks this up.
    // The game has no server side theming, so the cookie is left off. The plugin also puts a
    // native title on the toggle, which is swapped for the themed tooltip the other buttons use.
    if (themestrap.PluginDarkMode) {
        $.extend(themestrap.PluginDarkMode.defaults, {
            cookieEnabled: false,
            onChange(theme) {
                const label = this.$el.attr("aria-label");
                this.$el.removeAttr("title");
                App.setTooltip(this.$el, label);
            }
        });
    }

    // Page loader until everything (fonts, images, scripts) has arrived
    const pageLoader = App.loader("");
    if (pageLoader && document.readyState !== "complete") {
        pageLoader.show();
        $(window).on("load", () => pageLoader.hide());
    }

    $(() => {
        App.drawers();
        App.tooltips();

        // A click usually opens or hides something (a drawer, a dialog, a view), so the hint should
        // not linger. It is hidden again after the show delay in case a pending show was queued.
        $(document).on("click.app", "[data-plugin-tooltip]", function () {
            const tip = $(this).data("__pluginTooltip");
            if (!tip) return;
            tip.hide();
            setTimeout(() => tip.hide(), 200);
        });
    });
})(jQuery);