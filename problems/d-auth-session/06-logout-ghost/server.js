// D단계 9번 문제 — 로그아웃은 눈속임, 세션이 안 끊긴다
// 로그아웃을 누르면 브라우저 쿠키는 지워지지만, 서버가 그 세션을 실제로
// 무효화하지 않는다. 로그아웃 전에 쿠키 값을 복사해두면, 로그아웃 뒤에도
// 그 값을 다시 넣어서 들어갈 수 있다.
// 플래그는 "로그아웃했던 세션을 다시 재사용했을 때"만 나온다(loggedOutSids로
// 판정). 그냥 로그인만 해서는 플래그가 나오지 않는다 — 로그아웃→재사용을
// 실제로 수행해야 한다.
// 의존성 없이 Node 내장 http 모듈만 사용. 실행: node server.js (독립) / combined-server.js (통합)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SHARED_CSS = path.join(__dirname, '..', 'shared.css');
const MONSTER_IMG = path.join(__dirname, '..', 'assets', 'ch4-f06.webp');
const BG_IMG = path.join(__dirname, '..', 'assets', 'title-bg.webp');

const PORT = 4006;
const USER = 'roaster';
const PASS = 'coffee123';
const FLAG = 'BREW{ch4_06_logout_ghost_session}';

const liveSessions = new Set(); // 취약 지점: 로그아웃해도 여기서 지워지지 않는다
const loggedOutSids = new Set(); // 플레이어가 실제로 "로그아웃했던 세션"만 기록 (플래그 판정용)

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
    '<title>배전반 로그아웃 — KLOAD</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=Jua&family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;700&display=swap" rel="stylesheet">' +
    '<link rel="stylesheet" href="/shared.css"></head><body><div class="wrap">' +
    '<div class="hud"><span class="logo">KLOAD</span><span class="step">4장 추출 · 06</span></div>' +
    '<div class="card">' +
    '<div class="monster"><img src="/assets/ch4-f06.webp" alt="원두 몬스터"></div>' +
    '<div class="inner">' + inner + '</div></div>' +
    '</div></body></html>';
}

function loginPage(base, msg) {
  return page(
    '<h1>배전반 작업 기록 시스템</h1>' +
    '<p class="lead">교대 직원들이 작업 기록을 확인하는 화면입니다. 로그아웃을 믿을 수 있을까요.</p>' +
    '<p class="creds">관리자가 두고 간 계정으로 로그인하십시오.<br>아이디 <span class="flag-chip">roaster</span> · 비밀번호 <span class="flag-chip">coffee123</span></p>' +
    (msg ? '<p class="error">' + msg + '</p>' : '') +
    '<form method="POST" action="' + base + '/login">' +
    '<input type="text" name="id" placeholder="아이디" autocomplete="off">' +
    '<input type="password" name="pw" placeholder="비밀번호">' +
    '<button type="submit" class="btn">로그인</button></form>'
  );
}

function mypagePage(base, ghostProven) {
  if (ghostProven) {
    return page(
      '<h1>내 작업 기록</h1>' +
      '<div class="panel open"><strong>세션 확인됨 (로그아웃 이후 재사용됨)</strong><p>이 세션은 이미 로그아웃되었는데도 서버에는 여전히 살아있습니다. 봉인번호 <span class="flag-chip">' + FLAG + '</span></p></div>' +
      '<p class="lead"><a href="' + base + '/logout">로그아웃</a></p>'
    );
  }
  return page(
    '<h1>내 작업 기록</h1>' +
    '<div class="panel raw"><strong>세션 확인됨</strong><p>정상적으로 로그인된 상태의 평범한 접속 기록입니다.</p></div>' +
    '<p class="lead"><a href="' + base + '/logout">로그아웃</a></p>'
  );
}

function loggedOutPage(base) {
  return page(
    '<h1>로그아웃 되었습니다</h1>' +
    '<div class="panel locked"><strong>안내</strong><p>안전하게 로그아웃되었습니다(화면상으로는).</p></div>' +
    '<p class="lead"><a href="' + base + '/login">다시 로그인</a></p>'
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
  if (req.method === 'GET' && p === '/assets/ch4-f06.webp') {
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
        const token = crypto.randomBytes(12).toString('hex');
        liveSessions.add(token);
        res.writeHead(302, { Location: base + '/mypage', 'Set-Cookie': 'd06_sid=' + token + '; Path=' + cookiePath });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginPage(base, '아이디 또는 비밀번호가 틀렸습니다.'));
    });
  }

  if (req.method === 'GET' && p === '/mypage') {
    if (!cookies.d06_sid || !liveSessions.has(cookies.d06_sid)) {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(mypagePage(base, loggedOutSids.has(cookies.d06_sid)));
  }

  // 취약 지점: 클라이언트 쿠키만 만료시키고, liveSessions에서 지우지 않는다
  if (req.method === 'GET' && p === '/logout') {
    if (cookies.d06_sid) loggedOutSids.add(cookies.d06_sid); // 로그아웃 "시도된" 세션임을 기록 (서버 쪽에서는 여전히 유효함)
    res.writeHead(302, {
      Location: base + '/login',
      'Set-Cookie': 'd06_sid=; Path=' + cookiePath + '; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    });
    return res.end();
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(function (req, res) { handle(req, res, ''); }).listen(PORT, function () {
    console.log('D6 문제 서버 실행: http://localhost:' + PORT + '/login');
  });
}
