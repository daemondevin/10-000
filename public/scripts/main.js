// Online game page. The server owns the game: this file sends the player's choices and
// draws whatever state the server broadcasts, using Themestrap plugins for the UI.
(function ($) {
    "use strict";

    const { scoreSelection } = window.FarkleScoring;
    const room = window.location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
    const TOKEN_KEY = `farkle:${room}:token`;
    const NAME_KEY = "farkle:name";

    const socket = io();

    let state = null;
    let me = null;
    let lastSeq = 0;
    let animating = false;
    let joining = false;
    let unread = 0;
    const playerRows = new Map();

    const $start = $("#start");
    const $joinBtn = $(".join-btn");
    const $startBtn = $("#GameStart");
    const $rollBtn = $("#rollBtn");
    const $bankBtn = $("#Bank");
    const $status = $("#turnStatus");
    const $playerList = $("#PlayerList");
    const $chatBtn = $("#toggleChat");
    const $unread = $("#chatUnread");

    const dice = $("#dice").themestrapPluginDice({
        count: 6,
        selectable: false,
        size: "lg",
        center: true,
        emptyFace: "index",
        rollDuration: 900
    })[0];

    const loader = App.loader("Connecting to the table…");
    if (loader) loader.show();

    $("#roomCode").text(room);

    function setLabel($btn, text) {
        $btn.find(".label-text").text(text);
    }

    function joinDialog() {
        return $("#join-dialog").data("__pluginDialog") || $("#join-dialog").themestrapPluginDialog()[0];
    }

    // Connection

    socket.on("connect", () => {
        socket.emit("watch", { room, token: App.storage.session.get(TOKEN_KEY) });
    });

    socket.on("disconnect", () => {
        if (loader) {
            loader.setMessage("Connection lost. Reconnecting… your seat is kept for a minute.");
            loader.show();
        }
    });

    socket.on("missing", async () => {
        if (loader) loader.hide();
        await themestrap.PluginDialog.alert({
            title: "Game not found",
            message: "This game no longer exists. You will be taken back to the lobby."
        });
        window.location.href = "/";
    });

    socket.on("joined", (player) => {
        me = player;
        joining = false;
        App.storage.session.set(TOKEN_KEY, player.token);
        $chatBtn.prop("disabled", false);
        render();
    });

    socket.on("problem", (message) => {
        joining = false;
        App.toast("Hold on", message, "warning");
        render();
    });

    socket.on("state", (next) => {
        const prev = state;
        state = next;
        if (loader && loader.isVisible()) loader.hide();

        const event = next.lastEvent;
        const firstState = lastSeq === 0;
        const isNewEvent = Boolean(event && event.seq > lastSeq);
        if (isNewEvent) lastSeq = event.seq;

        if (!firstState && isNewEvent && (event.type === "roll" || event.type === "farkle")) {
            // The result of a throw is only announced once the dice have landed
            throwDice(prev, next, event.thrown || []).then(() => announce(event));
            render();
            return;
        }

        if (!animating) dice.setState(next.dice);
        if (prev && prev.turnPlayerId !== next.turnPlayerId) dice.clearSelection();
        if (!firstState && isNewEvent) announce(event);
        render();
    });

    // Tumbles the thrown dice from their current faces onto the server's result
    function throwDice(prev, next, thrown) {
        animating = true;
        const current = dice.getValues();
        dice.setState(next.dice.map((d, i) => (thrown.includes(i) ? { value: current[i], held: false } : d)));
        return dice.roll(thrown, thrown.map((i) => next.dice[i].value)).then(() => {
            animating = false;
            dice.setState(state.dice);
            render();
        });
    }

    socket.on("msg", (msg) => {
        addChat(msg.system ? null : msg.sender, msg.msg, { system: msg.system });
    });

    socket.on("gamewon", (winner) => {
        const mine = Boolean(me && state && state.players.some((p) => p.id === me.id && p.name === winner.name));
        themestrap.PluginDialog.alert({
            title: mine ? "You win!" : `${winner.name} wins!`,
            message: `${mine ? "You" : winner.name} banked ${App.number(winner.score)} points.\n\nThe host can start another game with the same players.`,
            confirmLabel: "Nice"
        });
    });

    socket.on("playerDisconect", (player) => {
        App.toast(`${player.name} left`, player.hadTurn ? "The dice pass to the next player." : "The game carries on.", "dark");
    });

    function announce(event) {
        if (!event) return;
        const you = Boolean(me && event.player === me.name);
        const who = you ? "You" : event.player;
        switch (event.type) {
            case "start":
                App.toast("Game on!", `${who} ${you ? "go" : "goes"} first.`, "info");
                break;
            case "farkle":
                App.toast("Farkle!", event.lost ? `${who} lost ${App.number(event.lost)} points.` : `${who} threw nothing that scores.`, "danger");
                break;
            case "roll":
                if (event.hotDiceReady) {
                    App.toast("Hot Dice!", you
                        ? "Every die you threw scores. Keep them all to throw all six again, or bank."
                        : `Every die ${event.player} threw scores.`, "warning", { delay: 4500 });
                }
                break;
            case "bank":
                App.toast(`${who} banked ${App.number(event.banked)}`, "", "success");
                break;
            case "away":
                App.toast(`${event.player} disconnected`, "Their seat is kept for a minute.", "dark");
                break;
            case "back":
                if (!you) App.toast(`${event.player} is back`, "", "dark");
                break;
        }
    }

    // Joining

    $joinBtn.on("click", () => {
        if (joining || me || (state && state.started)) return;
        $("#join-name").val(App.storage.local.get(NAME_KEY, "")).removeClass("is-invalid");
        joinDialog().open();
    });

    $("#join-form").on("submit", (e) => {
        e.preventDefault();
        const $name = $("#join-name");
        const name = String($name.val() || "").trim();
        if (!name) {
            $name.addClass("is-invalid").trigger("focus");
            return;
        }
        App.storage.local.set(NAME_KEY, name);
        joining = true;
        socket.emit("playerjoin", { name });
        joinDialog().close();
        render();
    });

    $("#join-name").on("input", function () {
        $(this).removeClass("is-invalid");
    });

    // Turn controls

    $startBtn.on("click", () => socket.emit("GameStart"));
    $rollBtn.on("click", () => {
        if (!$rollBtn.prop("disabled")) socket.emit("roll", { keep: dice.getSelected() });
    });
    $bankBtn.on("click", () => {
        if (!$bankBtn.prop("disabled")) socket.emit("bank", { keep: dice.getSelected() });
    });

    // Picking dice changes the score preview and the buttons
    document.getElementById("dice").addEventListener("ts.dice.select", () => render());

    // Rendering

    function isMyTurn() {
        return Boolean(me && state && state.started && state.turnPlayerId === me.id);
    }

    function canChoose() {
        return isMyTurn() && state.phase === "rolled" && !animating;
    }

    // Turn total the given player needs before the server accepts a bank
    function bankThreshold(player) {
        if (!state || !player) return 0;
        return player.entered ? state.minBank || 0 : state.entryScore || 0;
    }

    // Every die on the table (not set aside) scores, so keeping them all gives six new dice
    function hotDiceReady() {
        if (!state || state.phase !== "rolled") return false;
        const free = state.dice.filter((d) => !d.held && d.value != null).map((d) => d.value);
        return free.length > 0 && scoreSelection(free) > 0;
    }

    function selectionInfo() {
        const values = dice.getSelectedValues();
        const points = scoreSelection(values);
        return { count: values.length, points, valid: values.length > 0 && points > 0 };
    }

    function render() {
        if (!state) return;
        const myTurn = isMyTurn();
        dice.setSelectable(canChoose());

        const sel = selectionInfo();
        const turnPlayer = state.players.find((p) => p.id === state.turnPlayerId);
        const host = state.players.find((p) => p.host);
        const amHost = Boolean(me && host && host.id === me.id);
        const myPlayer = me ? state.players.find((p) => p.id === me.id) : null;

        // Join area
        $start.prop("hidden", Boolean(me));
        $joinBtn.prop("disabled", state.started || joining);
        setLabel($joinBtn, state.started ? "Game in progress" : joining ? "Joining…" : "Join");

        // Buttons
        $startBtn.prop("hidden", !(amHost && !state.started));
        setLabel($startBtn, state.winner ? "Play again" : "Start");
        $rollBtn.prop("hidden", !state.started);
        $bankBtn.prop("hidden", !state.started);

        const needed = bankThreshold(myPlayer);
        const pending = state.turnScore + (sel.valid ? sel.points : 0);
        const canRoll = myTurn && !animating && (state.phase === "start" || (state.phase === "rolled" && sel.valid));
        const canBank = myTurn && !animating && state.phase === "rolled" && sel.valid && pending >= needed;
        $rollBtn.prop("disabled", !canRoll);
        $bankBtn.prop("disabled", !canBank).toggleClass("btn-success", canBank).toggleClass("btn-light border", !canBank);

        const free = state.dice.filter((d, i) => !d.held && !dice.getSelected().includes(i)).length;
        const willThrow = state.phase === "start" || free === 0 ? 6 : free;
        setLabel($rollBtn, canRoll ? `Roll ${willThrow}` : "Roll");
        setLabel($bankBtn, canBank ? `Bank ${App.number(pending)}` : "Bank");

        // Status line
        let text;
        if (!state.started) {
            text = state.winner ? `${state.winner.name} won with ${App.number(state.winner.score)}. ` : "";
            if (!me) text += state.players.length ? "Join to play." : "Be the first to join.";
            else if (amHost) text += state.players.length > 1 ? "Press Start when everyone is here." : "Invite friends, or press Start to play alone.";
            else text += `Waiting for ${host ? host.name : "the host"} to start.`;
        } else {
            const who = myTurn ? "Your" : `${turnPlayer ? turnPlayer.name : "Someone"}'s`;
            text = `${who} turn · ${App.number(state.turnScore)} this turn`;
            if (animating) text = `${myTurn ? "You are" : (turnPlayer ? turnPlayer.name : "Someone") + " is"} rolling…`;
            else if (state.phase === "farkled") text = `${myTurn ? "You" : turnPlayer.name} farkled!`;
            else if (myTurn && state.phase === "start") {
                text += myPlayer && !myPlayer.entered ? ` · Roll! You need ${App.number(needed)} to get on the board` : " · Roll the dice!";
            } else if (myTurn && state.phase === "rolled") {
                if (!sel.count && hotDiceReady()) text += " · Hot Dice! Keep every die to throw all six again";
                else if (!sel.count) text += " · Pick the dice to keep";
                else if (!sel.valid) text += " · Every kept die must score";
                else if (hotDiceReady() && dice.getSelected().length === state.dice.filter((d) => !d.held).length) {
                    text += ` · +${App.number(sel.points)} · Hot Dice! Roll all six again`;
                    if (pending < needed) text += ` · ${App.number(needed - pending)} more to bank`;
                } else {
                    text += ` · +${App.number(sel.points)} selected`;
                    if (pending < needed) text += ` · ${App.number(needed - pending)} more to bank`;
                }
            }
            if (turnPlayer && !turnPlayer.connected) text += " (disconnected, waiting)";
        }
        $status.text(text);

        renderPlayers();
    }

    // One row per player, kept between renders so the score counter and progress bar can animate
    function renderPlayers() {
        const ids = state.players.map((p) => p.id);
        const known = [...playerRows.keys()];
        if (ids.join() !== known.join()) {
            $playerList.empty();
            playerRows.clear();
            state.players.forEach((p) => playerRows.set(p.id, buildPlayerRow(p)));
            if (!state.players.length) {
                $playerList.append('<div class="list-group-item text-body-secondary">Nobody has joined yet.</div>');
            }
        }

        state.players.forEach((p) => {
            const row = playerRows.get(p.id);
            row.$el.toggleClass("is-turn", p.id === state.turnPlayerId && state.started).toggleClass("is-away", !p.connected);
            row.$name.text(p.name);
            row.$you.prop("hidden", !(me && p.id === me.id));
            row.$host.prop("hidden", !p.host);
            row.$away.prop("hidden", p.connected);
            row.$board.prop("hidden", !(state.started && !p.entered));

            if (row.score !== p.score) {
                row.score = p.score;
                row.counter.replay(p.score);
                row.progress.set(Math.min(100, (p.score / state.winningScore) * 100));
            }
        });
    }

    function buildPlayerRow(p) {
        const $el = $('<div class="list-group-item player-row"></div>');
        const $line = $('<div class="player-line"></div>');
        const $name = $('<span class="player-name"></span>').text(p.name);
        const $you = $('<span class="badge rounded-pill text-bg-light border">you</span>');
        const $host = $('<i class="bi bi-star-fill text-warning" title="Host" aria-label="Host"></i>');
        const $away = $('<i class="bi bi-wifi-off text-secondary" title="Disconnected" aria-label="Disconnected"></i>');
        const $board = $('<span class="badge rounded-pill text-bg-secondary" title="Needs one turn of ' + App.number(state.entryScore) + ' to get on the board">not on board</span>');
        const $score = $('<span class="player-score"></span>').text(App.number(p.score));
        const $progress = $("<div></div>");

        $line.append('<span class="turn-dot" aria-hidden="true"></span>', $name, $you, $host, $away, $board, $score);
        $el.append($line, $progress);
        $playerList.append($el);

        const counter = $score.themestrapPluginCounter({ from: p.score, to: p.score, speed: 900, thousandsSeparator: "," })[0];
        const progress = $progress.themestrapPluginProgressBar({
            value: Math.min(100, (p.score / state.winningScore) * 100),
            size: "xs",
            color: "primary",
            duration: 900
        })[0];
        $progress.attr("aria-label", `${p.name}'s progress to ${App.number(state.winningScore)}`);

        return { $el, $name, $you, $host, $away, $board, counter, progress, score: p.score };
    }

    // Chat

    function addChat(sender, text, { system = false, mine = false } = {}) {
        const $line = $('<div class="chat-line"></div>').toggleClass("is-system", system).toggleClass("is-mine", mine);
        if (sender) $line.append($('<span class="chat-sender"></span>').text(sender + ": "));
        $line.append(document.createTextNode(text));
        const log = document.getElementById("chatlog");
        log.appendChild($line[0]);
        log.scrollTop = log.scrollHeight;

        const drawer = App.drawer("chat-drawer");
        if (!mine && !system && !(drawer && drawer.isOpen)) {
            unread++;
            $unread.text(unread).prop("hidden", false);
        }
    }

    $("#chat-form").on("submit", (e) => {
        e.preventDefault();
        const $input = $("#chatmessage");
        const text = String($input.val() || "").trim();
        if (!text || !me) return;
        socket.emit("msg", text);
        addChat("You", text, { mine: true });
        $input.val("");
    });

    $("#chat-drawer").on("drawer:open", () => {
        unread = 0;
        $unread.prop("hidden", true);
        setTimeout(() => $("#chatmessage").trigger("focus"), 50);
    });

    // Invite

    $("#copyInvite").on("click", async () => {
        const link = window.location.origin + "/" + room;
        try {
            await navigator.clipboard.writeText(link);
        } catch (e) {
            const ta = document.createElement("textarea");
            ta.value = link;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
        }
        App.toast("Invite link copied", "Send it to a friend so they can join this game.", "success");
    });
})(jQuery);
