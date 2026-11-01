// Lobby page: create a game, join one by its code, browse open games, read the rules.
(function ($) {
    "use strict";

    const REFRESH_MS = 5000;
    const $newBtn = $(".new-game-btn");
    const $openGames = $("#openGames");
    const $gameList = $("#openGamesList");
    const $joinForm = $("#joinCode");
    const $codeInput = $("#gameCode");
    const $offline = $("#offlineNote");

    $newBtn.on("click", () => newGame());

    async function newGame() {
        if ($newBtn.prop("disabled")) return;
        $newBtn.prop("disabled", true);
        const overlay = App.loader("Setting up a table…");
        if (overlay) overlay.show();
        try {
            const resp = await fetch(App.api("/api/newgame"));
            if (!resp.ok) throw new Error(`server answered ${resp.status}`);
            const data = await resp.json();
            window.location.href = App.roomUrl(data.Name);
        } catch (err) {
            console.error(err);
            if (overlay) overlay.hide();
            $newBtn.prop("disabled", false);
            App.toast("Could not create a game", "Is the server running?", "danger");
        }
    }

    // A game code is five letters. An invite link works too, its last part is the code.
    function codeFrom(text) {
        const value = String(text || "").trim();
        const fromLink = value.match(/\/([a-z]{5})\/?(?:[?#].*)?$/i);
        const code = fromLink ? fromLink[1] : value;
        return /^[a-z]{5}$/i.test(code) ? code.toLowerCase() : null;
    }

    $joinForm.on("submit", (e) => {
        e.preventDefault();
        const code = codeFrom($codeInput.val());
        if (!code) {
            $codeInput.addClass("is-invalid").trigger("focus");
            return;
        }
        // When there is no such game the website sends us back here with ?missing=, the apps
        // say so on the game page
        window.location.href = App.roomUrl(code);
    });

    $codeInput.on("input", () => $codeInput.removeClass("is-invalid"));

    // Whether the last call to the server got through. navigator.onLine alone is not enough, it
    // stays true on a Wi-Fi network with no internet.
    let reachable = true;

    // Online games need the server, the 3D game does not
    function showConnection() {
        const online = App.online() && reachable;
        $offline.prop("hidden", online);
        $newBtn.prop("disabled", !online);
        $joinForm.find("input, button").prop("disabled", !online);
        if (!online) $openGames.prop("hidden", true);
    }
    $(window).on("online offline", () => {
        showConnection();
        refreshGames();
    });

    // Games with players, waiting or in progress
    async function refreshGames() {
        if (!App.online()) {
            showConnection();
            return;
        }
        let rooms;
        try {
            const resp = await fetch(App.api("/api/getrooms"));
            ({ rooms } = await resp.json());
            reachable = true;
        } catch (err) {
            // No answer at all: no connection, or the server is down
            reachable = false;
            showConnection();
            return;
        }
        showConnection();
        try {
            const open = rooms.filter((r) => r.players > 0);
            $gameList.empty();
            open.forEach((r) => {
                const $item = $('<a class="list-group-item list-group-item-action"></a>').attr("href", App.roomUrl(r.name));
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
