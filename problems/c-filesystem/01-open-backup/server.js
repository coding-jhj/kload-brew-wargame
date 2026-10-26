// C단계(3장 로스팅, 파일 시스템) 1번 문제 — 열려 있는 납품 서류 창고
// /backup/ 폴더에 안내 페이지(인덱스)가 없어서, 웹서버가 폴더 안 파일 목록을
// 그대로 보여준다(디렉토리 리스팅). 목록에서 flag.txt를 찾아 열면 끝난다.
// 통합 서버(combined-server.js)에서는 basePath(/ch3/01)를 떼어낸 뒤 라우팅하고,
// 독립 실행(node server.js)에서는 basePath가 빈 문자열이라 기존과 동일하게 동작한다.
'use strict';
const http = require('http');
const path = require('path');
const lib = require('../_lib.js');

const PORT = 3001;
const FLAG = 'ROAST{ch3_01_open_backup}';
const FILES = {
  'notice.txt': '납품 서류 보관용 폴더입니다. 외부 공개 금지.',
  'flag.txt': FLAG
};

function landingPage(basePath) {
  return lib.page({
    title: '로스팅 공장 포털',
    step: '3장 로스팅 · 01',
    monster: 'ch3-f01.webp',
    inner:
      '<h1>로스팅 공장 포털</h1>' +
      '<p class="lead">원두 납품 서류를 모아두는 창고 폴더가 있다고 들었습니다. 안내 페이지가 따로 없는 폴더는 어떻게 보일까요.</p>' +
      '<div class="panel raw"><strong>힌트</strong><p><a href="' + basePath + '/backup/">' + basePath + '/backup/</a> 경로를 직접 열어보십시오.</p></div>'
  });
}

function listingPage(basePath) {
  const rows = Object.keys(FILES).map(function (name) {
    return '<li><a href="' + basePath + '/backup/' + name + '">' + name + '</a></li>';
  }).join('');
  return lib.page({
    title: '납품 서류 창고',
    step: '3장 로스팅 · 01',
    monster: 'ch3-f01.webp',
    inner:
      '<h1>Index of /backup/</h1>' +
      '<div class="panel raw"><strong>폴더 목록</strong><ul class="file-list">' + rows + '</ul></div>'
  });
}

function fileViewPage(name, content) {
  const isFlag = content === FLAG;
  return lib.page({
    title: name,
    step: '3장 로스팅 · 01',
    monster: 'ch3-f01.webp',
    inner:
      '<h1>' + name + '</h1>' +
      (isFlag
        ? '<div class="panel open"><strong>파일 내용</strong><p>봉인번호 <span class="flag-chip">' + content + '</span></p></div>'
        : '<div class="panel raw"><strong>파일 내용</strong><p>' + content + '</p></div>')
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
    return res.end(landingPage(basePath));
  }

  // 취약 지점: 인덱스 페이지가 없는 디렉토리를 그대로 목록으로 보여준다
  if (req.method === 'GET' && url.pathname === '/backup/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(listingPage(basePath));
  }

  const fm = url.pathname.match(/^\/backup\/([a-zA-Z0-9_.-]+)$/);
  if (req.method === 'GET' && fm && FILES[fm[1]]) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fileViewPage(fm[1], FILES[fm[1]]));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(handle).listen(PORT, function () {
    console.log('C1 문제 서버 실행: http://localhost:' + PORT + '/');
  });
}
