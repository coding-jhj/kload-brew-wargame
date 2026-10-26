// D단계 12번 문제 — 평문 권한 쿠키로 제어실 접근
// 로스팅 제어실 접근 권한이 암호화도 서명도 없는 평문 쿠키(d12_access=staff)로
// 저장된다. 서버는 그 값을 그대로 믿는다.
// 의존성 없이 Node 내장 http 모듈만 사용. 실행: node server.js (독립) / combined-server.js (통합)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const SHARED_CSS = path.join(__dirname, '..', 'shared.css');
const MONSTER_IMG = path.join(__dirname, '..', 'assets', 'ch4-f10.webp');
const BG_IMG = path.join(__dirname, '..', 'assets', 'title-bg.webp');

const PORT = 4012;
const USER = 'roaster';
const PASS = 'coffee123';
const FLAG = 'BREW{ch4_12_plaintext_access_cookie}';

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  raw.split(';').forEach(function (p) {
    const i = p.indexOf('=');
    if (i < 0) return;
    out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function parseBody(req, cb) {
  let data = '';
  req.on('data', function (c) { data += c; });
  req.on('end', function () {
    const out = {};
    data.split('&').forEach(function (p) {
      const i = p.indexOf('=');
      if (i < 0) return;
      out[decodeURIComponent(p.slice(0, i))] = decodeURIComponent((p.slice(i + 1) || '').replace(/\+/g, ' '));
    });
    cb(out);
  });
}

function page(inner) {
  return '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>로스팅 제어실 — KLOAD</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=Jua&family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;700&display=swap" rel="stylesheet">' +
    '<link rel="stylesheet" href="/shared.css"></head><body><div class="wrap">' +
    '<div class="hud"><span class="logo">KLOAD</span><span class="step">4장 추출 · 12</span></div>' +
    '<div class="card">' +
    '<div class="monster"><img src="/assets/ch4-f10.webp" alt="원두 몬스터"></div>' +
    '<div class="inner">' + inner + '</div></div>' +
    '</div></body></html>';
}

function loginPage(base, msg) {
  return page(
    '<h1>로스팅 제어실 출입 시스템</h1>' +
    '<p class="lead">일반 직원은 복도까지만, 제어실 안쪽은 별도 권한이 필요합니다.</p>' +
    '<p class="creds">관리자가 두고 간 계정으로 로그인하십시오.<br>아이디 <span class="flag-chip">roaster</span> · 비밀번호 <span class="flag-chip">coffee123</span></p>' +
    (msg ? '<p class="error">' + msg + '</p>' : '') +
    '<form method="POST" action="' + base + '/login">' +
    '<input type="text" name="id" placeholder="아이디" autocomplete="off">' +
    '<input type="password" name="pw" placeholder="비밀번호">' +
    '<button type="submit" class="btn">로그인</button></form>'
  );
}

function corridorPage(base) {
  return page(
    '<h1>복도</h1>' +
    '<div class="panel raw"><strong>현재 권한: staff</strong><p>제어실 안쪽(<a href="' + base + '/control-room">제어실</a>)은 별도 권한이 필요합니다.</p></div>'
  );
}

function controlRoomPage(access) {
  if (access === 'control') {
    return page(
      '<h1>로스팅 제어실</h1>' +
      '<div class="panel open"><strong>출입 승인됨</strong><p>봉인번호 <span class="flag-chip">' + FLAG + '</span></p></div>'
    );
  }
  return page(
    '<h1>로스팅 제어실</h1>' +
    '<div class="panel locked"><strong>출입 거부</strong><p>🔒 control 권한이 필요합니다. 현재 권한: ' + escapeHtml(access || '없음') + '</p></div>'
  );
}

function handle(req, res, base) {
  base = base || '';
  const cookiePath = base || '/';
  const cookies = parseCookies(req);
  const fullUrl = new URL(req.url, 'http://localhost');
  let p = fullUrl.pathname;
  if (base && p.indexOf(base) === 0) p = p.slice(base.length) || '/';

  if (req.method === 'GET' && p === '/shared.css') {
    return fs.readFile(SHARED_CSS, 'utf8', function (err, css) {
      if (err) { res.writeHead(404); return res.end(''); }
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
      res.end(css);
    });
  }
  if (req.method === 'GET' && p === '/assets/ch4-f10.webp') {
    return fs.readFile(MONSTER_IMG, function (err, buf) {
      if (err) { res.writeHead(404); return res.end(''); }
      res.writeHead(200, { 'Content-Type': 'image/webp' });
      res.end(buf);
    });
  }
  if (req.method === 'GET' && p === '/assets/title-bg.webp') {
    return fs.readFile(BG_IMG, function (err, buf) {
      if (err) { res.writeHead(404); return res.end(''); }
      res.writeHead(200, { 'Content-Type': 'image/webp' });
      res.end(buf);
    });
  }

  if (req.method === 'GET' && p === '/login') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(loginPage(base));
  }

  if (req.method === 'POST' && p === '/login') {
    return parseBody(req, function (body) {
      if (body.id === USER && body.pw === PASS) {
        res.writeHead(302, {
          Location: base + '/',
          'Set-Cookie': ['d12_session=ok; Path=' + cookiePath, 'd12_access=staff; Path=' + cookiePath]
        });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginPage(base, '아이디 또는 비밀번호가 틀렸습니다.'));
    });
  }

  if (req.method === 'GET' && p === '/') {
    if (cookies.d12_session !== 'ok') {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(corridorPage(base));
  }

  // 취약 지점: d12_access 쿠키 값을 서명 없이 그대로 믿는다
  if (req.method === 'GET' && p === '/control-room') {
    if (cookies.d12_session !== 'ok') {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(controlRoomPage(cookies.d12_access));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(function (req, res) { handle(req, res, ''); }).listen(PORT, function () {
    console.log('D12 문제 서버 실행: http://localhost:' + PORT + '/login');
  });
}
