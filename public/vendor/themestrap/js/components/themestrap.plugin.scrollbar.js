/**
 * Themestrap Plugin Scrollbar
 *
 * A self-contained custom scrollbar plugin — zero vendor JS dependencies.
 *
 * Usage — auto-init:
 *   <div data-plugin-scrollbar style="height: 300px; overflow: hidden;">
 *     ...content...
 *   </div>
 *
 *   With options:
 *   <div data-plugin-scrollbar
 *        data-plugin-options='{"axis": "yx", "theme": "dark", "scrollInertia": 400}'>
 *
 * Usage — manual:
 *   $('#sidebar').themestrapPluginScrollbar({ theme: 'rounded-dark' });
 *
 *   const sb = $('#sidebar').data('__scrollbar');
 *   sb.scrollTo('bottom');
 *   sb.update();
 *   sb.destroy();
 *
 * scrollTo() target formats:
 *   sb.scrollTo(300)            — pixel offset
 *   sb.scrollTo('top')          — scroll to top / left
 *   sb.scrollTo('bottom')       — scroll to bottom / right
 *   sb.scrollTo('50%')          — 50 % of the scrollable range
 *   sb.scrollTo('+=150')        — 150 px forward from current position
 *   sb.scrollTo('-=150')        — 150 px back from current position
 *   sb.scrollTo('#myAnchor')    — CSS selector within the content container
 *   sb.scrollTo($('#myAnchor')) — jQuery element
 *   sb.scrollTo([yVal, xVal])   — both axes at once (yx mode)
 *
 * Available themes:
 *   light, dark, light-2, dark-2, thick, thick-dark, thin, thin-dark,
 *   rounded, rounded-dark, rounded-dots, rounded-dots-dark,
 *   3d, 3d-dark, 3d-thick, 3d-thick-dark,
 *   minimal, minimal-dark,
 *   inset, inset-dark, inset-2, inset-2-dark, inset-3, inset-3-dark
 */

