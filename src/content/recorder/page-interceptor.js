/**
 * 页面主世界网络拦截器 — 通过 <script src> 注入，CSP 安全
 * 运行在页面的 JS 上下文中，能拦截页面的 XHR 和 fetch
 */
(function () {
    if (window.__bugreplay_net__) return;
    window.__bugreplay_net__ = true;

    function post(log) {
        window.postMessage({ source: 'bugreplay-network', payload: log }, '*');
    }

    function genId() {
        return 'net-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    }

    function parseXHRHeaders(raw) {
        var result = {};
        if (!raw) return result;
        var lines = raw.trim().split(/[\r\n]+/);
        for (var i = 0; i < lines.length; i++) {
            var parts = lines[i].split(': ');
            if (parts.length >= 2) result[parts[0]] = parts.slice(1).join(': ');
        }
        return result;
    }

    function parseFetchHeaders(headers) {
        var result = {};
        if (!headers) return result;
        headers.forEach(function (v, k) { result[k] = v; });
        return result;
    }

    // ===== XHR 拦截 =====
    var OrigXHR = XMLHttpRequest;
    var origOpen = OrigXHR.prototype.open;
    var origSend = OrigXHR.prototype.send;
    var origSetReqHeader = OrigXHR.prototype.setRequestHeader;

    OrigXHR.prototype.open = function (method, url) {
        this.__br = {
            id: genId(), method: method.toUpperCase(),
            url: String(url), startTime: Date.now(),
            reqHeaders: {}, reqBody: null,
        };
        return origOpen.apply(this, arguments);
    };

    OrigXHR.prototype.setRequestHeader = function (name, value) {
        if (this.__br) this.__br.reqHeaders[name] = value;
        return origSetReqHeader.apply(this, arguments);
    };

    OrigXHR.prototype.send = function (body) {
        var self = this;
        var meta = self.__br;
        if (!meta) return origSend.apply(self, arguments);
        meta.reqBody = typeof body === 'string' ? body.slice(0, 5000) : null;
        var started = Date.now();

        function makeLog(status, statusText, resBody, resHeaders, isErr, errMsg) {
            return {
                id: meta.id, url: meta.url, method: meta.method,
                requestHeaders: meta.reqHeaders, requestBody: meta.reqBody,
                status: status, statusText: statusText,
                responseHeaders: resHeaders, responseBody: (resBody || '').slice(0, 5000),
                startTime: meta.startTime, duration: Date.now() - started,
                requestType: 'xhr', isError: isErr,
                error: errMsg || undefined,
            };
        }

        self.addEventListener('readystatechange', function () {
            if (self.readyState !== 4) return;
            var resHeaders = parseXHRHeaders(self.getAllResponseHeaders());
            post(makeLog(self.status, self.statusText, self.responseText, resHeaders, self.status >= 400, self.status >= 400 ? 'HTTP ' + self.status : undefined));
        });

        self.addEventListener('error', function () {
            post(makeLog(0, 'Network Error', null, {}, true, 'XHR request failed'));
        });

        self.addEventListener('abort', function () {
            post(makeLog(0, 'Aborted', null, {}, true, 'XHR aborted'));
        });

        self.addEventListener('timeout', function () {
            post(makeLog(0, 'Timeout', null, {}, true, 'XHR timeout'));
        });

        return origSend.apply(self, arguments);
    };

    // ===== Fetch 拦截 =====
    var origFetch = window.fetch;
    window.fetch = function (input, init) {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var method = (init && init.method) || 'GET';
        var started = Date.now();
        var reqHeaders = {};

        if (init && init.headers) {
            if (init.headers instanceof Headers) {
                init.headers.forEach(function (v, k) { reqHeaders[k] = v; });
            }
            else if (Array.isArray(init.headers)) {
                init.headers.forEach(function (p) { reqHeaders[p[0]] = p[1]; });
            }
            else {
                var keys = Object.keys(init.headers);
                for (var i = 0; i < keys.length; i++) {
                    reqHeaders[keys[i]] = init.headers[keys[i]];
                }
            }
        }

        function makeFetchLog(status, statusText, body, resHeaders, isErr, errMsg) {
            return {
                id: genId(), url: url, method: method.toUpperCase(),
                requestHeaders: reqHeaders, requestBody: null,
                status: status, statusText: statusText,
                responseHeaders: resHeaders, responseBody: (body || '').slice(0, 5000),
                startTime: started, duration: Date.now() - started,
                requestType: 'fetch', isError: isErr,
                error: errMsg || undefined,
            };
        }

        try {
            return origFetch.apply(this, arguments).then(function (res) {
                var cloned = res.clone();
                var resHeaders = parseFetchHeaders(res.headers);
                cloned.text().then(function (body) {
                    post(makeFetchLog(res.status, res.statusText, body, resHeaders, res.status >= 400));
                }).catch(function () {
                    post(makeFetchLog(res.status, res.statusText, null, resHeaders, false));
                });
                return res;
            }).catch(function (err) {
                post(makeFetchLog(0, 'Fetch Error', null, {}, true, String(err)));
                throw err;
            });
        }
        catch (err) {
            // 同步错误（如无效 URL）
            return Promise.reject(err);
        }
    };

    // ===== URL 变更追踪 =====
    var lastUrl = location.href;

    function postEvent(type, data) {
        window.postMessage({
            source: 'bugreplay-page-event',
            payload: { timestamp: Date.now(), type: type, data: data },
        }, '*');
    }

    function checkUrl() {
        var current = location.href;
        if (current !== lastUrl) {
            postEvent('url_change', { from: lastUrl, to: current });
            lastUrl = current;
        }
    }

    // SPA 路由变化
    window.addEventListener('popstate', checkUrl);
    window.addEventListener('hashchange', checkUrl);

    // Monkey-patch history API
    var origPush = history.pushState;
    var origReplace = history.replaceState;
    history.pushState = function () { origPush.apply(this, arguments); checkUrl(); };
    history.replaceState = function () { origReplace.apply(this, arguments); checkUrl(); };

    // ===== Storage 变更追踪 =====
    function wrapStorage(storage, name) {
        var origSet = storage.setItem;
        var origRemove = storage.removeItem;
        var origClear = storage.clear;

        storage.setItem = function (key, value) {
            var oldVal = origSet.name ? null : storage.getItem(key);
            origSet.apply(this, arguments);
            postEvent('storage_change', { storageType: name, action: 'set', key: key, oldValue: oldVal, newValue: value });
        };

        storage.removeItem = function (key) {
            var oldVal = origRemove.name ? null : storage.getItem(key);
            origRemove.apply(this, arguments);
            postEvent('storage_change', { storageType: name, action: 'remove', key: key, oldValue: oldVal, newValue: null });
        };

        storage.clear = function () {
            origClear.apply(this, arguments);
            postEvent('storage_change', { storageType: name, action: 'clear' });
        };
    }

    try { wrapStorage(localStorage, 'local'); } catch (e) {}
    try { wrapStorage(sessionStorage, 'session'); } catch (e) {}
})();
