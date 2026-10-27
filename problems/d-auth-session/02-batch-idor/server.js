// D단계 2번 문제 — 배치 번호만 바꾸면 (IDOR)
// 서버는 요청한 배치 번호가 로그인한 사람의 것인지 확인하지 않는다.
// 내 배치(#7)가 아닌 1번(몬스터 핵심 배치)을 열면 플래그가 나온다.
// 의존성 없이 Node 내장 http 모듈만 사용. 실행: node server.js (독립) / combined-server.js (통합)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const SHARED_CSS = path.join(__dirname, '..', 'shared.css');
const MONSTER_IMG = path.join(__dirname, '..', 'assets', 'ch4-f02.webp'); // 문제 번호 = 프레임 번호 (몬스터가 점점 로스팅됨)
const BG_IMG = path.join(__dirname, '..', 'assets', 'title-bg.webp');

const PORT = 4002;
const USER = 'roaster';
const PASS = 'coffee123';
const MY_BATCH = 7;
const CORE_BATCH = 1;
const FLAG = 'BREW{ch4_02_idor_batch_snoop}';

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

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function page(inner) {
  return '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>배치 추적 시스템 — KLOAD</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=Jua&family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;700&display=swap" rel="stylesheet">' +
    '<link rel="stylesheet" href="/shared.css"></head><body><div class="wrap">' +
    '<div class="hud"><span class="logo">KLOAD</span><span class="step">4장 추출 · 02</span></div>' +
    '<div class="card">' +
    '<div class="monster"><img src="/assets/ch4-f02.webp" alt="원두 몬스터"></div>' +
    '<div class="inner">' + inner + '</div></div>' +
    '</div></body></html>';
}

function loginPage(base, msg) {
  return page(
    '<h1>배치 추적 시스템</h1>' +
    '<p class="lead">몬스터는 수많은 배치 중 하나인 척 공장 안에 숨어들었습니다.</p>' +
    '<p class="creds">관리자가 두고 간 계정으로 로그인하십시오.<br>아이디 <span class="flag-chip">roaster</span> · 비밀번호 <span class="flag-chip">coffee123</span></p>' +
    (msg ? '<p class="error">' + msg + '</p>' : '') +
    '<form method="POST" action="' + base + '/login">' +
    '<input type="text" name="id" placeholder="아이디" autocomplete="off">' +
    '<input type="password" name="pw" placeholder="비밀번호">' +
    '<button type="submit" class="btn">로그인</button></form>'
  );
}

function dashboardPage(base) {
  return page(
    '<h1>배치 추적 시스템 — 대시보드</h1>' +
    '<p class="lead">몬스터는 수많은 배치 중 하나인 척 공장 안에 숨어들었습니다.</p>' +
    '<div class="panel raw"><strong>내 담당 배치</strong><p>배치 #' + MY_BATCH + '. <a class="flag-chip" href="' + base + '/batch?id=' + MY_BATCH + '">상세보기</a></p></div>' +
    '<div class="panel"><strong>최근 배치 열람 기록</strong><ul>' +
    '<li>김로스팅 · 배치 #4 열람 · 정상 종료</li>' +
    '<li>박주임 · 배치 #9 열람 · 정상 종료</li>' +
    '<li>이선임 · 배치 #' + CORE_BATCH + ' 열람 요청 · 반려 (사유 미기재)</li>' +
    '<li>최대리 · 배치 #12 열람 · 정상 종료</li>' +
    '</ul></div>'
  );
}

function batchPage(id) {
  if (id === CORE_BATCH) {
    return page(
      '<h1>배치 #' + CORE_BATCH + ' 기록</h1>' +
      '<div class="panel open"><strong>핵심 배치 (몬스터 본체)</strong><p>위장이 벗겨졌습니다. 봉인번호 <span class="flag-chip">' + FLAG + '</span></p></div>'
    );
  }
  return page(
    '<h1>배치 #' + id + ' 기록</h1>' +
    '<div class="panel"><strong>로스팅 기록</strong><p>배치 #' + esc(id) + '의 평범한 로스팅 기록입니다. 특별한 내용은 없습니다.</p></div>'
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
  if (req.method === 'GET' && p === '/assets/ch4-f02.webp') {
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
        res.writeHead(302, { Location: base + '/', 'Set-Cookie': 'd02_session=ok; Path=' + cookiePath });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginPage(base, '아이디 또는 비밀번호가 틀렸습니다.'));
    });
  }

  if (req.method === 'GET' && p === '/') {
    if (cookies.d02_session !== 'ok') {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(dashboardPage(base));
  }

  // 취약 지점: 세션만 확인하고, 요청한 배치 번호가 내 것인지는 확인하지 않는다
  if (req.method === 'GET' && p === '/batch') {
    if (cookies.d02_session !== 'ok') {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    const id = parseInt(fullUrl.searchParams.get('id'), 10);
    if (!Number.isInteger(id) || id < 1 || id > 20) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(page('<h1>배치 없음</h1><p class="lead">존재하지 않는 배치 번호입니다.</p>'));
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(batchPage(id));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(function (req, res) { handle(req, res, ''); }).listen(PORT, function () {
    console.log('D2 문제 서버 실행: http://localhost:' + PORT + '/login');
  });
}
