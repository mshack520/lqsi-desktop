import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
export const MES_PROXY_PATH = '/__scx_mes_workbench';
export const ERP_PROXY_BRIDGE_PATH = '__dsh_proxy_bridge.js';
export const erpProxyBridgeScript = `(() => {
  const script = document.currentScript
  if (!script) return
  const routePath = script.dataset.routePath || ''
  const proxyBasePath = script.dataset.proxyBasePath || routePath
  const upstreamOrigin = script.dataset.upstreamOrigin || ''
  const upstreamBasePath = script.dataset.upstreamBasePath || ''
  const mapPath = (pathname) => {
    if (pathname === routePath || pathname.startsWith(routePath + '/')) return pathname
    const normalized = pathname.startsWith('/') ? pathname : '/' + pathname
    if (upstreamBasePath && (normalized === upstreamBasePath || normalized.startsWith(upstreamBasePath + '/'))) return routePath + normalized
    return proxyBasePath + normalized
  }
  const rewrite = (input) => {
    try {
      const request = typeof Request !== 'undefined' && input instanceof Request
      const urlObject = input instanceof URL
      const raw = request ? input.url : String(input)
      const target = new URL(raw, window.location.href)
      const sameProxy = target.origin === window.location.origin
      if (!sameProxy && target.origin !== upstreamOrigin) return input
      const nextPath = mapPath(target.pathname)
      if (sameProxy && nextPath === target.pathname) return input
      target.protocol = window.location.protocol
      target.host = window.location.host
      target.pathname = nextPath
      if (request) return new Request(target.href, input)
      if (urlObject) return target
      if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) return target.pathname + target.search + target.hash
      return target.href
    } catch { return input }
  }
  if (typeof window.fetch === 'function') {
    const fetch = window.fetch
    window.fetch = function (input, init) { return fetch.call(this, rewrite(input), init) }
  }
  if (typeof XMLHttpRequest !== 'undefined') {
    const open = XMLHttpRequest.prototype.open
    XMLHttpRequest.prototype.open = function (method, url, ...rest) { return open.call(this, method, rewrite(url), ...rest) }
  }
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const sendBeacon = navigator.sendBeacon.bind(navigator)
    navigator.sendBeacon = (url, data) => sendBeacon(rewrite(url), data)
  }
  const rewriteDomUrl = (value) => {
    const mapped = rewrite(value)
    return mapped instanceof URL ? mapped.href : mapped
  }
  if (typeof Element !== 'undefined') {
    const setAttribute = Element.prototype.setAttribute
    Element.prototype.setAttribute = function (name, value) {
      const attribute = String(name).toLowerCase()
      if (['src', 'href', 'action', 'formaction', 'poster'].includes(attribute)) value = rewriteDomUrl(value)
      return setAttribute.call(this, name, value)
    }
  }
  for (const [type, property] of [
    [typeof HTMLScriptElement !== 'undefined' && HTMLScriptElement, 'src'],
    [typeof HTMLLinkElement !== 'undefined' && HTMLLinkElement, 'href'],
    [typeof HTMLImageElement !== 'undefined' && HTMLImageElement, 'src'],
    [typeof HTMLIFrameElement !== 'undefined' && HTMLIFrameElement, 'src'],
    [typeof HTMLFormElement !== 'undefined' && HTMLFormElement, 'action'],
    [typeof HTMLSourceElement !== 'undefined' && HTMLSourceElement, 'src'],
    [typeof HTMLVideoElement !== 'undefined' && HTMLVideoElement, 'poster'],
  ]) {
    if (!type) continue
    const descriptor = Object.getOwnPropertyDescriptor(type.prototype, property)
    if (!descriptor?.set || !descriptor.configurable) continue
    Object.defineProperty(type.prototype, property, {
      ...descriptor,
      set(value) { return descriptor.set.call(this, rewriteDomUrl(value)) },
    })
  }
})()`;
const MAX_REQUEST_BYTES = 32 * 1024 * 1024;
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const HOP_BY_HOP_HEADERS = new Set([
    'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer',
    'transfer-encoding', 'upgrade', 'host', 'content-length', 'content-encoding', 'content-md5', 'accept-encoding',
]);
function upstreamCookieHeader(value) {
    if (!value)
        return undefined;
    const cookies = value.split(';').map((part) => part.trim()).filter((part) => {
        const name = part.slice(0, part.indexOf('='));
        return name && !name.startsWith('dsh-auth-') && !name.startsWith('dsh_erp_proxy_');
    });
    return cookies.length ? cookies.join('; ') : undefined;
}
const CSP_DIRECTIVES = new Set([
    'base-uri', 'child-src', 'connect-src', 'default-src', 'fenced-frame-src', 'font-src', 'form-action',
    'frame-ancestors', 'frame-src', 'img-src', 'manifest-src', 'media-src', 'object-src', 'prefetch-src',
    'script-src', 'script-src-attr', 'script-src-elem', 'style-src', 'style-src-attr', 'style-src-elem', 'worker-src',
]);
function splitCspPolicies(value) {
    const policies = [];
    let start = 0;
    for (let index = 0; index < value.length; index++) {
        if (value[index] !== ',')
            continue;
        const following = value.slice(index + 1).trimStart().match(/^([a-z-]+)(?=\s|;|$)/i)?.[1]?.toLowerCase();
        if (following && CSP_DIRECTIVES.has(following)) {
            policies.push(value.slice(start, index));
            start = index + 1;
        }
    }
    policies.push(value.slice(start));
    return policies;
}
function allowFrameAncestor(policy, origin) {
    return splitCspPolicies(policy).map((item) => {
        const directives = item.split(';').map((directive) => directive.trim()).filter(Boolean);
        const index = directives.findIndex((directive) => /^frame-ancestors(?:\s|$)/i.test(directive));
        const replacement = `frame-ancestors ${origin}`;
        if (index < 0)
            directives.push(replacement);
        else
            directives[index] = replacement;
        return directives.join('; ');
    }).join(', ');
}
function allowProxyBridgeResources(policy) {
    return splitCspPolicies(policy).map((item) => {
        const directives = item.split(';').map((directive) => directive.trim()).filter(Boolean);
        const elementIndex = directives.findIndex((directive) => /^script-src-elem(?:\s|$)/i.test(directive));
        const scriptIndex = directives.findIndex((directive) => /^script-src(?:\s|$)/i.test(directive));
        const index = elementIndex >= 0 ? elementIndex : scriptIndex;
        if (index >= 0) {
            if (!/(?:^|\s)'self'(?:\s|$)/i.test(directives[index]))
                directives[index] += " 'self'";
        }
        else {
            directives.push("script-src 'self'");
        }
        const connectIndex = directives.findIndex((directive) => /^connect-src(?:\s|$)/i.test(directive));
        if (connectIndex >= 0) {
            if (!/(?:^|\s)'self'(?:\s|$)/i.test(directives[connectIndex]))
                directives[connectIndex] += " 'self'";
        }
        else {
            directives.push("connect-src 'self'");
        }
        return directives.join('; ');
    }).join(', ');
}
export function readConfigString(value) {
    if (typeof value === 'string')
        return value;
    if (typeof value !== 'object' || value === null || !('get' in value) || typeof value.get !== 'function')
        return '';
    const current = value.get();
    return typeof current === 'string' ? current : '';
}
function normalizedBase(raw) {
    try {
        const url = new URL(raw.trim());
        if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password || url.search || url.hash)
            return undefined;
        if (!url.pathname.startsWith('/'))
            return undefined;
        return url;
    }
    catch {
        return undefined;
    }
}
function basePath(url) {
    const trimmed = url.pathname.replace(/\/+$/, '');
    return trimmed === '/' ? '' : trimmed;
}
export function getSiteProxyPath(siteUrl) {
    const base = normalizedBase(siteUrl);
    if (!base)
        return undefined;
    const identity = `${base.origin}${basePath(base)}`;
    let hash = 0xcbf29ce484222325n;
    for (let index = 0; index < identity.length; index++) {
        hash ^= BigInt(identity.charCodeAt(index));
        hash = BigInt.asUintN(64, hash * 0x100000001b3n);
    }
    return `${MES_PROXY_PATH}/${hash.toString(16).padStart(16, '0')}`;
}
export function publicBasePath(siteUrl) {
    const base = normalizedBase(siteUrl);
    const routePath = getSiteProxyPath(siteUrl);
    if (!base || !routePath)
        return undefined;
    return `${routePath}${basePath(base)}`;
}
export function resolveUpstreamTarget(siteUrl, requestUrl) {
    const base = normalizedBase(siteUrl);
    const routePath = getSiteProxyPath(siteUrl);
    if (!base || !routePath)
        return undefined;
    let incoming;
    try {
        incoming = new URL(requestUrl, 'http://dsh.local');
    }
    catch {
        return undefined;
    }
    const path = incoming.pathname;
    if (path !== routePath && !path.startsWith(`${routePath}/`))
        return undefined;
    const mountedPath = basePath(base);
    let forwardedPath;
    if (path === routePath || path === `${routePath}/`) {
        forwardedPath = mountedPath ? `${mountedPath}/` : '/';
    }
    else {
        forwardedPath = path.slice(routePath.length) || '/';
        if (!forwardedPath.startsWith('/'))
            return undefined;
        if (mountedPath && forwardedPath !== mountedPath && !forwardedPath.startsWith(`${mountedPath}/`))
            return undefined;
    }
    const target = new URL(base.origin);
    target.pathname = forwardedPath;
    target.search = incoming.search;
    return target;
}
export function isSameOriginRequest(origin, host, expectedOrigin) {
    if (!origin || !host)
        return false;
    try {
        const parsed = new URL(origin);
        if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.host.toLowerCase() !== host.toLowerCase())
            return false;
        return !expectedOrigin || parsed.origin === new URL(expectedOrigin).origin;
    }
    catch {
        return false;
    }
}
function rewriteRootPath(path, siteUrl) {
    if (path.startsWith('//'))
        return path;
    const mountPath = publicBasePath(siteUrl) || MES_PROXY_PATH;
    const routePath = getSiteProxyPath(siteUrl) || MES_PROXY_PATH;
    const upstreamBasePath = mountPath.slice(routePath.length).replace(/\/+$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    if (upstreamBasePath && (normalizedPath === upstreamBasePath || normalizedPath.startsWith(`${upstreamBasePath}/`))) {
        return `${routePath}${normalizedPath}`;
    }
    return `${routePath}${upstreamBasePath}${normalizedPath}`;
}
function escapeHtmlAttribute(value) {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
export function rewriteProxyHtml(html, siteUrl, injectProxyBridge = false) {
    const mountPath = publicBasePath(siteUrl) || MES_PROXY_PATH;
    const routePath = getSiteProxyPath(siteUrl) || MES_PROXY_PATH;
    const base = normalizedBase(siteUrl);
    let output = html.replace(/\bdata-base-path=(['"])[^'"]*\1/i, `data-base-path="${mountPath}"`);
    output = output.replace(/((?:href|src|action|formaction|poster)\s*=\s*['"])\/(?!\/)([^'"]*)/gi, (_match, prefix, path) => `${prefix}${rewriteRootPath(`/${path}`, siteUrl)}`);
    if (injectProxyBridge && base) {
        const script = `<script src="${mountPath}/${ERP_PROXY_BRIDGE_PATH}" data-route-path="${escapeHtmlAttribute(routePath)}" data-proxy-base-path="${escapeHtmlAttribute(mountPath)}" data-upstream-origin="${escapeHtmlAttribute(base.origin)}" data-upstream-base-path="${escapeHtmlAttribute(basePath(base))}"></script>`;
        const head = output.match(/<head\b[^>]*>/i);
        if (head && head.index !== undefined)
            output = `${output.slice(0, head.index + head[0].length)}${script}${output.slice(head.index + head[0].length)}`;
        else
            output = `${script}${output}`;
    }
    return output;
}
export function rewriteProxyCss(css, siteUrl) {
    const rewrite = (_match, quote, path) => `url(${quote}${rewriteRootPath(path, siteUrl)}${quote})`;
    let output = css.replace(/url\(\s*(['"]?)(\/(?!\/)[^)'"\s]*)\1\s*\)/gi, rewrite);
    output = output.replace(/(@import\s+)(['"])\/(?!\/)([^'"]*)\2/gi, (_match, prefix, quote, path) => `${prefix}${quote}${rewriteRootPath(`/${path}`, siteUrl)}${quote}`);
    return output;
}
export function rewriteProxyCookie(cookie, siteUrl) {
    const mountPath = publicBasePath(siteUrl) || MES_PROXY_PATH;
    const routePath = getSiteProxyPath(siteUrl) || MES_PROXY_PATH;
    const mappedPath = (path) => {
        const cleanMount = mountPath.replace(/\/+$/, '');
        const upstreamBase = cleanMount.slice(routePath.length);
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        if (!cleanMount)
            return `${routePath}${normalizedPath}`;
        if (upstreamBase && (normalizedPath === upstreamBase || normalizedPath.startsWith(`${upstreamBase}/`))) {
            return `${routePath}${normalizedPath}`;
        }
        return `${cleanMount}${normalizedPath}`;
    };
    let output = cookie.replace(/;\s*Domain=[^;]*/gi, '');
    const pathMatch = output.match(/;\s*Path=([^;]*)/i);
    if (pathMatch)
        output = output.replace(pathMatch[0], `; Path=${mappedPath(pathMatch[1].trim())}`);
    else
        output += `; Path=${mappedPath('/')}`;
    return output;
}
export function rewriteProxyLocation(location, siteUrl, requestOrigin) {
    const base = normalizedBase(siteUrl);
    const routePath = getSiteProxyPath(siteUrl);
    if (!base || !routePath)
        return location;
    try {
        const resolved = new URL(location, base);
        if (resolved.origin !== base.origin)
            return location;
        const mountPath = `${routePath}${basePath(base)}`;
        let path = resolved.pathname;
        const upstreamBase = basePath(base);
        if (upstreamBase && path !== upstreamBase && !path.startsWith(`${upstreamBase}/`)) {
            path = `${upstreamBase}${path.startsWith('/') ? path : `/${path}`}`;
        }
        if (upstreamBase && path === upstreamBase)
            path = `${upstreamBase}/`;
        const publicPath = `${mountPath}${path.slice(upstreamBase.length) || '/'}`;
        return `${requestOrigin}${publicPath}${resolved.search}${resolved.hash}`;
    }
    catch {
        return location;
    }
}
async function readRequestBody(req) {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
        const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += part.length;
        if (total > MAX_REQUEST_BYTES)
            throw new Error('request body too large');
        chunks.push(part);
    }
    return Buffer.concat(chunks, total);
}
function requestOrigin(req) {
    const host = req.headers.host;
    if (!host)
        return undefined;
    const encrypted = Boolean(req.socket.encrypted);
    return `${encrypted ? 'https' : 'http'}://${host}`;
}
function sendError(res, status, message) {
    if (res.headersSent || res.destroyed)
        return;
    const body = JSON.stringify({ error: message });
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body) });
    res.end(body);
}
function rewriteReferer(value, siteUrl, origin) {
    try {
        const parsed = new URL(value);
        const routePath = getSiteProxyPath(siteUrl);
        if (parsed.origin !== origin || !routePath || !parsed.pathname.startsWith(`${routePath}/`))
            return undefined;
        const target = resolveUpstreamTarget(siteUrl, `${parsed.pathname}${parsed.search}`);
        return target?.toString();
    }
    catch {
        return undefined;
    }
}
export function createMesProxyHandler(readSiteUrl, options = {}) {
    return async (req, res) => {
        const origin = requestOrigin(req);
        if (!origin || !req.headers.host)
            return sendError(res, 400, '无效的 DSH 请求来源');
        if (!ALLOWED_METHODS.has(req.method || ''))
            return sendError(res, 405, '不支持的请求方法');
        const incomingOrigin = req.headers.origin;
        if (incomingOrigin && !isSameOriginRequest(incomingOrigin, req.headers.host, origin))
            return sendError(res, 403, '拒绝跨站请求');
        if (req.method !== 'GET' && req.method !== 'HEAD' && !isSameOriginRequest(incomingOrigin, req.headers.host, origin)) {
            return sendError(res, 403, '写入请求缺少有效的 DSH 来源校验');
        }
        let siteUrl = '';
        try {
            siteUrl = readSiteUrl().trim();
        }
        catch { /* missing volatile config */ }
        const base = normalizedBase(siteUrl);
        if (!base)
            return sendError(res, 503, '请先在 DSH 工作台保存有效的 MES 网站地址');
        const routePath = getSiteProxyPath(siteUrl);
        if (!routePath)
            return sendError(res, 503, '请先在 DSH 工作台保存有效的 MES 网站地址');
        let target;
        try {
            target = resolveUpstreamTarget(siteUrl, req.url || '/');
        }
        catch {
            target = undefined;
        }
        if (!target)
            return sendError(res, 404, '代理路径无效');
        if (target.pathname === base.pathname.replace(/\/+$/, '') || target.pathname === `${base.pathname.replace(/\/+$/, '')}/`) {
            if (new URL(req.url || '/', origin).pathname === routePath) {
                res.writeHead(308, { location: `${origin}${publicBasePath(siteUrl)}/`, 'cache-control': 'no-store' });
                res.end();
                return;
            }
        }
        const headers = new Headers();
        for (const name of ['accept', 'accept-language', 'cache-control', 'content-type', 'cookie', 'if-match', 'if-modified-since', 'if-none-match', 'if-range', 'range', 'user-agent']) {
            const value = name === 'cookie' ? upstreamCookieHeader(req.headers.cookie) : req.headers[name];
            if (typeof value === 'string')
                headers.set(name, value);
        }
        const proto = origin.startsWith('https:') ? 'https' : 'http';
        headers.set('x-forwarded-for', req.socket.remoteAddress || 'unknown');
        headers.set('x-forwarded-host', req.headers.host);
        headers.set('x-forwarded-proto', proto);
        if (incomingOrigin)
            headers.set('origin', base.origin);
        const referer = req.headers.referer ? rewriteReferer(req.headers.referer, siteUrl, origin) : undefined;
        if (referer)
            headers.set('referer', referer);
        let body;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            try {
                body = await readRequestBody(req);
            }
            catch (error) {
                if (error instanceof Error && error.message === 'request body too large')
                    return sendError(res, 413, '请求内容超过代理限制');
                return sendError(res, 400, '无法读取请求内容');
            }
        }
        const controller = new AbortController();
        const abort = () => { if (!res.writableEnded)
            controller.abort(); };
        res.once('close', abort);
        let upstream;
        try {
            upstream = await fetch(target, {
                method: req.method,
                headers,
                body: body?.length ? body : undefined,
                signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]),
                redirect: 'manual',
            });
        }
        catch {
            res.removeListener('close', abort);
            return sendError(res, 502, '无法连接已配置的 MES 网站');
        }
        const outputHeaders = {};
        upstream.headers.forEach((value, name) => {
            const key = name.toLowerCase();
            if (HOP_BY_HOP_HEADERS.has(key) || key === 'set-cookie' || key === 'location' || (options.frameAncestor && key === 'x-frame-options'))
                return;
            outputHeaders[key] = value;
        });
        const cookies = upstream.headers.getSetCookie()
            .filter((cookie) => !/^(?:dsh-auth-|dsh_erp_proxy_)[^=]*=/i.test(cookie))
            .map((cookie) => rewriteProxyCookie(cookie, siteUrl));
        if (cookies.length)
            outputHeaders['set-cookie'] = cookies;
        const location = upstream.headers.get('location');
        if (location)
            outputHeaders.location = rewriteProxyLocation(location, siteUrl, origin);
        const frameAncestor = options.frameAncestor?.(req);
        if (frameAncestor || options.injectProxyBridge) {
            const policy = outputHeaders['content-security-policy'];
            let updatedPolicy = Array.isArray(policy) ? policy.join(', ') : policy || '';
            if (options.injectProxyBridge && updatedPolicy)
                updatedPolicy = allowProxyBridgeResources(updatedPolicy);
            if (frameAncestor)
                updatedPolicy = allowFrameAncestor(updatedPolicy, frameAncestor);
            if (updatedPolicy)
                outputHeaders['content-security-policy'] = updatedPolicy;
        }
        const contentType = upstream.headers.get('content-type') || '';
        if (contentType.toLowerCase().includes('text/html')) {
            const html = await upstream.text();
            const rewritten = rewriteProxyHtml(html, siteUrl, options.injectProxyBridge);
            delete outputHeaders['content-length'];
            delete outputHeaders.etag;
            delete outputHeaders['last-modified'];
            outputHeaders['content-length'] = String(Buffer.byteLength(rewritten));
            res.writeHead(upstream.status, upstream.statusText, outputHeaders);
            res.end(rewritten);
            res.removeListener('close', abort);
            return;
        }
        if (contentType.toLowerCase().includes('text/css')) {
            const css = await upstream.text();
            const rewritten = rewriteProxyCss(css, siteUrl);
            delete outputHeaders['content-length'];
            delete outputHeaders.etag;
            delete outputHeaders['last-modified'];
            outputHeaders['content-length'] = String(Buffer.byteLength(rewritten));
            res.writeHead(upstream.status, upstream.statusText, outputHeaders);
            res.end(rewritten);
            res.removeListener('close', abort);
            return;
        }
        res.writeHead(upstream.status, upstream.statusText, outputHeaders);
        if (!upstream.body) {
            res.end();
            res.removeListener('close', abort);
            return;
        }
        try {
            await pipeline(Readable.fromWeb(upstream.body), res);
        }
        catch {
            if (!res.destroyed)
                res.destroy();
        }
        finally {
            res.removeListener('close', abort);
        }
    };
}
//# sourceMappingURL=mes-proxy.js.map