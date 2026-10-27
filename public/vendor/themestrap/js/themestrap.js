/**
 * StorageBin
 *
 * A lightweight, backend-independent storage abstraction.
 *
 * Supported backends:
 *     "auto"           Automatically select localStorage, then cookies.
 *     "localStorage"   Browser localStorage.
 *     "sessionStorage" Browser sessionStorage.
 *     "cookie"         Browser cookies.
 *     "memory"         In-memory storage.
 *
 * Example:
 *
 *     const prefs = new StorageBin();
 *
 *     prefs.set("theme", "dark");
 *     prefs.set("enabled", true);
 *     prefs.set("settings", {
 *         sidebar: true,
 *         compact: false
 *     });
 *
 *     prefs.get("theme");
 *     prefs.contains("enabled");
 *     prefs.del("theme");
 *
 *     // Explicit backend:
 *     const session = new StorageBin({
 *         backend: "sessionStorage"
 *     });
 *
 *     // Cookie storage:
 *     const cookies = new StorageBin({
 *         backend: "cookie"
 *     });
 *
 *     // Automatic fallback:
 *     const storage = new StorageBin({
 *         backend: "auto"
 *     });
 */
// StorageBin
const StorageBin = (() => {
    "use strict";
 
    const TEST_KEY = "__storagebin_test__";
 
    const encode = (value) => {
        if (typeof value === "string") {
            return value;
        }
        try {
            const result = JSON.stringify(value);
            if (typeof result === "undefined") {
                throw new TypeError("StorageBin: undefined cannot be stored.");
            }
            return result;
        } catch (error) {
            if (error instanceof TypeError) {
                throw error;
            }
            throw new TypeError("StorageBin: value could not be serialized.");
        }
    };
 
    const decode = (value) => {
        if (value === null) {
            return null;
        }
        try {
            return JSON.parse(value);
        } catch (error) {
            return value;
        }
    };
 
    const createWebStorageBackend = (name) => {
        const getStorage = () => {
            if (typeof window === "undefined" || !window[name]) {
                return null;
            }
            return window[name];
        };
 
        return {
            name,
            available() {
                try {
                    const storage = getStorage();
                    if (!storage) { return false; }
                    storage.setItem(TEST_KEY, TEST_KEY);
                    const works = storage.getItem(TEST_KEY) === TEST_KEY;
                    storage.removeItem(TEST_KEY);
                    return works;
                } catch (error) {
                    return false;
                }
            },
            set(key, value)  { getStorage().setItem(key, value); },
            get(key)         { return getStorage().getItem(key); },
            has(key)         { return getStorage().getItem(key) !== null; },
            remove(key)      { getStorage().removeItem(key); },
            keys() {
                const storage = getStorage();
                const result = [];
                for (let i = 0; i < storage.length; i++) {
                    const key = storage.key(i);
                    if (key !== null) { result.push(key); }
                }
                return result;
            },
            clear() { getStorage().clear(); }
        };
    };
 
    const cookieBackend = {
        name: "cookie",
        available() {
            if (typeof document === "undefined") { return false; }
            try {
                this.set(TEST_KEY, TEST_KEY);
                const works = this.get(TEST_KEY) === TEST_KEY;
                this.remove(TEST_KEY);
                return works;
            } catch (error) {
                return false;
            }
        },
        set(key, value) {
            document.cookie = encodeURIComponent(key) + "=" + encodeURIComponent(value) + "; path=/";
        },
        get(key) {
            const target = encodeURIComponent(key) + "=";
            const cookies = document.cookie ? document.cookie.split(";") : [];
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.indexOf(target) === 0) {
                    const value = cookie.substring(target.length);
                    try { return decodeURIComponent(value); } catch (e) { return value; }
                }
            }
            return null;
        },
        has(key)    { return this.get(key) !== null; },
        remove(key) {
            document.cookie = encodeURIComponent(key) + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
        },
        keys() {
            if (typeof document === "undefined" || !document.cookie) { return []; }
            return document.cookie.split(";").map(c => c.trim()).filter(Boolean).map(c => {
                const idx = c.indexOf("=");
                const key = idx === -1 ? c : c.substring(0, idx);
                try { return decodeURIComponent(key); } catch (e) { return key; }
            });
        },
        clear() { this.keys().forEach(key => { this.remove(key); }); }
    };
 
    const createMemoryBackend = () => {
        const data = Object.create(null);
        return {
            name: "memory",
            available() { return true; },
            set(key, value)  { data[key] = value; },
            get(key)         { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
            has(key)         { return Object.prototype.hasOwnProperty.call(data, key); },
            remove(key)      { delete data[key]; },
            keys()           { return Object.keys(data); },
            clear()          { Object.keys(data).forEach(key => { delete data[key]; }); }
        };
    };
 
    const createBackends = () => ({
        localStorage:   createWebStorageBackend("localStorage"),
        sessionStorage: createWebStorageBackend("sessionStorage"),
        cookie:         cookieBackend,
        memory:         createMemoryBackend()
    });
 
    const selectBackend = (requested, backends) => {
        const name = requested || "auto";
        if (name === "auto") {
            if (backends.localStorage.available())  { return backends.localStorage; }
            if (backends.cookie.available())        { return backends.cookie; }
            return backends.memory;
        }
        if (!backends[name]) {
            throw new TypeError(
                "StorageBin: unknown backend \"" + name + "\". Supported: " +
                Object.keys(backends).join(", ") + "."
            );
        }
        if (!backends[name].available()) {
            throw new Error("StorageBin: backend \"" + name + "\" is not available.");
        }
        return backends[name];
    };
 
    class StorageBin {
        constructor(options = {}) {
            if (options === null || typeof options !== "object" || Array.isArray(options)) {
                throw new TypeError("StorageBin: options must be an object.");
            }
            const backends     = createBackends();
            this._backend      = selectBackend(options.backend || "auto", backends);
            this._backendName  = this._backend.name;
        }
 
        get backend() { return this._backendName; }
 
        set(key, value) {
            if (typeof key !== "string") { throw new TypeError("StorageBin.set(): key must be a string."); }
            this._backend.set(key, encode(value));
            return this;
        }
 
        store(values) {
            if (values === null || typeof values !== "object" || Array.isArray(values)) {
                throw new TypeError("StorageBin.store(): argument must be an object.");
            }
            Object.keys(values).forEach(key => { this.set(key, values[key]); });
            return this;
        }
 
        get(key, defaultValue = null) {
            if (typeof key !== "string") { throw new TypeError("StorageBin.get(): key must be a string."); }
            const value = this._backend.get(key);
            return value === null ? defaultValue : decode(value);
        }
 
        getKeys()      { return this._backend.keys(); }
 
        contains(key) {
            if (typeof key !== "string") { throw new TypeError("StorageBin.contains(): key must be a string."); }
            return this._backend.has(key);
        }
 
        del(keys) {
            if (typeof keys === "string") { this._backend.remove(keys); return this; }
            if (Array.isArray(keys)) {
                keys.forEach((key, index) => {
                    if (typeof key !== "string") {
                        throw new TypeError("StorageBin.del(): key at index " + index + " must be a string.");
                    }
                    this._backend.remove(key);
                });
                return this;
            }
            throw new TypeError("StorageBin.del(): key must be a string or array.");
        }
 
        empty() { return this.clear(); }
 
        clear() { this._backend.clear(); return this; }
 
        toObject() {
            const result = {};
            this.getKeys().forEach(key => { result[key] = this.get(key); });
            return result;
        }
    }
 
    return StorageBin;
})();

