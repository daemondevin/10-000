// Lobby page: create a game, browse open games, read the rules.
(function ($) {
    "use strict";

    const REFRESH_MS = 5000;
    const $newBtn = $(".new-game-btn");
    const $openGames = $("#openGames");
    const $gameList = $("#openGamesList");

    $newBtn.on("click", async () => {
        if ($newBtn.prop("disabled")) return;
        $newBtn.prop("disabled", true);
        const overlay = App.loader("Setting up a table…");
        if (overlay) overlay.show();
        try {
            const resp = await fetch("/api/newgame");
            if (!resp.ok) throw new Error(`server answered ${resp.status}`);
            const data = await resp.json();
            window.location.href = "/" + encodeURIComponent(data.Name);
        } catch (err) {
            console.error(err);
            if (overlay) overlay.hide();
            $newBtn.prop("disabled", false);
            App.toast("Could not create a game", "Is the server running?", "danger");
        }
    });

    // Games with players, waiting or in progress
    async function refreshGames() {
        try {
            const resp = await fetch("/api/getrooms");
            const { rooms } = await resp.json();
            const open = rooms.filter((r) => r.players > 0);
            $gameList.empty();
            open.forEach((r) => {
                const $item = $('<a class="list-group-item list-group-item-action"></a>').attr("href", "/" + encodeURIComponent(r.name));
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

    refreshGames();
    setInterval(refreshGames, REFRESH_MS);
})(jQuery);
