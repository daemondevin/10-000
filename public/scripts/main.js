// Online game page. The server owns the game: this file sends the player's choices and
// draws whatever state the server broadcasts, using Themestrap plugins for the UI.
(function ($) {
    "use strict";

    const { scoreSelection } = window.FarkleScoring;
    const room = window.location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
    const TOKEN_KEY = `farkle:${room}:token`;
    const NAME_KEY = "farkle:name";
    // Each player picks the flat dice or the 3D table for themselves, remembered per browser
    const VIEW_KEY = "farkle:view";

    const socket = io();

    let state = null;
    let me = null;
    let lastSeq = 0;
    let animating = false;
    let joining = false;
    let unread = 0;
    const playerRows = new Map();
    // Dice the player whose turn it is has picked, as told by the server
    let remote = { turnId: 0, indexes: [] };
    // The turn their own picks were last restored for, after a reload
    let restoredTurn = 0;

    const $start = $("#start");
    const $joinBtn = $(".join-btn");
    const $startBtn = $("#GameStart");
    const $rollBtn = $("#rollBtn");
    const $bankBtn = $("#Bank");
    const $status = $("#turnStatus");
    const $playerList = $("#PlayerList");
    const $chatBtn = $("#toggleChat");
    const $unread = $("#chatUnread");
    const $view3dBtn = $("#toggle3d");
    const $diceBoard = $(".dice-board");
    const $turnBox = $("#turnScoreBox");
    const $turnWho = $("#turnScoreWho");
    const $turnPick = $("#turnScorePick");
    const turnCounter = $("#turnScore").themestrapPluginCounter({ from: 0, to: 0, speed: 700, thousandsSeparator: "," })[0];
    turnCounter.shown = 0;

    // Boards. The flat PluginDice tray and the 3D table offer the same methods, so the rest of
    // this file talks to whichever one is showing through `board`.

    const flatDice = $("#dice").themestrapPluginDice({
        count: 6,
        selectable: false,
        size: "lg",
        center: true,
        emptyFace: "index",
        rollDuration: 900
    })[0];
    // Only clicks and key presses fire this, not setSelected()
    document.getElementById("dice").addEventListener("ts.dice.select", (e) => onPick(e.detail.selection));

    const flatBoard = Object.assign(Object.create(flatDice), {
        name: "2d",
        show() {
            $("#dice").prop("hidden", false);
        },
        hide() {
            $("#dice").prop("hidden", true);
        }
    });
    // Methods borrowed from the plugin instance must run with it as `this`
    ["setState", "roll", "getValues", "setSelectable", "getSelected", "getSelectedValues", "clearSelection", "setSelected"]
        .forEach((m) => (flatBoard[m] = flatDice[m].bind(flatDice)));

    let board = flatBoard;
    let tableBoard = null;
    let tableLoading = null;

    // Loads the 3D table on first use, three.js and the 2 MB dice model only come down then
    function loadTable() {
        if (!tableLoading) {
            tableLoading = import("/scripts/dice3d.js").then(({ DiceTable3D }) => {
                const host = document.getElementById("dice3d");
                const table = new DiceTable3D({
                    canvas: document.getElementById("dice3d-canvas"),
                    overlayHost: host,
                    onSelect: (selection) => onPick(selection)
                });
                tableBoard = Object.assign(Object.create(table), {
                    name: "3d",
                    show() {
                        host.hidden = false;
                        table.resize();
                        table.resume();
                    },
                    hide() {
                        host.hidden = true;
                        table.pause();
                    }
                });
                ["setState", "roll", "getValues", "setSelectable", "getSelected", "getSelectedValues", "clearSelection", "setSelected"]
                    .forEach((m) => (tableBoard[m] = table[m].bind(table)));
                tableBoard.table = table;
                return tableBoard;
            });
        }
        return tableLoading;
    }

    async function setView(view) {
        if (animating) return;
        let next = flatBoard;
        if (view === "3d") {
            $view3dBtn.prop("disabled", true);
            try {
                next = await loadTable();
            } catch (err) {
                console.error(err);
                App.toast("3D table unavailable", "The 3D dice could not be loaded, staying with the flat dice.", "warning");
                next = flatBoard;
            } finally {
                $view3dBtn.prop("disabled", false);
            }
            // A throw may have started while the table loaded
            if (animating) return;
        }
        const picked = board.getSelected();
        board.hide();
        board = next;
        board.show();
        $diceBoard.toggleClass("is-3d", board.name === "3d");
        if (state) board.setState(state.dice);
        if (isMyTurn()) board.setSelected(picked);
        App.storage.local.set(VIEW_KEY, board.name);
        $view3dBtn.attr("aria-pressed", board.name === "3d" ? "true" : "false").toggleClass("active", board.name === "3d");
        App.setTooltip($view3dBtn, board.name === "3d" ? "Back to the flat dice." : "Throw the dice on the 3D table.");
        render();
    }

    $view3dBtn.on("click", () => setView(board.name === "3d" ? "2d" : "3d"));

    // For tests and the console
    window.__online = {
        get board() { return board; },
        get state() { return state; },
        get animating() { return animating; }
    };
    if (App.storage.local.get(VIEW_KEY) === "3d") setView("3d");

    // The player picked or dropped a die, the others see it straight away
    function onPick(selection) {
        if (!canChoose()) return;
        socket.emit("select", { keep: selection });
        render();
    }

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

        remote = { turnId: next.turnId, indexes: next.selection || [] };

        if (!firstState && isNewEvent && (event.type === "roll" || event.type === "farkle" || event.type === "sixkind")) {
            // The result of a throw is only announced once the dice have landed
            throwDice(prev, next, event.thrown || []).then(() => announce(event));
            render();
            return;
        }

        if (!animating) board.setState(next.dice);
        if (prev && prev.turnId !== next.turnId) board.clearSelection();
        if (!firstState && isNewEvent) announce(event);
        render();
    });

    // Another player picked or dropped a die
    socket.on("selection", (data) => {
        if (!state || !data || data.turnId !== state.turnId) return;
        remote = { turnId: data.turnId, indexes: Array.isArray(data.indexes) ? data.indexes : [] };
        render();
    });

    // Tumbles the thrown dice from their current faces onto the server's result
    function throwDice(prev, next, thrown) {
        animating = true;
        const thrower = board;
        thrower.clearSelection();
        const current = thrower.getValues();
        thrower.setState(next.dice.map((d, i) => (thrown.includes(i) ? { value: current[i], held: false } : d)));
        return thrower.roll(thrown, thrown.map((i) => next.dice[i].value)).then(() => {
            animating = false;
            board.setState(state.dice);
            render();
        });
    }

    socket.on("msg", (msg) => {
        addChat(msg.system ? null : msg.sender, msg.msg, { system: msg.system });
    });

    // The game over dialog comes from the "won" and "sixkind" events in announce(), so a winning
    // throw is shown landing before the dialog covers it

    // Six of a kind in words, "six 4s"
    function sixOf(face) {
        return `six ${face}s`;
    }

    function showWinner(winner) {
        if (!winner) return;
        const mine = Boolean(me && winner.id === me.id);
        const who = mine ? "You" : winner.name;
        const standings = [...state.players]
            // The winner leads the list even with fewer points, after a six of a kind
            .sort((a, b) => (b.id === winner.id) - (a.id === winner.id) || b.score - a.score)
            .map((p, i) => `${i + 1}. ${p.name}  ${App.number(p.score)}`)
            .join("\n");
        const how = winner.reason === "six"
            ? `${who} threw ${sixOf(winner.face)}, an automatic win!`
            : `${who} finished on top with ${App.number(winner.score)} points.`;
        themestrap.PluginDialog.alert({
            title: mine ? "You win!" : `${winner.name} wins!`,
            message: `${how}\n\n${standings}\n\nThe host can start another game with the same players.`,
            confirmLabel: "Nice"
        });
    }

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
                if (event.tookLead) {
                    App.toast(`${who} took the lead!`, `${App.number(event.score)} is now the score to beat.`, "warning", { delay: 4500 });
                } else {
                    App.toast(`${who} banked ${App.number(event.banked)}`, "", "success");
                }
                break;
            case "final":
                App.toast("Final round!", `${who} reached ${App.number(event.score)}. Everyone else gets one last turn to beat it.`, "warning", { delay: 6000 });
                break;
            case "won":
            case "sixkind":
                showWinner(event.winner || state.winner);
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
        if (!$rollBtn.prop("disabled")) socket.emit("roll", { keep: board.getSelected() });
    });
    $bankBtn.on("click", () => {
        if (!$bankBtn.prop("disabled")) socket.emit("bank", { keep: board.getSelected() });
    });

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

    // Picks made by the player whose turn it is, as shown to everyone else
    function watchedPicks() {
        if (!state || !state.started || state.phase !== "rolled" || animating) return [];
        if (remote.turnId !== state.turnId) return [];
        return remote.indexes.filter((i) => state.dice[i] && !state.dice[i].held && state.dice[i].value != null);
    }

    // The current pick and what it is worth: our own on our turn, otherwise the one we watch
    function selectionInfo() {
        const values = isMyTurn()
            ? board.getSelectedValues()
            : watchedPicks().map((i) => state.dice[i].value);
        const points = scoreSelection(values);
        return { count: values.length, points, valid: values.length > 0 && points > 0 };
    }

    function render() {
        if (!state) return;
        const myTurn = isMyTurn();
        board.setSelectable(canChoose());
        if (myTurn) {
            // After a reload the server still knows what we had picked
            if (canChoose() && restoredTurn !== state.turnId) {
                restoredTurn = state.turnId;
                if (!board.getSelected().length && state.selection && state.selection.length) board.setSelected(state.selection);
            }
        } else {
            // Turning picking off clears picks, so the watched ones are drawn after
            board.setSelected(watchedPicks());
        }

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

        const free = state.dice.filter((d, i) => !d.held && !board.getSelected().includes(i)).length;
        const willThrow = state.phase === "start" || free === 0 ? 6 : free;
        setLabel($rollBtn, canRoll ? `Roll ${willThrow}` : "Roll");
        setLabel($bankBtn, canBank ? `Bank ${App.number(pending)}` : "Bank");

        // Status line
        let text;
        if (!state.started) {
            const w = state.winner;
            text = !w ? "" : w.reason === "six"
                ? `${w.name} won with ${sixOf(w.face)}. `
                : `${w.name} won with ${App.number(w.score)}. `;
            if (!me) text += state.players.length ? "Join to play." : "Be the first to join.";
            else if (amHost) text += state.players.length > 1 ? "Press Start when everyone is here." : "Invite friends, or press Start to play alone.";
            else text += `Waiting for ${host ? host.name : "the host"} to start.`;
        } else {
            const who = myTurn ? "Your" : `${turnPlayer ? turnPlayer.name : "Someone"}'s`;
            // The points this turn are on the counter above, the line says what is going on
            text = `${who} turn`;
            if (animating) text = `${myTurn ? "You are" : (turnPlayer ? turnPlayer.name : "Someone") + " is"} rolling…`;
            else if (state.phase === "farkled") text = `${myTurn ? "You" : turnPlayer.name} farkled!`;
            else if (myTurn && state.phase === "start") {
                text += myPlayer && !myPlayer.entered ? ` · Roll! You need ${App.number(needed)} to get on the board` : " · Roll the dice!";
            } else if (myTurn && state.phase === "rolled") {
                if (!sel.count && hotDiceReady()) text += " · Hot Dice! Keep every die to throw all six again";
                else if (!sel.count) text += " · Pick the dice to keep";
                else if (!sel.valid) text += " · Every kept die must score";
                else if (hotDiceReady() && board.getSelected().length === state.dice.filter((d) => !d.held).length) {
                    text += ` · +${App.number(sel.points)} · Hot Dice! Roll all six again`;
                    if (pending < needed) text += ` · ${App.number(needed - pending)} more to bank`;
                } else {
                    text += ` · +${App.number(sel.points)} selected`;
                    if (pending < needed) text += ` · ${App.number(needed - pending)} more to bank`;
                }
            } else if (!myTurn && state.phase === "rolled") {
                // Watching: the picks light up on our dice too
                if (!sel.count) text += " · choosing dice";
                else text += sel.valid ? ` · picked +${App.number(sel.points)}` : " · picking";
            }
            if (state.finalRound && !animating && state.phase !== "farkled") {
                const fr = state.finalRound;
                const leader = state.players.find((p) => p.id === fr.leaderId);
                const mover = myTurn ? myPlayer : turnPlayer;
                const toTop = mover ? fr.target - mover.score + 1 : 0;
                text += ` · Final round: ${App.number(toTop)} to beat ${leader ? leader.name : "the leader"}`;
            }
            if (turnPlayer && !turnPlayer.connected) text += " (disconnected, waiting)";
        }
        $status.text(text);

        renderTurnScore(turnPlayer, myTurn, sel);
        renderPlayers();
    }

    // The current player's points this turn, plus what the dice they have picked are worth,
    // counted up or down with PluginCounter so everyone sees the turn grow
    function renderTurnScore(turnPlayer, myTurn, sel) {
        const show = Boolean(state.started && turnPlayer);
        $turnBox.prop("hidden", !show);
        if (!show) return;
        $turnWho.text(myTurn ? "Your turn" : `${turnPlayer.name}'s turn`);
        const value = state.turnScore + (sel.valid ? sel.points : 0);
        if (turnCounter.shown !== value) {
            turnCounter.shown = value;
            turnCounter.replay(value);
        }
        let note = "";
        if (state.phase === "farkled") note = "Farkle!";
        else if (sel.valid) note = `+${App.number(sel.points)} picked`;
        $turnPick.text(note).toggleClass("text-danger", state.phase === "farkled");
        $turnBox.toggleClass("is-farkle", state.phase === "farkled");
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
            const fr = state.started ? state.finalRound : null;
            row.$lead.prop("hidden", !(fr && fr.leaderId === p.id));
            row.$last.prop("hidden", !(fr && fr.remaining.includes(p.id)));

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
        const $lead = $('<span class="badge rounded-pill text-bg-warning" title="Highest score, the one to beat"><i class="bi bi-trophy-fill me-1" aria-hidden="true"></i>to beat</span>');
        const $last = $('<span class="badge rounded-pill text-bg-info" title="One last turn to beat the leader">last turn</span>');
        const $score = $('<span class="player-score"></span>').text(App.number(p.score));
        const $progress = $("<div></div>");

        $line.append('<span class="turn-dot" aria-hidden="true"></span>', $name, $you, $host, $away, $board, $lead, $last, $score);
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

        return { $el, $name, $you, $host, $away, $board, $lead, $last, counter, progress, score: p.score };
    }

    // Chat

    function addChat(sender, text, { system = false, mine = false } = {}) {
        const $line = $('<div class="chat-line"></div>').toggleClass("is-system", system).toggleClass("is-mine", mine);
        if (sender) $line.append($('<span class="chat-sender"></span>').text(sender + ": "));
        $line.append(document.createTextNode(text));

        // PluginScrollbar moves the log's content into its own container, new lines go there
        // and the scrollbar is asked to scroll to the end
        const $log = $("#chatlog");
        const scrollbar = $log.data("__scrollbar");
        const $content = $log.find(".ts-scrollbox-container").first();
        ($content.length ? $content : $log).append($line);
        if (scrollbar) {
            scrollbar.update().scrollTo("bottom", { scrollInertia: 0 });
        } else {
            $log[0].scrollTop = $log[0].scrollHeight;
        }

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