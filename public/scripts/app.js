// Shared page setup for 10,000 with Friends.
// Loaded after Themestrap on every page. Starts the plugins that themestrap.init.js does not
// wire up (drawers and tooltips), shows a loader until the page has finished loading, and
// offers small helpers to the page scripts.
(function ($) {
    "use strict";

    const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    const ROOM = /^[a-z]{5}$/;
    const SERVER_KEY = "farkle:server";

    const cleanServer = (value) => String(value || "").trim().replace(/\/+$/, "");

    // The game servers (scripts/config.js). The website has none listed and uses the server
    // that sent the page, written "". The apps list every server they may use, in order of
    // preference. Each game lives on the server that created it.
    const SERVERS = (function () {
        const listed = [].concat(window.FARKLE_SERVERS || window.FARKLE_SERVER || []).map(cleanServer).filter(Boolean);
        return listed.length ? [...new Set(listed)] : [""];
    })();

    // The server this page talks to: the one named in the address (game pages), else the
    // last one that worked, else the first on the list. Only listed servers are used.
    function startingServer() {
        const named = cleanServer(new URLSearchParams(window.location.search).get("server"));
        if (named && SERVERS.includes(named)) return named;
        try {
            const last = cleanServer(window.localStorage.getItem(SERVER_KEY));
            if (last && SERVERS.includes(last)) return last;
        } catch (err) {
            // Storage can be blocked, the first server will do
        }
        return SERVERS[0];
    }

    const App = {
        servers: SERVERS,

        // The game server's address. Empty on the website, where the server is the one that
        // sent the page.
        server: startingServer(),

        // Switches to a server that answered and remembers it for next time
        useServer(server) {
            server = cleanServer(server);
            if (!SERVERS.includes(server)) return;
            App.server = server;
            try {
                if (server) window.localStorage.setItem(SERVER_KEY, server);
            } catch (err) {
                // Not remembered, the next visit checks the servers again anyway
            }
        },

        // The listed server an address such as an invite link points at, or null
        serverOf(url) {
            try {
                const origin = cleanServer(new URL(url).origin);
                return SERVERS.includes(origin) ? origin : null;
            } catch (err) {
                return null;
            }
        },

        // fetch() for JSON that gives up after timeoutMs, so one slow server cannot hold up the rest
        async getJSON(url, timeoutMs = 10000) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const resp = await fetch(url, { signal: controller.signal, cache: "no-store" });
                if (!resp.ok) throw new Error(`${url} answered ${resp.status}`);
                return await resp.json();
            } finally {
                clearTimeout(timer);
            }
        },

        // Running inside the Android or iOS app (Capacitor), not a browser
        isNative() {
            return Boolean(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
        },

        // A server address for fetch(), for example App.api("/api/newgame")
        api(path, server = App.server) {
            return server + path;
        },

        // A link to share with people outside the app: the website of the server running the game
        publicUrl(path, server = App.server) {
            return (server || window.location.origin) + path;
        },

        // Where a game's page is. The website has /abcde, the apps carry game.html and pass the
        // code, plus the server running the game when there is more than one to choose from.
        roomUrl(code, server = App.server) {
            const room = encodeURIComponent(String(code || "").toLowerCase());
            if (!App.isNative()) return "/" + room;
            const on = SERVERS.length > 1 && server ? "&server=" + encodeURIComponent(server) : "";
            return "/game.html?room=" + room + on;
        },

        // The game code of the page we are on, from /abcde or game.html?room=abcde
        currentRoom() {
            const fromQuery = new URLSearchParams(window.location.search).get("room");
            const fromPath = window.location.pathname.replace(/^\/+|\/+$/g, "");
            const room = String(fromQuery || fromPath).toLowerCase();
            return ROOM.test(room) ? room : "";
        },

        // Shares through the app's share sheet, the browser's, or not at all (returns false)
        async share({ title, text, url }) {
            if (App.isNative() && window.Capacitor.registerPlugin) {
                const Share = App._sharePlugin || (App._sharePlugin = window.Capacitor.registerPlugin("Share"));
                try {
                    await Share.share({ title, text, url, dialogTitle: title });
                    return true;
                } catch (err) {
                    // Closing the share sheet without picking anything also lands here
                    return /cancel/i.test(String(err && err.message));
                }
            }
            if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
                try {
                    await navigator.share({ title, text, url });
                    return true;
                } catch (err) {
                    return Boolean(err && err.name === "AbortError");
                }
            }
            return false;
        },
        // Escapes text for the few places that take HTML, such as toast bodies
        esc(value) {
            return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ESC[c]);
        },

        // False when the browser knows it has no connection
        online() {
            return navigator.onLine !== false;
        },

        // Running as an installed app (the web app, or the Android or iOS app) rather than in a browser tab
        isInstalled() {
            return App.isNative() || window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
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
        // A toggle can be built before this script runs (the page keeps parsing while scripts
        // load), so any that exist already take the settings above too
        $("[data-plugin-darkmode]").each(function () {
            const toggle = $(this).data("__darkMode");
            if (toggle) toggle.setOptions({})._refreshUI(themestrap.PluginDarkMode.getTheme());
        });
    }

    // Installable app

    // The service worker keeps the game's files so the installed app opens offline. Browsers
    // only allow it on https, or on localhost while developing, so a LAN address such as
    // http://192.168.1.10:3030 plays normally but cannot be installed.
    // The Android and iOS apps carry their files already, so they need no service worker.
    let updateAccepted = false;
    if ("serviceWorker" in navigator && window.isSecureContext && !App.isNative()) {
        $(window).on("load", () => {
            navigator.serviceWorker.register("/sw.js").then((registration) => {
                // A new version waiting from an earlier visit, or one arriving while the page is open
                if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration.waiting);
                registration.addEventListener("updatefound", () => {
                    const worker = registration.installing;
                    if (!worker) return;
                    worker.addEventListener("statechange", () => {
                        if (worker.state === "installed" && navigator.serviceWorker.controller) offerUpdate(worker);
                    });
                });
            }).catch((err) => console.warn("The game will not work offline, the service worker failed:", err));
        });

        // Reload once the new version has taken over, only when the player asked for it
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (!updateAccepted) return;
            updateAccepted = false;
            window.location.reload();
        });
    }

    // The player decides when to reload, in the middle of a game is a bad moment
    function offerUpdate(worker) {
        App.toast("A new version is ready", "Reload to play the latest version of 10,000.", "info", {
            autoDismiss: false,
            dismissible: true,
            actions: [{ label: "Reload", key: "reload", variant: "primary" }],
            onAction(key) {
                if (key === "reload") {
                    updateAccepted = true;
                    worker.postMessage({ type: "SKIP_WAITING" });
                }
                this.dismiss();
            }
        });
    }

    // Install buttons ([data-install-app]). Chrome, Edge and Android offer an install prompt the
    // page can open. iPhone and iPad have none, so those players get the steps instead.
    let installPrompt = null;
    const isApple = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    function showInstallButtons() {
        const offer = !App.isInstalled() && (installPrompt || isApple);
        $("[data-install-app]").prop("hidden", !offer);
    }

    window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        installPrompt = e;
        showInstallButtons();
    });

    window.addEventListener("appinstalled", () => {
        installPrompt = null;
        showInstallButtons();
        App.toast("Installed", "10,000 is on this device now, open it like any other app.", "success");
    });

    $(document).on("click.app", "[data-install-app]", async () => {
        if (installPrompt) {
            const prompt = installPrompt;
            installPrompt = null;
            prompt.prompt();
            await prompt.userChoice;
            showInstallButtons();
        } else if (isApple) {
            App.toast(
                "Add 10,000 to your Home Screen",
                "In Safari, tap the Share button (the square with an arrow), then Add to Home Screen.",
                "info",
                { autoDismiss: false, dismissible: true }
            );
        }
    });

    // Page loader until everything (fonts, images, scripts) has arrived
    const pageLoader = App.loader("");
    if (pageLoader && document.readyState !== "complete") {
        pageLoader.show();
        $(window).on("load", () => pageLoader.hide());
    }

    $(() => {
        App.drawers();
        App.tooltips();
        showInstallButtons();

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