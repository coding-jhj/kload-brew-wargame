// C단계(3장 로스팅, 파일 시스템) 10문제 통합 서버.
// 기존에 포트 3001-3010으로 따로 돌던 10개 서버를 "포트 하나"에서 돌린다.
// 각 문제는 /ch3/01 ~ /ch3/10 경로 접두사(basePath)로 구분한다.
// 공용 리소스(/shared.css, /assets/*)는 이 파일 최상단에서 한 번만 처리하고,
// 문제별 요청은 접두사를 떼어낸 뒤 각 문제의 핸들러(module.exports)에 넘긴다.
// 외부 호스팅(Render 등)에서는 PORT 환경변수를 주므로 그 값을 우선 사용하고,
// 없으면 3000을 쓴다 — 어느 경우든 포트는 하나만 연다.
'use strict';
const http = require('http');
const lib = require('./_lib.js');

const PORT = process.env.PORT || 3000;

// 번호 -> { 핸들러, 제목 }. 각 server.js는 (req, res, basePath) 형태의
// 핸들러 함수를 내보낸다. require 시점에 서버를 띄우지 않도록 각 파일의
// listen 호출은 require.main === module 로 감싸져 있다.
const PROBLEMS = [
  { no: '01', dir: '01-open-backup', title: '열려 있는 납품 서류 창고 (디렉토리 리스팅)' },
  { no: '02', dir: '02-path-traversal', title: '레시피 경로 거슬러 올라가기 (경로 탐색)' },
  { no: '03', dir: '03-git-exposure', title: '지워지지 않은 배포 흔적 (.git 노출)' },
  { no: '04', dir: '04-env-leak', title: '환경설정이 적힌 쪽지 (.env 노출)' },
  { no: '05', dir: '05-double-ext-bypass', title: '사진처럼 보이는 레시피 (이중 확장자 우회)' },
  { no: '06', dir: '06-lfi-log-poison', title: '접속 기록에 숨긴 코드 (LFI + 로그 포이즈닝)' },
  { no: '07', dir: '07-bundle-slip', title: '압축을 풀면 열리는 뒷문 (Zip Slip)' },
  { no: '08', dir: '08-phar-deserialize', title: '압축 안에 숨은 객체 (phar 역직렬화 원리)' },
  { no: '09', dir: '09-race-condition', title: '검사와 삭제 사이의 짧은 순간 (레이스 컨디션)' },
  { no: '10', dir: '10-image-cmd-injection', title: '이미지 처리 프로그램 커맨드 인젝션 (최종)' }
];

const handlers = {};
PROBLEMS.forEach(function (p) {
  handlers[p.no] = require('./' + p.dir + '/server.js');
});

function indexPage() {
  const rows = PROBLEMS.map(function (p) {
    return '<li><a href="/ch3/' + p.no + '/">C' + parseInt(p.no, 10) + '. ' + lib.escapeHtml(p.title) + '</a></li>';
  }).join('');
  return lib.page({
    title: '3장 로스팅 — 파일 시스템 취약점',
    step: '3장 로스팅 · 전체',
    monster: 'ch3-f01.webp',
    inner:
      '<h1>3장 로스팅 — 파일 시스템 취약점</h1>' +
      '<p class="lead">10개 문제가 하나의 서버에서 돌아갑니다. 각 문제는 <code>/ch3/번호/</code> 경로로 들어갑니다.</p>' +
      '<div class="panel raw"><strong>문제 목록</strong><ul class="file-list">' + rows + '</ul></div>'
  });
}

// 요청 처리 함수. 루트 server.js(프론트엔드 + 3장 + 4장 단일 서버)가 이 함수를
// require 해서 /ch3/* 요청을 위임한다. 독립 실행은 파일 맨 아래 require.main 블록에서 한다.
function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');

  // 공용 리소스(/shared.css, /assets/*)는 접두사 없이 최상단에서 한 번만 처리한다.
  if (lib.commonRoutes(req, res, url)) return;

  // /ch3/NN 또는 /ch3/NN/... 요청이면 해당 문제 핸들러로 넘긴다.
  const m = url.pathname.match(/^\/ch3\/(\d{2})(?=\/|$)/);
  if (m && handlers[m[1]]) {
    const basePath = '/ch3/' + m[1];
    return handlers[m[1]](req, res, basePath);
  }

  if (req.method === 'GET' && url.pathname === '/') {
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
    console.log('C단계 통합 서버 실행: http://localhost:' + PORT + '/  (문제별 경로: /ch3/01 ~ /ch3/10)');
  });
}
