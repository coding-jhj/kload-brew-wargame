// D단계 10번 문제 — 숨겨진 디버그 페이지의 관리자 계정
// robots.txt 에 검색엔진더러 들어오지 말라고 적어둔 경로가, 역설적으로
// "여기 뭔가 있다"는 지도 역할을 한다. 그 경로에 테스트용 관리자 계정이
// 그대로 남아있다.
// 의존성 없이 Node 내장 http 모듈만 사용. 실행: node server.js (독립) / combined-server.js (통합)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SHARED_CSS = path.join(__dirname, '..', 'shared.css');
const MONSTER_IMG = path.join(__dirname, '..', 'assets', 'ch4-f07.webp');
const BG_IMG = path.join(__dirname, '..', 'assets', 'title-bg.webp');

const PORT = 4007;
const ADMIN_ID = 'headroaster';
const ADMIN_PASS = 'debug2026';
const FLAG = 'BREW{ch4_07_hidden_admin_creds}';
// 실제 로그인에 성공했을 때만 서버가 발급한 유효 세션 토큰 집합.
// 쿠키 값이 이 집합에 들어 있는지로 인증을 판정하므로, 공격자가 쿠키 값을
// 스스로 지어낼 수 없고 반드시 올바른 아이디·비밀번호로 로그인해야 한다.
const validTokens = new Set();

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
    '<title>유지보수 포털 — KLOAD</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=Jua&family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;700&display=swap" rel="stylesheet">' +
    '<link rel="stylesheet" href="/shared.css"></head><body><div class="wrap">' +
    '<div class="hud"><span class="logo">KLOAD</span><span class="step">4장 추출 · 07</span></div>' +
    '<div class="card">' +
    '<div class="monster"><img src="/assets/ch4-f07.webp" alt="원두 몬스터"></div>' +
    '<div class="inner">' + inner + '</div></div>' +
    '</div></body></html>';
}

function loginPage(base, msg) {
  return page(
    '<h1>유지보수 포털</h1>' +
    '<p class="lead">배전반 시스템을 관리하는 또 다른 화면입니다. 공개된 계정은 없습니다.</p>' +
    (msg ? '<p class="error">' + msg + '</p>' : '') +
    '<form method="POST" action="' + base + '/login">' +
    '<input type="text" name="id" placeholder="아이디" autocomplete="off">' +
    '<input type="password" name="pw" placeholder="비밀번호">' +
    '<button type="submit" class="btn">로그인</button></form>'
  );
}

function debugPage() {
  return page(
    '<h1>디버그 전용 페이지</h1>' +
    '<p class="lead">QA가 끝나면 지웠어야 했는데, 아직 남아있습니다.</p>' +
    '<div class="panel raw"><strong>테스트 계정</strong><p>아이디: ' + ADMIN_ID + '<br>비밀번호: ' + ADMIN_PASS + '</p></div>'
  );
}

function adminPage() {
  return page(
    '<h1>유지보수 포털 — 관리자</h1>' +
    '<div class="panel open"><strong>로그인 성공</strong><p>봉인번호 <span class="flag-chip">' + FLAG + '</span></p></div>'
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
  if (req.method === 'GET' && p === '/assets/ch4-f07.webp') {
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

  if (req.method === 'GET' && p === '/robots.txt') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(page(
      '<h1>robots.txt</h1>' +
      '<div class="panel raw"><strong>파일 내용</strong><p style="white-space:pre-wrap">User-agent: *\nDisallow: ' + base + '/debug-staff-only</p></div>'
    ));
  }

  // 취약 지점: "들어오지 말라"는 안내가 오히려 숨은 경로를 가리킨다
  if (req.method === 'GET' && p === '/debug-staff-only') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(debugPage());
  }

  if (req.method === 'GET' && p === '/login') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(loginPage(base));
  }

  if (req.method === 'POST' && p === '/login') {
    return parseBody(req, function (body) {
      if (body.id === ADMIN_ID && body.pw === ADMIN_PASS) {
        const token = crypto.randomBytes(16).toString('hex');
        validTokens.add(token);
        res.writeHead(302, { Location: base + '/', 'Set-Cookie': 'd07_auth=' + token + '; Path=' + cookiePath });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginPage(base, '아이디 또는 비밀번호가 틀렸습니다.'));
    });
  }

  if (req.method === 'GET' && p === '/') {
    if (!cookies.d07_auth || !validTokens.has(cookies.d07_auth)) {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(adminPage());
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(function (req, res) { handle(req, res, ''); }).listen(PORT, function () {
    console.log('D7 문제 서버 실행: http://localhost:' + PORT + '/login');
  });
}
