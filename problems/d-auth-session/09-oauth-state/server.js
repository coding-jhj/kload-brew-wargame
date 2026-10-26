// D단계 09번 문제 — 제휴 계정 연동 탈취 (OAuth state 미검증)
// 제휴 로스팅 업체 계정으로 로그인하는 기능이 있다. 콜백 주소는 CSRF 방지용
// state 값을 발급은 하지만, 실제로 콜백을 처리할 때 그 값이 맞는지 검증하지
// 않는다. 자기 자신의 인가 코드로 만든 콜백 주소를 "문의하기"로 관리자에게
// 보내면, 관리자가 그 링크를 열람하는 순간(이 서버에서는 자동 시뮬레이션)
// 관리자 계정에 공격자의 외부 계정이 연동되어 버린다.
// 의존성 없이 Node 내장 http/crypto 모듈만 사용. 실행: node server.js (독립) / combined-server.js (통합)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SHARED_CSS = path.join(__dirname, '..', 'shared.css');
const MONSTER_IMG = path.join(__dirname, '..', 'assets', 'ch4-f09.webp');
const BG_IMG = path.join(__dirname, '..', 'assets', 'title-bg.webp');

const PORT = 4009;
const USER = 'roaster';
const PASS = 'coffee123';
const FLAG = 'BREW{ch4_09_oauth_state_missing}';
const ADMIN_SID = 'adm-fixed-001'; // 관리자가 항상 로그인되어 있다고 가정하는 고정 세션
const BOT_DELAY_MS = 3000; // 관리자가 전달받은 링크를 열람하는 데 걸리는 시간(시뮬레이션)

const sessions = { // sid -> { role, externalId }
  [ADMIN_SID]: { role: 'admin', externalId: null }
};
const externalLinks = {}; // code -> sid (어느 세션에 연동되었는지)

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
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
    '<title>제휴 계정 연동 — KLOAD</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=Jua&family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;700&display=swap" rel="stylesheet">' +
    '<link rel="stylesheet" href="/shared.css"></head><body><div class="wrap">' +
    '<div class="hud"><span class="logo">KLOAD</span><span class="step">4장 추출 · 09</span></div>' +
    '<div class="card">' +
    '<div class="monster"><img src="/assets/ch4-f09.webp" alt="원두 몬스터"></div>' +
    '<div class="inner">' + inner + '</div></div>' +
    '</div></body></html>';
}

function loginPage(base, msg) {
  return page(
    '<h1>제휴 계정 연동 시스템</h1>' +
    '<p class="lead">제휴 로스팅 업체 계정으로도 로그인할 수 있습니다.</p>' +
    '<p class="creds">관리자가 두고 간 계정으로 로그인하십시오.<br>아이디 <span class="flag-chip">roaster</span> · 비밀번호 <span class="flag-chip">coffee123</span></p>' +
    (msg ? '<p class="error">' + msg + '</p>' : '') +
    '<form method="POST" action="' + base + '/login">' +
    '<input type="text" name="id" placeholder="아이디" autocomplete="off">' +
    '<input type="password" name="pw" placeholder="비밀번호">' +
    '<button type="submit" class="btn">로그인</button></form>'
  );
}

function dashboardPage(base, role) {
  if (role === 'admin') {
    return page(
      '<h1>관리자 전용 화면</h1>' +
      '<div class="panel open"><strong>관리자 세션 확인됨</strong><p>봉인번호 <span class="flag-chip">' + FLAG + '</span></p></div>'
    );
  }
  return page(
    '<h1>대시보드</h1>' +
    '<p class="lead">제휴 업체 계정으로 연동하려면 <a href="' + base + '/oauth/authorize">여기</a>를 누르십시오.<br>' +
    '연동 후 받은 콜백 주소는, 문의 게시판의 "링크 신고" 기능(<a href="' + base + '/report">여기</a>)으로 관리자에게 전달할 수 있습니다.</p>' +
    '<div class="panel raw"><strong>현재 권한: staff</strong><p>admin 권한이 있어야 관리자 전용 화면을 볼 수 있습니다.</p></div>' +
    '<p class="lead">외부 계정 코드로 로그인: <a href="' + base + '/login-with-external">여기</a></p>'
  );
}

