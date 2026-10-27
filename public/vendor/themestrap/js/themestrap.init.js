// Commom Plugins
(($ => {

	'use strict';

	// Scroll to Top
	if (typeof themestrap.PluginScrollToTop !== 'undefined') {
		themestrap.PluginScrollToTop.initialize();
	}

	// Validations
	if ( $.isFunction($.validator) && typeof themestrap.PluginValidation !== 'undefined') {
		themestrap.PluginValidation.initialize();
	}

	// Animate
	if (typeof $.fn['themestrapPluginAnimate'] === 'function' && $('[data-appear-animation]').length) {
		themestrap.fn.dynIntObsInit( '[data-appear-animation], [data-appear-animation-svg]', 'themestrapPluginAnimate', themestrap.PluginAnimate.defaults );
	}

	// Animated Content
	if (typeof $.fn['themestrapPluginAnimatedContent'] === 'function') {
		themestrap.fn.intObsInit( '[data-plugin-animated-letters]:not(.manual), .animated-letters', 'themestrapPluginAnimatedContent' );
		themestrap.fn.intObsInit( '[data-plugin-animated-words]:not(.manual), .animated-words', 'themestrapPluginAnimatedContent' );
	}

	// Before / After
	if (typeof $.fn['themestrapPluginBeforeAfter'] === 'function' && $('[data-plugin-before-after]').length) {
		themestrap.fn.intObsInit( '[data-plugin-before-after]:not(.manual)', 'themestrapPluginBeforeAfter' );
	}

	// Carousel
	if (typeof $.fn['themestrapPluginCarousel'] === 'function' && $('[data-plugin-carousel]:not(.manual), .owl-carousel:not(.manual)').length) {
		themestrap.fn.intObsInit( '[data-plugin-carousel]:not(.manual), .owl-carousel:not(.manual)', 'themestrapPluginCarousel' );
	}

	// Chart Circular
	if (typeof $.fn['themestrapPluginChartCircular'] === 'function' && ( $('[data-plugin-chart-circular]').length || $('.circular-bar-chart').length )) {
		themestrap.fn.dynIntObsInit( '[data-plugin-chart-circular]:not(.manual), .circular-bar-chart:not(.manual)', 'themestrapPluginChartCircular', themestrap.PluginChartCircular.defaults );
	}

	// Countdown
	if (typeof $.fn['themestrapPluginCountdown'] === 'function' && ( $('[data-plugin-countdown]').length || $('.countdown').length )) {
		themestrap.fn.intObsInit( '[data-plugin-countdown]:not(.manual), .countdown', 'themestrapPluginCountdown' );
	}

	// Counter
	if (typeof $.fn['themestrapPluginCounter'] === 'function' && ( $('[data-plugin-counter]').length || $('.counters [data-to]').length )) {
		themestrap.fn.dynIntObsInit( '[data-plugin-counter]:not(.manual), .counters [data-to]', 'themestrapPluginCounter', themestrap.PluginCounter.defaults );
	}

	// Cursor Effect
	if (typeof $.fn['themestrapPluginCursorEffect'] === 'function' && $('[data-plugin-cursor-effect]').length ) {
		themestrap.fn.intObsInit( '[data-plugin-cursor-effect]:not(.manual)', 'themestrapPluginCursorEffect' );
	}

	// Float Element
	if (typeof $.fn['themestrapPluginFloatElement'] === 'function' && $('[data-plugin-float-element]').length) {
		themestrap.fn.intObsInit( '[data-plugin-float-element], [data-plugin-float-element-svg]', 'themestrapPluginFloatElement' );
	}

	// GDPR
	if (typeof $.fn['themestrapPluginGDPR'] === 'function' && $('[data-plugin-gdpr]').length) {

		$(() => {
			$('[data-plugin-gdpr]:not(.manual)').each(function() {
                const $this = $(this);
                let opts;

                const pluginOptions = themestrap.fn.getOptions($this.data('plugin-options'));
                if (pluginOptions)
					opts = pluginOptions;

                $this.themestrapPluginGDPR(opts);
            });
		});

	}

	// GDPR Wrapper
	if (typeof $.fn['themestrapPluginGDPRWrapper'] === 'function' && $('[data-plugin-gdpr-wrapper]').length) {

		$(() => {
			$('[data-plugin-gdpr-wrapper]:not(.manual)').each(function() {
                const $this = $(this);
                let opts;

                const pluginOptions = themestrap.fn.getOptions($this.data('plugin-options'));
                if (pluginOptions)
					opts = pluginOptions;

                $this.themestrapPluginGDPRWrapper(opts);
            });
		});

	}

	// Hover Effect
	if (typeof $.fn['themestrapPluginHoverEffect'] === 'function' && $('[data-plugin-hover-effect], .hover-effect-3d').length) {
		themestrap.fn.intObsInit( '[data-plugin-hover-effect]:not(.manual), .hover-effect-3d:not(.manual)', 'themestrapPluginHoverEffect' );
	}

	// Animated Icon
	if (typeof $.fn['themestrapPluginIcon'] === 'function' && $('[data-icon]').length) {
		themestrap.fn.dynIntObsInit( '[data-icon]:not(.svg-inline--fa)', 'themestrapPluginIcon', themestrap.PluginIcon.defaults );
	}

	// In Viewport Style
	if (typeof $.fn['themestrapPluginInViewportStyle'] === 'function' && $('[data-inviewport-style]').length) {

		$(() => {
			$('[data-inviewport-style]:not(.manual)').each(function() {
                const $this = $(this);
                let opts;

                const pluginOptions = themestrap.fn.getOptions($this.data('plugin-options'));
                if (pluginOptions)
					opts = pluginOptions;

                $this.themestrapPluginInViewportStyle(opts);
            });
		});

	}

	// Lightbox
	if (typeof $.fn['themestrapPluginLightbox'] === 'function' && ( $('[data-plugin-lightbox]').length || $('.lightbox').length )) {
		themestrap.fn.execOnceThroughEvent( '[data-plugin-lightbox]:not(.manual), .lightbox:not(.manual)', 'mouseover.trigger.lightbox', function(){
            const $this = $(this);
            let opts;

            const pluginOptions = themestrap.fn.getOptions($this.data('plugin-options'));
            if (pluginOptions)
				opts = pluginOptions;

            $this.themestrapPluginLightbox(opts);
        });
	}

	// Masonry
	if (typeof $.fn['themestrapPluginMasonry'] === 'function' && $('[data-plugin-masonry]').length) {

		$(() => {
			$('[data-plugin-masonry]:not(.manual)').each(function() {
                const $this = $(this);
                let opts;

                const pluginOptions = themestrap.fn.getOptions($this.data('plugin-options'));
                if (pluginOptions)
					opts = pluginOptions;

                $this.themestrapPluginMasonry(opts);
            });
		});

	}

	if ($('[data-masonry]').length) {
		const $masonryItems = $('[data-masonry]');

		$(window).on('load', () => {
			setTimeout(() => {
				$masonryItems.each(function() {
					$(this).masonry('layout');
				});
			}, 1);
		});
	}

	// Match Height
	if (typeof $.fn['themestrapPluginMatchHeight'] === 'function' && $('[data-plugin-match-height]').length) {

		$(() => {
			$('[data-plugin-match-height]:not(.manual)').each(function() {
                const $this = $(this);
                let opts;

                const pluginOptions = themestrap.fn.getOptions($this.data('plugin-options'));
                if (pluginOptions)
					opts = pluginOptions;

                $this.themestrapPluginMatchHeight(opts);
            });
		});

	}

	// Parallax
	if (typeof $.fn['themestrapPluginParallax'] === 'function' && $('[data-plugin-parallax]').length) {
		themestrap.fn.intObsInit( '[data-plugin-parallax]:not(.manual)', 'themestrapPluginParallax' );
	}

	// Progress Bar
	if (typeof $.fn['themestrapPluginProgressBar'] === 'function' && ( $('[data-plugin-progress-bar]') || $('[data-appear-progress-animation]').length )) {
		themestrap.fn.dynIntObsInit( '[data-plugin-progress-bar]:not(.manual), [data-appear-progress-animation]', 'themestrapPluginProgressBar', themestrap.PluginProgressBar.defaults );
	}

	// Random Images
	if (typeof $.fn['themestrapPluginRandomImages'] === 'function' && $('[data-plugin-random-images]').length) {
		themestrap.fn.dynIntObsInit( '.plugin-random-images', 'themestrapPluginRandomImages', themestrap.PluginRandomImages.defaults );
	}

	// Read More
	if (typeof $.fn['themestrapPluginReadMore'] === 'function' && $('[data-plugin-readmore]').length) {
		themestrap.fn.intObsInit( '[data-plugin-readmore]:not(.manual)', 'themestrapPluginReadMore' );
	}

	// Revolution Slider
	if (typeof $.fn['themestrapPluginRevolutionSlider'] === 'function' && ( $('[data-plugin-revolution-slider]').length || $('.slider-container .slider').length )) {

		$(() => {
			$('[data-plugin-revolution-slider]:not(.manual), .slider-container .slider:not(.manual)').each(function() {
                const $this = $(this);
                let opts;

                const pluginOptions = themestrap.fn.getOptions($this.data('plugin-options'));
                if (pluginOptions)
					opts = pluginOptions;

                $this.themestrapPluginRevolutionSlider(opts);
            });
		});

	}

	// Scroll Spy
	if (typeof $.fn['themestrapPluginScrollSpy'] === 'function' && $('[data-plugin-scroll-spy]').length) {

		$(() => {
			$('[data-plugin-scroll-spy]:not(.manual)').each(function() {
                const $this = $(this);
                let opts;

                const pluginOptions = themestrap.fn.getOptions($this.data('plugin-options'));
                if (pluginOptions)
					opts = pluginOptions;

                $this.themestrapPluginScrollSpy(opts);
            });
		});

	}

	// Section Scroll
	if (typeof $.fn['themestrapPluginSectionScroll'] === 'function' && $('[data-plugin-section-scroll]').length) {

		$(() => {
			$('[data-plugin-section-scroll]:not(.manual)').each(function() {
                const $this = $(this);
                let opts;

                const pluginOptions = themestrap.fn.getOptions($this.data('plugin-options'));
                if (pluginOptions)
					opts = pluginOptions;

                $this.themestrapPluginSectionScroll(opts);
            });
		});

	}

	// Sort
	if (typeof $.fn['themestrapPluginSort'] === 'function' && ( $('[data-plugin-sort]').length || $('.sort-source').length )) {
		themestrap.fn.intObsInit( '[data-plugin-sort]:not(.manual), .sort-source:not(.manual)', 'themestrapPluginSort' );
	}

	// Sticky
	if (typeof $.fn['themestrapPluginSticky'] === 'function' && $('[data-plugin-sticky]').length) {
		themestrap.fn.execOnceThroughWindowEvent( window, 'scroll.trigger.sticky', () => {
			$('[data-plugin-sticky]:not(.manual)').each(function() {
                const $this = $(this);
                let opts;

                const pluginOptions = themestrap.fn.getOptions($this.data('plugin-options'));
                if (pluginOptions)
					opts = pluginOptions;

                $this.themestrapPluginSticky(opts);
            });
		});
	}

	// Toggle
	if (typeof $.fn['themestrapPluginToggle'] === 'function' && $('[data-plugin-toggle]').length) {
		themestrap.fn.intObsInit( '[data-plugin-toggle]:not(.manual)', 'themestrapPluginToggle' );
	}

	// Video Background
	if (typeof $.fn['themestrapPluginVideoBackground'] === 'function' && $('[data-plugin-video-background]').length) {
		themestrap.fn.intObsInit( '[data-plugin-video-background]:not(.manual)', 'themestrapPluginVideoBackground' );
	}

	// Sticky Header
	if (typeof themestrap.StickyHeader !== 'undefined') {
		themestrap.StickyHeader.initialize();
	}

	// Nav Menu
	if (typeof themestrap.Nav !== 'undefined') {
		themestrap.Nav.initialize();
	}

	// Search
	if (typeof themestrap.Search !== 'undefined' && ( $('#searchForm').length || $('.header-nav-features-search-reveal').length )) {
		themestrap.Search.initialize();
	}

	// Newsletter
	if (typeof themestrap.Newsletter !== 'undefined' && $('#newsletterForm').length) {
		themestrap.fn.intObs( '#newsletterForm', 'themestrap.Newsletter.initialize();', {} );
	}

	// Account
	if (typeof themestrap.Account !== 'undefined' && ( $('#headerAccount').length || $('#headerSignUp').length || $('#headerSignIn').length || $('#headerRecover').length || $('#headerRecoverCancel').length )) {
		themestrap.Account.initialize();
	}
	
    // Alert
    if (typeof $.fn['themestrapPluginAlert'] === 'function' && $('[data-plugin-alert]').length) {
        themestrap.fn.intObsInit('[data-plugin-alert]:not(.manual)', 'themestrapPluginAlert');
    }
	
    // Rating
    if (typeof $.fn['themestrapPluginRating'] === 'function' && $('[data-plugin-rating]').length) {
        themestrap.fn.intObsInit('[data-plugin-rating]:not(.manual)', 'themestrapPluginRating');
    }
    
	// Syntax Highlight
	if (typeof $.fn['themestrapPluginHighlight'] === 'function' && $('[data-plugin-highlight]').length) {
		$(() => {
			$('[data-plugin-highlight]:not(.manual)').each(function() {
                const $this = $(this);
                $this.themestrapPluginHighlight();
            });
		});
	}
	
	// Code Window
	if (typeof $.fn['themestrapPluginCodeWindow'] === 'function' && $('[data-plugin-code-window]').length) {
      themestrap.fn.intObsInit('[data-plugin-code-window]:not(.manual)','themestrapPluginCodeWindow');
    }
    
    // Scroller
    if (typeof $.fn['themestrapPluginScroller'] === 'function' && $('[data-plugin-scroller]').length) {
        themestrap.fn.intObsInit('[data-plugin-scroller]:not(.manual)', 'themestrapPluginScroller');
    }
    
    // Scrollable
	if (typeof $.fn['nanoScroller'] === 'function' && $('[data-plugin-scrollable]').length) {

		$(() => {
			$('[data-plugin-scrollable]:not(.manual)').each(function() {
				const $this = $(this);
				const opts  = themestrap.fn.getOptions($this.data('plugin-options')) || undefined;
				$this.themestrapPluginScrollable(opts);
			});
		});

	}
	
	// Scroll Shadow
    if (typeof $.fn['themestrapPluginScrollShadow'] === 'function' && $('[data-plugin-scroll-shadow]').length) {
        themestrap.fn.intObsInit('[data-plugin-scroll-shadow]:not(.manual)', 'themestrapPluginScrollShadow');
    }
    
    // Dialog
    if (typeof $.fn['themestrapPluginDialog'] === 'function' && $('[data-plugin-dialog]').length) {
        $(() => {
            $('[data-plugin-dialog]:not(.manual)').each(function () {
                const $this = $(this);
                const opts  = themestrap.fn.getOptions($this.data('plugin-options')) || undefined;
                $this.themestrapPluginDialog(opts);
            });
        });
    }
    
    // Collapsible
    if (typeof $.fn['themestrapPluginCollapsible'] === 'function' && $('[data-plugin-collapsible]').length) {
        themestrap.fn.intObsInit('[data-plugin-collapsible]:not(.manual)', 'themestrapPluginCollapsible');
    }
    
    // Vertical Navigation
    if (typeof $.fn['themestrapPluginVerticalNav'] === 'function' && $('[data-plugin-vertical-nav]').length) {
        themestrap.fn.intObsInit('[data-plugin-vertical-nav]:not(.manual)', 'themestrapPluginVerticalNav');
    }
    
    // SideNav
    if (typeof $.fn['themestrapPluginSideNav'] === 'function' && $('[data-plugin-sidenav]').length) {
        $(() => {
            $('[data-plugin-sidenav]:not(.manual)').each(function() {
                const $this = $(this);
                const opts  = themestrap.fn.getOptions($this.data('plugin-options')) || undefined;
                $this.themestrapPluginSideNav(opts);
            });
        });
    }
    
    // Dark Mode
    if (typeof $.fn['themestrapPluginDarkMode'] === 'function' && $('[data-plugin-darkmode]').length) {
        themestrap.fn.intObsInit('[data-plugin-darkmode]:not(.manual)', 'themestrapPluginDarkMode');
    }
    
	// Auth
    if (typeof $.fn['themestrapPluginAuth'] === 'function' && $('[data-plugin-auth]').length) {
        $(() => {
            $('[data-plugin-auth]:not(.manual)').each(function () {
                const $this = $(this);
                const opts = themestrap.fn.getOptions($this.data('plugin-options')) || undefined;
                $this.themestrapPluginAuth(opts);
            });
        });
    }
    
	// Command Menu
    if (typeof $.fn['themestrapPluginCommandMenu'] === 'function' && $('[data-plugin-command-menu]').length) {
        $(() => {
            $('[data-plugin-command-menu]:not(.manual)').each(function () {
                const $this = $(this);
                const opts = themestrap.fn.getOptions($this.data('plugin-options')) || undefined;
                $this.themestrapPluginCommandMenu(opts);
            });
        });
    }
    
	// Panel Navigation
    if (typeof $.fn['themestrapPluginPanelNav'] === 'function' && $('[data-plugin-panelnav]').length) {
        $(() => {
            $('[data-plugin-panelnav]:not(.manual)').each(function() {
                const $this = $(this);
                const opts  = themestrap.fn.getOptions($this.data('plugin-options')) || undefined;
                $this.themestrapPluginPanelNav(opts);
            });
        });
    }
    
	// Navbar
    if (typeof $.fn['themestrapPluginNavbar'] === 'function' && $('[data-plugin-navbar]').length) {
        $(() => {
            $('[data-plugin-navbar]:not(.manual)').each(function() {
                const $this = $(this);
                const opts  = themestrap.fn.getOptions($this.data('plugin-options')) || undefined;
                $this.themestrapPluginNavbar(opts);
            });
        });
    }

	// Popover
    if (typeof $.fn['themestrapPluginPopover'] === 'function' && $('[data-plugin-popover]').length) {
        $(() => {
            $('[data-plugin-popover]:not(.manual)').each(function () {
                const $this = $(this);
                const opts  = themestrap.fn.getOptions($this.data('plugin-options')) || undefined;
                $this.themestrapPluginPopover(opts);
            });
        });
    }
    
	// Navigation Menu
    if (typeof $.fn['themestrapPluginNavmenu'] === 'function' && $('[data-plugin-navmenu]').length) {
        $(() => {
            $('[data-plugin-navmenu]:not(.manual)').each(function () {
                const $this = $(this);
                const opts  = themestrap.fn.getOptions($this.data('plugin-options')) || undefined;
                $this.themestrapPluginNavmenu(opts);
            });
        });
    }
	
	// Select
    if (typeof themestrap.fn === 'object' && typeof themestrap.fn.intObsInit === 'function') {
        themestrap.fn.intObsInit('[data-plugin-select]:not(.manual)', 'themestrapPluginSelect');
    }
    
	// Wizard
	if (typeof $.fn['themestrapPluginWizard'] === 'function' && $('[data-plugin-wizard]').length) {
		$(() => {
			$('[data-plugin-wizard]:not(.manual)').each(function () {
				const $this = $(this);
				const opts = themestrap.fn.getOptions($this.data('plugin-options')) || undefined;
				$this.themestrapPluginWizard(opts);
			});
		});
	}

	// Tree
	if (typeof $.fn['themestrapPluginTree'] === 'function' && $('[data-plugin-tree]').length) {
		themestrap.fn.intObsInit('[data-plugin-tree]:not(.manual)', 'themestrapPluginTree');
	}

	// Toolbar
	if (typeof $.fn['themestrapPluginToolbar'] === 'function' && $('[data-plugin-toolbar]').length) {
		themestrap.fn.intObsInit('[data-plugin-toolbar]:not(.manual)', 'themestrapPluginToolbar');
	}

	// Accordion
	if (typeof $.fn['themestrapPluginAccordion'] === 'function' && $('[data-plugin-accordion]').length) {
		themestrap.fn.intObsInit('[data-plugin-accordion]:not(.manual)', 'themestrapPluginAccordion');
	}

	// Calendar
	if (typeof $.fn['themestrapPluginCalendar'] === 'function' && $('[data-plugin-calendar]').length) {
		themestrap.fn.intObsInit('[data-plugin-calendar]:not(.manual)', 'themestrapPluginCalendar');
	}

	// Code Rail
	if (typeof $.fn['themestrapPluginCodeRail'] === 'function' && $('[data-plugin-code-rail]').length) {
		themestrap.fn.intObsInit('[data-plugin-code-rail]:not(.manual)', 'themestrapPluginCodeRail');
	}

	// Code Window
	if (typeof $.fn['themestrapPluginCodeWindow'] === 'function' && $('[data-plugin-code-window]').length) {
		themestrap.fn.intObsInit('[data-plugin-code-window]:not(.manual)', 'themestrapPluginCodeWindow');
	}

	// Context Menu
	if (typeof $.fn['themestrapPluginContextMenu'] === 'function' && $('[data-plugin-context-menu]').length) {
		themestrap.fn.intObsInit('[data-plugin-context-menu]:not(.manual)', 'themestrapPluginContextMenu');
	}

	// HoverCard
	if (typeof $.fn['themestrapPluginHoverCard'] === 'function' && $('[data-plugin-hovercard]').length) {
		$(() => {
			$('[data-plugin-hovercard]:not(.manual)').each(function () {
				const $this = $(this);
				const opts  = themestrap.fn.getOptions($this.data('plugin-options')) || undefined;
				$this.themestrapPluginHoverCard(opts);
			});
		});
	}

	// Lockscreen
	if (typeof $.fn['themestrapPluginLockscreen'] === 'function' && $('[data-plugin-lockscreen]').length) {
		$(() => {
			$('[data-plugin-lockscreen]:not(.manual)').each(function () {
				const $this = $(this);
				const opts  = themestrap.fn.getOptions($this.data('plugin-options')) || undefined;
				$this.themestrapPluginLockscreen(opts);
			});
		});
	}

	// Markdown
	if (typeof $.fn['themestrapPluginMarkdown'] === 'function' && $('[data-plugin-markdown]').length) {
		themestrap.fn.intObsInit('[data-plugin-markdown]:not(.manual)', 'themestrapPluginMarkdown');
	}

	// MarkdownEditor
	if (typeof $.fn['themestrapPluginMarkdownEditor'] === 'function' && $('[data-plugin-markdowneditor]').length) {
		themestrap.fn.intObsInit('[data-plugin-markdowneditor]:not(.manual)', 'themestrapPluginMarkdownEditor');
	}

	// Menubar
	if (typeof $.fn['themestrapPluginMenubar'] === 'function' && $('[data-plugin-menubar]').length) {
		$(() => {
			$('[data-plugin-menubar]:not(.manual)').each(function () {
				const $this = $(this);
				const opts  = themestrap.fn.getOptions($this.data('plugin-options')) || undefined;
				$this.themestrapPluginMenubar(opts);
			});
		});
	}

	// Navigation (hybrid)
	if (typeof $.fn['themestrapPluginNavigation'] === 'function' && $('[data-plugin-navigation]').length) {
		themestrap.fn.dynIntObsInit('[data-plugin-navigation]:not(.manual)', 'themestrapPluginNavigation', themestrap.PluginNavigation.defaults);
	}

	// Otp
	if (typeof $.fn['themestrapPluginOtp'] === 'function' && $('[data-plugin-otp]').length) {
		$(() => {
			$('[data-plugin-otp]:not(.manual)').each(function () {
				const $this = $(this);
				const opts  = themestrap.fn.getOptions($this.data('plugin-options')) || undefined;
				$this.themestrapPluginOtp(opts);
			});
		});
	}

	// Pricing Toggle
	if (typeof $.fn['themestrapPluginPricingToggle'] === 'function' && $('[data-plugin-pricingtoggle]').length) {
		$(() => {
			$('[data-plugin-pricingtoggle]:not(.manual)').each(function () {
				const $this = $(this);
				const opts  = themestrap.fn.getOptions($this.data('plugin-options')) || undefined;
				$this.themestrapPluginPricingToggle(opts);
			});
		});
	}

	// RichEditor
	if (typeof $.fn['themestrapPluginRichEditor'] === 'function' && $('[data-plugin-richeditor]').length) {
		themestrap.fn.intObsInit('[data-plugin-richeditor]:not(.manual)', 'themestrapPluginRichEditor');
	}

	// Scrollbar
	if (typeof $.fn['themestrapPluginScrollbar'] === 'function' && $('[data-plugin-scrollbar]').length) {
		themestrap.fn.dynIntObsInit('[data-plugin-scrollbar]:not(.manual)', 'themestrapPluginScrollbar', themestrap.PluginScrollbar.defaults);
	}

	// Scroller
	if (typeof $.fn['themestrapPluginScroller'] === 'function' && $('[data-plugin-scroller]').length) {
		themestrap.fn.intObsInit('[data-plugin-scroller]:not(.manual)', 'themestrapPluginScroller');
	}

	// ScrollFx
	if (typeof $.fn['themestrapPluginScrollFx'] === 'function' && $('.js-scroll-fx').length) {
		themestrap.fn.dynIntObsInit('.js-scroll-fx:not(.manual)', 'themestrapPluginScrollFx', themestrap.PluginScrollFx.defaults);
	}

	// ScrollShadow
	if (typeof $.fn['themestrapPluginScrollShadow'] === 'function' && $('.js-scroll-shadow').length) {
		themestrap.fn.intObsInit('.js-scroll-shadow:not(.manual)', 'themestrapPluginScrollShadow');
	}

	// TagsInput
	if (typeof $.fn['themestrapPluginTagsInput'] === 'function' && $('[data-plugin-tagsinput]').length) {
		themestrap.fn.intObsInit('[data-plugin-tagsinput]:not(.manual)', 'themestrapPluginTagsInput');
	}

	// TimePicker
	if (typeof $.fn['themestrapPluginTimePicker'] === 'function' && $('[data-plugin-timepicker]').length) {
		themestrap.fn.intObsInit('[data-plugin-timepicker]:not(.manual)', 'themestrapPluginTimePicker');
	}

	// NumberInput
	if (typeof $.fn['themestrapPluginNumberInput'] === 'function' && $('[data-plugin-numberinput]').length) {
		themestrap.fn.intObsInit('[data-plugin-numberinput]:not(.manual)', 'themestrapPluginNumberInput');
	}

	// Dice
	if (typeof $.fn['themestrapPluginDice'] === 'function' && $('[data-plugin-dice]').length) {
		themestrap.fn.intObsInit('[data-plugin-dice]:not(.manual)', 'themestrapPluginDice');
	}

	// Particles
	if (typeof $.fn['themestrapPluginParticles'] === 'function' && $('[data-plugin-particles]').length) {
		themestrap.fn.intObsInit('[data-plugin-particles]:not(.manual)', 'themestrapPluginParticles');
	}

})).apply( this, [ jQuery ]);
