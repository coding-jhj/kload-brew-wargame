// D단계 5번 문제 — 서명 검증 없는 토큰의 역할(role) 위조
// 로그인하면 header.payload.signature 형태의 토큰이 발급된다.
// 서버는 payload 안의 role 값만 읽을 뿐, signature가 진짜인지는 전혀 확인하지 않는다.
// payload를 디코드해서 role을 admin으로 바꾸고 재인코드하면 전체 보고서(플래그)가 보인다.
// 의존성 없이 Node 내장 http 모듈만 사용. 실행: node server.js (독립) / combined-server.js (통합)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const SHARED_CSS = path.join(__dirname, '..', 'shared.css');
const MONSTER_IMG = path.join(__dirname, '..', 'assets', 'ch4-f05.webp'); // 문제 번호 = 프레임 번호 (몬스터가 점점 로스팅됨)
const BG_IMG = path.join(__dirname, '..', 'assets', 'title-bg.webp');

const PORT = 4005;
const USER = 'roaster';
const PASS = 'coffee123';
const FLAG = 'BREW{ch4_05_jwt_role_forge}';

function b64urlEncode(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

function b64urlDecode(str) {
  try {
    return JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
}

function issueToken(role) {
  const header = b64urlEncode({ alg: 'none', typ: 'JWT' });
  const payload = b64urlEncode({ user: USER, role: role });
  const signature = 'unsigned'; // 취약 지점: 서버가 이 부분을 전혀 검증하지 않는다
  return header + '.' + payload + '.' + signature;
}

function readRole(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const payload = b64urlDecode(parts[1]);
  if (!payload || typeof payload.role !== 'string') return null;
  return payload.role;
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
    '<title>보고서 열람 시스템 — KLOAD</title>' +
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
    '<h1>보고서 열람 시스템</h1>' +
    '<p class="lead">배치 폐기와 둥지 봉인 기록이 보고서로 정리되었습니다. 열람 권한에 따라 보이는 내용이 다릅니다.</p>' +
    '<p class="creds">관리자가 두고 간 계정으로 로그인하십시오.<br>아이디 <span class="flag-chip">roaster</span> · 비밀번호 <span class="flag-chip">coffee123</span></p>' +
    (msg ? '<p class="error">' + msg + '</p>' : '') +
    '<form method="POST" action="' + base + '/login">' +
    '<input type="text" name="id" placeholder="아이디" autocomplete="off">' +
    '<input type="password" name="pw" placeholder="비밀번호">' +
    '<button type="submit" class="btn">로그인</button></form>'
  );
}

function reportPage(role) {
  if (role === 'admin') {
    return page(
      '<h1>전체 보고서 — admin 권한</h1>' +
      '<div class="panel open"><strong>전체 공개 금지 구역</strong><p>몬스터의 최종 흔적이 모두 기록되었습니다. 봉인번호 <span class="flag-chip">' + FLAG + '</span></p></div>'
    );
  }
  return page(
    '<h1>요약 보고서 — staff 권한</h1>' +
    '<div class="panel raw"><strong>현재 권한: staff</strong><p>배치 폐기와 둥지 봉인이 완료되었다는 요약만 볼 수 있습니다. 전체 보고서는 admin 권한이 필요합니다.</p></div>'
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
        const token = issueToken('staff');
        res.writeHead(302, { Location: base + '/', 'Set-Cookie': 'd05_auth=' + token + '; Path=' + cookiePath });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginPage(base, '아이디 또는 비밀번호가 틀렸습니다.'));
    });
  }

  // 취약 지점: payload의 role 값만 읽고, signature가 진짜인지는 전혀 확인하지 않는다
  if (req.method === 'GET' && p === '/') {
    const role = readRole(cookies.d05_auth);
    if (!role) {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(reportPage(role));
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