// Scrollbar
(((themestrap = {}, $) => {

    const instanceName   = '__scrollbar';

    // Injected stylesheet — runs once per page, keyed to the plugin stylesheet ID.
    const STYLE_ID = 'ts-scrollbar-styles';
    // CSS_TEXT is injected lazily by injectStyles() on first build (see below),
    // so loading this script never adds CSS to pages that don't use the plugin.
    const CSS_TEXT = `
/* Themestrap — PluginScrollbar */
/* 1. CORE LAYOUT */

.tsScrollbar {
    -ms-touch-action: pinch-zoom;
    touch-action: pinch-zoom;
}

.tsScrollbar.ts-scrollbar-no-scrollbar,
.tsScrollbar.ts-scrollbar-touch-action {
    -ms-touch-action: auto;
    touch-action: auto;
}

/* The clipping viewport */
.tsScrollBox {
    position: relative;
    overflow: hidden;
    height: 100%;
    max-width: 100%;
    outline: 0;
    direction: ltr;
}

/* The content container (this element scrolls via top/left CSS) */
.ts-scrollbox-container {
    overflow: hidden;
    width: auto;
    height: auto;
}

/* Inside position: reserve 30 px on the right for the vertical scrollbar */
.ts-scrollbox-inside > .ts-scrollbox-container { margin-right: 30px; }

/* Remove the margin when the vertical scrollbar is not needed */
.ts-scrollbox-inside > .ts-scrollbox-container.ts-scrollbar-no-scrollbar-y.ts-scrollbar-y-hidden { margin-right: 0; }

/* RTL support */
.ts-scrollbar-dir-rtl > .ts-scrollbox-inside > .ts-scrollbox-container               { margin-right: 0; margin-left: 30px; }
.ts-scrollbar-dir-rtl > .ts-scrollbox-inside > .ts-scrollbox-container.ts-scrollbar-no-scrollbar-y.ts-scrollbar-y-hidden { margin-left: 0; }

/* 2. SCROLLBAR TRACK (vertical default) */

.ts-scrollbox-scrollTools {
    position: absolute;
    width: 16px;
    height: auto;
    left: auto;
    top: 0;
    right: 0;
    bottom: 0;
    opacity: 0.75;
}

/* Outside position */
.ts-scrollbox-outside + .ts-scrollbox-scrollTools { right: -26px; }

/* RTL */
.ts-scrollbar-dir-rtl > .ts-scrollbox-inside > .ts-scrollbox-scrollTools,
.ts-scrollbar-dir-rtl > .ts-scrollbox-outside + .ts-scrollbox-scrollTools { right: auto; left: 0; }
.ts-scrollbar-dir-rtl > .ts-scrollbox-outside + .ts-scrollbox-scrollTools { left: -26px; }

/* Dragger container fills the entire track area */
.ts-scrollbox-scrollTools .ts-scrollbox-draggerContainer {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    height: auto;
}

/* When scroll buttons are present, push container inward */
.ts-scrollbox-scrollTools a + .ts-scrollbox-draggerContainer { margin: 20px 0; }

/* The rail line */
.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    width: 2px;
    height: 100%;
    margin: 0 auto;
    border-radius: 16px;
}

/* The draggable thumb */
.ts-scrollbox-scrollTools .ts-scrollbox-dragger {
    cursor: pointer;
    width: 100%;
    height: 30px;
    z-index: 1;
}

/* The visible bar inside the thumb */
.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    position: relative;
    width: 4px;
    height: 100%;
    margin: 0 auto;
    border-radius: 16px;
    text-align: center;
}

/* Expand-on-drag (autoExpandScrollbar themes) — vertical */
.ts-scrollbox-scrollTools-vertical.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag-expanded .ts-scrollbox-dragger-bar,
.ts-scrollbox-scrollTools-vertical.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-draggerContainer:hover .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    width: 12px;
}

.ts-scrollbox-scrollTools-vertical.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag-expanded + .ts-scrollbox-draggerRail,
.ts-scrollbox-scrollTools-vertical.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-draggerContainer:hover .ts-scrollbox-draggerRail {
    width: 8px;
}

/* 3. SCROLL BUTTONS (vertical) */

.ts-scrollbox-scrollTools .ts-scrollbox-buttonUp,
.ts-scrollbox-scrollTools .ts-scrollbox-buttonDown {
    display: block;
    position: absolute;
    height: 20px;
    width: 100%;
    overflow: hidden;
    margin: 0 auto;
    cursor: pointer;
    opacity: 0.4;
}

.ts-scrollbox-scrollTools .ts-scrollbox-buttonDown { bottom: 0; }

/* 4. HORIZONTAL LAYOUT */

.ts-scrollbox-horizontal.ts-scrollbox-inside > .ts-scrollbox-container  { margin-right: 0; margin-bottom: 30px; }
.ts-scrollbox-horizontal.ts-scrollbox-outside > .ts-scrollbox-container { min-height: 100%; }

.ts-scrollbox-horizontal > .ts-scrollbox-container.ts-scrollbar-no-scrollbar-x.ts-scrollbar-x-hidden { margin-bottom: 0; }

.ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-horizontal {
    width: auto;
    height: 16px;
    top: auto;
    right: 0;
    bottom: 0;
    left: 0;
}

.tsScrollBox + .ts-scrollbox-scrollTools + .ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-horizontal,
.tsScrollBox + .ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-horizontal {
    bottom: -26px;
}

.ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-horizontal a + .ts-scrollbox-draggerContainer { margin: 0 20px; }

.ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail {
    width: 100%;
    height: 2px;
    margin: 7px 0;
}

.ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger {
    width: 30px;
    height: 100%;
    left: 0;
}

.ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    width: 100%;
    height: 4px;
    margin: 6px auto;
}

/* Expand-on-drag — horizontal */
.ts-scrollbox-scrollTools-horizontal.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag-expanded .ts-scrollbox-dragger-bar,
.ts-scrollbox-scrollTools-horizontal.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-draggerContainer:hover .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    height: 12px;
    margin: 2px auto;
}

.ts-scrollbox-scrollTools-horizontal.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag-expanded + .ts-scrollbox-draggerRail,
.ts-scrollbox-scrollTools-horizontal.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-draggerContainer:hover .ts-scrollbox-draggerRail {
    height: 8px;
    margin: 4px 0;
}

/* Scroll buttons — horizontal */
.ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-buttonLeft,
.ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-buttonRight {
    display: block;
    position: absolute;
    width: 20px;
    height: 100%;
    overflow: hidden;
    margin: 0 auto;
    cursor: pointer;
    opacity: 0.4;
}

.ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-buttonLeft  { left: 0; }
.ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-buttonRight { right: 0; }

/* 5. BOTH-AXES (yx) CONTAINER WRAPPER */

.ts-scrollbox-container-wrapper {
    position: absolute;
    height: auto;
    width: auto;
    overflow: hidden;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    margin-right: 30px;
    margin-bottom: 30px;
}

.ts-scrollbox-container-wrapper > .ts-scrollbox-container {
    padding-right: 30px;
    padding-bottom: 30px;
    box-sizing: border-box;
}

/* yx scrollbar offsets — keep scrollbars away from the shared corner */
.ts-scrollbox-vertical-horizontal > .ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-vertical   { bottom: 20px; }
.ts-scrollbox-vertical-horizontal > .ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-horizontal { right: 20px; }

/* Collapse vertical bottom offset when horizontal bar not needed */
.ts-scrollbox-container-wrapper.ts-scrollbar-no-scrollbar-x.ts-scrollbar-x-hidden + .ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-vertical { bottom: 0; }

/* Collapse horizontal right offset when vertical bar not needed */
.ts-scrollbar-dir-rtl > .tsScrollBox.ts-scrollbox-vertical-horizontal.ts-scrollbox-inside > .ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-horizontal,
.ts-scrollbox-container-wrapper.ts-scrollbar-no-scrollbar-y.ts-scrollbar-y-hidden + .ts-scrollbox-scrollTools ~ .ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-horizontal {
    right: 0;
}

.ts-scrollbar-dir-rtl > .tsScrollBox.ts-scrollbox-vertical-horizontal.ts-scrollbox-inside > .ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-horizontal { left: 20px; }
.ts-scrollbar-dir-rtl > .tsScrollBox.ts-scrollbox-vertical-horizontal.ts-scrollbox-inside > .ts-scrollbox-container-wrapper.ts-scrollbar-no-scrollbar-y.ts-scrollbar-y-hidden + .ts-scrollbox-scrollTools ~ .ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-horizontal { left: 0; }

.ts-scrollbar-dir-rtl > .ts-scrollbox-inside > .ts-scrollbox-container-wrapper { margin-right: 0; margin-left: 30px; }

.ts-scrollbox-container-wrapper.ts-scrollbar-no-scrollbar-y.ts-scrollbar-y-hidden > .ts-scrollbox-container { padding-right: 0; }
.ts-scrollbox-container-wrapper.ts-scrollbar-no-scrollbar-x.ts-scrollbar-x-hidden > .ts-scrollbox-container { padding-bottom: 0; }

.tsScrollBox.ts-scrollbox-vertical-horizontal.ts-scrollbox-inside > .ts-scrollbox-container-wrapper.ts-scrollbar-no-scrollbar-y.ts-scrollbar-y-hidden { margin-right: 0; margin-left: 0; }
.tsScrollBox.ts-scrollbox-vertical-horizontal.ts-scrollbox-inside > .ts-scrollbox-container-wrapper.ts-scrollbar-no-scrollbar-x.ts-scrollbar-x-hidden { margin-bottom: 0; }

/* 6. TRANSITIONS */

.ts-scrollbox-scrollTools,
.ts-scrollbox-scrollTools .ts-scrollbox-buttonDown,
.ts-scrollbox-scrollTools .ts-scrollbox-buttonLeft,
.ts-scrollbox-scrollTools .ts-scrollbox-buttonRight,
.ts-scrollbox-scrollTools .ts-scrollbox-buttonUp,
.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    transition: opacity 0.2s ease-in-out, background-color 0.2s ease-in-out;
}

/* Expand-on-drag transitions (for autoExpandScrollbar themes) */
.ts-scrollbox-scrollTools-horizontal.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-draggerRail,
.ts-scrollbox-scrollTools-horizontal.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-dragger-bar,
.ts-scrollbox-scrollTools-vertical.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-draggerRail,
.ts-scrollbox-scrollTools-vertical.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-dragger-bar {
    transition:
        width 0.2s ease-out 0.2s,
        height 0.2s ease-out 0.2s,
        margin-left 0.2s ease-out 0.2s,
        margin-right 0.2s ease-out 0.2s,
        margin-top 0.2s ease-out 0.2s,
        margin-bottom 0.2s ease-out 0.2s,
        opacity 0.2s ease-in-out,
        background-color 0.2s ease-in-out;
}

/* 7. AUTO-HIDE BEHAVIOUR */

/* Default hidden state when autoHideScrollbar is on */
.ts-scrollbar-autoHide > .tsScrollBox > .ts-scrollbox-scrollTools,
.ts-scrollbar-autoHide > .tsScrollBox ~ .ts-scrollbox-scrollTools {
    opacity: 0;
}

/* Show on hover (progressive enhancement; JS also handles this) */
.ts-scrollbar-autoHide:hover > .tsScrollBox > .ts-scrollbox-scrollTools,
.ts-scrollbar-autoHide:hover > .tsScrollBox ~ .ts-scrollbox-scrollTools,
.tsScrollBox:hover > .ts-scrollbox-scrollTools,
.tsScrollBox:hover ~ .ts-scrollbox-scrollTools,
.tsScrollbar > .tsScrollBox > .ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-onDrag,
.tsScrollbar > .tsScrollBox ~ .ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-onDrag {
    opacity: 1;
}

/* 8. DISABLED STATE */

.ts-scrollbar-disabled > .tsScrollBox > .ts-scrollbox-scrollTools {
    opacity: 0.3;
    pointer-events: none;
    cursor: default;
}

/* 9. DEFAULT (LIGHT) THEME COLOURS */

.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    background-color: rgba(0, 0, 0, 0.4);
}

.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    background-color: rgba(255, 255, 255, 0.75);
}

.ts-scrollbox-scrollTools .ts-scrollbox-dragger:hover .ts-scrollbox-dragger-bar {
    background-color: rgba(255, 255, 255, 0.85);
}

.ts-scrollbox-scrollTools .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag .ts-scrollbox-dragger-bar,
.ts-scrollbox-scrollTools .ts-scrollbox-dragger:active .ts-scrollbox-dragger-bar {
    background-color: rgba(255, 255, 255, 0.9);
}

/* Button hover / active opacity (arrow colour is set below) */
.ts-scrollbox-scrollTools .ts-scrollbox-buttonDown:hover,
.ts-scrollbox-scrollTools .ts-scrollbox-buttonLeft:hover,
.ts-scrollbox-scrollTools .ts-scrollbox-buttonRight:hover,
.ts-scrollbox-scrollTools .ts-scrollbox-buttonUp:hover {
    opacity: 0.75;
}

.ts-scrollbox-scrollTools .ts-scrollbox-buttonDown:active,
.ts-scrollbox-scrollTools .ts-scrollbox-buttonLeft:active,
.ts-scrollbox-scrollTools .ts-scrollbox-buttonRight:active,
.ts-scrollbox-scrollTools .ts-scrollbox-buttonUp:active {
    opacity: 0.9;
}

/* 10. SCROLL BUTTON ARROWS (pure CSS — no sprite sheet) */

/* Base: all four button types share the same pseudo-element pattern */
.ts-scrollbox-scrollTools .ts-scrollbox-buttonUp::after,
.ts-scrollbox-scrollTools .ts-scrollbox-buttonDown::after,
.ts-scrollbox-scrollTools .ts-scrollbox-buttonLeft::after,
.ts-scrollbox-scrollTools .ts-scrollbox-buttonRight::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    transform: translate(-50%, -50%);
    pointer-events: none;
}

/* Light theme (default) — white arrows */
.ts-scrollbox-scrollTools .ts-scrollbox-buttonUp::after {
    border-width: 0 5px 7px;
    border-style: solid;
    border-color: transparent transparent rgba(255, 255, 255, 0.9);
    margin-top: -2px;
}

.ts-scrollbox-scrollTools .ts-scrollbox-buttonDown::after {
    border-width: 7px 5px 0;
    border-style: solid;
    border-color: rgba(255, 255, 255, 0.9) transparent transparent;
    margin-top: 2px;
}

.ts-scrollbox-scrollTools .ts-scrollbox-buttonLeft::after {
    border-width: 5px 7px 5px 0;
    border-style: solid;
    border-color: transparent rgba(255, 255, 255, 0.9) transparent transparent;
    margin-left: -2px;
}

.ts-scrollbox-scrollTools .ts-scrollbox-buttonRight::after {
    border-width: 5px 0 5px 7px;
    border-style: solid;
    border-color: transparent transparent transparent rgba(255, 255, 255, 0.9);
    margin-left: 2px;
}

/* Dark-theme variants — override arrow colour only
   The [class*="dark"] selector catches: dark, dark-2, thick-dark, thin-dark,
   rounded-dark, rounded-dots-dark, 3d-dark, 3d-thick-dark, minimal-dark,
   inset-dark, inset-2-dark, inset-3-dark */
.ts-scrollbox-scrollTools[class*="dark"] .ts-scrollbox-buttonUp::after {
    border-bottom-color: rgba(0, 0, 0, 0.7);
}

.ts-scrollbox-scrollTools[class*="dark"] .ts-scrollbox-buttonDown::after {
    border-top-color: rgba(0, 0, 0, 0.7);
}

.ts-scrollbox-scrollTools[class*="dark"] .ts-scrollbox-buttonLeft::after {
    border-right-color: rgba(0, 0, 0, 0.7);
}

.ts-scrollbox-scrollTools[class*="dark"] .ts-scrollbox-buttonRight::after {
    border-left-color: rgba(0, 0, 0, 0.7);
}

/* inset / inset-2 / inset-3 light variants also use dark arrows */
.ts-scrollbar-inset.ts-scrollbox-scrollTools .ts-scrollbox-buttonUp::after,
.ts-scrollbar-inset-2.ts-scrollbox-scrollTools .ts-scrollbox-buttonUp::after,
.ts-scrollbar-inset-3.ts-scrollbox-scrollTools .ts-scrollbox-buttonUp::after       { border-bottom-color: rgba(0, 0, 0, 0.7); }

.ts-scrollbar-inset.ts-scrollbox-scrollTools .ts-scrollbox-buttonDown::after,
.ts-scrollbar-inset-2.ts-scrollbox-scrollTools .ts-scrollbox-buttonDown::after,
.ts-scrollbar-inset-3.ts-scrollbox-scrollTools .ts-scrollbox-buttonDown::after     { border-top-color: rgba(0, 0, 0, 0.7); }

.ts-scrollbar-inset.ts-scrollbox-scrollTools .ts-scrollbox-buttonLeft::after,
.ts-scrollbar-inset-2.ts-scrollbox-scrollTools .ts-scrollbox-buttonLeft::after,
.ts-scrollbar-inset-3.ts-scrollbox-scrollTools .ts-scrollbox-buttonLeft::after     { border-right-color: rgba(0, 0, 0, 0.7); }

.ts-scrollbar-inset.ts-scrollbox-scrollTools .ts-scrollbox-buttonRight::after,
.ts-scrollbar-inset-2.ts-scrollbox-scrollTools .ts-scrollbox-buttonRight::after,
.ts-scrollbar-inset-3.ts-scrollbox-scrollTools .ts-scrollbox-buttonRight::after    { border-left-color: rgba(0, 0, 0, 0.7); }

/* 11. THEME: dark */

.ts-scrollbar-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    background-color: rgba(0, 0, 0, 0.15);
}

.ts-scrollbar-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    background-color: rgba(0, 0, 0, 0.75);
}

.ts-scrollbar-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:hover .ts-scrollbox-dragger-bar {
    background-color: rgba(0, 0, 0, 0.85);
}

.ts-scrollbar-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag .ts-scrollbox-dragger-bar,
.ts-scrollbar-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:active .ts-scrollbox-dragger-bar {
    background-color: rgba(0, 0, 0, 0.9);
}

/* 12. THEME: light-2 / dark-2  (4 px rail, 1 px radius) */

.ts-scrollbar-dark-2.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail,
.ts-scrollbar-light-2.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    width: 4px;
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 1px;
}

.ts-scrollbar-dark-2.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-light-2.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    width: 4px;
    background-color: rgba(255, 255, 255, 0.75);
    border-radius: 1px;
}

.ts-scrollbar-dark-2.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-dark-2.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail,
.ts-scrollbar-light-2.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-light-2.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail {
    width: 100%;
    height: 4px;
    margin: 6px auto;
}

.ts-scrollbar-light-2.ts-scrollbox-scrollTools .ts-scrollbox-dragger:hover .ts-scrollbox-dragger-bar {
    background-color: rgba(255, 255, 255, 0.85);
}

.ts-scrollbar-light-2.ts-scrollbox-scrollTools .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag .ts-scrollbox-dragger-bar,
.ts-scrollbar-light-2.ts-scrollbox-scrollTools .ts-scrollbox-dragger:active .ts-scrollbox-dragger-bar {
    background-color: rgba(255, 255, 255, 0.9);
}

.ts-scrollbar-dark-2.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 1px;
}

.ts-scrollbar-dark-2.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    background-color: rgba(0, 0, 0, 0.75);
    border-radius: 1px;
}

.ts-scrollbar-dark-2.ts-scrollbox-scrollTools .ts-scrollbox-dragger:hover .ts-scrollbox-dragger-bar {
    background-color: rgba(0, 0, 0, 0.85);
}

.ts-scrollbar-dark-2.ts-scrollbox-scrollTools .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag .ts-scrollbox-dragger-bar,
.ts-scrollbar-dark-2.ts-scrollbox-scrollTools .ts-scrollbox-dragger:active .ts-scrollbox-dragger-bar {
    background-color: rgba(0, 0, 0, 0.9);
}

/* 13. THEME: thick / thick-dark  (6 px bar, 2 px radius) */

.ts-scrollbar-thick-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail,
.ts-scrollbar-thick.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    width: 4px;
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
}

.ts-scrollbar-thick-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-thick.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    width: 6px;
    background-color: rgba(255, 255, 255, 0.75);
    border-radius: 2px;
}

.ts-scrollbar-thick-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail,
.ts-scrollbar-thick.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail {
    width: 100%;
    height: 4px;
    margin: 6px 0;
}

.ts-scrollbar-thick-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-thick.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    width: 100%;
    height: 6px;
    margin: 5px auto;
}

.ts-scrollbar-thick.ts-scrollbox-scrollTools .ts-scrollbox-dragger:hover .ts-scrollbox-dragger-bar {
    background-color: rgba(255, 255, 255, 0.85);
}

.ts-scrollbar-thick.ts-scrollbox-scrollTools .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag .ts-scrollbox-dragger-bar,
.ts-scrollbar-thick.ts-scrollbox-scrollTools .ts-scrollbox-dragger:active .ts-scrollbox-dragger-bar {
    background-color: rgba(255, 255, 255, 0.9);
}

.ts-scrollbar-thick-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 2px;
}

.ts-scrollbar-thick-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    background-color: rgba(0, 0, 0, 0.75);
    border-radius: 2px;
}

.ts-scrollbar-thick-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:hover .ts-scrollbox-dragger-bar {
    background-color: rgba(0, 0, 0, 0.85);
}

.ts-scrollbar-thick-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag .ts-scrollbox-dragger-bar,
.ts-scrollbar-thick-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:active .ts-scrollbox-dragger-bar {
    background-color: rgba(0, 0, 0, 0.9);
}

/* 14. THEME: thin / thin-dark  (2 px bar) */

.ts-scrollbar-thin.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    background-color: rgba(255, 255, 255, 0.1);
}

.ts-scrollbar-thin-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-thin.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    width: 2px;
}

.ts-scrollbar-thin-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail,
.ts-scrollbar-thin.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail {
    width: 100%;
}

.ts-scrollbar-thin-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-thin.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    width: 100%;
    height: 2px;
    margin: 7px auto;
}

.ts-scrollbar-thin-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    background-color: rgba(0, 0, 0, 0.15);
}

.ts-scrollbar-thin-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    background-color: rgba(0, 0, 0, 0.75);
}

.ts-scrollbar-thin-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:hover .ts-scrollbox-dragger-bar {
    background-color: rgba(0, 0, 0, 0.85);
}

.ts-scrollbar-thin-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag .ts-scrollbox-dragger-bar,
.ts-scrollbar-thin-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:active .ts-scrollbox-dragger-bar {
    background-color: rgba(0, 0, 0, 0.9);
}

/* 15. THEME: rounded / rounded-dark  (14 px pill-shaped thumb) */

.ts-scrollbar-rounded.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    background-color: rgba(255, 255, 255, 0.15);
}

.ts-scrollbar-rounded-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger,
.ts-scrollbar-rounded-dots-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger,
.ts-scrollbar-rounded-dots.ts-scrollbox-scrollTools .ts-scrollbox-dragger,
.ts-scrollbar-rounded.ts-scrollbox-scrollTools .ts-scrollbox-dragger {
    height: 14px;
}

.ts-scrollbar-rounded-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-rounded-dots-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-rounded-dots.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-rounded.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    width: 14px;
    margin: 0 1px;
}

.ts-scrollbar-rounded-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger,
.ts-scrollbar-rounded-dots-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger,
.ts-scrollbar-rounded-dots.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger,
.ts-scrollbar-rounded.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger {
    width: 14px;
}

.ts-scrollbar-rounded-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-rounded-dots-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-rounded-dots.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-rounded.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    height: 14px;
    margin: 1px 0;
}

/* Expand on drag — rounded */
.ts-scrollbar-rounded-dark.ts-scrollbox-scrollTools-vertical.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag-expanded .ts-scrollbox-dragger-bar,
.ts-scrollbar-rounded-dark.ts-scrollbox-scrollTools-vertical.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-draggerContainer:hover .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-rounded.ts-scrollbox-scrollTools-vertical.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag-expanded .ts-scrollbox-dragger-bar,
.ts-scrollbar-rounded.ts-scrollbox-scrollTools-vertical.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-draggerContainer:hover .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    width: 16px;
    height: 16px;
    margin: -1px 0;
}

.ts-scrollbar-rounded-dark.ts-scrollbox-scrollTools-vertical.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag-expanded + .ts-scrollbox-draggerRail,
.ts-scrollbar-rounded-dark.ts-scrollbox-scrollTools-vertical.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-draggerContainer:hover .ts-scrollbox-draggerRail,
.ts-scrollbar-rounded.ts-scrollbox-scrollTools-vertical.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag-expanded + .ts-scrollbox-draggerRail,
.ts-scrollbar-rounded.ts-scrollbox-scrollTools-vertical.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-draggerContainer:hover .ts-scrollbox-draggerRail {
    width: 4px;
}

.ts-scrollbar-rounded-dark.ts-scrollbox-scrollTools-horizontal.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag-expanded .ts-scrollbox-dragger-bar,
.ts-scrollbar-rounded-dark.ts-scrollbox-scrollTools-horizontal.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-draggerContainer:hover .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-rounded.ts-scrollbox-scrollTools-horizontal.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag-expanded .ts-scrollbox-dragger-bar,
.ts-scrollbar-rounded.ts-scrollbox-scrollTools-horizontal.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-draggerContainer:hover .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    height: 16px;
    width: 16px;
    margin: 0 -1px;
}

.ts-scrollbar-rounded-dark.ts-scrollbox-scrollTools-horizontal.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag-expanded + .ts-scrollbox-draggerRail,
.ts-scrollbar-rounded-dark.ts-scrollbox-scrollTools-horizontal.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-draggerContainer:hover .ts-scrollbox-draggerRail,
.ts-scrollbar-rounded.ts-scrollbox-scrollTools-horizontal.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag-expanded + .ts-scrollbox-draggerRail,
.ts-scrollbar-rounded.ts-scrollbox-scrollTools-horizontal.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-draggerContainer:hover .ts-scrollbox-draggerRail {
    height: 4px;
    margin: 6px 0;
}

/* rounded-dark colours */
.ts-scrollbar-rounded-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-rounded-dots-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    background-color: rgba(0, 0, 0, 0.75);
}

.ts-scrollbar-rounded-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    background-color: rgba(0, 0, 0, 0.15);
}

.ts-scrollbar-rounded-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:hover .ts-scrollbox-dragger-bar,
.ts-scrollbar-rounded-dots-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:hover .ts-scrollbox-dragger-bar {
    background-color: rgba(0, 0, 0, 0.85);
}

.ts-scrollbar-rounded-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag .ts-scrollbox-dragger-bar,
.ts-scrollbar-rounded-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:active .ts-scrollbox-dragger-bar,
.ts-scrollbar-rounded-dots-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag .ts-scrollbox-dragger-bar,
.ts-scrollbar-rounded-dots-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:active .ts-scrollbox-dragger-bar {
    background-color: rgba(0, 0, 0, 0.9);
}

/* 16. THEME: rounded-dots / rounded-dots-dark  (dotted rail) */

.ts-scrollbar-rounded-dots-dark.ts-scrollbox-scrollTools-vertical .ts-scrollbox-draggerRail,
.ts-scrollbar-rounded-dots.ts-scrollbox-scrollTools-vertical .ts-scrollbox-draggerRail {
    width: 4px;
}

.ts-scrollbar-rounded-dots-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail,
.ts-scrollbar-rounded-dots-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail,
.ts-scrollbar-rounded-dots.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail,
.ts-scrollbar-rounded-dots.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail {
    background-color: transparent;
    background-position: center;
}

/* Dot pattern — light */
.ts-scrollbar-rounded-dots.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAANElEQVQYV2NkIAAYiVbw//9/Y6DiM1ANJoyMjGdBbLgJQAX/kU0DKgDLkaQAvxW4HEvQFwCRcxIJK1XznAAAAABJRU5ErkJggg==");
    background-repeat: repeat-y;
    opacity: 0.3;
}

.ts-scrollbar-rounded-dots.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail {
    height: 4px;
    margin: 6px 0;
    background-repeat: repeat-x;
}

/* Dot pattern — dark */
.ts-scrollbar-rounded-dots-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAALElEQVQYV2NkIAAYSVFgDFR8BqrBBEifBbGRTfiPZhpYjiQFBK3A6l6CvgAAE9kGCd1mvgEAAAAASUVORK5CYII=");
    background-repeat: repeat-y;
}

.ts-scrollbar-rounded-dots-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail {
    height: 4px;
    margin: 6px 0;
    background-repeat: repeat-x;
}

/* 17. THEME: 3d / 3d-dark  (gradient thumb, 8 px bar) */

.ts-scrollbar-3d-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d-thick-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d-thick.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    background-repeat: repeat-y;
    background-image: linear-gradient(to right, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 100%);
}

.ts-scrollbar-3d-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d-thick-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d-thick.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    background-repeat: repeat-x;
    background-image: linear-gradient(to bottom, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 100%);
}

.ts-scrollbar-3d-dark.ts-scrollbox-scrollTools-vertical .ts-scrollbox-dragger,
.ts-scrollbar-3d.ts-scrollbox-scrollTools-vertical .ts-scrollbox-dragger { height: 70px; }

.ts-scrollbar-3d-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger,
.ts-scrollbar-3d.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger { width: 70px; }

.ts-scrollbar-3d-dark.ts-scrollbox-scrollTools,
.ts-scrollbar-3d.ts-scrollbox-scrollTools { opacity: 1; }

.ts-scrollbar-3d-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail,
.ts-scrollbar-3d.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    border-radius: 16px;
}

.ts-scrollbar-3d-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail,
.ts-scrollbar-3d.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    width: 8px;
    background-color: rgba(0, 0, 0, 0.2);
    box-shadow: inset 1px 0 1px rgba(0, 0, 0, 0.5), inset -1px 0 1px rgba(255, 255, 255, 0.2);
}

.ts-scrollbar-3d-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:active .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:hover .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d.ts-scrollbox-scrollTools .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d.ts-scrollbox-scrollTools .ts-scrollbox-dragger:active .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d.ts-scrollbox-scrollTools .ts-scrollbox-dragger:hover .ts-scrollbox-dragger-bar {
    background-color: #555;
}

.ts-scrollbar-3d-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar { width: 8px; }

.ts-scrollbar-3d-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail,
.ts-scrollbar-3d.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail {
    width: 100%;
    height: 8px;
    margin: 4px 0;
    box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.5), inset 0 -1px 1px rgba(255, 255, 255, 0.2);
}

.ts-scrollbar-3d-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    width: 100%;
    height: 8px;
    margin: 4px auto;
}

/* 3d-dark specifics */
.ts-scrollbar-3d-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    background-color: rgba(0, 0, 0, 0.1);
    box-shadow: inset 1px 0 1px rgba(0, 0, 0, 0.1);
}

.ts-scrollbar-3d-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail {
    box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.1);
}

/* 18. THEME: 3d-thick / 3d-thick-dark  (rounded container) */

.ts-scrollbar-3d-thick-dark.ts-scrollbox-scrollTools,
.ts-scrollbar-3d-thick.ts-scrollbox-scrollTools { opacity: 1; }

.ts-scrollbar-3d-thick-dark.ts-scrollbox-scrollTools,
.ts-scrollbar-3d-thick-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerContainer,
.ts-scrollbar-3d-thick.ts-scrollbox-scrollTools,
.ts-scrollbar-3d-thick.ts-scrollbox-scrollTools .ts-scrollbox-draggerContainer {
    border-radius: 7px;
}

.ts-scrollbox-inside + .ts-scrollbar-3d-thick-dark.ts-scrollbox-scrollTools-vertical,
.ts-scrollbox-inside + .ts-scrollbar-3d-thick.ts-scrollbox-scrollTools-vertical { right: 1px; }

.ts-scrollbar-3d-thick-dark.ts-scrollbox-scrollTools-vertical,
.ts-scrollbar-3d-thick.ts-scrollbox-scrollTools-vertical {
    box-shadow: inset 1px 0 1px rgba(0, 0, 0, 0.1), inset 0 0 14px rgba(0, 0, 0, 0.5);
}

.ts-scrollbar-3d-thick-dark.ts-scrollbox-scrollTools-horizontal,
.ts-scrollbar-3d-thick.ts-scrollbox-scrollTools-horizontal {
    bottom: 1px;
    box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.1), inset 0 0 14px rgba(0, 0, 0, 0.5);
}

.ts-scrollbar-3d-thick-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d-thick.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    border-radius: 5px;
    box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.4);
    width: 12px;
    margin: 2px;
    position: absolute;
    height: auto;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
}

.ts-scrollbar-3d-thick-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d-thick.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
    height: 12px;
    width: auto;
}

.ts-scrollbar-3d-thick.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d-thick.ts-scrollbox-scrollTools .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d-thick.ts-scrollbox-scrollTools .ts-scrollbox-dragger:active .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d-thick.ts-scrollbox-scrollTools .ts-scrollbox-dragger:hover .ts-scrollbox-dragger-bar { background-color: #555; }

.ts-scrollbar-3d-thick.ts-scrollbox-scrollTools .ts-scrollbox-draggerContainer {
    background-color: rgba(0, 0, 0, 0.05);
    box-shadow: inset 1px 1px 16px rgba(0, 0, 0, 0.1);
}

.ts-scrollbar-3d-thick.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail { background-color: transparent; }

/* 3d-thick-dark specifics */
.ts-scrollbar-3d-thick-dark.ts-scrollbox-scrollTools { box-shadow: inset 0 0 14px rgba(0, 0, 0, 0.2); }

.ts-scrollbar-3d-thick-dark.ts-scrollbox-scrollTools-horizontal {
    box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.1), inset 0 0 14px rgba(0, 0, 0, 0.2);
}

.ts-scrollbar-3d-thick-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.4), inset -1px 0 0 rgba(0, 0, 0, 0.2);
}

.ts-scrollbar-3d-thick-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), inset 0 -1px 0 rgba(0, 0, 0, 0.2);
}

.ts-scrollbar-3d-thick-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d-thick-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d-thick-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:active .ts-scrollbox-dragger-bar,
.ts-scrollbar-3d-thick-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:hover .ts-scrollbox-dragger-bar { background-color: #777; }

.ts-scrollbar-3d-thick-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerContainer {
    background-color: rgba(0, 0, 0, 0.05);
    box-shadow: inset 1px 1px 16px rgba(0, 0, 0, 0.1);
}

.ts-scrollbar-3d-thick-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail { background-color: transparent; }

/* 19. THEME: minimal / minimal-dark  (no rail, large dragger) */

.ts-scrollbox-outside + .ts-scrollbar-minimal-dark.ts-scrollbox-scrollTools-vertical,
.ts-scrollbox-outside + .ts-scrollbar-minimal.ts-scrollbox-scrollTools-vertical {
    right: 0;
    margin: 12px 0;
}

.tsScrollBox.ts-scrollbar-minimal + .ts-scrollbox-scrollTools + .ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-horizontal,
.tsScrollBox.ts-scrollbar-minimal + .ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-horizontal,
.tsScrollBox.ts-scrollbar-minimal-dark + .ts-scrollbox-scrollTools + .ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-horizontal,
.tsScrollBox.ts-scrollbar-minimal-dark + .ts-scrollbox-scrollTools.ts-scrollbox-scrollTools-horizontal {
    bottom: 0;
    margin: 0 12px;
}

.ts-scrollbar-dir-rtl > .ts-scrollbox-outside + .ts-scrollbar-minimal-dark.ts-scrollbox-scrollTools-vertical,
.ts-scrollbar-dir-rtl > .ts-scrollbox-outside + .ts-scrollbar-minimal.ts-scrollbox-scrollTools-vertical { left: 0; right: auto; }

.ts-scrollbar-minimal-dark.ts-scrollbox-scrollTools-vertical .ts-scrollbox-dragger,
.ts-scrollbar-minimal.ts-scrollbox-scrollTools-vertical .ts-scrollbox-dragger { height: 50px; }

.ts-scrollbar-minimal-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger,
.ts-scrollbar-minimal.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger { width: 50px; }

.ts-scrollbar-minimal-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail,
.ts-scrollbar-minimal.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail    { background-color: transparent; }

.ts-scrollbar-minimal.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    background-color: rgba(255, 255, 255, 0.2);
}

.ts-scrollbar-minimal.ts-scrollbox-scrollTools .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag .ts-scrollbox-dragger-bar,
.ts-scrollbar-minimal.ts-scrollbox-scrollTools .ts-scrollbox-dragger:active .ts-scrollbox-dragger-bar {
    background-color: rgba(255, 255, 255, 0.5);
}

.ts-scrollbar-minimal-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    background-color: rgba(0, 0, 0, 0.2);
}

.ts-scrollbar-minimal-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag .ts-scrollbox-dragger-bar,
.ts-scrollbar-minimal-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:active .ts-scrollbox-dragger-bar {
    background-color: rgba(0, 0, 0, 0.5);
}

/* 20. THEME: light-3 / dark-3  (6 px rail, expand on hover) */

.ts-scrollbar-dark-3.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail,
.ts-scrollbar-light-3.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    width: 6px;
    background-color: rgba(0, 0, 0, 0.2);
}

.ts-scrollbar-dark-3.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-light-3.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar { width: 6px; }

.ts-scrollbar-dark-3.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-dark-3.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail,
.ts-scrollbar-light-3.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-light-3.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail {
    width: 100%;
    height: 6px;
    margin: 5px 0;
}

/* Expand on drag — light-3 / dark-3 */
.ts-scrollbar-dark-3.ts-scrollbox-scrollTools-vertical.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag-expanded + .ts-scrollbox-draggerRail,
.ts-scrollbar-dark-3.ts-scrollbox-scrollTools-vertical.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-draggerContainer:hover .ts-scrollbox-draggerRail,
.ts-scrollbar-light-3.ts-scrollbox-scrollTools-vertical.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag-expanded + .ts-scrollbox-draggerRail,
.ts-scrollbar-light-3.ts-scrollbox-scrollTools-vertical.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-draggerContainer:hover .ts-scrollbox-draggerRail {
    width: 12px;
}

.ts-scrollbar-dark-3.ts-scrollbox-scrollTools-horizontal.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag-expanded + .ts-scrollbox-draggerRail,
.ts-scrollbar-dark-3.ts-scrollbox-scrollTools-horizontal.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-draggerContainer:hover .ts-scrollbox-draggerRail,
.ts-scrollbar-light-3.ts-scrollbox-scrollTools-horizontal.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag-expanded + .ts-scrollbox-draggerRail,
.ts-scrollbar-light-3.ts-scrollbox-scrollTools-horizontal.ts-scrollbox-scrollTools-onDrag-expand .ts-scrollbox-draggerContainer:hover .ts-scrollbox-draggerRail {
    height: 12px;
    margin: 2px 0;
}

/* dark-3 colours */
.ts-scrollbar-dark-3.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar { background-color: rgba(0, 0, 0, 0.75); }
.ts-scrollbar-dark-3.ts-scrollbox-scrollTools .ts-scrollbox-dragger:hover .ts-scrollbox-dragger-bar  { background-color: rgba(0, 0, 0, 0.85); }
.ts-scrollbar-dark-3.ts-scrollbox-scrollTools .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag .ts-scrollbox-dragger-bar,
.ts-scrollbar-dark-3.ts-scrollbox-scrollTools .ts-scrollbox-dragger:active .ts-scrollbox-dragger-bar { background-color: rgba(0, 0, 0, 0.9); }
.ts-scrollbar-dark-3.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail { background-color: rgba(0, 0, 0, 0.1); }

/* 21. THEME: inset / inset-dark / inset-2 / inset-2-dark /
             inset-3 / inset-3-dark  (12 px rail, inset thumb) */

.ts-scrollbar-inset-2-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail,
.ts-scrollbar-inset-2.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail,
.ts-scrollbar-inset-3-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail,
.ts-scrollbar-inset-3.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail,
.ts-scrollbar-inset-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail,
.ts-scrollbar-inset.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    width: 12px;
    background-color: rgba(0, 0, 0, 0.2);
}

.ts-scrollbar-inset-2-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-inset-2.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-inset-3-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-inset-3.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-inset-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-inset.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    width: 6px;
    margin: 3px 5px;
    position: absolute;
    height: auto;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
}

/* Horizontal inset variants */
.ts-scrollbar-inset-2-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-inset-2.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-inset-3-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-inset-3.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-inset-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-inset.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-dragger .ts-scrollbox-dragger-bar {
    height: 6px;
    margin: 5px 3px;
    position: absolute;
    width: auto;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
}

.ts-scrollbar-inset-2-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail,
.ts-scrollbar-inset-2.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail,
.ts-scrollbar-inset-3-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail,
.ts-scrollbar-inset-3.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail,
.ts-scrollbar-inset-dark.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail,
.ts-scrollbar-inset.ts-scrollbox-scrollTools-horizontal .ts-scrollbox-draggerRail {
    width: 100%;
    height: 12px;
    margin: 2px 0;
}

/* Light inset colours */
.ts-scrollbar-inset-2-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-inset-3-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar,
.ts-scrollbar-inset-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar     { background-color: rgba(0, 0, 0, 0.75); }

.ts-scrollbar-inset-2-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:hover .ts-scrollbox-dragger-bar,
.ts-scrollbar-inset-3-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:hover .ts-scrollbox-dragger-bar,
.ts-scrollbar-inset-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:hover .ts-scrollbox-dragger-bar { background-color: rgba(0, 0, 0, 0.85); }

.ts-scrollbar-inset-2-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag .ts-scrollbox-dragger-bar,
.ts-scrollbar-inset-2-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:active .ts-scrollbox-dragger-bar,
.ts-scrollbar-inset-3-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag .ts-scrollbox-dragger-bar,
.ts-scrollbar-inset-3-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:active .ts-scrollbox-dragger-bar,
.ts-scrollbar-inset-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag .ts-scrollbox-dragger-bar,
.ts-scrollbar-inset-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:active .ts-scrollbox-dragger-bar { background-color: rgba(0, 0, 0, 0.9); }

.ts-scrollbar-inset-2-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail,
.ts-scrollbar-inset-3-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail,
.ts-scrollbar-inset-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail { background-color: rgba(0, 0, 0, 0.1); }

/* inset-2 / inset-2-dark: bordered (outlined) rail */
.ts-scrollbar-inset-2-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail,
.ts-scrollbar-inset-2.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    background-color: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-sizing: border-box;
}

.ts-scrollbar-inset-2-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    border-color: rgba(0, 0, 0, 0.2);
}

/* inset-3 / inset-3-dark: solid filled rail */
.ts-scrollbar-inset-3.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    background-color: rgba(255, 255, 255, 0.6);
}

.ts-scrollbar-inset-3-dark.ts-scrollbox-scrollTools .ts-scrollbox-draggerRail {
    background-color: rgba(0, 0, 0, 0.6);
}

/* inset-3 light thumb (dark on light rail) */
.ts-scrollbar-inset-3.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar { background-color: rgba(0, 0, 0, 0.75); }
.ts-scrollbar-inset-3.ts-scrollbox-scrollTools .ts-scrollbox-dragger:hover .ts-scrollbox-dragger-bar  { background-color: rgba(0, 0, 0, 0.85); }
.ts-scrollbar-inset-3.ts-scrollbox-scrollTools .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag .ts-scrollbox-dragger-bar,
.ts-scrollbar-inset-3.ts-scrollbox-scrollTools .ts-scrollbox-dragger:active .ts-scrollbox-dragger-bar { background-color: rgba(0, 0, 0, 0.9); }

/* inset-3-dark thumb (light on dark rail) */
.ts-scrollbar-inset-3-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger .ts-scrollbox-dragger-bar { background-color: rgba(255, 255, 255, 0.75); }
.ts-scrollbar-inset-3-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:hover .ts-scrollbox-dragger-bar  { background-color: rgba(255, 255, 255, 0.85); }
.ts-scrollbar-inset-3-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger.ts-scrollbox-dragger-onDrag .ts-scrollbox-dragger-bar,
.ts-scrollbar-inset-3-dark.ts-scrollbox-scrollTools .ts-scrollbox-dragger:active .ts-scrollbox-dragger-bar { background-color: rgba(255, 255, 255, 0.9); }
`;

    // Inject the stylesheet only when the plugin is actually used (called from
    // build()), so loading the script never adds CSS to unused pages.
    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = CSS_TEXT;
        (document.head || document.documentElement).appendChild(style);
    }

    const MIN_DRAGGER_PX = 10;   // absolute minimum thumb size in px
    const HIDE_DELAY_MS  = 400;  // ms after last activity before auto-hide

    // Easing
    // 5th-order polynomial
    // f(0)=0, f(1)=1, fast start, smooth deceleration.
    function easeOut(t) {
        return 0.5*t**5 - 2.5*t**4 + 5.5*t**3 - 6.5*t**2 + 4*t;
    }

    function perfNow() {
        return (window.performance && window.performance.now) ? window.performance.now() : Date.now();
    }

    // Extracts clientX/Y from mouse, touch, or pointer events uniformly.
    function getCoords(e) {
        const oe = e.originalEvent || e;
        const src = (oe.touches        && oe.touches.length)        ? oe.touches[0]
                  : (oe.changedTouches && oe.changedTouches.length) ? oe.changedTouches[0]
                  : oe;
        return { x: src.clientX, y: src.clientY };
    }

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    class PluginScrollbar {

        constructor($el, opts) {
            return this.initialize($el, opts);
        }

        initialize($el, opts) {
            if ($el.data(instanceName)) {
                return this;
            }

            this.$el          = $el;
            this._initialHTML = $el.html();   // snapshot for destroy()

            // Scroll state
            this._scrollY  = 0;
            this._scrollX  = 0;
            this._maxScrollY = 0;
            this._maxScrollX = 0;
            this._vpH      = 0;
            this._vpW      = 0;
            this._overflowY = false;
            this._overflowX = false;

            // Animation
            this._rafId      = null;
            this._isScrolling = false;

            // Interaction
            this._disabled   = false;
            this._isDragging = false;

            // Timers
            this._hideTimer = null;
            this._btnTimer  = null;

            // Touch momentum
            this._touchHistory = [];

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
            this.options = $.extend(true, {}, PluginScrollbar.defaults, opts, {
                wrapper: this.$el
            });
            return this;
        }

        build() {
            // Inject component CSS lazily — only when an instance is built.
            injectStyles();

            const self = this;
            const o    = self.options;

            // 1 Root element gets Scrollbar + optional autoHide class
            self.$el.addClass('tsScrollbar' + (o.autoHideScrollbar ? ' ts-scrollbar--autoHide' : ''));

            // 2 Scroll box (the clipping viewport)
            const axisClass = o.axis === 'yx' ? 'ts-scrollbox-vertical-horizontal'
                            : o.axis === 'x'  ? 'ts-scrollbox-horizontal'
                            : 'ts-scrollbox-vertical';

            self._$box = $(`<div class="tsScrollBox ts-scrollbar-${o.theme} ${axisClass} ts-scrollbox-inside"></div>`);

            // 3 Content container (this is what actually moves when scrolling)
            self._$container = $('<div class="ts-scrollbox-container" style="position:relative;top:0;left:0;"></div>')
                .append(self.$el.contents());

            // For x / yx axes the container must expand to its natural content width
            if (o.axis !== 'y') {
                self._$container.css({ width: 'max-content', 'min-width': '100%' });
            }

            // 4 For yx: wrap container in ts-scrollbox-container_wrapper so the
            //      vertical and horizontal scrollbars each claim their 30 px edge.
            if (o.axis === 'yx') {
                self._$wrapper = $('<div class="ts-scrollbox-container-wrapper"></div>').append(self._$container);
                self._$box.append(self._$wrapper);
            } else {
                self._$wrapper = null;
                self._$box.append(self._$container);
            }

            // 5 Build one or two scrollbar track elements
            const buildTools = (vertical) => {
                const dirClass     = vertical ? 'ts-scrollbox-scrollTools-vertical' : 'ts-scrollbox-scrollTools-horizontal';
                const draggerStyle = vertical ? 'position:absolute;top:0;' : 'position:absolute;left:0;';

                const $draggerBar  = $('<div class="ts-scrollbox-dragger-bar"></div>');
                const $dragger     = $(`<div class="ts-scrollbox-dragger" style="${draggerStyle}"></div>`).append($draggerBar);
                const $rail        = $('<div class="ts-scrollbox-draggerRail"></div>');
                const $draggerCont = $('<div class="ts-scrollbox-draggerContainer"></div>').append($dragger).append($rail);

                // Theme class is placed on the tools element itself
                const $tools = $(`<div class="ts-scrollbox-scrollTools ts-scrollbar-${o.theme} ${dirClass}"></div>`)
                    .append($draggerCont);

                let $btnA = null, $btnB = null;
                if (o.scrollButtons.enable) {
                    if (vertical) {
                        $btnA = $('<a class="ts-scrollbox-buttonUp"    tabindex="-1" aria-label="Scroll up"></a>');
                        $btnB = $('<a class="ts-scrollbox-buttonDown"  tabindex="-1" aria-label="Scroll down"></a>');
                    } else {
                        $btnA = $('<a class="ts-scrollbox-buttonLeft"  tabindex="-1" aria-label="Scroll left"></a>');
                        $btnB = $('<a class="ts-scrollbox-buttonRight" tabindex="-1" aria-label="Scroll right"></a>');
                    }
                    // Buttons bracket the dragger container: up/left before, down/right after
                    $tools.prepend($btnA).append($btnB);
                }

                return { $tools, $dragger, $btnA, $btnB };
            };

            if (o.axis !== 'x') {
                const vb = buildTools(true);
                self._$toolsV  = vb.$tools;
                self._$draggerV = vb.$dragger;
                self._$btnUp   = vb.$btnA;
                self._$btnDown = vb.$btnB;
                self._$box.append(vb.$tools);
            }

            if (o.axis !== 'y') {
                const hb = buildTools(false);
                self._$toolsH   = hb.$tools;
                self._$draggerH = hb.$dragger;
                self._$btnLeft  = hb.$btnA;
                self._$btnRight = hb.$btnB;
                self._$box.append(hb.$tools);
            }

            // 6 Outside scrollbar position
            if (o.scrollbarPosition === 'outside') {
                if (self.$el.css('position') === 'static') {
                    self.$el.css('position', 'relative');
                }
                self.$el.css('overflow', 'visible');
                self._$box.removeClass('ts-scrollbox-inside').addClass('ts-scrollbox-outside');
            }

            self.$el.append(self._$box);

            // 7 Keyboard: ensure the element is focusable
            if (o.keyboard.enable && !self.$el.attr('tabindex')) {
                self.$el.attr('tabindex', '0');
            }

            // 8 Initial measure and ResizeObserver for auto-update
            self._measure();

            if (window.ResizeObserver) {
                self._ro = new ResizeObserver(() => self._measure());
                self._ro.observe(self._$box[0]);
                self._ro.observe(self._$container[0]);
            }

            return this;
        }

        events() {
            const self = this;
            const o    = self.options;

            // Mouse wheel (native, no mousewheel plugin needed)
            if (o.mouseWheel.enable) {
                self._$box.on('wheel.scrollbar', e => self._onWheel(e));
            }

            // Dragger drag via pointer events (covers mouse, touch pen, touch finger)
            if (self._$draggerV) {
                self._$draggerV.on('pointerdown.scrollbar', e => self._startDrag(e, 'y'));
            }
            if (self._$draggerH) {
                self._$draggerH.on('pointerdown.scrollbar', e => self._startDrag(e, 'x'));
            }

            // Rail click → page-jump scroll
            if (self._$toolsV) {
                self._$toolsV.on('click.scrollbar', e => self._onRailClick(e, 'y'));
            }
            if (self._$toolsH) {
                self._$toolsH.on('click.scrollbar', e => self._onRailClick(e, 'x'));
            }

            // Touch scrolling on the content area (momentum scrolling)
            self._$box
                .on('touchstart.scrollbar',                    e => self._onTouchStart(e))
                .on('touchmove.scrollbar',                     e => self._onTouchMove(e))
                .on('touchend.scrollbar touchcancel.scrollbar', e => self._onTouchEnd(e));

            // Keyboard navigation
            if (o.keyboard.enable) {
                self.$el.on('keydown.scrollbar', e => self._onKeyDown(e));
            }

            // Scroll buttons
            if (o.scrollButtons.enable) {
                const bindBtn = ($btn, dir) => {
                    if (!$btn) return;
                    $btn.on('mousedown.scrollbar touchstart.scrollbar', e => {
                        e.preventDefault();
                        self._startBtnScroll(dir);
                    });
                };
                bindBtn(self._$btnUp,    'up');
                bindBtn(self._$btnDown,  'down');
                bindBtn(self._$btnLeft,  'left');
                bindBtn(self._$btnRight, 'right');

                // Stop continuous scrolling on any release — attached to document
                // so it fires even if the cursor drifted off the button
                $(document).on(
                    'mouseup.scrollbar-btn touchend.scrollbar-btn pointerup.scrollbar-btn',
                    () => self._stopBtnScroll()
                );
            }

            // Auto-hide: show the scrollbar on hover, schedule hide on leave
            if (o.autoHideScrollbar) {
                self.$el
                    .on('mouseenter.scrollbar', () => self._showScrollbar())
                    .on('mouseleave.scrollbar', () => self._scheduleHide());
            }

            return this;
        }

        // Measurement & layout 
        _measure() {
            const self      = this;
            const o         = self.options;
            const container = self._$container[0];

            // For yx the wrapper (not the box) is the clipping viewport because it
            // has margin-right / margin-bottom that subtract the scrollbar width.
            const vpEl = self._$wrapper ? self._$wrapper[0] : self._$box[0];

            const vpH = vpEl.clientHeight;
            const vpW = vpEl.clientWidth;
            const cH  = container.offsetHeight; // full content height (height: auto)
            const cW  = container.offsetWidth;  // full content width

            self._vpH        = vpH;
            self._vpW        = vpW;
            self._maxScrollY = Math.max(0, cH - vpH);
            self._maxScrollX = Math.max(0, cW - vpW);
            self._overflowY  = self._maxScrollY > 0;
            self._overflowX  = self._maxScrollX > 0;

            // Resize dragger thumbs to reflect the content/viewport ratio
            if (o.autoDraggerLength) {
                self._sizeDragger(self._$draggerV, vpH, cH, true);
                self._sizeDragger(self._$draggerH, vpW, cW, false);
            }

            // Clamp current position to the new (possibly smaller) bounds
            self._scrollY = clamp(self._scrollY, 0, self._maxScrollY);
            self._scrollX = clamp(self._scrollX, 0, self._maxScrollX);

            // Re-render: silent=true skips the whileScrolling callback
            self._applyScroll(self._scrollY, self._scrollX, true);
            self._updateVisibility();
        }

        _sizeDragger($dragger, vpDim, cDim, vertical) {
            if (!$dragger) return;
            const prop    = vertical ? 'clientHeight' : 'clientWidth';
            const cssProp = vertical ? 'height' : 'width';
            const railDim = $dragger[0].parentElement[prop];
            const ratio   = vpDim / Math.max(cDim, 1);
            const size    = Math.max(MIN_DRAGGER_PX, Math.round(ratio * railDim));
            $dragger.css(cssProp, size + 'px');
        }

        _updateVisibility() {
            const self = this;
            const o    = self.options;

            const applyAxis = (overflow, $tools, $dragger, noScrollClass, hiddenClass) => {
                if (!$tools) return;

                // Remove stale state classes first
                self._$container.removeClass(`${noScrollClass} ${hiddenClass}`);

                if (!overflow) {
                    self._$container.addClass(noScrollClass);
                    if (o.alwaysShowScrollbar === 0) {
                        $tools.hide();
                        self._$container.addClass(hiddenClass);
                    } else {
                        $tools.show();
                        // alwaysShowScrollbar: 2 → show track, hide thumb
                        if (o.alwaysShowScrollbar === 2 && $dragger) {
                            $dragger.hide();
                        }
                    }
                } else {
                    $tools.show();
                    if ($dragger) $dragger.show();
                }
            };

            applyAxis(self._overflowY, self._$toolsV, self._$draggerV, 'ts-scrollbar-no-scrollbar-y', 'ts-scrollbar-y-hidden');
            applyAxis(self._overflowX, self._$toolsH, self._$draggerH, 'ts-scrollbar-no-scrollbar-x', 'ts-scrollbar-x-hidden');

            if (!self._overflowY && !self._overflowX) {
                self.$el.addClass('ts-scrollbar-no-scrollbar');
            } else {
                self.$el.removeClass('ts-scrollbar-no-scrollbar');
            }
        }

        // Scroll application 
        _applyScroll(y, x, silent) {
            const self = this;

            self._scrollY = clamp(y, 0, self._maxScrollY);
            self._scrollX = clamp(x, 0, self._maxScrollX);

            // Translate the content container (top/left with position:relative)
            self._$container.css({ top: -self._scrollY + 'px', left: -self._scrollX + 'px' });

            // Sync dragger thumb positions to match
            self._posDragger(self._$draggerV, self._scrollY, self._maxScrollY, true);
            self._posDragger(self._$draggerH, self._scrollX, self._maxScrollX, false);

            if (!silent) {
                self._fireCallback('whileScrolling');
            }
        }

        _posDragger($dragger, scroll, maxScroll, vertical) {
            if (!$dragger) return;
            const el         = $dragger[0];
            const prop       = vertical ? 'clientHeight' : 'clientWidth';
            const cssProp    = vertical ? 'top' : 'left';
            const draggerDim = vertical ? el.offsetHeight : el.offsetWidth;
            const railDim    = el.parentElement[prop];
            const range      = Math.max(0, railDim - draggerDim);
            const pos        = maxScroll > 0 ? (scroll / maxScroll) * range : 0;
            $dragger.css(cssProp, pos + 'px');
        }

        // Animation 
        _animateTo(targetY, targetX, duration) {
            const self = this;
            self._stopAnim();

            const o = self.options;

            // Snap to grid if configured
            if (o.snapAmount) {
                const snap = v => Math.round(v / o.snapAmount) * o.snapAmount - (o.snapOffset || 0);
                targetY = snap(targetY);
                targetX = snap(targetX);
            }

            targetY = clamp(targetY, 0, self._maxScrollY);
            targetX = clamp(targetX, 0, self._maxScrollX);

            // Instant jump (duration 0 or no delta)
            if (duration <= 0) {
                self._applyScroll(targetY, targetX);
                self._onScrollEnd();
                return;
            }

            const dY = targetY - self._scrollY;
            const dX = targetX - self._scrollX;
            if (dY === 0 && dX === 0) return;

            const startY = self._scrollY;
            const startX = self._scrollX;

            if (!self._isScrolling) {
                self._isScrolling = true;
                self._fireCallback('onScrollStart');
            }
            self._showScrollbar();

            const t0 = perfNow();

            const tick = (ts) => {
                const elapsed  = ts - t0;
                const progress = Math.min(elapsed / duration, 1);
                const ease     = easeOut(progress);

                self._applyScroll(startY + dY * ease, startX + dX * ease);

                if (progress < 1) {
                    self._rafId = requestAnimationFrame(tick);
                } else {
                    // Snap to exact target to eliminate floating-point drift
                    self._applyScroll(targetY, targetX);
                    self._onScrollEnd();
                }
            };

            self._rafId = requestAnimationFrame(tick);
        }

        _stopAnim() {
            if (this._rafId) {
                cancelAnimationFrame(this._rafId);
                this._rafId = null;
            }
        }

        _onScrollEnd() {
            const self = this;
            const o    = self.options;
            const cb   = o.callbacks;

            self._isScrolling = false;
            self._fireCallback('onScroll');

            if (self._overflowY) {
                if (self._scrollY >= self._maxScrollY - (cb.onTotalScrollOffset    || 0)) self._fireCallback('onTotalScroll');
                if (self._scrollY <=                    (cb.onTotalScrollBackOffset || 0)) self._fireCallback('onTotalScrollBack');
            }

            if (o.autoHideScrollbar && !self._isDragging) {
                self._scheduleHide();
            }
        }

        // Scrollbar visibility 
        _showScrollbar() {
            const self = this;
            clearTimeout(self._hideTimer);
            self._hideTimer = null;

            // For autoHide we must set opacity explicitly because the .ts-scrollbar--autoHide
            // CSS rule drives opacity:0 by default; inline style wins over it.
            // For normal (non-autoHide) we clear any inline override and let the
            // CSS default of opacity:0.75 on .ts-scrollbox-scrollTools apply.
            const val = self.options.autoHideScrollbar ? '1' : ''; 
            if (self._$toolsV && self._overflowY) self._$toolsV.css('opacity', val);
            if (self._$toolsH && self._overflowX) self._$toolsH.css('opacity', val);
        }

        _scheduleHide() {
            const self = this;
            // Never auto-hide when alwaysShowScrollbar is set
            if (self.options.alwaysShowScrollbar > 0) return;
            clearTimeout(self._hideTimer);
            self._hideTimer = setTimeout(() => {
                if (!self._isDragging) {
                    if (self._$toolsV) self._$toolsV.css('opacity', '0');
                    if (self._$toolsH) self._$toolsH.css('opacity', '0');
                }
            }, HIDE_DELAY_MS);
        }

        // Mouse wheel 
        _onWheel(e) {
            const self = this;
            if (self._disabled) return;

            const o  = self.options;
            const mw = o.mouseWheel;
            const oe = e.originalEvent || e;

            // Normalize deltaMode: LINE (1) → ~40px, PAGE (2) → viewport height
            const mult = oe.deltaMode === 2 ? self._vpH
                       : oe.deltaMode === 1 ? 40
                       : 1;

            let dY = oe.deltaY * mult;
            let dX = oe.deltaX * mult;

            if (mw.invert) { dY = -dY; dX = -dX; }

            // Fixed scroll amount overrides the raw delta
            if (mw.scrollAmount !== 'auto') {
                const px = parseInt(mw.scrollAmount);
                dY = dY !== 0 ? (dY > 0 ? px : -px) : 0;
                dX = dX !== 0 ? (dX > 0 ? px : -px) : 0;
            }

            const scrollAxis = mw.axis || o.axis;
            let targetY = self._scrollY;
            let targetX = self._scrollX;

            if (scrollAxis !== 'x' && self._overflowY) targetY += dY;
            if (scrollAxis !== 'y' && self._overflowX) targetX += dX;

            // Prevent native page scroll when this element will actually consume the event
            const wouldScrollY = clamp(targetY, 0, self._maxScrollY) !== self._scrollY;
            const wouldScrollX = clamp(targetX, 0, self._maxScrollX) !== self._scrollX;
            if (wouldScrollY || wouldScrollX || mw.preventDefault) {
                e.preventDefault();
                e.stopPropagation();
            }

            self._animateTo(targetY, targetX, o.scrollInertia);
        }

        // Dragger drag 
        _startDrag(e, axis) {
            const self     = this;
            if (self._disabled) return;

            e.preventDefault();
            e.stopPropagation();

            const vertical  = axis === 'y';
            const $dragger  = vertical ? self._$draggerV : self._$draggerH;
            const $tools    = vertical ? self._$toolsV   : self._$toolsH;
            const startXY   = vertical ? getCoords(e).y  : getCoords(e).x;
            const startPos  = vertical ? $dragger[0].offsetTop : $dragger[0].offsetLeft;

            self._isDragging = true;
            $tools.addClass('ts-scrollbox-scrollTools-onDrag');
            $dragger.addClass('ts-scrollbox-dragger-onDrag');

            // Pointer capture keeps events coming even if the cursor leaves the element
            const oe = e.originalEvent || e;
            if (oe.pointerId !== undefined) {
                try { $dragger[0].setPointerCapture(oe.pointerId); } catch (_) {}
            }

            const onMove = (e) => {
                const coord = vertical ? getCoords(e).y : getCoords(e).x;
                const delta = coord - startXY;
                const el    = $dragger[0];
                const prop  = vertical ? 'clientHeight' : 'clientWidth';
                const railDim    = el.parentElement[prop];
                const draggerDim = vertical ? el.offsetHeight : el.offsetWidth;
                const range  = Math.max(1, railDim - draggerDim);
                const newPos = clamp(startPos + delta, 0, range);
                const maxS   = vertical ? self._maxScrollY : self._maxScrollX;
                const scroll = (newPos / range) * maxS;

                self._stopAnim();
                if (vertical) {
                    self._applyScroll(scroll, self._scrollX);
                } else {
                    self._applyScroll(self._scrollY, scroll);
                }
                if (self.options.autoHideScrollbar) self._showScrollbar();
            };

            const onUp = () => {
                self._isDragging = false;
                $tools.removeClass('ts-scrollbox-scrollTools-onDrag');
                $dragger.removeClass('ts-scrollbox-dragger-onDrag');
                $(document).off('.scrollbar-drag');
                if (self.options.autoHideScrollbar) self._scheduleHide();
            };

            $(document)
                .on('pointermove.scrollbar-drag mousemove.scrollbar-drag touchmove.scrollbar-drag', onMove)
                .on('pointerup.scrollbar-drag   mouseup.scrollbar-drag   touchend.scrollbar-drag',  onUp);
        }

        // Rail click (page jump) 
        _onRailClick(e, axis) {
            const self = this;
            if (self._disabled) return;

            // Ignore clicks that landed on the thumb or scroll buttons
            if ($(e.target).closest('.ts-scrollbox-dragger, .ts-scrollbox-buttonUp, .ts-scrollbox-buttonDown, .ts-scrollbox-buttonLeft, .ts-scrollbox-buttonRight').length) return;
            if (!$(e.target).closest('.ts-scrollbox-draggerContainer').length) return;

            const vertical   = axis === 'y';
            const $dragger   = vertical ? self._$draggerV : self._$draggerH;
            const oe         = e.originalEvent || e;
            const railRect   = $dragger[0].parentElement.getBoundingClientRect();
            const clickPos   = vertical ? oe.clientY - railRect.top : oe.clientX - railRect.left;
            const draggerPos = vertical ? $dragger[0].offsetTop      : $dragger[0].offsetLeft;
            const draggerDim = vertical ? $dragger[0].offsetHeight   : $dragger[0].offsetWidth;
            const railDim    = $dragger[0].parentElement[vertical ? 'clientHeight' : 'clientWidth'];
            const range      = Math.max(1, railDim - draggerDim);
            // Determine direction: click below/right of thumb = scroll forward
            const dir        = clickPos > draggerPos + draggerDim / 2 ? 1 : -1;
            const vpDim      = vertical ? self._vpH : self._vpW;
            const newPos     = clamp(draggerPos + dir * vpDim * 0.9, 0, range);
            const maxScroll  = vertical ? self._maxScrollY : self._maxScrollX;
            const target     = (newPos / range) * maxScroll;

            self._animateTo(
                vertical ? target    : self._scrollY,
                vertical ? self._scrollX : target,
                self.options.scrollInertia
            );
        }

        // Touch scroll + momentum 
        _onTouchStart(e) {
            const self = this;
            if (self._disabled) return;

            // Let dragger / button touch events handle themselves separately
            if ($(e.target).closest('.ts-scrollbox-dragger, .ts-scrollbox-buttonUp, .ts-scrollbox-buttonDown, .ts-scrollbox-buttonLeft, .ts-scrollbox-buttonRight').length) return;

            const oe = e.originalEvent || e;
            if (oe.touches && oe.touches.length > 1) return; // multi-touch: pass through

            self._stopAnim();

            const c = getCoords(e);
            self._touchStartScrollY = self._scrollY;
            self._touchStartScrollX = self._scrollX;
            self._touchRefY  = c.y;
            self._touchRefX  = c.x;
            self._touchAxis  = null; // locked on first significant move
            self._touchHistory = [{ t: Date.now(), y: c.y, x: c.x }];
        }

        _onTouchMove(e) {
            const self = this;
            if (self._disabled || !self._touchHistory.length) return;

            const oe = e.originalEvent || e;
            if (oe.touches && oe.touches.length > 1) return;

            const o  = self.options;
            const c  = getCoords(e);
            const dY = self._touchRefY - c.y;
            const dX = self._touchRefX - c.x;

            // Lock the axis on the first meaningful move to prevent diagonal drift
            if (!self._touchAxis) {
                if (Math.abs(dY) < 4 && Math.abs(dX) < 4) return;
                self._touchAxis = (o.axis === 'yx')
                    ? (Math.abs(dY) >= Math.abs(dX) ? 'y' : 'x')
                    : o.axis;
            }

            const scrollY = self._touchAxis !== 'x' && self._overflowY;
            const scrollX = self._touchAxis !== 'y' && self._overflowX;

            if (scrollY || scrollX) e.preventDefault();

            const newY = scrollY ? self._touchStartScrollY + dY : self._scrollY;
            const newX = scrollX ? self._touchStartScrollX + dX : self._scrollX;
            self._applyScroll(newY, newX);

            // Rolling 100 ms velocity window
            const now_ = Date.now();
            self._touchHistory.push({ t: now_, y: c.y, x: c.x });
            self._touchHistory = self._touchHistory.filter(p => now_ - p.t <= 100);

            if (o.autoHideScrollbar) self._showScrollbar();
        }

        _onTouchEnd(e) {
            const self = this;
            if (self._disabled || !self._touchHistory.length) {
                self._touchHistory = [];
                return;
            }

            const h = self._touchHistory;
            if (h.length < 2) {
                self._touchHistory = [];
                if (self.options.autoHideScrollbar) self._scheduleHide();
                return;
            }

            // Velocity in px/ms, positive = content moving in that direction
            const first = h[0];
            const last  = h[h.length - 1];
            const dt    = Math.max(last.t - first.t, 1);
            const velY  = (first.y - last.y) / dt;
            const velX  = (first.x - last.x) / dt;

            self._touchHistory = [];

            const o       = self.options;
            const inertia = Math.max(o.scrollInertia, 200);

            // Project momentum: distance ≈ velocity × duration
            if (Math.abs(velY) > 0.05 || Math.abs(velX) > 0.05) {
                self._animateTo(
                    self._scrollY + velY * inertia,
                    self._scrollX + velX * inertia,
                    inertia
                );
            } else {
                if (o.autoHideScrollbar) self._scheduleHide();
            }
        }

        // Keyboard navigation 
        _onKeyDown(e) {
            const self = this;
            if (self._disabled) return;

            // Don't steal keys from focused form fields inside the container
            if ($(document.activeElement).is('input,textarea,select,[contenteditable]')) return;

            const key   = e.keyCode || e.which;
            const o     = self.options;
            const stepY = self._vpH * 0.9;   // page step
            const stepX = self._vpW * 0.9;
            const line  = 40;                  // arrow-key step

            let targetY = self._scrollY;
            let targetX = self._scrollX;
            let handled = false;

            if (o.axis !== 'x' && self._overflowY) {
                switch (key) {
                    case 38: targetY -= line;            handled = true; break; // ↑
                    case 40: targetY += line;            handled = true; break; // ↓
                    case 33: targetY -= stepY;           handled = true; break; // Page Up
                    case 34: targetY += stepY;           handled = true; break; // Page Down
                    case 36: targetY = 0;                handled = true; break; // Home
                    case 35: targetY = self._maxScrollY; handled = true; break; // End
                }
            }

            if (o.axis !== 'y' && self._overflowX) {
                switch (key) {
                    case 37: targetX -= line; handled = true; break; // ←
                    case 39: targetX += line; handled = true; break; // →
                }
            }

            if (handled) {
                e.preventDefault();
                self._animateTo(targetY, targetX, o.scrollInertia);
            }
        }

        // Scroll buttons (continuous press) 
        _startBtnScroll(dir) {
            const self = this;
            if (self._disabled) return;
            self._stopBtnScroll();

            const step = () => {
                const amt = parseInt(self.options.scrollButtons.scrollAmount) || 40;
                let y = self._scrollY, x = self._scrollX;

                if      (dir === 'up')    y -= amt;
                else if (dir === 'down')  y += amt;
                else if (dir === 'left')  x -= amt;
                else if (dir === 'right') x += amt;

                // Short duration for a rapid, click-like feel
                self._animateTo(y, x, 60);
                self._btnTimer = setTimeout(step, 80);
            };

            step();
        }

        _stopBtnScroll() {
            clearTimeout(this._btnTimer);
            this._btnTimer = null;
        }

        // Callbacks 
        _fireCallback(name) {
            const cb = this.options.callbacks[name];
            if (typeof cb !== 'function') return;
            cb.call(this.$el[0], {
                scrollY:    this._scrollY,
                scrollX:    this._scrollX,
                maxScrollY: this._maxScrollY,
                maxScrollX: this._maxScrollX,
                pctY: this._maxScrollY > 0 ? Math.round(100 * this._scrollY / this._maxScrollY) : 0,
                pctX: this._maxScrollX > 0 ? Math.round(100 * this._scrollX / this._maxScrollX) : 0,
            });
        }

        // scrollTo target resolution 
        _resolveTarget(target, axis) {
            const self     = this;
            const $c       = self._$container;
            const vertical = axis === 'y';
            const maxS     = vertical ? self._maxScrollY : self._maxScrollX;
            const current  = vertical ? self._scrollY    : self._scrollX;

            if (target === null || target === undefined) return null;
            if (typeof target === 'number')              return target;

            if (typeof target === 'string') {
                if (target === 'top'    || target === 'left')  return 0;
                if (target === 'bottom')                        return self._maxScrollY;
                if (target === 'right')                         return self._maxScrollX;
                if (target === 'first') {
                    const $f = $c.children().first();
                    return $f.length ? $f[0][vertical ? 'offsetTop' : 'offsetLeft'] : null;
                }
                if (target === 'last') {
                    const $l = $c.children().last();
                    return $l.length ? $l[0][vertical ? 'offsetTop' : 'offsetLeft'] : null;
                }
                if (target.includes('%'))  return (parseFloat(target) / 100) * maxS;
                if (target.includes('+=')) return current + parseFloat(target.split('+=')[1]);
                if (target.includes('-=')) return current - parseFloat(target.split('-=')[1]);
                if (target.includes('px')) return parseFloat(target);

                // Try as a CSS selector inside the container
                const $sel = $c.find(target);
                if ($sel.length) {
                    return vertical
                        ? $sel[0].offsetTop  - $c[0].offsetTop
                        : $sel[0].offsetLeft - $c[0].offsetLeft;
                }
            }

            // jQuery object or raw DOM element
            if ((target instanceof $ && target.length) || target instanceof Element) {
                const el = (target instanceof $) ? target[0] : target;
                return vertical
                    ? el.offsetTop  - $c[0].offsetTop
                    : el.offsetLeft - $c[0].offsetLeft;
            }

            return null;
        }

        /**
         * Re-measure the content and recalculate the scrollbar.
         * Call this after dynamically inserting or removing content.
         */
        update() {
            this._measure();
            return this;
        }

        /**
         * Scroll to a target position.
         *
         * @param {number|string|jQuery|Element|Array} target  — see file header
         * @param {object} [opts]
         *   scrollInertia {number} — override animation duration in ms
         *   axis          {string} — override which axis to animate ('y'|'x'|'yx')
         */
        scrollTo(target, opts) {
            const self      = this;
            const o         = self.options;
            const scrollOpts = $.extend({ scrollInertia: o.scrollInertia, axis: o.axis }, opts);
            const axis      = scrollOpts.axis;

            let targetY = self._scrollY;
            let targetX = self._scrollX;

            if (Array.isArray(target)) {
                // [yTarget, xTarget]
                const y = self._resolveTarget(target[0], 'y');
                const x = self._resolveTarget(target[1], 'x');
                if (y !== null) targetY = y;
                if (x !== null) targetX = x;
            } else {
                if (axis !== 'x') {
                    const y = self._resolveTarget(target, 'y');
                    if (y !== null) targetY = y;
                }
                if (axis !== 'y') {
                    const x = self._resolveTarget(target, 'x');
                    if (x !== null) targetX = x;
                }
            }

            self._animateTo(targetY, targetX, scrollOpts.scrollInertia);
            return this;
        }

        /**
         * Stop any currently running scroll animation.
         */
        stop() {
            this._stopAnim();
            return this;
        }

        /**
         * Make the scrollbar non-interactive.
         * @param {boolean} [resetScroll=false] — also jump scroll position back to 0
         */
        disable(resetScroll) {
            this._disabled = true;
            this.$el.addClass('ts-scrollbar-disabled');
            if (resetScroll) this._animateTo(0, 0, 0);
            return this;
        }

        /**
         * Re-enable a previously disabled scrollbar.
         */
        enable() {
            this._disabled = false;
            this.$el.removeClass('ts-scrollbar-disabled');
            this._measure();
            return this;
        }

        /**
         * Destroy the plugin and restore the element to its original HTML.
         */
        destroy() {
            const self = this;

            self._stopAnim();
            self._stopBtnScroll();
            clearTimeout(self._hideTimer);

            if (self._ro) self._ro.disconnect();

            $(document).off('.scrollbar-drag').off('.scrollbar-btn');

            self.$el
                .off('.scrollbar')
                .removeAttr('tabindex')
                .removeClass((i, cls) =>
                    cls.split(' ')
                        .filter(c => c.startsWith('mC') || c === 'ts-scrollbar-disabled' || c === 'ts-scrollbar-no-scrollbar')
                        .join(' ')
                )
                .html(self._initialHTML)
                .removeData(instanceName);

            return this;
        }
    }

    PluginScrollbar.defaults = {

        // Init immediately (scrollbars are usually always in the viewport).
        // Set to false for below-fold panels that should lazy-init.
        forceInit: true,

        // Scroll axis: 'y' | 'x' | 'yx'
        axis: 'y',

        // Visual theme — must have a matching .ts-scrollbar--{theme} block in the CSS.
        // light, dark, light-2, dark-2, thick, thick-dark, thin, thin-dark,
        // rounded, rounded-dark, rounded-dots, rounded-dots-dark,
        // 3d, 3d-dark, 3d-thick, 3d-thick-dark, minimal, minimal-dark,
        // inset, inset-dark, inset-2, inset-2-dark, inset-3, inset-3-dark
        theme: 'light',

        // Easing animation duration in ms. 0 = instant jump.
        scrollInertia: 950,

        // Resize the thumb proportionally to the content/viewport ratio.
        autoDraggerLength: true,

        // Fade the scrollbar out after HIDE_DELAY_MS of inactivity; fade in on activity.
        autoHideScrollbar: false,

        // 0 = visible only during hover/scroll
        // 1 = always visible
        // 2 = always visible track, hide thumb when nothing to scroll
        alwaysShowScrollbar: 0,

        // 'inside'  — scrollbar rendered inside the element (default)
        // 'outside' — scrollbar rendered outside (element needs overflow:visible)
        scrollbarPosition: 'inside',

        // Snap scroll position to multiples of this value in px. 0 = disabled.
        snapAmount: 0,

        // Shift the snap grid by this many px.
        snapOffset: 0,

        mouseWheel: {
            enable: true,

            // Fixed px per wheel notch, or 'auto' to use the native event delta.
            scrollAmount: 'auto',

            // Which axis the mouse wheel drives. Defaults to the plugin's own axis.
            axis: 'y',

            // Prevent native page scroll even when the content is at its edge.
            preventDefault: false,

            // Reverse the scroll direction.
            invert: false,
        },

        keyboard: {
            // Arrow keys, Page Up/Down, Home, End
            enable: true,
        },

        scrollButtons: {
            // Show clickable up/down (or left/right) arrow buttons on the track.
            enable: false,

            // px per click, or per tick while the button is held down. 'auto' → 40px.
            scrollAmount: 'auto',
        },

        callbacks: {
            // Called once when a scroll animation begins.
            onScrollStart: null,

            // Called on every rAF frame during a scroll animation.
            whileScrolling: null,

            // Called when a scroll animation completes.
            onScroll: null,

            // Called when the scroll position reaches (or passes) the end.
            onTotalScroll: null,
            // How many px from the end counts as "at the end".
            onTotalScrollOffset: 0,

            // Called when the scroll position returns to (or passes) the start.
            onTotalScrollBack: null,
            onTotalScrollBackOffset: 0,
        },
    };

    $.extend(themestrap, { PluginScrollbar });

    $.fn.themestrapPluginScrollbar = function(opts) {
        return this.map(function() {
            const $this = $(this);

            // Fall back to data-plugin-options for manual calls without explicit opts
            if (typeof opts === 'undefined') {
                const dataOpts = themestrap.fn.getOptions($this.data('plugin-options'));
                if (dataOpts) opts = dataOpts;
            }

            if ($this.data(instanceName)) {
                return $this.data(instanceName);
            }

            return new PluginScrollbar($this, opts);
        });
    };

})).apply(this, [window.themestrap, jQuery]);