// C단계 2번 문제 — 레시피 경로를 거슬러 올라가기 (경로 탐색)
// file 파라미터를 경로 검증 없이 notes 폴더와 그대로 결합한다. ../ 를
// 반복하면 상위 폴더로 거슬러 올라가 서버의 다른 파일(flag.txt)을 읽을 수 있다.
// 통합 서버에서는 basePath(/ch3/02)를 떼어낸 뒤 라우팅한다.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const lib = require('../_lib.js');

const PORT = 3002;
const FLAG = 'ROAST{ch3_02_path_traversal}';
const PROBLEM_ROOT = path.resolve(__dirname); // traversal is allowed only inside this folder
const NOTES_DIR = path.join(__dirname, 'notes');
const SECRET_DIR = path.join(__dirname, 'secret'); // notes 폴더 바깥, 원래는 접근하면 안 되는 곳

fs.mkdirSync(NOTES_DIR, { recursive: true });
fs.mkdirSync(SECRET_DIR, { recursive: true });
fs.writeFileSync(path.join(NOTES_DIR, 'recipe1.txt'), '오늘의 로스팅 레시피: 200도, 12분.');
fs.writeFileSync(path.join(SECRET_DIR, 'flag.txt'), FLAG);

function landingPage(basePath) {
  return lib.page({
    title: '레시피 다운로드',
    step: '3장 로스팅 · 02',
    monster: 'ch3-f02.webp',
    inner:
      '<h1>레시피 다운로드</h1>' +
      '<p class="lead">파일 이름을 입력하면 레시피 폴더에서 찾아 보여줍니다.</p>' +
      '<div class="panel raw"><strong>힌트</strong><p>notes 폴더 바로 옆에 secret 폴더가 그대로 남아있다는 소문이 있습니다.</p></div>' +
      '<form method="GET" action="' + basePath + '/download">' +
      '<input type="text" name="file" placeholder="예: recipe1.txt" autocomplete="off">' +
      '<button type="submit" class="btn">다운로드</button></form>'
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

  // 취약 지점: file 파라미터를 검증 없이 그대로 경로에 결합한다
  if (req.method === 'GET' && url.pathname === '/download') {
    const file = url.searchParams.get('file') || '';
    // 방어: 널 바이트가 있으면 fs.readFile이 동기 예외(ERR_INVALID_ARG_VALUE)를 던져
    // 서버 프로세스가 죽으므로, fs.readFile을 부르기 전에 "파일 없음"으로 처리한다.
    if (file.indexOf('\0') !== -1) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(lib.page({
        title: '파일 없음',
        step: '3장 로스팅 · 02',
        monster: 'ch3-f02.webp',
        inner: '<h1>파일 없음</h1><div class="panel locked"><strong>안내</strong><p>파일을 찾을 수 없습니다.</p></div>'
      }));
    }
    const target = path.resolve(NOTES_DIR, file);
    // Boundary: the intended ../ escape (notes/ -> secret/) stays inside this problem folder.
    // Anything resolving outside __dirname (other chapters, wargame/, repo root) is treated as "not found".
    // Comparing against base + path.sep blocks prefix tricks such as "02-path-traversal-evil".
    if (target.indexOf(PROBLEM_ROOT + path.sep) !== 0) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(lib.page({
        title: '파일 없음',
        step: '3장 로스팅 · 02',
        monster: 'ch3-f02.webp',
        inner: '<h1>파일 없음</h1><div class="panel locked"><strong>안내</strong><p>파일을 찾을 수 없습니다.</p></div>'
      }));
    }
    fs.readFile(target, 'utf8', function (err, data) {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(lib.page({
          title: '파일 없음',
          step: '3장 로스팅 · 02',
          monster: 'ch3-f02.webp',
          inner: '<h1>파일 없음</h1><div class="panel locked"><strong>안내</strong><p>파일을 찾을 수 없습니다.</p></div>'
        }));
      }
      const body = data.replace(FLAG, '<span class="flag-chip">' + FLAG + '</span>');
      const isFlag = data.indexOf(FLAG) !== -1;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(lib.page({
        title: file,
        step: '3장 로스팅 · 02',
        monster: 'ch3-f02.webp',
        inner: '<h1>' + file + '</h1><div class="panel' + (isFlag ? ' open' : ' raw') + '"><strong>파일 내용</strong><p style="white-space:pre-wrap">' + body + '</p></div>'
      }));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(handle).listen(PORT, function () {
    console.log('C2 문제 서버 실행: http://localhost:' + PORT + '/');
  });
}
