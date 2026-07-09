/**
 * 页面主世界网络拦截器 — 通过 <script src> 注入，CSP 安全
 * 运行在页面的 JS 上下文中，能拦截页面的 XHR 和 fetch
 */
(function () {
    if (window.__bugreplay_net__) return;
    window.__bugreplay_net__ = true;

    // 录制开关 — 只有录制中才上报日志，避免页面启动即拦截的开销
    let _isRecording = false;

    // ============================================================
    // 常量（与 src/content/constants.ts 保持同步）
    // ============================================================
    const PM_SOURCE_NETWORK = 'bugreplay-network';
    const PM_SOURCE_PAGE_EVENT = 'bugreplay-page-event';
    const PM_SOURCE_CONTROL = 'bugreplay-control';
    const PM_ACTION_START = 'start';
    const PM_ACTION_STOP = 'stop';
    const PM_TARGET_ORIGIN = '*';

    // 响应体最大字节数（与 shared/types/network.ts 中 MAX_RESPONSE_BODY_SIZE 对齐）
    const MAX_BODY_SIZE = 100 * 1024; // 100KB
    const HTTP_ERROR_THRESHOLD = 400;
    const REQUEST_TYPE_XHR = 'xhr';
    const REQUEST_TYPE_FETCH = 'fetch';

    const EVENT_URL_CHANGE = 'url_change';
    const EVENT_STORAGE_CHANGE = 'storage_change';
    const STORAGE_ACTION_SET = 'set';
    const STORAGE_ACTION_REMOVE = 'remove';
    const STORAGE_ACTION_CLEAR = 'clear';
    const STORAGE_TYPE_LOCAL = 'local';
    const STORAGE_TYPE_SESSION = 'session';

    window.addEventListener('message', (e) => {
        if (e.data && e.data.source === PM_SOURCE_CONTROL) {
            if (e.data.action === PM_ACTION_START) {
                _isRecording = true;
                console.log('[BugReplay] Page interceptor: recording started');
            } else if (e.data.action === PM_ACTION_STOP) {
                _isRecording = false;
                console.log('[BugReplay] Page interceptor: recording stopped');
            }
        }
    });

    function post(log) {
        if (!_isRecording) return;
        window.postMessage({ source: PM_SOURCE_NETWORK, payload: log }, PM_TARGET_ORIGIN);
    }

    function genId() {
        return `net-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }

    function parseXHRHeaders(raw) {
        let result = {};
        if (!raw) return result;
        let lines = raw.trim().split(/[\r\n]+/);
        for (let i = 0; i < lines.length; i++) {
            let parts = lines[i].split(': ');
            if (parts.length >= 2) result[parts[0]] = parts.slice(1).join(': ');
        }
        return result;
    }

    function parseFetchHeaders(headers) {
        let result = {};
        if (!headers) return result;
        headers.forEach((v, k) => { result[k] = v; });
        return result;
    }

    // ===== XHR 拦截 =====
    let OrigXHR = XMLHttpRequest;
    let origOpen = OrigXHR.prototype.open;
    let origSend = OrigXHR.prototype.send;
    let origSetReqHeader = OrigXHR.prototype.setRequestHeader;

    OrigXHR.prototype.open = function (method, url) {
        // 只在录制中附加 __br 元数据，避免非录制时的开销
        if (_isRecording) {
            this.__br = {
                id: genId(),
                method: method.toUpperCase(),
                url: String(url),
                startTime: Date.now(),
                reqHeaders: {},
                reqBody: null,
            };
        }
        return origOpen.apply(this, arguments);
    };

    OrigXHR.prototype.setRequestHeader = function (name, value) {
        if (this.__br) this.__br.reqHeaders[name] = value;
        return origSetReqHeader.apply(this, arguments);
    };

    OrigXHR.prototype.send = function (body) {
        let self = this;
        let meta = self.__br;
        if (!meta) return origSend.apply(self, arguments);
        meta.reqBody = typeof body === 'string' ? body.slice(0, MAX_BODY_SIZE) : null;
        let started = Date.now();

        function makeLog(status, statusText, resBody, resHeaders, isErr, errMsg) {
            return {
                id: meta.id,
                url: meta.url,
                method: meta.method,
                requestHeaders: meta.reqHeaders,
                requestBody: meta.reqBody,
                status,
                statusText,
                responseHeaders: resHeaders,
                responseBody: (resBody || '').slice(0, MAX_BODY_SIZE),
                startTime: meta.startTime,
                duration: Date.now() - started,
                requestType: REQUEST_TYPE_XHR,
                isError: isErr,
                error: errMsg || undefined,
            };
        }

        function onReady() {
            if (self.readyState !== 4) return;
            cleanup();
            let resHeaders = parseXHRHeaders(self.getAllResponseHeaders());
            post(makeLog(self.status, self.statusText, self.responseText, resHeaders, self.status >= 400, self.status >= 400 ? `HTTP ${self.status}` : undefined));
        }

        function onErr() {
            cleanup();
            post(makeLog(0, 'Network Error', null, {}, true, 'XHR request failed'));
        }

        function onAbort() {
            cleanup();
            post(makeLog(0, 'Aborted', null, {}, true, 'XHR aborted'));
        }

        function onTimeout() {
            cleanup();
            post(makeLog(0, 'Timeout', null, {}, true, 'XHR timeout'));
        }

        function cleanup() {
            self.removeEventListener('readystatechange', onReady);
            self.removeEventListener('error', onErr);
            self.removeEventListener('abort', onAbort);
            self.removeEventListener('timeout', onTimeout);
        }

        self.addEventListener('readystatechange', onReady);
        self.addEventListener('error', onErr);
        self.addEventListener('abort', onAbort);
        self.addEventListener('timeout', onTimeout);

        return origSend.apply(self, arguments);
    };

    // ===== Fetch 拦截 =====
    let origFetch = window.fetch;
    window.fetch = function (input, init) {
        // 🔧 未录制时直接透传，不做任何拦截（避免 clone 内存泄漏）
        if (!_isRecording) {
            return origFetch.apply(this, arguments);
        }

        let url = typeof input === 'string' ? input : (input && input.url) || '';
        let method = (init && init.method) || (input && input.method) || 'GET';
        let started = Date.now();
        let reqHeaders = {};

        // 从 Request 对象中提取已有的请求头（input 可能是 Request 实例）
        if (input && typeof input !== 'string' && input.headers) {
            try {
                if (input.headers.forEach) {
                    input.headers.forEach((v, k) => { reqHeaders[k] = v; });
                }
            } catch (_) { /* Request headers may be immutable guard */ }
        }

        // 从 init.headers 合并（会覆盖同名的）
        if (init && init.headers) {
            if (init.headers instanceof Headers) {
                init.headers.forEach((v, k) => { reqHeaders[k] = v; });
            }
            else if (Array.isArray(init.headers)) {
                init.headers.forEach((p) => { reqHeaders[p[0]] = p[1]; });
            }
            else {
                let keys = Object.keys(init.headers);
                for (let i = 0; i < keys.length; i++) {
                    reqHeaders[keys[i]] = init.headers[keys[i]];
                }
            }
        }

        function makeFetchLog(status, statusText, body, resHeaders, isErr, errMsg) {
            return {
                id: genId(),
                url,
                method: method.toUpperCase(),
                requestHeaders: reqHeaders,
                requestBody: null,
                status,
                statusText,
                responseHeaders: resHeaders,
                responseBody: (body || '').slice(0, MAX_BODY_SIZE),
                startTime: started,
                duration: Date.now() - started,
                requestType: REQUEST_TYPE_FETCH,
                isError: isErr,
                error: errMsg || undefined,
            };
        }

        try {
            return origFetch.apply(this, arguments).then((res) => {
                let cloned = res.clone();
                let resHeaders = parseFetchHeaders(res.headers);
                cloned.text().then((body) => {
                    post(makeFetchLog(res.status, res.statusText, body, resHeaders, res.status >= 400));
                }).catch(() => {
                    post(makeFetchLog(res.status, res.statusText, null, resHeaders, false));
                });
                return res;
            }).catch((err) => {
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
    let lastUrl = location.href;

    function postEvent(type, data) {
        if (!_isRecording) return;
        window.postMessage({
            source: PM_SOURCE_PAGE_EVENT,
            payload: { timestamp: Date.now(), type, data },
        }, PM_TARGET_ORIGIN);
    }

    // Storage 事件去重：同一 key 短时间内多次变化只保留最后一条
    let _pendingStorageEvents = {};
    let _storageDebounceTimer = null;
    const STORAGE_DEBOUNCE_MS = 100;

    function postStorageEvent(data) {
        if (!_isRecording) return;
        const eventKey = `${data.storageType}:${data.action}:${data.key || ''}`;
        _pendingStorageEvents[eventKey] = data;
        if (!_storageDebounceTimer) {
            _storageDebounceTimer = setTimeout(() => {
                _storageDebounceTimer = null;
                const now = Date.now();
                for (const d of Object.values(_pendingStorageEvents)) {
                    window.postMessage({
                        source: PM_SOURCE_PAGE_EVENT,
                        payload: { timestamp: now, type: EVENT_STORAGE_CHANGE, data: d },
                    }, PM_TARGET_ORIGIN);
                }
                _pendingStorageEvents = {};
            }, STORAGE_DEBOUNCE_MS);
        }
    }

    function checkUrl() {
        let current = location.href;
        if (current !== lastUrl) {
            postEvent(EVENT_URL_CHANGE, { type: EVENT_URL_CHANGE, from: lastUrl, to: current });
            lastUrl = current;
        }
    }

    // SPA 路由变化
    window.addEventListener('popstate', checkUrl);
    window.addEventListener('hashchange', checkUrl);

    // Monkey-patch history API
    let origPush = history.pushState;
    let origReplace = history.replaceState;
    history.pushState = function () {
        origPush.apply(this, arguments);
        if (_isRecording) checkUrl();
    };
    history.replaceState = function () {
        origReplace.apply(this, arguments);
        if (_isRecording) checkUrl();
    };

    // ===== Storage 变更追踪 =====
    function wrapStorage(storage, name) {
        let origSet = storage.setItem;
        let origRemove = storage.removeItem;
        let origClear = storage.clear;

        storage.setItem = function (key, value) {
            if (_isRecording) {
                let oldVal = origSet.name ? null : storage.getItem(key);
                origSet.apply(this, arguments);
                postStorageEvent({ type: EVENT_STORAGE_CHANGE, storageType: name, action: STORAGE_ACTION_SET, key, oldValue: oldVal, newValue: value });
            } else {
                origSet.apply(this, arguments);
            }
        };

        storage.removeItem = function (key) {
            if (_isRecording) {
                let oldVal = origRemove.name ? null : storage.getItem(key);
                origRemove.apply(this, arguments);
                postStorageEvent({ type: EVENT_STORAGE_CHANGE, storageType: name, action: STORAGE_ACTION_REMOVE, key, oldValue: oldVal, newValue: null });
            } else {
                origRemove.apply(this, arguments);
            }
        };

        storage.clear = function () {
            if (_isRecording) {
                origClear.apply(this, arguments);
                postStorageEvent({ type: EVENT_STORAGE_CHANGE, storageType: name, action: STORAGE_ACTION_CLEAR });
            } else {
                origClear.apply(this, arguments);
            }
        };
    }

    try { wrapStorage(localStorage, 'local'); }
    catch (e) {}
    try { wrapStorage(sessionStorage, 'session'); }
    catch (e) {}
})();
