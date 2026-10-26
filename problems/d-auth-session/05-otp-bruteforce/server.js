// D단계 5번 문제 — 2단계 인증(보안 코드) 무차별 대입 + 잠금 우회
// 최고관리자 headroaster 계정으로 로그인한 뒤, "창고 긴급 개방"을 하려면 4자리 보안 코드를
// 추가로 입력해야 한다. 코드는 로그인할 때 한 번 정해지고 바뀌지 않는다(0000-9999, 10000가지).
// 같은 단말기(X-Terminal-Id 헤더)로 5번 틀리면 그 단말기를 잠그지만, 이 헤더 값을
// 클라이언트가 보낸 그대로 믿기 때문에 요청마다 값을 바꾸면 잠금이 걸리지 않는다.
// 의존성 없이 Node 내장 http 모듈만 사용. 실행: node server.js (독립) / combined-server.js (통합)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const SHARED_CSS = path.join(__dirname, '..', 'shared.css');
const MONSTER_IMG = path.join(__dirname, '..', 'assets', 'ch4-f05.webp'); // 문제 번호 = 프레임 번호
const BG_IMG = path.join(__dirname, '..', 'assets', 'title-bg.webp');

const PORT = 4005;
const USER = 'headroaster';
const PASS = 'roast2026';
const FLAG = 'BREW{ch4_05_otp_bruteforce}';

// 로그인 시 한 번 발급되는 4자리 코드.
let pendingCode = null;

// 긴급 상황을 대비해 창고 입구마다 별도 보안 단말기가 있고, 요청에 X-Terminal-Id
// 헤더로 "어느 단말기에서 왔는지"를 싣는다. 같은 단말기 ID로 5번 틀리면 그 단말기만
// 잠근다 — 라는 게 의도이지만, 서버는 이 헤더 값을 클라이언트가 보낸 그대로 믿는다.
// 취약 지점: 요청마다 X-Terminal-Id 값을 바꿔 보내면 매번 "새 단말기"로 취급되어
// 잠금이 걸리지 않는다. 그래서 0000-9999를 전부 시도하는 걸 실질적으로 막지 못한다.
const ATTEMPT_LIMIT = 5;
let attemptsByTerminal = new Map();

function issueCode() {
  pendingCode = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  attemptsByTerminal = new Map();
}

function terminalId(req) {
  return req.headers['x-terminal-id'] || '기본';
}

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
    '<title>창고 긴급 개방 시스템 — KLOAD</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=Jua&family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;700&display=swap" rel="stylesheet">' +
    '<link rel="stylesheet" href="/shared.css"></head><body><div class="wrap">' +
    '<div class="hud"><span class="logo">KLOAD</span><span class="step">4장 추출 · 05</span></div>' +
    '<div class="card">' +
    '<div class="monster"><img src="/assets/ch4-f05.webp" alt="원두 몬스터"></div>' +
    '<div class="inner">' + inner + '</div></div>' +
    '</div></body></html>';
}

function loginPage(base, msg) {
  return page(
    '<h1>창고 긴급 개방 시스템</h1>' +
    '<p class="lead">최고관리자 전용 시스템입니다. 계정은 아래와 같이 공개되어 있지만, 민감한 작업에는 추가 인증이 필요합니다.</p>' +
    '<p class="creds">아이디 <span class="flag-chip">headroaster</span> · 비밀번호 <span class="flag-chip">roast2026</span></p>' +
    (msg ? '<p class="error">' + msg + '</p>' : '') +
    '<form method="POST" action="' + base + '/login">' +
    '<input type="text" name="id" placeholder="아이디" autocomplete="off">' +
    '<input type="password" name="pw" placeholder="비밀번호">' +
    '<button type="submit" class="btn">로그인</button></form>'
  );
}

function codePage(base, msg) {
  return page(
    '<!-- dev note: 단말기 구분은 X-Terminal-Id 헤더 값으로만 판단함. 같은 값으로 5번 틀리면 그 단말기를 잠그지만, 헤더 값은 검증하지 않음 — 요청마다 바꿔 보내면 잠기지 않음. -->' +
    '<h1>보안 코드 확인</h1>' +
    '<p class="lead">창고를 긴급 개방하려면 4자리 보안 코드를 입력하십시오. 코드는 로그인 시 발급되었습니다.</p>' +
    (msg ? '<p class="error">' + msg + '</p>' : '') +
    '<form method="POST" action="' + base + '/verify-code">' +
    '<input type="text" name="code" placeholder="0000" maxlength="4" autocomplete="off">' +
    '<button type="submit" class="btn">확인</button></form>'
  );
}

function openedPage() {
  return page(
    '<h1>창고 긴급 개방 완료</h1>' +
    '<div class="panel open"><strong>개방 완료</strong><p>보안 코드가 확인되어 창고가 열렸습니다. 봉인번호 <span class="flag-chip">' + FLAG + '</span></p></div>'
  );
}

function lockedPage(tid) {
  return page(
    '<h1>단말기 잠김</h1>' +
    '<div class="panel locked"><strong>안내</strong><p>단말기(<code>X-Terminal-Id: ' + tid + '</code>)에서 시도 횟수를 초과했습니다. 다른 입구 단말기에서 시도하십시오.</p></div>'
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
  if (req.method === 'GET' && p === '/assets/ch4-f05.webp') {
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
        issueCode(); // 로그인 시 코드 한 번 발급, 맞출 때까지 바뀌지 않는다
        res.writeHead(302, { Location: base + '/', 'Set-Cookie': 'd05_auth=' + USER + '; Path=' + cookiePath });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginPage(base, '아이디 또는 비밀번호가 틀렸습니다.'));
    });
  }

  // 취약 지점: 단말기 식별을 클라이언트가 보낸 X-Terminal-Id 헤더로만 한다.
  // 그 값을 바꿔 보내면 매번 새 단말기로 취급되어, 시도 횟수 제한이 실질적으로 무력화된다.
  if (req.method === 'POST' && p === '/verify-code') {
    return parseBody(req, function (body) {
      if (cookies.d05_auth !== USER) {
        res.writeHead(302, { Location: base + '/login' });
        return res.end();
      }
      const tid = terminalId(req);
      const tries = attemptsByTerminal.get(tid) || 0;
      if (tries >= ATTEMPT_LIMIT) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(lockedPage(tid));
      }
      if (body.code === pendingCode) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(openedPage());
      }
      const nextTries = tries + 1;
      attemptsByTerminal.set(tid, nextTries);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (nextTries >= ATTEMPT_LIMIT) {
        return res.end(lockedPage(tid));
      }
      return res.end(codePage(base, '코드가 올바르지 않습니다.'));
    });
  }

  if (req.method === 'GET' && p === '/') {
    if (cookies.d05_auth !== USER) {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(codePage(base));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(function (req, res) { handle(req, res, ''); }).listen(PORT, function () {
    console.log('D5 문제 서버 실행: http://localhost:' + PORT + '/login');
  });
}