// Themestrap
window.themestrap = {};

// Module-scoped dedup set for getScripts — persists across calls within the page session
const _loadedScripts = new Set();

// Themestrap Common Functions
window.themestrap.fn = {

	getOptions(opts) {

		if (opts !== null && typeof opts === 'object') {

			return opts;

		} else if (typeof opts === 'string') {

			try {
				return JSON.parse(opts.replace(/'/g, '"').replace(/;/g, ''));
			} catch (e) {
				return {};
			}

		} else {

			return {};

		}

	},

	execPluginFunction(functionName, context, ...args) {
		const namespaces = functionName.split(".");
		const func = namespaces.pop();

		for (let i = 0; i < namespaces.length; i++) {
			context = context[namespaces[i]];
		}

		return context[func](...args);
	},

	intObs(selector, callback, intObsOptions, alwaysObserve) {
		const el = document.querySelectorAll(selector);
		let intersectionObserverOptions = {
			rootMargin: '0px 0px 200px 0px'
		};

		if (Object.keys(intObsOptions).length) {
			intersectionObserverOptions = $.extend(intersectionObserverOptions, intObsOptions);
		}

		const observer = new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
					callback.call($(entry.target));

					if (!alwaysObserve) {
						observer.unobserve(entry.target);
					}
				}
            }
        }, intersectionObserverOptions);

		el.forEach(node => observer.observe(node));
	},

	intObsInit(selector, functionName) {
		const el = document.querySelectorAll(selector);
		const intersectionObserverOptions = {
			rootMargin: '200px'
		};

		const observer = new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const $this = $(entry.target);
                    const opts = themestrap.fn.getOptions($this.data('plugin-options'));

                    themestrap.fn.execPluginFunction(functionName, $this, opts);
                    observer.unobserve(entry.target);
                }
            }
        }, intersectionObserverOptions);

		el.forEach(node => observer.observe(node));
	},

	dynIntObsInit(selector, functionName, pluginDefaults) {
		const el = document.querySelectorAll(selector);

		el.forEach(node => {
            const $this = $(node);
            const opts = themestrap.fn.getOptions($this.data('plugin-options'));
            const mergedPluginDefaults = themestrap.fn.mergeOptions(pluginDefaults, opts);

            const intersectionObserverOptions = {
				rootMargin: themestrap.fn.getRootMargin(functionName, mergedPluginDefaults),
				threshold: 0
			};

            if (!mergedPluginDefaults.forceInit) {

				const observer = new IntersectionObserver(entries => {
                    for (const entry of entries) {
                        if (entry.isIntersecting) {
							themestrap.fn.execPluginFunction(functionName, $this, mergedPluginDefaults);
							observer.unobserve(entry.target);
						}
                    }
                }, intersectionObserverOptions);

				observer.observe(node);

			} else {
				themestrap.fn.execPluginFunction(functionName, $this, mergedPluginDefaults);
			}
        });
	},

	getRootMargin(plugin, {accY}) {
		return accY ? `0px 0px ${accY}px 0px` : '0px 0px 200px 0px';
	},

	mergeOptions(obj1, obj2) {
		return Object.assign({}, obj1, obj2);
	},

	execOnceThroughEvent($el, event, callback, withContext = true) {
		const self = this, dataName = self.formatDataName(event);

		$($el).on(event, function() {
			if (!$(this).data(dataName)) {

				withContext ? callback.call($(this)) : callback();

				$(this).data(dataName, true);

				$(this).off(event);
			}
		});

		return this;
	},

	execOnceThroughWindowEvent($el, event, callback) {
		return this.execOnceThroughEvent($el, event, callback, false);
	},

	formatDataName(name) {
		name = name.replace('.', '');
		return name;
	},

	isElementInView($el) {
		const rect = $el[0].getBoundingClientRect();

		return (
			rect.top <= (window.innerHeight / 3)
		);
	},

    getScripts(arr, path = '') {
        const requests = arr.map(src => {
            const fullPath = path + src;
    
            if (_loadedScripts.has(fullPath)) {
                return $.Deferred().resolve();
            }
    
            return $.getScript(fullPath).done(() => {
                _loadedScripts.add(fullPath);
            });
        });
    
        return $.when(...requests);
    },
    
    async importScripts(arr, path = '') {
        await Promise.all(
            arr.map(src => import(path + src))
        );
    },

	createStorage(options = {}) {
		return new StorageBin(options);
	},

	showErrorMessage(title, content) {

		$('.modalThemestrapErrorMessage').remove();
		$('body').append('<div class="modal fade" id="modalThemestrapErrorMessage"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">' + title + '</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="modal-body">' + content + '</div><div class="modal-footer"><button type="button" class="btn btn-primary" data-bs-dismiss="modal">Close</button></div></div></div></div>');

		const errorEl    = document.getElementById('modalThemestrapErrorMessage');
		const errorModal = bootstrap.Modal.getOrCreateInstance(errorEl);
		errorModal.show();

	}

};

