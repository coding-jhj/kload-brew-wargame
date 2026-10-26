// D단계 11번 문제 — 재설정 토큰이 응답에 그대로 노출
// D6과 달리 토큰을 "예측"할 필요가 없다. 서버가 디버깅용으로 남긴 코드 때문에
// 재설정 요청 응답(JSON)에 토큰 값이 그대로 찍혀 나온다. 개발자 도구의
// 네트워크 탭만 열어보면 바로 보인다.
// 의존성 없이 Node 내장 http/crypto 모듈만 사용. 실행: node server.js (독립) / combined-server.js (통합)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SHARED_CSS = path.join(__dirname, '..', 'shared.css');
const MONSTER_IMG = path.join(__dirname, '..', 'assets', 'ch4-f10.webp');
const BG_IMG = path.join(__dirname, '..', 'assets', 'title-bg.webp');

const PORT = 4011;
const STAFF_ID = 'shiftlead';
const FLAG = 'BREW{ch4_11_reset_token_leak}';

let pendingToken = null;
let shiftleadPassword = crypto.randomBytes(16).toString('hex'); // 아무도 모르는 초기 비밀번호

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
    '<title>교대조장 계정 복구 — KLOAD</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=Jua&family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;700&display=swap" rel="stylesheet">' +
    '<link rel="stylesheet" href="/shared.css"></head><body><div class="wrap">' +
    '<div class="hud"><span class="logo">KLOAD</span><span class="step">4장 추출 · 11</span></div>' +
    '<div class="card">' +
    '<div class="monster"><img src="/assets/ch4-f10.webp" alt="원두 몬스터"></div>' +
    '<div class="inner">' + inner + '</div></div>' +
    '</div></body></html>';
}

function homePage(base, msg) {
  return page(
    '<h1>교대조장 계정 복구</h1>' +
    '<p class="lead">교대조장(' + STAFF_ID + ') 비밀번호를 아는 사람이 없습니다. 아이디만 입력하면 재설정 링크를 발급합니다(개발자 도구의 네트워크 탭을 열어두십시오).</p>' +
    (msg ? '<p class="error">' + msg + '</p>' : '') +
    '<form method="POST" action="' + base + '/api/reset-request">' +
    '<input type="text" name="id" placeholder="아이디" autocomplete="off">' +
    '<button type="submit" class="btn">재설정 요청</button></form>' +
    '<p class="lead"><a href="' + base + '/confirm">이미 토큰이 있다면 여기서 비밀번호를 설정하십시오</a></p>' +
    '<p class="lead"><a href="' + base + '/login">로그인</a></p>'
  );
}

function confirmPage(base, msg) {
  return page(
    '<h1>새 비밀번호 설정</h1>' +
    (msg ? '<p class="error">' + msg + '</p>' : '') +
    '<form method="POST" action="' + base + '/api/reset-confirm">' +
    '<input type="text" name="token" placeholder="토큰" autocomplete="off">' +
    '<input type="password" name="newpw" placeholder="새 비밀번호">' +
    '<button type="submit" class="btn">비밀번호 변경</button></form>'
  );
}

function loginPage(base, msg) {
  return page(
    '<h1>로그인</h1>' +
    (msg ? '<p class="error">' + msg + '</p>' : '') +
    '<form method="POST" action="' + base + '/login">' +
    '<input type="text" name="id" placeholder="아이디" autocomplete="off">' +
    '<input type="password" name="pw" placeholder="비밀번호">' +
    '<button type="submit" class="btn">로그인</button></form>'
  );
}

function dashboardPage() {
  return page(
    '<h1>교대조장 전용 화면</h1>' +
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

  if (req.method === 'GET' && p === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(homePage(base));
  }

  // 취약 지점: 토큰을 메일로만 보내야 하는데, 디버깅용으로 응답 JSON에도 그대로 넣어버린다
  if (req.method === 'POST' && p === '/api/reset-request') {
    return parseBody(req, function (body) {
      if (body.id !== STAFF_ID) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(homePage(base, '등록되지 않은 아이디입니다.'));
      }
      pendingToken = crypto.randomBytes(16).toString('hex');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ status: 'sent', message: '등록된 연락처로 발송했습니다.', debug_token: pendingToken }));
    });
  }

  if (req.method === 'GET' && p === '/confirm') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(confirmPage(base));
  }

  if (req.method === 'POST' && p === '/api/reset-confirm') {
    return parseBody(req, function (body) {
      if (!pendingToken || body.token !== pendingToken || !body.newpw) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(confirmPage(base, '토큰이 올바르지 않거나 비밀번호가 비어 있습니다.'));
      }
      shiftleadPassword = body.newpw;
      pendingToken = null;
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    });
  }

  if (req.method === 'GET' && p === '/login') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(loginPage(base));
  }

  if (req.method === 'POST' && p === '/login') {
    return parseBody(req, function (body) {
      if (body.id === STAFF_ID && body.pw === shiftleadPassword) {
        res.writeHead(302, { Location: base + '/dashboard', 'Set-Cookie': 'd11_auth=' + STAFF_ID + '; Path=' + cookiePath });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginPage(base, '아이디 또는 비밀번호가 틀렸습니다.'));
    });
  }

  if (req.method === 'GET' && p === '/dashboard') {
    if (cookies.d11_auth !== STAFF_ID) {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(dashboardPage());
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(function (req, res) { handle(req, res, ''); }).listen(PORT, function () {
    console.log('D11 문제 서버 실행: http://localhost:' + PORT + '/');
  });
}
