// C단계 4번 문제 — 환경설정이 적힌 쪽지 (.env 노출)
// 민감한 접속 정보가 담긴 .env 파일이 웹에서 바로 열리는 폴더에 놓여 있다.
// 통합 서버에서는 basePath(/ch3/04)를 떼어낸 뒤 라우팅한다.
'use strict';
const http = require('http');
const lib = require('../_lib.js');

const PORT = 3004;
const FLAG = 'ROAST{ch3_04_env_leak}';
const ENV_CONTENT = 'DB_HOST=localhost\nDB_USER=roastmaster\nDB_PASS=super_secret_roast\nFLAG=' + FLAG + '\n';

function landingPage() {
  return lib.page({
    title: '로스팅 공장 사이트',
    step: '3장 로스팅 · 04',
    monster: 'ch3-f04.webp',
    inner:
      '<!-- dev note: .env 파일이 아직도 웹 루트에 그대로 있음. 배포 스크립트에서 제외 처리 안 함. -->' +
      '<h1>로스팅 공장 사이트</h1>' +
      '<p class="lead">개발 설정이 어디에 저장되어 있을지 한번 찾아보십시오. 요즘 서비스들은 보통 이런 설정값들을 한 파일에 모아둡니다.</p>'
  });
}

function handle(req, res, basePath) {
  basePath = basePath || '';
  const url = new URL(req.url, 'http://localhost');
  if (basePath && url.pathname.indexOf(basePath) === 0) {
    url.pathname = url.pathname.slice(basePath.length) || '/';
  }
  if (lib.commonRoutes(req, res, url)) return;

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(landingPage());
  }

  // 취약 지점: 민감한 설정 파일이 웹 루트에 그대로 놓여서 누구나 요청할 수 있다
  if (req.method === 'GET' && url.pathname === '/.env') {
    const body = ENV_CONTENT.replace(FLAG, '<span class="flag-chip">' + FLAG + '</span>');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(lib.page({
      title: '.env',
      step: '3장 로스팅 · 04',
      monster: 'ch3-f04.webp',
      inner: '<h1>.env</h1><div class="panel open"><strong>파일 내용</strong><p style="white-space:pre-wrap">' + body + '</p></div>'
    }));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(handle).listen(PORT, function () {
    console.log('C4 문제 서버 실행: http://localhost:' + PORT + '/');
  });
}