(((themestrap = {}, $) => {
	/**
	 * Browser Selector
	 */
	$.extend({

		browserSelector() {

			// jQuery.browser.mobile (http://detectmobilebrowser.com/)
			(a => {(jQuery.browser=jQuery.browser||{}).mobile=/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))})(navigator.userAgent||navigator.vendor||window.opera);

			// Touch
			const hasTouch = 'ontouchstart' in window || navigator.msMaxTouchPoints;

			const u = navigator.userAgent, ua = u.toLowerCase(), is = t => ua.includes(t), g = 'gecko', w = 'webkit', s = 'safari', o = 'opera', h = document.documentElement, b = [(!(/opera|webtv/i.test(ua)) && /msie\s(\d)/.test(ua)) ? (`ie ie${parseFloat(navigator.appVersion.split("MSIE")[1])}`) : is('firefox/2') ? `${g} ff2` : is('firefox/3.5') ? `${g} ff3 ff3_5` : is('firefox/3') ? `${g} ff3` : is('gecko/') ? g : is('opera') ? o + (/version\/(\d+)/.test(ua) ? ` ${o}${RegExp.jQuery1}` : (/opera(\s|\/)(\d+)/.test(ua) ? ` ${o}${RegExp.jQuery2}` : '')) : is('konqueror') ? 'konqueror' : is('chrome') ? `${w} chrome` : is('iron') ? `${w} iron` : is('applewebkit/') ? `${w} ${s}${/version\/(\d+)/.test(ua) ? ` ${s}${RegExp.jQuery1}` : ''}` : is('mozilla/') ? g : '', is('j2me') ? 'mobile' : is('iphone') ? 'iphone' : is('ipod') ? 'ipod' : is('mac') ? 'mac' : is('darwin') ? 'mac' : is('webtv') ? 'webtv' : is('win') ? 'win' : is('freebsd') ? 'freebsd' : (is('x11') || is('linux')) ? 'linux' : '', 'js'];

			// [#6] c was an implicit global — now correctly declared with let (mutated below)
			let c = b.join(' ');

			if ($.browser.mobile) {
				c += ' mobile';
			}

			if (hasTouch) {
				c += ' touch';
			}

			h.className += ` ${c}`;

			// Edge Detect
			const isEdge = /Edge/.test(navigator.userAgent);

			if(isEdge) {
				$('html').removeClass('chrome').addClass('edge');
			}

			// Dark and Boxed Compatibility
			if($('body').hasClass('dark')) {
				$('html').addClass('dark');
			}

			if($('body').hasClass('boxed')) {
				$('html').addClass('boxed');
			}

		}

	});

	$.browserSelector();

	/**
	 * Browser Workarounds
	 */
	if (/iPad|iPhone|iPod/.test(navigator.platform)) {

		// iPad/Iphone/iPod Hover Workaround
		$(document).ready($ => {
			$('.thumb-info').attr('onclick', 'return true');
		});
	}

	// Check for IntersectionObserver support
	if ('IntersectionObserver' in window) {
		document.addEventListener("DOMContentLoaded", function() {

			function handleIntersection(entries) {
				entries.map((entry) => {
					if (entry.isIntersecting) {
						// Item has crossed our observation threshold — load src from data-src
						entry.target.style.backgroundImage = "url('" + entry.target.dataset.bgSrc + "')";
						// Job done for this item — no need to watch it
						observer.unobserve(entry.target);
					}
				});
			}

			const lazyLoadElements = document.querySelectorAll('.lazyload');
			const observer = new IntersectionObserver(
				handleIntersection, {
					rootMargin: "100px"
				}
			);
			lazyLoadElements.forEach(lazyLoadEl => observer.observe(lazyLoadEl));
		});
	} else {
		// No IntersectionObserver support — load all background images immediately
		const lazyLoadElements = document.querySelectorAll('.lazyload');
		lazyLoadElements.forEach(lazyLoadEl => {
			lazyLoadEl.style.backgroundImage = "url('" + lazyLoadEl.dataset.bgSrc + "')";
		});
	}

    // Scrollbar width measurement
    // Measures the native scrollbar width and stores it as --ts-scrollbar-width
	// on <html> so that body.ts-scroll-lock { padding-right: var(--ts-scrollbar-width) }
    // can compensate exactly, preventing layout shift when a dialog, overlay, modal, or
	// backdrop opens.
    //
    // Wrapped in a DOMContentLoaded guard so the script is safe to load from
    // <head> as well as before </body>.
    (function measureScrollbarWidth() {
        function measure() {
            const outer = document.createElement('div');
            outer.style.cssText = 'visibility:hidden;overflow:scroll;position:absolute;width:100px';
            document.body.appendChild(outer);
            const width = outer.offsetWidth - outer.clientWidth;
            document.body.removeChild(outer);
            document.documentElement.style.setProperty('--ts-scrollbar-width', width + 'px');
        }

        if (document.body) {
            // Body is already available (script loaded before </body> as normal)
            measure();
        } else {
            // Script loaded in <head> — defer until the body exists
            document.addEventListener('DOMContentLoaded', measure, { once: true });
        }
    })();

	/**
	 * Tabs
	 */
	if( $('a[data-bs-toggle="tab"]').length ) {
		$('a[data-bs-toggle="tab"]').on('shown.bs.tab', function({target}) {
			const $tabPane = $($(target).attr('href'));

			// Carousel Refresh
			if($tabPane.length) {
				$tabPane.find('.owl-carousel').trigger('refresh.owl.carousel');
			}

			// Change Active Class
			$(this).parents('.nav-tabs').find('.active').removeClass('active');
			$(this).addClass('active').parent().addClass('active');
		});

		if( window.location.hash ) {
			$(window).on('load', () => {
				if( window.location.hash !== '*' && $( window.location.hash ).get(0) ) {
					new bootstrap.Tab( $('a.nav-link[href="'+ window.location.hash +'"]:not([data-hash])')[0] ).show();
				}
			});
		}
	}

	/**
	 * On Load Scroll
	 */
	if( !$('html').hasClass('disable-onload-scroll') && window.location.hash && !['#*'].includes( window.location.hash ) ) {

		window.scrollTo(0, 0);

		$(window).on('load', () => {
			setTimeout(() => {
				const target = window.location.hash;
				let offset = ( $(window).width() < 768 ) ? 180 : 90;

				if (!$(target).length) {
					return;
				}

				if ( $("a[href$='" + window.location.hash + "']").is('[data-hash-offset]') ) {
					offset = parseInt( $("a[href$='" + window.location.hash + "']").first().attr('data-hash-offset') );
				} else if ( $("html").is('[data-hash-offset]') ) {
					offset = parseInt( $("html").attr('data-hash-offset') );
				}

				if (isNaN(offset)) {
					offset = 0;
				}

				$('body').addClass('scrolling');

				$('html, body').animate({
					scrollTop: $(target).offset().top - offset
				}, 600, 'easeOutQuad', () => {
					$('body').removeClass('scrolling');
				});
			}, 1);
		});
	}

	/**
	 * Text Rotator
	 */
	$.fn.extend({
		textRotator(options) {

			const defaults = {
				fadeSpeed: 500,
				pauseSpeed: 100,
				child: null
			};

			const opts = $.extend({}, defaults, options);

			return this.each(function() {
				const o = opts;
				const obj = $(this);
				const items = $(obj.children(), obj);
				items.each(function() {
					$(this).hide();
				});

				let next;
				if (!o.child) {
					next = $(obj).children(':first');
				} else {
					next = o.child;
				}

				$(next).fadeIn(o.fadeSpeed, () => {
					$(next).delay(o.pauseSpeed).fadeOut(o.fadeSpeed, function() {
						// nextEl avoids shadowing the outer next
						let nextEl = $(this).next();
						if (nextEl.length == 0) {
							nextEl = $(obj).children(':first');
						}
						$(obj).textRotator({
							child: nextEl,
							fadeSpeed: o.fadeSpeed,
							pauseSpeed: o.pauseSpeed
						});
					});
				});
			});
		}
	});

	/**
	 * Notice Top bar
	 */
	const $noticeTopBar = {
		$wrapper: $('.notice-top-bar'),
		$closeBtn: $('.notice-top-bar-close'),
		$header: $('#header'),
		$body: $('.body'),
		init() {
			const self = this;

			if( !$.cookie('themestrapNoticeTopBarClose') ) {
				self
					.build()
					.events();
			} else {
				self.$wrapper.parent().prepend( '<!-- Notice Top Bar removed by cookie -->' );
				self.$wrapper.remove();
			}

			return this;
		},
		build() {
			const self = this;

			$(window).on('load', () => {
				setTimeout(() => {
					self.$body.css({
						'margin-top': self.$wrapper.outerHeight(),
						'transition': 'ease margin 300ms'
					});

					$('#noticeTopBarContent').textRotator({
						fadeSpeed: 500,
						pauseSpeed: 5000
					});

					if( ['absolute', 'fixed'].includes( self.$header.css('position') ) ) {
						self.$header.css({
							'top': self.$wrapper.outerHeight(),
							'transition': 'ease top 300ms'
						});
					}

					$(window).trigger('notice.top.bar.opened');

				}, 1000);
			});

			return this;
		},
		events() {
			const self = this;

			self.$closeBtn.on('click', e => {
				e.preventDefault();

				self.$body.animate({
					'margin-top': 0,
				}, 300, () => {
					self.$wrapper.remove();
					self.saveCookie();
				});

				if( ['absolute', 'fixed'].includes( self.$header.css('position') ) ) {
					self.$header.animate({
						top: 0
					}, 300);
				}

				// When header has shrink effect
				if( self.$header.hasClass('header-effect-shrink') ) {
					self.$header.find('.header-body').animate({
						top: 0
					}, 300);
				}

				$(window).trigger('notice.top.bar.closed');
			});

			return this;
		},
		checkCookie() {
			return !!$.cookie('themestrapNoticeTopBarClose');
		},
		saveCookie() {
			const self = this;

			$.cookie('themestrapNoticeTopBarClose', true);

			return this;
		}
	};

	if( $('.notice-top-bar').length ) {
		$noticeTopBar.init();
	}

	/**
	 * Image Hotspots
	 */
	if( $('.image-hotspot').length ) {
		$('.image-hotspot')
			.append('<span class="ring"></span>')
			.append('<span class="circle"></span>');
	}

	/**
	 * Reading Progress
	 *
	 * Markup:  <div class="progress-reading" data-reading-target=".post-body"><div class="progress-bar"></div></div>
	 *
	 * With data-reading-target the bar tracks that element: 0% when its top reaches the top of the screen,
	 * 100% when its end reaches the bottom. Without it the bar tracks the whole page.
	 */
	if($('.progress-reading').length) {

		function updateScrollProgress() {
			$('.progress-reading').each(function() {
				const $bar    = $(this);
				const target  = $bar.attr('data-reading-target');
				const $target = target ? $(target).first() : $();
				let progress;

				if($target.length) {
					const rect = $target[0].getBoundingClientRect();
					const span = rect.height - $(window).height();
					$bar.toggleClass('is-idle', span <= 0);
					progress = span > 0 ? 100 * -rect.top / span : 100;
				} else {
					const pixels     = $(document).scrollTop();
					const pageHeight = $(document).height() - $(window).height();
					progress = pageHeight > 0 ? 100 * pixels / pageHeight : 0;
				}

				progress = Math.min(100, Math.max(0, progress));
				$bar.find('.progress-bar').width(parseInt(progress) + "%");
				$bar.attr('aria-valuenow', parseInt(progress));
			});
		}

		$(document).on('scroll ready', () => {
			updateScrollProgress();
		});

		$(document).ready(() => {
			$(window).afterResize(() => {
				updateScrollProgress();
			});
		});

	}

	/**
	 * Page Transition
	 */
	if( $('body[data-plugin-page-transition]').length ) {
		
		let link_click = false;

		$(document).on('click', 'a', function(e){
			link_click = $(this);
		});

		$(window).on("beforeunload", e => {
			if( typeof link_click === 'object' ) {
				const href = link_click.attr('href');

				if( href && href.indexOf('mailto:') != 0 && href.indexOf('tel:') != 0 && !link_click.data('rm-from-transition') ) {
					$('body').addClass('page-transition-active');
				}
			}
		});

		$(window).on("pageshow", ({persisted, originalEvent}) => {
			if( persisted || originalEvent.persisted) {
				if( $('html').hasClass('safari') ) {
					window.location.reload();
				}
				
				$('body').removeClass('page-transition-active');
			}
		});
	}

	/**
	 * Clone Element
	 */
	if ($('[data-clone-element]').length) {
		$('[data-clone-element]').each(function() {
			const $el = $(this), 
				  content = $el.html(), 
				  qty = $el.attr('data-clone-element');
			for (let i = 0; i < qty; i++) {
				$el.html($el.html() + content);
			}
		});
	}

	if ($('[data-clone-element-to]').length) {
		$('[data-clone-element-to]').each(function() {
			const $el = $(this);
			const content = $el.html();
			const $to = $($el.attr('data-clone-element-to'));
			$to.html($to.html() + content);
		});

	}

	/**
	 * Thumb Info Floating Caption
	 */
	$('.thumb-info-floating-caption').each(function() {
		$(this)
			.addClass('thumb-info-floating-element-wrapper')
			.append('<span class="thumb-info-floating-element thumb-info-floating-caption-title d-none">'+ $(this).data('title') +'</span>');

		if ($(this).data('type')) {
			$('.thumb-info-floating-caption-title', $(this))
				.append( '<div class="thumb-info-floating-caption-type">'+ $(this).data('type') +'</div>' )
				.css({
					'padding-bottom' : 22
				});
		}
		if ($(this).hasClass('thumb-info-floating-caption-clean')) {
			$('.thumb-info-floating-element', $(this)).addClass('bg-transparent');
		}
	});

	/**
	 * Thumb Info Floating Element
	 */
	if ($('.thumb-info-floating-element-wrapper').length) {
		if (typeof gsap !== 'undefined') {
			$('.thumb-info-floating-element-wrapper').on('mouseenter', function({clientX, clientY}) {
				if(!$(this).data('offset')) {
					$(this).data('offset', 0);
				}
				const offset = parseInt($(this).data('offset'));
				$('.thumb-info-floating-element-clone').remove();
				$('.thumb-info-floating-element', 
					$(this))
						.clone()
						.addClass('thumb-info-floating-element-clone p-fixed p-events-none')
						.attr('style', 'transform: scale(0.1);')
						.removeClass('d-none')
						.appendTo('body');

				$('.thumb-info-floating-element-clone').css({
					left: clientX + (offset),
					top: clientY + (offset)
				}).fadeIn(300);

				gsap.to('.thumb-info-floating-element-clone', 0.5, {
					css: {
						scaleX: 1,
						scaleY: 1
					}
				});

				$(document).off('mousemove').on('mousemove', ({clientX, clientY}) => {
					gsap.to('.thumb-info-floating-element-clone', 0.5, {
						css: {
							left: clientX + (offset),
							top: clientY + (offset)
						}
					});
				});
			}).on('mouseout', () => {
				gsap.to('.thumb-info-floating-element-clone', 0.5, {
					css: {
						scaleX: 0.5,
						scaleY: 0.5,
						opacity: 0
					}
				});
			});
		} else {
			themestrap.fn.showErrorMessage('Failed to Load File', 'Failed to load: GSAP - Include the following file(s): (vendor/gsap/gsap.min.js)');
		}
	}

	/**
	 * Thumb Info Direction Aware
	 */
	$(window).on('load', () => {
		$('.thumb-info-wrapper-direction-aware').each( function() {
			$(this).hoverdir({
				speed : 300,
				easing : 'ease',
				hoverDelay : 0,
				inverse : false,
				hoverElem: '.thumb-info-wrapper-overlay'
			});
		});
	});

	/**
	 * Thumb Info Container Full
	 */
	$('.thumb-info-container-full-img').each(function() {

		const $container = $(this);

		$('[data-full-width-img-src]', $container).each(function() {
			const uniqueId = 'img' + Math.floor(Math.random() * 10000);
			$(this).attr('data-rel', uniqueId);

			$container.append('<div style="background-image: url(' + $(this).attr('data-full-width-img-src') + ');" id="' + uniqueId + '" class="thumb-info-container-full-img-large opacity-0"></div>');
		});

		$('.thumb-info', $container).on('mouseenter', function(e){
			$('.thumb-info-container-full-img-large').removeClass('active');
			$('#' + $(this).attr('data-rel')).addClass('active');
		});

	});

	/**
	 * Toggle Text Click
	 */
	$('[data-toggle-text-click]').on('click', function () {
		$(this).text(function(i, text){
			return text === $(this).attr('data-toggle-text-click') ? $(this).attr('data-toggle-text-click-alt') : $(this).attr('data-toggle-text-click');
		});
	});

	/**
	 * Toggle Class
	 */
	$('[data-toggle-class]').on('click', function (e) {
		e.preventDefault();
		$(this).toggleClass($(this).data('toggle-class'));
	});

	/**
	 * Shape Divider Aspect Ratio
	 */
	if( $('.shape-divider').length ) {
		aspectRatioSVG();
		$(window).on('resize', () => {
			aspectRatioSVG();
		});
	}

	/**
	 * Shape Divider Animated
	 */
	if( $('.shape-divider-horizontal-animation').length ) {
		themestrap.fn.intObs('.shape-divider-horizontal-animation', function(){
			for( let i = 0; i <= 1; i++ ) {
				const svgClone = $(this).find('svg:nth-child(1)').clone();

				$(this).append( svgClone );
			}
			$(this).addClass('start');
		}, {});
	}

	/**
	 * Shape Divider - SVG Aspect Ratio
	 */
	function aspectRatioSVG() {
		if ($(window).width() < 1950) {
			$('.shape-divider svg[preserveAspectRatio]').each(function(){
				if( !$(this).parent().hasClass('shape-divider-horizontal-animation') ) {
					$(this).attr('preserveAspectRatio', 'xMinYMin');
				} else {
					$(this).attr('preserveAspectRatio', 'none');
				}
			});
		} else {
			$('.shape-divider svg[preserveAspectRatio]').each(function(){
				$(this).attr('preserveAspectRatio', 'none');
			});
		}
	}

	/**
	 * Content Switcher
	 */
	$('[data-content-switcher]').on('change', function(e, v) {
		const switcherRel = ($(this).is(':checked') ? '1' : '2' ), switcherId = $(this).attr('data-content-switcher-content-id');
		$('[data-content-switcher-id=' + switcherId + ']').addClass('initialized').removeClass('active');
		const $activeEl = $('[data-content-switcher-id=' + switcherId + '][data-content-switcher-rel=' + switcherRel + ']');
		$activeEl.addClass('active');
		$activeEl.parent().css('height', $activeEl.height());
	});

	$('[data-content-switcher]').trigger('change');

	/**
	 * Dynamic Height
	 */
	const $window = $(window);
	$window.on('resize dynamic.height.resize', () => {
		$('[data-dynamic-height]').each(function(){
			const $this = $(this), values = JSON.parse($this.data('dynamic-height').replace(/'/g,'"').replace(';',''));

			// XS
			if( $window.width() < 576 ) {
				$this.height( values[4] );
			}

			// SM
			if( $window.width() > 575 && $window.width() < 768 ) {
				$this.height( values[3] );
			}

			// MD
			if( $window.width() > 767 && $window.width() < 992 ) {
				$this.height( values[2] );
			}

			// LG
			if( $window.width() > 991 && $window.width() < 1200 ) {
				$this.height( values[1] );
			}

			// XL
			if( $window.width() > 1199 ) {
				$this.height( values[0] );
			}
		});
	});

	// Mobile First Load
	if($window.width() < 992) {
		$window.trigger('dynamic.height.resize');
	}

	/**
	 * Video - Trigger Play
	 */
	if ($('[data-trigger-play-video]').length) {
		themestrap.fn.execOnceThroughEvent( '[data-trigger-play-video]', 'mouseover.trigger.play.video', function(){
			const $video = $( $(this).data('trigger-play-video') );

			$(this).on('click', function(e){
				e.preventDefault();

				if( $(this).data('trigger-play-video-remove') == 'yes' ) {
					$(this).animate({
						opacity: 0
					}, 300, function(){
						$video[0].play();

						$(this).remove();
					});
				} else {
					setTimeout(() => {
						$video[0].play();
					},300);
				}
			});
		});
	}

	/**
	 * Video - Auto Play
	 */
	if ($('video[data-auto-play]').length) {
		$(window).on('load', () => {
			$('video[data-auto-play]').each(function(){
				const $video = $(this);

				setTimeout(() => {
					if($('#' + $video.attr('id')).length) {
						if ( $( '[data-trigger-play-video="#' + $video.attr('id') + '"]' ).data('trigger-play-video-remove') == 'yes' ) {
							$( '[data-trigger-play-video="#' + $video.attr('id') + '"]' ).animate({
								opacity: 0
							}, 300, () => {
								$video[0].play();

								$( '[data-trigger-play-video="#' + $video.attr('id') + '"]' ).remove();
							});
						} else {
							setTimeout(() => {
								$video[0].play();
							},300);
						}
					}
				}, 100);

			});
		});
	}

	/**
	 * Remove min height after the load of page
	 */
	if ( $('[data-remove-min-height]').length ) {
		$(window).on('load', () => {
			$('[data-remove-min-height]').each(function(){
				$(this).css({
					'min-height': 0
				});
			});
		});
	}

	/**
	 * Title Border
	 */
	if ($('[data-title-border]').length) {
		const $pageHeaderTitleBorder = $('<span class="page-header-title-border"></span>'), 
		 	  $pageHeaderTitle = $('[data-title-border]'), 
			  $window = $(window);
		$pageHeaderTitle.before($pageHeaderTitleBorder);
		const setPageHeaderTitleBorderWidth = () => {
			$pageHeaderTitleBorder.width($pageHeaderTitle.width());
		};
		$window.afterResize(() => {
			setPageHeaderTitleBorderWidth();
		});
		setPageHeaderTitleBorderWidth();
		$pageHeaderTitleBorder.addClass('visible');
	}

	/**
	 * Footer Reveal
	 */
	($ => {
		const $footerReveal = {
			$wrapper: $('.footer-reveal'),
			init() {
				const self = this;

				self.build();
				self.events();
			},
			build() {
				const self = this, 
					  footer_height = self.$wrapper.outerHeight(true), 
					  window_height = ($(window).height() - $('.header-body').height());

				if( footer_height > window_height ) {
					$('#footer').removeClass('footer-reveal');
					$('body').css('margin-bottom', 0);
				} else {
					$('#footer').addClass('footer-reveal');
					$('body').css('margin-bottom', footer_height);
				}
			},
			events() {
				const self = this, $window = $(window);
				$window.on('load', () => {
					$window.afterResize(() => {
						self.build();
					});
				});
			}
		};
		if ($('.footer-reveal').length) {
			$footerReveal.init();
		}
	})(jQuery);

	/**
	 * Re-Init Plugin
	 */
	if ($('[data-reinit-plugin]').length) {
		$('[data-reinit-plugin]').on('click', function(e) {
			e.preventDefault();

			const pluginInstance = $(this).data('reinit-plugin'), 
				  pluginFunction = $(this).data('reinit-plugin-function'), 
				  pluginElement  = $(this).data('reinit-plugin-element'), 
				  pluginOptions  = themestrap.fn.getOptions($(this).data('reinit-plugin-options'));

			$(pluginElement).data(pluginInstance).destroy();

			setTimeout(() => {
				themestrap.fn.execPluginFunction(pluginFunction, $(pluginElement), pluginOptions);
			}, 1000);

		});
	}

	/**
	 * Marquee
	 */
	if ($('.marquee').length && typeof $.fn.marquee === 'function') {
		$('.marquee').marquee({
			duration: 5000,
			gap: 0,
			delayBeforeStart: 0,
			direction: 'left',
			duplicated: true
		});
	}

})).apply(this, [ window.themestrap, jQuery ]);
