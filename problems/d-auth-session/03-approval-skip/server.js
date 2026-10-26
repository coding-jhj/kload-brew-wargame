// D단계 3번 문제 — 1차 검토 없이 2차 승인으로 직행 (절차 생략)
// 서버는 "2차 승인" 요청을 받으면 세션만 확인하고, 1차 검토를 먼저 끝냈는지는 확인하지 않는다.
// 1차 검토 페이지의 제출 버튼을 누르지 않고, 주소창에 2차 승인 URL을 바로 입력하면 플래그가 나온다.
// 의존성 없이 Node 내장 http 모듈만 사용. 실행: node server.js (독립) / combined-server.js (통합)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const SHARED_CSS = path.join(__dirname, '..', 'shared.css');
const MONSTER_IMG = path.join(__dirname, '..', 'assets', 'ch4-f03.webp'); // 문제 번호 = 프레임 번호 (몬스터가 점점 로스팅됨)
const BG_IMG = path.join(__dirname, '..', 'assets', 'title-bg.webp');

const PORT = 4003;
const USER = 'roaster';
const PASS = 'coffee123';
const CORE_BATCH = 1;
const FLAG = 'BREW{ch4_03_skip_approval_step}';

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
    '<title>핵심 배치 폐기 승인 시스템 — KLOAD</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=Jua&family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;700&display=swap" rel="stylesheet">' +
    '<link rel="stylesheet" href="/shared.css"></head><body><div class="wrap">' +
    '<div class="hud"><span class="logo">KLOAD</span><span class="step">4장 추출 · 03</span></div>' +
    '<div class="card">' +
    '<div class="monster"><img src="/assets/ch4-f03.webp" alt="원두 몬스터"></div>' +
    '<div class="inner">' + inner + '</div></div>' +
    '</div></body></html>';
}

function loginPage(base, msg) {
  return page(
    '<h1>핵심 배치 폐기 승인 시스템</h1>' +
    '<p class="lead">배치 #' + CORE_BATCH + '(몬스터 본체)의 위장이 벗겨졌습니다. 이제 폐기 절차를 밟아야 합니다.</p>' +
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
    '<!-- dev note: 2차 승인은 내부적으로 GET ' + base + '/approve 경로로 처리됨. 세션만 확인하고 1차 검토 제출 여부는 확인 안 함. -->' +
    '<h1>폐기 절차 안내</h1>' +
    '<p class="lead">배치 #' + CORE_BATCH + '(몬스터 본체)를 폐기하려면 1차 검토 후 2차 승인을 거쳐야 합니다. 2차 승인은 담당자 전용 내부 경로로 별도 처리됩니다.</p>' +
    '<div class="panel raw"><strong>1단계 · 1차 검토</strong><p>배치 상태를 확인하고 검토 의견을 제출합니다. <a class="flag-chip" href="' + base + '/review">1차 검토로 이동</a></p></div>'
  );
}

function reviewPage(base) {
  return page(
    '<h1>1차 검토</h1>' +
    '<p class="lead">배치 #' + CORE_BATCH + '의 상태를 확인했습니다. 검토 의견을 제출하면 2차 승인 담당자에게 넘어갑니다.</p>' +
    '<form method="POST" action="' + base + '/review">' +
    '<input type="text" name="note" placeholder="검토 의견 (예: 이상 없음)" autocomplete="off">' +
    '<button type="submit" class="btn">검토 제출</button></form>'
  );
}

function reviewSubmittedPage() {
  return page(
    '<h1>1차 검토 제출 완료</h1>' +
    '<div class="panel locked"><strong>2차 승인 대기 중</strong><p>검토 의견이 2차 승인 담당자에게 전달되었습니다. 승인은 담당자만 진행할 수 있습니다.</p></div>'
  );
}

function approvePage() {
  return page(
    '<h1>2차 승인 — 배치 #' + CORE_BATCH + ' 폐기 완료</h1>' +
    '<div class="panel open"><strong>핵심 배치 폐기 승인</strong><p>몬스터 본체가 완전히 처리되었습니다. 봉인번호 <span class="flag-chip">' + FLAG + '</span></p></div>'
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
  if (req.method === 'GET' && p === '/assets/ch4-f03.webp') {
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
        res.writeHead(302, { Location: base + '/', 'Set-Cookie': 'd03_session=ok; Path=' + cookiePath });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginPage(base, '아이디 또는 비밀번호가 틀렸습니다.'));
    });
  }

  if (req.method === 'GET' && p === '/') {
    if (cookies.d03_session !== 'ok') {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(dashboardPage(base));
  }

  if (req.method === 'GET' && p === '/review') {
    if (cookies.d03_session !== 'ok') {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(reviewPage(base));
  }

  if (req.method === 'POST' && p === '/review') {
    if (cookies.d03_session !== 'ok') {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    return parseBody(req, function () {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(reviewSubmittedPage());
    });
  }

  // 취약 지점: 세션만 확인하고, 1차 검토가 제출되었는지는 전혀 확인하지 않는다
  if (req.method === 'GET' && p === '/approve') {
    if (cookies.d03_session !== 'ok') {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(approvePage());
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(function (req, res) { handle(req, res, ''); }).listen(PORT, function () {
    console.log('D3 문제 서버 실행: http://localhost:' + PORT + '/login');
  });
}
