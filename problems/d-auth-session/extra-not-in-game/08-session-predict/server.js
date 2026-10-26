// D단계 8번 문제 — 배전반 접속 기록 시스템, 세션 번호 예측
// 세션 번호가 암호학적으로 안전한 난수가 아니라 1씩 증가하는 정수로 발급된다.
// 서버가 주기적으로 관리자(headroaster) 세션을 내부적으로 자동 발급하는데,
// 플레이어가 두 번 로그인해서 받은 번호 사이에 "비어있는 번호"가 하나 있다는 것을
// 눈치채면, 그 번호로 쿠키를 바꿔 관리자 세션을 가로챌 수 있다.
// 의존성 없이 Node 내장 http 모듈만 사용. 실행: node server.js (독립) / combined-server.js (통합)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const SHARED_CSS = path.join(__dirname, '..', 'shared.css');
const MONSTER_IMG = path.join(__dirname, '..', 'assets', 'ch4-f08.webp');
const BG_IMG = path.join(__dirname, '..', 'assets', 'title-bg.webp');

const PORT = 4008;
const USER = 'roaster';
const PASS = 'coffee123';
const FLAG = 'BREW{ch4_08_session_predict}';
const ADMIN_AUTO_INTERVAL_MS = 8000; // 관리자가 주기적으로 자동 접속하는 간격

let counter = 1000;
const sessions = {}; // sid(number) -> { role }

setInterval(function () {
  counter += 1;
  sessions[counter] = { role: 'admin' }; // 관리자 자동 접속, 플레이어에게는 번호를 알려주지 않음
}, ADMIN_AUTO_INTERVAL_MS);

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
    '<title>배전반 접속 기록 시스템 — KLOAD</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=Jua&family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;700&display=swap" rel="stylesheet">' +
    '<link rel="stylesheet" href="/shared.css"></head><body><div class="wrap">' +
    '<div class="hud"><span class="logo">KLOAD</span><span class="step">4장 추출 · 08</span></div>' +
    '<div class="card">' +
    '<div class="monster"><img src="/assets/ch4-f08.webp" alt="원두 몬스터"></div>' +
    '<div class="inner">' + inner + '</div></div>' +
    '</div></body></html>';
}

function loginPage(base, msg) {
  return page(
    '<h1>배전반 접속 기록 시스템</h1>' +
    '<p class="lead">창고가 열린 뒤, 로스팅 라인 배전반을 여러 직원이 교대로 접속합니다. 접속할 때마다 번호가 하나씩 발급됩니다.</p>' +
    '<p class="creds">관리자가 두고 간 계정으로 로그인하십시오.<br>아이디 <span class="flag-chip">roaster</span> · 비밀번호 <span class="flag-chip">coffee123</span></p>' +
    (msg ? '<p class="error">' + msg + '</p>' : '') +
    '<form method="POST" action="' + base + '/login">' +
    '<input type="text" name="id" placeholder="아이디" autocomplete="off">' +
    '<input type="password" name="pw" placeholder="비밀번호">' +
    '<button type="submit" class="btn">로그인</button></form>'
  );
}

function dashboardPage(sid, role) {
  if (role === 'admin') {
    return page(
      '<h1>배전반 제어 — 관리자</h1>' +
      '<div class="panel open"><strong>관리자 세션 확인됨</strong><p>봉인번호 <span class="flag-chip">' + FLAG + '</span></p></div>'
    );
  }
  return page(
    '<h1>배전반 접속 기록 — 대시보드</h1>' +
    '<p class="lead">창고가 열린 뒤, 로스팅 라인 배전반을 여러 직원이 교대로 접속합니다. 접속할 때마다 번호가 하나씩 발급됩니다.</p>' +
    '<div class="panel raw"><strong>내 접속 번호</strong><p>이번 접속 번호: <span class="flag-chip">' + sid + '</span>. 평범한 직원 권한입니다.</p></div>'
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
  if (req.method === 'GET' && p === '/assets/ch4-f08.webp') {
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
        counter += 1;
        sessions[counter] = { role: 'staff' };
        res.writeHead(302, { Location: base + '/', 'Set-Cookie': 'd08_sid=' + counter + '; Path=' + cookiePath });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginPage(base, '아이디 또는 비밀번호가 틀렸습니다.'));
    });
  }

  // 취약 지점: 세션 번호가 순차 정수라 추측 가능하고, 관리자 세션도 같은 카운터를 공유한다
  if (req.method === 'GET' && p === '/') {
    const sid = cookies.d08_sid;
    if (!sid || !sessions[sid]) {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(dashboardPage(sid, sessions[sid].role));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(function (req, res) { handle(req, res, ''); }).listen(PORT, function () {
    console.log('D8 문제 서버 실행: http://localhost:' + PORT + '/login');
  });
}
