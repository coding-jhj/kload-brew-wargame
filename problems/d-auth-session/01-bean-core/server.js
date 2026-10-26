// D단계 1번 문제 — 생두의 위장 (쿠키 role/상태값 조작)
// 서버는 d01_bean_state 쿠키 값을 그대로 믿는다. roasted로 바꾸면 핵심(플래그)이 열린다.
// 의존성 없이 Node 내장 http 모듈만 사용. 실행: node server.js (독립) / combined-server.js (통합)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const SHARED_CSS = path.join(__dirname, '..', 'shared.css'); // D단계 공용 스타일
const MONSTER_IMG = path.join(__dirname, '..', 'assets', 'ch4-f01.webp'); // 문제 번호 = 프레임 번호 (몬스터가 점점 로스팅됨)
const BG_IMG = path.join(__dirname, '..', 'assets', 'title-bg.webp');

const PORT = 4001;
const USER = 'roaster';
const PASS = 'coffee123';
const FLAG = 'BREW{ch4_01_b3an_r0ast_bypass}';

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
    '<title>추출 시스템 — KLOAD</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=Jua&family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;700&display=swap" rel="stylesheet">' +
    '<link rel="stylesheet" href="/shared.css"></head><body><div class="wrap">' +
    '<div class="hud"><span class="logo">KLOAD</span><span class="step">4장 추출 · 01</span></div>' +
    '<div class="card">' +
    '<div class="monster"><img src="/assets/ch4-f01.webp" alt="원두 몬스터"></div>' +
    '<div class="inner">' + inner + '</div></div>' +
    '</div></body></html>';
}

function loginPage(base, msg) {
  return page(
    '<h1>원두 몬스터 추출 시스템</h1>' +
    '<p class="lead">몬스터는 스스로 생두인 척 위장합니다. 하지만 위장은 껍데기일 뿐입니다.</p>' +
    '<p class="creds">관리자가 두고 간 계정으로 로그인하십시오.<br>아이디 <span class="flag-chip">roaster</span> · 비밀번호 <span class="flag-chip">coffee123</span></p>' +
    (msg ? '<p class="error">' + msg + '</p>' : '') +
    '<form method="POST" action="' + base + '/login">' +
    '<input type="text" name="id" placeholder="아이디" autocomplete="off">' +
    '<input type="password" name="pw" placeholder="비밀번호">' +
    '<button type="submit" class="btn">로그인</button></form>'
  );
}

function dashboardPage(beanState) {
  const roasted = beanState === 'roasted';
  return page(
    '<h1>추출 시스템 — 대시보드</h1>' +
    '<p class="lead">몬스터는 스스로 생두인 척 위장합니다. 하지만 위장은 껍데기일 뿐입니다.</p>' +
    '<div class="panel raw"><strong>생두 상태</strong><p>오늘의 재고: 생두 128kg. (상태값은 raw 아니면 roasted 둘 중 하나입니다.)</p></div>' +
    (roasted
      ? '<div class="panel open"><strong>핵심 (로스팅 완료)</strong><p>위장이 벗겨졌습니다. 봉인번호 <span class="flag-chip">' + FLAG + '</span></p></div>'
      : '<div class="panel locked"><strong>핵심</strong><p>🔒 로스팅이 완료된 원두만 열람할 수 있습니다.</p></div>')
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

  if (req.method === 'GET' && p === '/assets/ch4-f01.webp') {
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
          'Set-Cookie': ['d01_session=ok; Path=' + cookiePath, 'd01_bean_state=raw; Path=' + cookiePath]
        });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginPage(base, '아이디 또는 비밀번호가 틀렸습니다.'));
    });
  }

  if (req.method === 'GET' && p === '/') {
    if (cookies.d01_session !== 'ok') {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(dashboardPage(cookies.d01_bean_state));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(function (req, res) { handle(req, res, ''); }).listen(PORT, function () {
    console.log('D1 문제 서버 실행: http://localhost:' + PORT + '/login');
  });
}