function reportFormPage(base, msg) {
  return page(
    '<h1>링크 신고(문의)</h1>' +
    '<p class="lead">문제가 있는 외부 링크를 신고하면 관리자가 확인합니다.</p>' +
    (msg ? '<p class="error">' + msg + '</p>' : '') +
    '<form method="POST" action="' + base + '/report">' +
    '<input type="text" name="url" placeholder="신고할 콜백 주소 전체" autocomplete="off">' +
    '<button type="submit" class="btn">신고</button></form>'
  );
}

function externalLoginPage(base, msg) {
  return page(
    '<h1>외부 계정 코드로 로그인</h1>' +
    (msg ? '<p class="error">' + msg + '</p>' : '') +
    '<form method="POST" action="' + base + '/login-with-external">' +
    '<input type="text" name="code" placeholder="외부 계정 코드" autocomplete="off">' +
    '<button type="submit" class="btn">로그인</button></form>'
  );
}

function simulateAdminVisit(urlPath) {
  setTimeout(function () {
    const fakeReq = { method: 'GET', url: urlPath, headers: { cookie: 'd09_sid=' + ADMIN_SID } };
    handleOauthCallback(fakeReq);
  }, BOT_DELAY_MS);
}

// 취약 지점: state 값이 세션에 저장된 값과 맞는지 전혀 비교하지 않는다
function handleOauthCallback(req) {
  const url = new URL(req.url, 'http://localhost');
  const code = url.searchParams.get('code');
  const cookies = parseCookies(req);
  const sid = cookies.d09_sid;
  if (!code || !sid || !sessions[sid]) return;
  sessions[sid].externalId = code;
  externalLinks[code] = sid;
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
  if (req.method === 'GET' && p === '/assets/ch4-f09.webp') {
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
        const sid = crypto.randomBytes(8).toString('hex');
        sessions[sid] = { role: 'staff', externalId: null };
        res.writeHead(302, { Location: base + '/', 'Set-Cookie': 'd09_sid=' + sid + '; Path=' + cookiePath });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginPage(base, '아이디 또는 비밀번호가 틀렸습니다.'));
    });
  }

  if (req.method === 'GET' && p === '/') {
    const s = sessions[cookies.d09_sid];
    if (!s) {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(dashboardPage(base, s.role));
  }

  // 제휴 업체 인가를 흉내낸다. state를 발급은 하지만 세션엔 저장하지 않는다(취약 지점).
  if (req.method === 'GET' && p === '/oauth/authorize') {
    if (!sessions[cookies.d09_sid]) {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    const code = crypto.randomBytes(8).toString('hex');
    const state = crypto.randomBytes(8).toString('hex');
    res.writeHead(302, { Location: base + '/oauth/callback?code=' + code + '&state=' + state });
    return res.end();
  }

  if (req.method === 'GET' && p === '/oauth/callback') {
    handleOauthCallback(req);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(page(
      '<h1>제휴 계정 연동 완료</h1>' +
      '<div class="panel raw"><strong>안내</strong><p>이 콜백 주소 전체를 복사해 두면, 나중에 다시 쓸 수 있습니다.<br>' + escapeHtml(req.url) + '</p></div>'
    ));
  }

  if (req.method === 'GET' && p === '/report') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(reportFormPage(base));
  }

  // 신고된 링크를 관리자가 몇 초 뒤 열람한다고 가정(관리자 봇 시뮬레이션)
  if (req.method === 'POST' && p === '/report') {
    return parseBody(req, function (body) {
      let target;
      try { target = new URL(body.url); } catch (e) { target = null; }
      if (!target || target.pathname !== base + '/oauth/callback') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(reportFormPage(base, '올바른 콜백 주소가 아닙니다.'));
      }
      simulateAdminVisit(target.pathname + target.search);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(page('<h1>신고 접수됨</h1><div class="panel locked"><strong>안내</strong><p>관리자가 곧 확인합니다.</p></div>'));
    });
  }

  if (req.method === 'GET' && p === '/login-with-external') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(externalLoginPage(base));
  }

  if (req.method === 'POST' && p === '/login-with-external') {
    return parseBody(req, function (body) {
      const targetSid = externalLinks[body.code];
      if (!targetSid || !sessions[targetSid]) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(externalLoginPage(base, '연동된 계정을 찾을 수 없습니다.'));
      }
      const role = sessions[targetSid].role;
      res.writeHead(302, { Location: base + '/', 'Set-Cookie': 'd09_sid=' + targetSid + '; Path=' + cookiePath });
      return res.end();
    });
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(function (req, res) { handle(req, res, ''); }).listen(PORT, function () {
    console.log('D9 문제 서버 실행: http://localhost:' + PORT + '/login');
  });
}
