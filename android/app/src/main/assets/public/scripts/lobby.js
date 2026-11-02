// Lobby page: create a game, join one by its code, browse open games, read the rules.
(function ($) {
    "use strict";

    const REFRESH_MS = 5000;
    // How long one server gets to answer before the lobby counts it as down for now. A
    // sleeping server keeps waking up after that, the next check finds it.
    const ANSWER_MS = 10000;
    const $newBtn = $(".new-game-btn");
    const $openGames = $("#openGames");
    const $gameList = $("#openGamesList");
    const $joinForm = $("#joinCode");
    const $codeInput = $("#gameCode");
    const $offline = $("#offlineNote");

    if (App.servers.length > 1) $offline.find("[data-unreachable-text]").text("None of the game servers are answering");

    // What the last check of each server found: true (answered), false (did not), or not
    // checked yet. The apps can have several servers, the website has its own.
    const alive = new Map();
    // Each server's games, from its last answer
    const roomsBy = new Map();

    // Servers to try, best first: the one used last time while it works, then the others
    // that answered, then the rest in case they have come back
    function serverOrder() {
        const order = [...App.servers].sort((a, b) => (alive.get(b) === true) - (alive.get(a) === true));
        if (alive.get(App.server) !== false) {
            order.splice(order.indexOf(App.server), 1);
            order.unshift(App.server);
        }
        return order;
    }

    $newBtn.on("click", () => newGame());

    async function newGame() {
        if ($newBtn.prop("disabled")) return;
        $newBtn.prop("disabled", true);
        const overlay = App.loader("Setting up a table…");
        if (overlay) overlay.show();
        // Down the list until a server makes the game
        for (const server of serverOrder()) {
            try {
                const data = await App.getJSON(App.api("/api/newgame", server), ANSWER_MS);
                alive.set(server, true);
                App.useServer(server);
                window.location.href = App.roomUrl(data.Name, server);
                return;
            } catch (err) {
                alive.set(server, false);
                console.warn("Could not create a game on", server || window.location.origin, err);
            }
        }
        if (overlay) overlay.hide();
        showConnection();
        App.toast("Could not create a game", App.servers.length > 1 ? "None of the game servers answered. Try again in a minute." : "The game server didn't answer. Try again in a minute.", "danger");
    }

    // A game code is five letters. An invite link works too: its last part is the code, and
    // its address can say which server runs the game.
    function codeFrom(text) {
        const value = String(text || "").trim();
        const fromLink = value.match(/\/([a-z]{5})\/?(?:[?#].*)?$/i);
        const code = fromLink ? fromLink[1] : value;
        if (!/^[a-z]{5}$/i.test(code)) return null;
        return { code: code.toLowerCase(), server: fromLink ? App.serverOf(value) : null };
    }

    // The server running a game, asked of every server at once. Null when none has it,
    // undefined when none answered.
    async function findGame(code) {
        let answered = false;
        const found = await Promise.all(App.servers.map(async (server) => {
            try {
                const { rooms } = await App.getJSON(App.api("/api/getrooms", server), ANSWER_MS);
                answered = true;
                alive.set(server, true);
                return rooms.some((r) => r.name === code) ? server : null;
            } catch (err) {
                alive.set(server, false);
                return null;
            }
        }));
        const server = serverOrder().find((s) => found.includes(s));
        return server !== undefined ? server : answered ? null : undefined;
    }

    let searching = false;
    $joinForm.on("submit", async (e) => {
        e.preventDefault();
        if (searching) return;
        const parsed = codeFrom($codeInput.val());
        if (!parsed) {
            $codeInput.addClass("is-invalid").trigger("focus");
            return;
        }
        const { code } = parsed;
        // One server, or a link that names it: straight there. When there is no such game the
        // website sends us back here with ?missing=, the apps say so on the game page.
        if (App.servers.length === 1 || parsed.server) {
            window.location.href = App.roomUrl(code, parsed.server || App.server);
            return;
        }
        searching = true;
        const $btn = $joinForm.find("button[type=submit]").prop("disabled", true);
        const server = await findGame(code);
        searching = false;
        $btn.prop("disabled", false);
        showConnection();
        if (server) {
            window.location.href = App.roomUrl(code, server);
        } else if (server === null) {
            App.toast("Game not found", `There is no open game called "${code}". Check the code, or start a new game.`, "warning", { delay: 6000 });
        } else {
            App.toast("Could not look for the game", "None of the game servers answered. Try again in a minute.", "danger");
        }
    });

    $codeInput.on("input", () => $codeInput.removeClass("is-invalid"));

    // Whether a server can be reached: one answered, or one has not been checked yet.
    // navigator.onLine alone is not enough, it stays true on a Wi-Fi network with no internet.
    function reachable() {
        return App.servers.some((s) => alive.get(s) !== false);
    }

    // Online games need a server, the 3D game does not. No connection at all and servers that
    // do not answer get different notices: the second is not something the player can fix.
    function showConnection() {
        const connected = App.online();
        const online = connected && reachable();
        $offline.prop("hidden", online);
        $offline.find('[data-when="offline"]').prop("hidden", connected);
        $offline.find('[data-when="unreachable"]').prop("hidden", !connected);
        $newBtn.prop("disabled", !online);
        $joinForm.find("input, button").prop("disabled", !online);
        if (!online) $openGames.prop("hidden", true);
    }
    $(window).on("online offline", () => {
        showConnection();
        refreshGames();
    });

    // Games with players, waiting or in progress, from every server. Each server's answer is
    // shown as it comes, so a slow one does not hold up the others.
    const checking = new Set();

    function refreshGames() {
        if (!App.online()) {
            showConnection();
            return;
        }
        App.servers.forEach(async (server) => {
            if (checking.has(server)) return;
            checking.add(server);
            try {
                const { rooms } = await App.getJSON(App.api("/api/getrooms", server), ANSWER_MS);
                alive.set(server, true);
                roomsBy.set(server, Array.isArray(rooms) ? rooms : []);
            } catch (err) {
                // No usable answer: no connection, the server is down or asleep, or (for the apps)
                // the server does not allow the app's origin, which browsers report the same way
                alive.set(server, false);
                roomsBy.delete(server);
                console.warn("The game server did not answer:", App.api("/api/getrooms", server), err);
            } finally {
                checking.delete(server);
            }
            showConnection();
            showGames();
        });
    }

    function showGames() {
        if (!reachable() || !App.online()) return;
        try {
            const open = [];
            App.servers.forEach((server) => (roomsBy.get(server) || []).forEach((r) => {
                if (r.players > 0) open.push(Object.assign({ server }, r));
            }));
            $gameList.empty();
            open.forEach((r) => {
                const $item = $('<a class="list-group-item list-group-item-action"></a>').attr("href", App.roomUrl(r.name, r.server));
                const $text = $('<div class="flex-grow-1"></div>')
                    .append($('<div class="fw-bold"></div>').text(r.host ? `${r.host}'s game` : r.name))
                    .append($('<small class="text-body-secondary"></small>').text(r.name));
                const $badge = r.started
                    ? $('<span class="badge text-bg-secondary">in progress</span>')
                    : $('<span class="badge text-bg-primary"></span>').text(`${r.players}/${r.maxPlayers} players`);
                $item.append('<i class="bi bi-dice-5" aria-hidden="true"></i>', $text, $badge);
                $gameList.append($item);
            });
            $openGames.prop("hidden", open.length === 0);
        } catch (err) {
            $openGames.prop("hidden", true);
        }
    }

    // The server sends people here when they follow a link to a game that has ended
    const missing = new URLSearchParams(window.location.search).get("missing");
    if (missing) {
        $(() => App.toast("Game not found", `There is no open game called "${missing}". Start a new one below.`, "warning", { delay: 6000 }));
        window.history.replaceState(null, "", "/");
    }

    // The "New online game" shortcut on the installed app's icon
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
        window.history.replaceState(null, "", "/");
        if (App.online()) newGame();
    }

    showConnection();
    refreshGames();
    setInterval(refreshGames, REFRESH_MS);
})(jQuery);