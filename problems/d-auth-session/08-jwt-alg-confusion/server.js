// D단계 08번 문제 — 서명 알고리즘 바꿔치기 (JWT alg confusion, RS256 -> HS256)
// 지난 사고 이후 서버가 진짜 서명(RS256, 공개키/비밀키 방식)을 쓰도록 바뀌었다.
// 그런데 검증 코드가 "토큰에 적힌 alg 값"을 그대로 믿고 검증 방식을 고른다.
// 공개키는 /public_key.pem 으로 누구나 볼 수 있는데, alg를 HS256(비밀키
// 하나로 서명하는 방식)으로 바꾸고 그 "비밀키" 자리에 공개키 문자열을 그대로
// 넣어 서명하면, 서버가 같은 공개키로 검증하다가 속아 넘어간다.
// 의존성 없이 Node 내장 http/crypto 모듈만 사용. 실행: node server.js (독립) / combined-server.js (통합)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SHARED_CSS = path.join(__dirname, '..', 'shared.css');
const MONSTER_IMG = path.join(__dirname, '..', 'assets', 'ch4-f08.webp');
const BG_IMG = path.join(__dirname, '..', 'assets', 'title-bg.webp');

const PORT = 4008;
const USER = 'roaster';
const PASS = 'coffee123';
const FLAG = 'BREW{ch4_08_jwt_alg_confusion}';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlToBuffer(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}
function b64urlJson(obj) {
  return b64url(Buffer.from(JSON.stringify(obj), 'utf8'));
}

function issueToken(role) {
  const header = b64urlJson({ alg: 'RS256', typ: 'JWT' });
  const payload = b64urlJson({ user: USER, role: role });
  const signingInput = header + '.' + payload;
  const sig = crypto.sign('sha256', Buffer.from(signingInput, 'utf8'), privateKey);
  return signingInput + '.' + b64url(sig);
}

// 취약 지점: 토큰의 alg 값을 그대로 믿고 검증 방식을 분기한다
function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  let header, payload;
  try {
    header = JSON.parse(b64urlToBuffer(h).toString('utf8'));
    payload = JSON.parse(b64urlToBuffer(p).toString('utf8'));
  } catch (e) { return null; }
  const signingInput = h + '.' + p;
  const sig = b64urlToBuffer(s);

  if (header.alg === 'RS256') {
    const ok = crypto.verify('sha256', Buffer.from(signingInput, 'utf8'), publicKey, sig);
    return ok ? payload : null;
  }
  if (header.alg === 'HS256') {
    const expected = crypto.createHmac('sha256', publicKey).update(signingInput).digest();
    const ok = expected.length === sig.length && crypto.timingSafeEqual(expected, sig);
    return ok ? payload : null;
  }
  return null;
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
    '<!-- dev note: 검증 코드가 토큰 헤더에 적힌 alg를 그대로 믿고 검증 방식을 고름. RS256/HS256 혼동 가능성 아직 안 막음. -->' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>서명 토큰 발급 시스템 — KLOAD</title>' +
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
    '<h1>서명 토큰 발급 시스템</h1>' +
    '<p class="lead">지난 사고 이후, 이번엔 진짜 서명이 있는 토큰(공개키 방식)을 씁니다. 공개키는 <a href="' + base + '/public_key.pem">' + base + '/public_key.pem</a>에서 누구나 볼 수 있습니다.</p>' +
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
      '<h1>전체 통제 — admin 권한</h1>' +
      '<div class="panel open"><strong>서명 검증 통과</strong><p>봉인번호 <span class="flag-chip">' + FLAG + '</span></p></div>'
    );
  }
  return page(
    '<h1>직원 화면 — staff 권한</h1>' +
    '<div class="panel raw"><strong>현재 권한: staff</strong><p>admin 권한이 있어야 전체 통제 화면을 볼 수 있습니다.</p></div>'
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

  if (req.method === 'GET' && p === '/public_key.pem') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(page(
      '<h1>public_key.pem</h1>' +
      '<div class="panel raw"><strong>공개키 (복사해서 사용하십시오)</strong><p style="white-space:pre-wrap">' + publicKey + '</p></div>'
    ));
  }

  if (req.method === 'GET' && p === '/login') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(loginPage(base));
  }

  if (req.method === 'POST' && p === '/login') {
    return parseBody(req, function (body) {
      if (body.id === USER && body.pw === PASS) {
        const token = issueToken('staff');
        res.writeHead(302, { Location: base + '/', 'Set-Cookie': 'd08_auth=' + token + '; Path=' + cookiePath });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginPage(base, '아이디 또는 비밀번호가 틀렸습니다.'));
    });
  }

  if (req.method === 'GET' && p === '/') {
    const payload = verifyToken(cookies.d08_auth);
    if (!payload) {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(reportPage(payload.role));
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
