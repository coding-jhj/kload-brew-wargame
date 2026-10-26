// D단계 10번 문제 — 마지막 보안 관문, 2단계 인증 로직 우회 (4장·전체 게임 마지막 문제)
// 최종 제어실은 비밀번호+OTP 두 단계가 필요하다. 그런데 "1차(비밀번호) 통과"
// 플래그와 "2차(OTP) 통과" 플래그가 분리되어 있는데, 최종 제어실 접근을
// 검사하는 코드가 실수로 1차 플래그만 확인한다. OTP를 아예 입력하지 않아도
// 최종 제어실에 들어갈 수 있다.
// 의존성 없이 Node 내장 http 모듈만 사용. 실행: node server.js (독립) / combined-server.js (통합)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const SHARED_CSS = path.join(__dirname, '..', 'shared.css');
const MONSTER_IMG = path.join(__dirname, '..', 'assets', 'ch4-f10.webp');
const BG_IMG = path.join(__dirname, '..', 'assets', 'title-bg.webp');

const PORT = 4010;
const USER = 'headroaster';
const PASS = 'roast2026';
const FLAG = 'BREW{ch4_10_2fa_logic_bypass}';

// 2단계(OTP) 코드. 로그인(1단계 통과) 시점에 서버 메모리에만 발급되며, 정상 경로로는
// 사용자에게 보여주거나 알려줄 방법이 없다("정상적으로는 코드를 알 수 없다"는 것이 설계 의도).
let pendingOtp = null;

function issueOtp() {
  pendingOtp = String(Math.floor(1000 + Math.random() * 9000));
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
    '<title>최종 제어실 — KLOAD</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=Jua&family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;700&display=swap" rel="stylesheet">' +
    '<link rel="stylesheet" href="/shared.css"></head><body><div class="wrap">' +
    '<div class="hud"><span class="logo">KLOAD</span><span class="step">4장 추출 · 10 (최종)</span></div>' +
    '<div class="card">' +
    '<div class="monster"><img src="/assets/ch4-f10.webp" alt="원두 몬스터"></div>' +
    '<div class="inner">' + inner + '</div></div>' +
    '</div></body></html>';
}

function loginPage(base, msg) {
  return page(
    '<h1>최종 제어실 — 1단계</h1>' +
    '<p class="lead">가장 민감한 최종 제어실은 비밀번호와 보안 코드(OTP) 두 단계를 모두 통과해야 합니다.</p>' +
    '<p class="creds">아이디 <span class="flag-chip">headroaster</span> · 비밀번호 <span class="flag-chip">roast2026</span></p>' +
    (msg ? '<p class="error">' + msg + '</p>' : '') +
    '<form method="POST" action="' + base + '/login">' +
    '<input type="text" name="id" placeholder="아이디" autocomplete="off">' +
    '<input type="password" name="pw" placeholder="비밀번호">' +
    '<button type="submit" class="btn">1단계 로그인</button></form>'
  );
}

function otpPage(base, msg) {
  return page(
    '<h1>최종 제어실 — 2단계(보안 코드)</h1>' +
    '<p class="lead">1단계를 통과했습니다. 등록된 기기로 전송된 보안 코드를 입력하면 최종 승인됩니다.</p>' +
    (msg ? '<p class="error">' + msg + '</p>' : '') +
    '<form method="POST" action="' + base + '/verify-otp">' +
    '<input type="text" name="code" placeholder="보안 코드" autocomplete="off">' +
    '<button type="submit" class="btn">확인</button></form>'
  );
}

function finalControlPage() {
  return page(
    '<h1>최종 제어실 — 공장 전체 장악 완료</h1>' +
    '<div class="panel open"><strong>전체 게임 최종 봉인번호</strong><p>봉인번호 <span class="flag-chip">' + FLAG + '</span></p></div>'
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

  if (req.method === 'GET' && p === '/login') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(loginPage(base));
  }

  if (req.method === 'POST' && p === '/login') {
    return parseBody(req, function (body) {
      if (body.id === USER && body.pw === PASS) {
        issueOtp(); // 1단계 통과 시 2단계 코드를 서버 메모리에만 발급(화면에는 노출하지 않음)
        res.writeHead(302, { Location: base + '/verify-otp', 'Set-Cookie': 'd10_pre_auth=1; Path=' + cookiePath });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginPage(base, '아이디 또는 비밀번호가 틀렸습니다.'));
    });
  }

  if (req.method === 'GET' && p === '/verify-otp') {
    if (cookies.d10_pre_auth !== '1') {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(otpPage(base));
  }

  // 2단계: 제출된 코드가 로그인 시 발급된 코드와 맞을 때만 d10_auth=1을 세팅한다.
  if (req.method === 'POST' && p === '/verify-otp') {
    if (cookies.d10_pre_auth !== '1') {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    return parseBody(req, function (body) {
      if (pendingOtp !== null && body.code === pendingOtp) {
        res.writeHead(302, { Location: base + '/final-control', 'Set-Cookie': 'd10_auth=1; Path=' + cookiePath });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(otpPage(base, '보안 코드가 올바르지 않습니다.'));
    });
  }

  // 취약 지점: d10_auth(2단계 통과)가 아니라 d10_pre_auth(1단계 통과)만 검사한다
  if (req.method === 'GET' && p === '/final-control') {
    if (cookies.d10_pre_auth !== '1') {
      res.writeHead(302, { Location: base + '/login' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(finalControlPage());
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(function (req, res) { handle(req, res, ''); }).listen(PORT, function () {
    console.log('D10 문제 서버 실행: http://localhost:' + PORT + '/login');
  });
}
