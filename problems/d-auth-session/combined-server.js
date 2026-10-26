// D단계 통합 서버 — 10개 문제를 포트 하나(4000)에서 경로 접두사로 구분해 제공한다.
// 각 문제는 /ch4/01/ ~ /ch4/10/ 로 접근한다.
// 공용 리소스(shared.css, assets/)는 이 통합 서버가 최상단에서 한 번만 처리한다.
// 각 문제의 플래그/취약점/공격 절차는 그대로이며, 바뀐 것은 경로 접두사와 쿠키 Path 속성뿐이다.
// 실행: node combined-server.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4000;
const SHARED_CSS = path.join(__dirname, 'shared.css');
const ASSETS_DIR = path.join(__dirname, 'assets');

// 각 문제 핸들러 모듈. require 시점에 module.exports = handle(req, res, base) 를 얻는다.
// (각 server.js 는 require.main !== module 이므로 독립 리스닝은 하지 않는다.)
const handlers = {
  '01': require('./01-bean-core/server.js'),
  '02': require('./02-batch-idor/server.js'),
  '03': require('./03-approval-skip/server.js'),
  '04': require('./04-nest-csrf/server.js'),
  '05': require('./05-otp-bruteforce/server.js'),
  '06': require('./06-logout-ghost/server.js'),
  '07': require('./07-hidden-debug/server.js'),
  '08': require('./08-jwt-alg-confusion/server.js'),
  '09': require('./09-oauth-state/server.js'),
  '10': require('./10-2fa-bypass/server.js')
};

// 문제 번호 고정 순서. '10'은 배열 인덱스로 취급되는 숫자 키라 Object.keys(handlers)로
// 순회하면 '10'이 맨 앞으로 밀려 10, 01, 02, ..., 09 순으로 나온다. 인덱스 페이지는
// 반드시 이 배열 순서(01~10)로 순회해야 한다.
const ORDER = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];

const TITLES = {
  '01': '생두의 위장 (쿠키 상태값 조작)',
  '02': '배치 번호만 바꾸면 (IDOR)',
  '03': '절차 생략 (승인 직행)',
  '04': '둥지 봉인 요청 위조 (CSRF)',
  '05': '보안 코드 무차별 대입 (OTP bruteforce)',
  '06': '로그아웃 유령 세션 (logout ghost)',
  '07': '숨겨진 디버그 계정 (hidden debug)',
  '08': '서명 알고리즘 혼동 (JWT alg confusion)',
  '09': 'OAuth state 미검증 (oauth state)',
  '10': '2단계 인증 로직 우회 (2FA bypass)'
};

const CONTENT_TYPES = {
  '.webp': 'image/webp',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

function indexPage() {
  let rows = '';
  ORDER.forEach(function (n) {
    // D6·D10은 '/' 라우트가 없고 /login에서 시작하는 설계라 인덱스 링크도 /login으로 보낸다.
    const href = (n === '06' || n === '10') ? '/ch4/' + n + '/login' : '/ch4/' + n + '/';
    rows += '<li><a href="' + href + '">D' + parseInt(n, 10) + ' · ' + TITLES[n] + '</a></li>';
  });
  return '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>4장 추출 — 통합 서버</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=Jua&family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;700&display=swap" rel="stylesheet">' +
    '<link rel="stylesheet" href="/shared.css"></head><body><div class="wrap">' +
    '<div class="hud"><span class="logo">KLOAD</span><span class="step">4장 추출 · 통합</span></div>' +
    '<div class="card"><div class="inner">' +
    '<h1>4장 추출 — 문제 목록</h1>' +
    '<p class="lead">각 문제는 아래 경로로 접근합니다.</p>' +
    '<ul>' + rows + '</ul>' +
    '</div></div></div></body></html>';
}

// 요청 처리 함수. 루트 server.js(프론트엔드 + 3장 + 4장 단일 서버)가 이 함수를
// require 해서 /ch4/* 요청을 위임한다. 독립 실행은 파일 맨 아래 require.main 블록에서 한다.
function handle(req, res) {
  let pathname;
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch (e) {
    pathname = req.url;
  }

  // 공용: shared.css (최상단에서 한 번만 처리)
  if (req.method === 'GET' && pathname === '/shared.css') {
    return fs.readFile(SHARED_CSS, 'utf8', function (err, css) {
      if (err) { res.writeHead(404); return res.end(''); }
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
      res.end(css);
    });
  }

  // 공용: /assets/<파일> (경로 탈출 방지를 위해 basename 만 사용)
  if (req.method === 'GET' && pathname.indexOf('/assets/') === 0) {
    const name = path.basename(pathname); // '..' 등 상위 경로 제거
    const full = path.join(ASSETS_DIR, name);
    // 결과 경로가 반드시 ASSETS_DIR 하위인지 재확인 (심층 방어)
    if (full.indexOf(ASSETS_DIR + path.sep) !== 0) {
      res.writeHead(404); return res.end('');
    }
    const ext = path.extname(name).toLowerCase();
    return fs.readFile(full, function (err, buf) {
      if (err) { res.writeHead(404); return res.end(''); }
      res.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream' });
      res.end(buf);
    });
  }

  // 문제 라우팅: /ch4/NN 또는 /ch4/NN/...
  const m = pathname.match(/^\/ch4\/(\d{2})(?:\/|$)/);
  if (m) {
    const n = m[1];
    const h = handlers[n];
    if (h) {
      return h(req, res, '/ch4/' + n);
    }
  }

  // 루트: 문제 목록
  if (req.method === 'GET' && (pathname === '/' || pathname === '')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(indexPage());
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

// 독립 실행(node combined-server.js)일 때만 포트를 연다. 로컬 테스트·디버깅용.
if (require.main === module) {
  http.createServer(handle).listen(PORT, function () {
    console.log('D단계 통합 서버 실행: http://localhost:' + PORT + '/');
    console.log('문제 경로: http://localhost:' + PORT + '/ch4/01/ ~ /ch4/10/');
  });
}
