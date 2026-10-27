(((themestrap = {}, $) => {
    const instanceName = '__toast';

    // Container registry
    // one container div per position, lazily created.
    const containers = {};

    function getContainer(position) {
        if (containers[position]) return containers[position];

        const [y, x] = position.split('-');   // e.g. 'top-end' ? ['top', 'end']

        const yClass = {
            top:    'top-0',
            middle: 'top-50 translate-middle-y',
            bottom: 'bottom-0',
        }[y] ?? 'top-0';

        const xClass = {
            start:  'start-0',
            center: 'start-50 translate-middle-x',
            end:    'end-0',
        }[x] ?? 'end-0';

        const $c = $(`<div class="toast-container position-fixed p-3 ${yClass} ${xClass}" />`);
        $c.css('z-index', 1090);
        $('body').append($c);

        containers[position] = $c;
        return $c;
    }

    // Icon map
    const typeIcons = {
        success: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g stroke-linejoin="round" stroke-linecap="round" stroke-width="2" fill="none" stroke="#0088cc"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" stroke="#0088cc"></path><path d="M9 12l2 2l4 -4" stroke="#777"></path></g></svg>`,
        danger:  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g stroke-linejoin="round" stroke-linecap="round" stroke-width="2" fill="none" stroke="#0088cc"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" stroke="#0088cc"></path><path d="M12 8v4" stroke="#777"></path><path d="M12 16h.01" stroke="#777"></path></g></svg>`,
        warning: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g stroke-linejoin="round" stroke-linecap="round" stroke-width="2" fill="none" stroke="#0088cc"><path d="M12 9v4" stroke="#777"></path><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" stroke="#0088cc"></path><path d="M12 16h.01" stroke="#777"></path></g></svg>`,
        info:    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g stroke-linejoin="round" stroke-linecap="round" stroke-width="2" fill="none" stroke="#0088cc"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" stroke="#0088cc"></path><path d="M12 9h.01" stroke="#777"></path><path d="M11 12h1v4h1" stroke="#777"></path></g></svg>`,
        dark:    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g stroke-linejoin="round" stroke-linecap="round" stroke-width="2" fill="none" stroke="#0088cc"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008"></path></g></svg>`,
        light:   `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g stroke-linejoin="round" stroke-linecap="round" stroke-width="2" fill="none" stroke="#0088cc"><path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" stroke="#0088cc"></path><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" stroke="#777"></path></g></svg>`,
    };

    // Header color map: Bootstrap contextual text + bg combos for the
    // icon/title row, keeping the body neutral white.
    const typeHeaderClass = {
        success: 'text-success',
        danger:  'text-danger',
        warning: 'text-warning',
        info:    'text-info',
        dark:    'text-dark',
        light:   'text-secondary',
    };

    class PluginToast {

        constructor($el, opts) {
            return this.initialize($el, opts);
        }

        initialize($el, opts) {
            this.$el = $el;

            if ($el.data(instanceName)) {
                return $el.data(instanceName);
            }

            this
                .setData()
                .setOptions(opts)
                .build();

            return this;
        }

        setData() {
            this.$el.data(instanceName, this);
            return this;
        }

        setOptions(opts) {
            const attrOpts = themestrap.fn.getOptions(this.$el.data('plugin-toast-options'));

            this.options = $.extend(true, {}, PluginToast.defaults, opts, attrOpts, {
                // Inline data attributes win over everything else.
                title:    this.$el.data('plugin-toast-title')    ?? (opts?.title    ?? PluginToast.defaults.title),
                body:     this.$el.data('plugin-toast-body')     ?? (opts?.body     ?? PluginToast.defaults.body),
                type:     this.$el.data('plugin-toast-type')     ?? (opts?.type     ?? PluginToast.defaults.type),
                position: this.$el.data('plugin-toast-position') ?? (opts?.position ?? PluginToast.defaults.position),
                delay:    this.$el.data('plugin-toast-delay')    ?? (opts?.delay    ?? PluginToast.defaults.delay),
                autohide: this.$el.data('plugin-toast-autohide') ?? (opts?.autohide ?? PluginToast.defaults.autohide),
                progress: this.$el.data('plugin-toast-progress') ?? (opts?.progress ?? PluginToast.defaults.progress),
                icon:     this.$el.data('plugin-toast-icon')     ?? (opts?.icon     ?? null),
            });

            return this;
        }

        build() {
            const self = this;
            const o    = self.options;

            const icon = o.icon
                ? `<img src="${o.icon}" width="16" height="16" alt="" />`
                : (typeIcons[o.type] ?? '');

            const headerClass = typeHeaderClass[o.type] ?? '';

            const timestamp = o.timestamp
                ? `<small class="text-body-secondary ms-auto">${o.timestamp}</small>`
                : '';

            const progress = o.autohide && o.progress
                ? `<div class="hljs-toast-progress"><div class="hljs-toast-progress-bar"></div></div>`
                : '';

            const $toast = $(`
                <div class="toast align-items-stretch border-0 shadow" role="alert" aria-live="assertive" aria-atomic="true">
                    <div class="toast-header ${headerClass}">
                        <span class="me-2 d-flex">${icon}</span>
                        <strong class="me-auto">${o.title}</strong>
                        ${timestamp}
                        ${o.dismissible ? '<button type="button" class="btn-close ms-2" data-bs-dismiss="toast" aria-label="Close"></button>' : ''}
                    </div>
                    <div class="toast-body">${o.body}</div>
                    ${progress}
                </div>
            `);

            const $container = getContainer(o.position);
            $container.append($toast);

            // Bootstrap 5 native Toast instance
            const bsToast = new bootstrap.Toast($toast[0], {
                autohide: o.autohide,
                delay:    o.delay,
            });

            // Progress bar animation, shrinks width over `delay` ms.
            if (o.autohide && o.progress) {
                const $bar = $toast.find('.toast-progress-bar');
                // Reset then animate on next tick so the transition fires.
                $bar.css('transition', 'none').css('width', '100%');
                requestAnimationFrame(() => {
                    $bar.css('transition', `width ${o.delay}ms linear`).css('width', '0%');
                });
            }

            // Pause progress & autohide on hover.
            if (o.autohide && o.progress) {
                $toast.on('mouseenter', () => {
                    $toast.find('.toast-progress-bar').css('transition', 'none');
                    bsToast._clearTimeout?.();  
                }).on('mouseleave', () => {
                    bsToast.show();             // Re-arms the autohide timer.
                });
            }

            // Remove from DOM after Bootstrap fires hidden event.
            $toast[0].addEventListener('hidden.bs.toast', () => {
                $toast.remove();
                // Clean up empty container.
                if ($container.children().length === 0) {
                    $container.remove();
                    delete containers[o.position];
                }
                self.$el.removeData(instanceName);
                if (typeof o.onHidden === 'function') o.onHidden.call(self);
            });

            $toast[0].addEventListener('shown.bs.toast', () => {
                if (typeof o.onShown === 'function') o.onShown.call(self);
            });

            self.$toast  = $toast;
            self._bsToast = bsToast;

            bsToast.show();

            return this;
        }

        hide() {
            this._bsToast?.hide();
            return this;
        }

        dispose() {
            this._bsToast?.dispose();
            this.$el.removeData(instanceName);
            return this;
        }

        // Fire-and-forget: PluginToast.show({ title: '', body: '', type: 'success' })
        // No element needed, mounts to a detached anchor appended to body.
        static show(opts) {
            const $anchor = $('<div />').appendTo('body').hide();
            return new PluginToast($anchor, opts);
        }
    }

    PluginToast.defaults = {
        title:       'Notification',
        body:        '',
        type:        'info',            // success | danger | warning | info | dark | light
        position:    'top-end',         // {top|middle|bottom}-{start|center|end}
        autohide:    true,
        delay:       4000,
        dismissible: true,
        progress:    true,              // animated countdown bar (requires autohide: true)
        timestamp:   null,             // string shown in header right (e.g. 'just now')
        onShown:     null,
        onHidden:    null,
        icon:        null,             // custom img src; falls back to type icon SVG
    };

    $.extend(themestrap, { PluginToast });

    $.fn.themestrapPluginToast = function (opts) {
        return this.map(function () {
            const $this = $(this);

            if ($this.data(instanceName)) {
                return $this.data(instanceName);
            }

            return new PluginToast($this, opts);
        });
    };

})).apply(this, [window.themestrap, jQuery]);
