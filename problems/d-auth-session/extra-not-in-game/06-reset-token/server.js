// D단계 6번 문제 — 최고관리자 계정 복구 토큰 예측
// 최고관리자(headroaster)의 비밀번호는 아무도 모른다. 대신 비밀번호 재설정 기능이 있다.
// 재설정 링크의 토큰은 MD5(아이디:발급시각_유닉스초)로 만들어지는데, 서버가 서명이나 난수를
// 섞지 않아서 "발급시각"만 알면 누구나 같은 토큰을 직접 계산할 수 있다.
// 발급시각은 재설정 요청 응답의 HTTP Date 헤더(모든 HTTP 응답에 표준으로 들어가는 서버 시각)로
// 알아낼 수 있다. Date 헤더는 초 단위라 실제 발급 시각과 1초 정도 어긋날 수 있으므로,
// 서버는 검증 시 ±2초 범위 안에서 토큰이 맞는지 확인한다(구현 안정성을 위한 허용 오차).
// 의존성 없이 Node 내장 http/crypto 모듈만 사용. 실행: node server.js (독립) / combined-server.js (통합)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SHARED_CSS = path.join(__dirname, '..', 'shared.css');
const MONSTER_IMG = path.join(__dirname, '..', 'assets', 'ch4-f06.webp'); // 문제 번호 = 프레임 번호
const BG_IMG = path.join(__dirname, '..', 'assets', 'title-bg.webp');

const PORT = 4006;
const ADMIN_ID = 'headroaster';
const FLAG = 'BREW{ch4_06_reset_token_predict}';
const TOKEN_WINDOW_SEC = 2; // Date 헤더의 초 단위 오차를 흡수하기 위한 허용 범위

// 최고관리자의 실제 비밀번호는 서버 기동 시 무작위로 정해지고 아무에게도 공개되지 않는다.
// 재설정에 성공하면 이 값을 사용자가 정한 새 비밀번호로 덮어쓴다.
let adminPassword = crypto.randomBytes(16).toString('hex');
// 가장 최근에 발급된 재설정 요청의 시각(Unix seconds). 한 번에 하나만 유효하다고 가정.
let lastResetIssuedAt = null;

function md5(str) {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function makeToken(id, issuedAtSec) {
  return md5(id + ':' + issuedAtSec);
}

// 발급시각 기준 ±TOKEN_WINDOW_SEC 안에서 토큰이 맞는지 확인 (취약 지점: 서명도 난수도 없이 예측 가능한 값)
function verifyToken(id, token) {
  if (lastResetIssuedAt === null) return false;
  for (let d = -TOKEN_WINDOW_SEC; d <= TOKEN_WINDOW_SEC; d++) {
    if (makeToken(id, lastResetIssuedAt + d) === token) return true;
  }
  return false;
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
    '<!-- dev note: 재설정 토큰 공식이 MD5(아이디:발급시각_유닉스초)로 돼 있음. 발급시각은 응답 Date 헤더로 역산 가능. 서명/난수 추가 필요. -->' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>최고관리자 계정 복구 시스템 — KLOAD</title>' +
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
    '<h1>최고관리자 계정 복구 시스템</h1>' +
    '<p class="lead">진짜 최고관리자 <span class="flag-chip">headroaster</span> 계정의 비밀번호를 아는 사람이 없습니다. 비밀번호를 재설정해야 로그인할 수 있습니다.</p>' +
    (msg ? '<p class="error">' + msg + '</p>' : '') +
    '<form method="POST" action="' + base + '/login">' +
    '<input type="text" name="id" placeholder="아이디" autocomplete="off">' +
    '<input type="password" name="pw" placeholder="비밀번호">' +
    '<button type="submit" class="btn">로그인</button></form>' +
    '<p class="lead"><a href="' + base + '/reset">비밀번호를 재설정하시겠습니까?</a></p>'
  );
}

function resetRequestPage(base, msg) {
  return page(
    '<h1>비밀번호 재설정 요청</h1>' +
    '<p class="lead">아이디를 입력하면 재설정 링크를 발급합니다.</p>' +
    (msg ? '<p class="error">' + msg + '</p>' : '') +
    '<form method="POST" action="' + base + '/reset">' +
    '<input type="text" name="id" placeholder="아이디" autocomplete="off">' +
    '<button type="submit" class="btn">재설정 링크 발급</button></form>'
  );
}

function resetIssuedPage(base) {
  return page(
    '<h1>재설정 링크 발급 완료</h1>' +
    '<div class="panel raw"><strong>알림</strong><p>등록된 연락처로 재설정 링크를 보냈습니다. 링크는 짧은 시간 안에 만료됩니다.</p></div>' +
    '<p class="lead"><a href="' + base + '/login">로그인으로 돌아가기</a></p>'
  );
}

function resetConfirmPage(base, token, msg) {
  return page(
    '<h1>새 비밀번호 설정</h1>' +
    (msg ? '<p class="error">' + msg + '</p>' : '') +
    '<form method="POST" action="' + base + '/reset/confirm">' +
    '<input type="hidden" name="token" value="' + escapeHtml(token) + '">' +
    '<input type="password" name="newpw" placeholder="새 비밀번호">' +
    '<button type="submit" class="btn">비밀번호 변경</button></form>'
  );
}

function adminPage() {
  return page(
    '<h1>최고관리자 전용 — headroaster</h1>' +
    '<div class="panel open"><strong>복구 완료</strong><p>최고관리자 계정으로 로그인했습니다. 봉인번호 <span class="flag-chip">' + FLAG + '</span></p></div>'
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
      if (body.id === ADMIN_ID && body.pw === adminPassword) {
        res.writeHead(302, { Location: base + '/', 'Set-Cookie': 'd06_auth=' + ADMIN_ID + '; Path=' + cookiePath });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginPage(base, '아이디 또는 비밀번호가 틀렸습니다.'));
    });
  }

  if (req.method === 'GET' && p === '/reset') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(resetRequestPage(base));
  }

  // 취약 지점: 토큰이 MD5(아이디:발급시각)이라 서명/난수가 없고, 발급시각은 응답의
  // Date 헤더(초 단위 서버 시각)로 그대로 노출된다.
  if (req.method === 'POST' && p === '/reset') {
    return parseBody(req, function (body) {
      if (body.id !== ADMIN_ID) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(resetRequestPage(base, '등록되지 않은 아이디입니다.'));
      }
      lastResetIssuedAt = Math.floor(Date.now() / 1000);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(resetIssuedPage(base));
    });
  }

  if (req.method === 'GET' && p === '/reset/confirm') {
    const token = fullUrl.searchParams.get('token') || '';
    if (!verifyToken(ADMIN_ID, token)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(resetConfirmPage(base, '', '토큰이 올바르지 않거나 만료되었습니다.'));
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(resetConfirmPage(base, token, null));
  }

  if (req.method === 'POST' && p === '/reset/confirm') {
    return parseBody(req, function (body) {
      if (!verifyToken(ADMIN_ID, body.token || '') || !body.newpw) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(resetConfirmPage(base, body.token || '', '토큰이 올바르지 않거나 비밀번호가 비어 있습니다.'));
      }
      adminPassword = body.newpw;
      lastResetIssuedAt = null; // 토큰 재사용 방지
      res.writeHead(302, { Location: base + '/login', 'Set-Cookie': 'd06_reset=done; Path=' + cookiePath });
      return res.end();
    });
  }

  if (req.method === 'GET' && p === '/') {
    if (cookies.d06_auth !== ADMIN_ID) {
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
    console.log('D6 문제 서버 실행: http://localhost:' + PORT + '/login');
  });
}
