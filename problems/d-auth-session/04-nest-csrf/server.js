// D단계 4번 문제 — 둥지 봉인 요청 위조 (CSRF)
// 서버는 GET /seal-nest 요청을 받으면 세션 쿠키만 확인하고, CSRF 토큰은
// 전혀 확인하지 않는다. 그래서 로그인된 상태에서 외부 악성 페이지를 열기만
// 해도 요청이 몰래 전송되어 버린다.
// 단, "정말 외부에서 온 요청"인지는 브라우저가 자동으로 보내는 표준 헤더
// Sec-Fetch-Site로 판정한다(F12 Network 탭에서 확인 가능한 실제 헤더).
// cross-site일 때만(=외부 HTML 파일에서 자동 이동) 통과시키고, none(주소창
// 직접 입력)이나 same-origin(사이트 안에서 클릭)은 거부한다.
// 의존성 없이 Node 내장 http 모듈만 사용. 실행: node server.js (독립) / combined-server.js (통합)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const SHARED_CSS = path.join(__dirname, '..', 'shared.css');
const MONSTER_IMG = path.join(__dirname, '..', 'assets', 'ch4-f04.webp'); // 문제 번호 = 프레임 번호 (몬스터가 점점 로스팅됨)
const BG_IMG = path.join(__dirname, '..', 'assets', 'title-bg.webp');

const PORT = 4004;
const USER = 'roaster';
const PASS = 'coffee123';
const FLAG = 'BREW{ch4_04_csrf_seal_nest}';

let nestSealed = false; // 단일 플레이어용 전역 상태, 서버 재시작 시 초기화됨

// 요청이 "다른 출처에서" 온 것인지 확인한다. 브라우저가 모든 요청에 자동으로
// 붙이는 표준 헤더다: none(주소창 직접 입력/북마크), same-origin(이 사이트
// 안에서 이동), cross-site(다른 출처 — 외부 HTML 파일에서 자동 이동한 경우).
function isCrossSiteTriggered(req) {
  return req.headers['sec-fetch-site'] === 'cross-site';
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
    '<title>둥지 봉인 시스템 — KLOAD</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=Jua&family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;700&display=swap" rel="stylesheet">' +
    '<link rel="stylesheet" href="/shared.css"></head><body><div class="wrap">' +
    '<div class="hud"><span class="logo">KLOAD</span><span class="step">4장 추출 · 04</span></div>' +
    '<div class="card">' +
    '<div class="monster"><img src="/assets/ch4-f04.webp" alt="원두 몬스터"></div>' +
    '<div class="inner">' + inner + '</div></div>' +
    '</div></body></html>';
}

function loginPage(base, msg) {
  return page(
    '<h1>둥지 봉인 시스템</h1>' +
    '<p class="lead">배치 #1은 폐기되었지만, 몬스터가 살던 둥지 자체는 아직 봉인되지 않았습니다.</p>' +
    '<p class="creds">관리자가 두고 간 계정으로 로그인하십시오.<br>아이디 <span class="flag-chip">roaster</span> · 비밀번호 <span class="flag-chip">coffee123</span></p>' +
    (msg ? '<p class="error">' + msg + '</p>' : '') +
    '<form method="POST" action="' + base + '/login">' +
    '<input type="text" name="id" placeholder="아이디" autocomplete="off">' +
    '<input type="password" name="pw" placeholder="비밀번호">' +
    '<button type="submit" class="btn">로그인</button></form>'
  );
}

function dashboardPage(base) {
  if (nestSealed) {
    return page(
      '<h1>둥지 봉인 완료</h1>' +
      '<div class="panel open"><strong>둥지 봉인 성공</strong><p>몬스터의 서식지가 완전히 봉인되었습니다. 봉인번호 <span class="flag-chip">' + FLAG + '</span></p></div>'
    );
  }
  return page(
    '<h1>둥지 봉인 대기 중</h1>' +
    '<p class="lead">둥지 봉인은 보안상 화면에 버튼을 두지 않습니다. 오직 내부 API(<code>GET ' + base + '/seal-nest</code>)로만 처리됩니다.</p>' +
    '<div class="panel raw"><strong>현재 상태</strong><p>둥지가 아직 봉인되지 않았습니다.</p></div>'
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
  if (req.method === 'GET' && p === '/assets/ch4-f04.webp') {
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
        res.writeHead(302, { Location: base + '/', 'Set-Cookie': 'd04_session=ok; Path=' + cookiePath });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginPage(base, '아이디 또는 비밀번호가 틀렸습니다.'));
    });
  }

  if (req.method === 'GET' && p === '/') {
    if (cookies.d04_session !== 'ok') {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(dashboardPage(base));
  }

  // 취약 지점: 세션만 확인하고 CSRF 토큰은 확인하지 않는다.
  // GET으로 상태를 바꾸는 것 자체도 결함이다 (상태 변경 작업은 GET이 아니어야 한다).
  if (req.method === 'GET' && p === '/seal-nest') {
    if (cookies.d04_session !== 'ok') {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    if (!isCrossSiteTriggered(req)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(page(
        '<h1>둥지 봉인 거부</h1>' +
        '<div class="panel locked"><strong>안내</strong><p>이 요청은 이 사이트 안에서 직접 보낸 것으로 보입니다. 외부 페이지가 몰래 이 요청을 보내도록 만들어야 합니다.</p></div>'
      ));
    }
    nestSealed = true;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(dashboardPage(base));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(function (req, res) { handle(req, res, ''); }).listen(PORT, function () {
    console.log('D4 문제 서버 실행: http://localhost:' + PORT + '/login');
  });
}
