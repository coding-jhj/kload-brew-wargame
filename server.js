// KLOAD wargame single-server entry point (one deployment, one origin).
// Merges the three former Render services into one Node http server:
//   - wargame/ static frontend      (was: kload-wargame-frontend, `npx serve -s wargame`)
//   - /ch3/01 ~ /ch3/10             (was: kload-ch3-filesystem,   problems/c-filesystem/combined-server.js)
//   - /ch4/01 ~ /ch4/10             (was: kload-ch4-auth-session, problems/d-auth-session/combined-server.js)
// Node built-ins only (http, fs, path), so the host needs no `npm install`.
// Run: node server.js   (PORT env var, default 3000)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const STATIC_ROOT = path.join(__dirname, 'wargame');

// Each combined-server.js exports its request handler and only listens when run directly.
const handleCh3 = require('./problems/c-filesystem/combined-server.js');
const handleCh4 = require('./problems/d-auth-session/combined-server.js');

// Problem pages link absolute top-level paths: /shared.css and /assets/ch3-fNN.webp or
// /assets/ch4-fNN.webp. Before the merge each chapter had its own origin, so these never collided.
// - /assets/ch3-fNN.webp and /assets/ch4-fNN.webp have distinct names -> route to the owning chapter.
// - /shared.css exists in both chapters. The ch3 file is the ch4 file plus `.file-list` rules
//   (which ch4 never uses), so serving the ch3 copy is identical for ch4 pages.
// - /assets/title-bg.webp is byte-identical in wargame/, ch3 and ch4 -> served from wargame/.
const CH3_RE = /^\/ch3(?:\/|$)|^\/shared\.css$|^\/assets\/ch3-f\d\d\.webp$/;
const CH4_RE = /^\/ch4(?:\/|$)|^\/assets\/ch4-f\d\d\.webp$/;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function sendFile(req, res, filePath) {
  fs.readFile(filePath, function (err, buf) {
    if (err) return sendText(res, 404, '404');
    const type = CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': buf.length });
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
}

// Static file server for wargame/. Directory -> its index.html.
// Unknown extensionless paths fall back to index.html (like `serve -s`);
// unknown paths with an extension return 404 so a missing asset is not answered with HTML.
function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
    return res.end('405');
  }

  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch (e) {
    return sendText(res, 400, '400');
  }
  // Reject NUL bytes and dot-segments/dotfiles (also blocks `..` traversal) before touching the disk.
  if (rel.indexOf('\0') !== -1 || rel.split(/[\\/]/).some(function (s) { return s.charAt(0) === '.'; })) {
    return sendText(res, 404, '404');
  }

  const full = path.join(STATIC_ROOT, rel);
  // Defense in depth: the resolved path must stay inside STATIC_ROOT.
  if (full !== STATIC_ROOT && full.indexOf(STATIC_ROOT + path.sep) !== 0) {
    return sendText(res, 404, '404');
  }

  fs.stat(full, function (err, st) {
    if (!err && st.isDirectory()) {
      // Keep relative asset URLs (css/, js/, assets/) correct: /dir -> /dir/
      if (!pathname.endsWith('/')) {
        res.writeHead(301, { Location: pathname + '/' });
        return res.end();
      }
      return sendFile(req, res, path.join(full, 'index.html'));
    }
    if (!err && st.isFile()) return sendFile(req, res, full);
    if (path.extname(rel) === '') return sendFile(req, res, path.join(STATIC_ROOT, 'index.html'));
    return sendText(res, 404, '404');
  });
}

function handle(req, res) {
  let pathname;
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch (e) {
    return sendText(res, 400, '400');
  }

  if (CH3_RE.test(pathname)) return handleCh3(req, res);
  if (CH4_RE.test(pathname)) return handleCh4(req, res);
  return serveStatic(req, res, pathname);
}

module.exports = handle;

if (require.main === module) {
  http.createServer(handle).listen(PORT, function () {
    console.log('KLOAD single server: http://localhost:' + PORT + '/');
    console.log('  frontend: /   ch3: /ch3/01/ ~ /ch3/10/   ch4: /ch4/01/ ~ /ch4/10/');
  });
}
