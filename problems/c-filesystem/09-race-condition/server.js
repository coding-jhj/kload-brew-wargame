// C단계 9번 문제 — 검사와 삭제 사이의 짧은 순간 (레이스 컨디션 업로드)
// 업로드된 파일을 먼저 "실행 가능한" 위치에 저장한 뒤, 내용을 검사해서
// 위험하면 그제서야 지운다. 저장 시점과 삭제 시점 사이에 파일이 실행 가능한
// 상태로 짧게 존재하는 진짜 시간차(TOCTOU)를 이용해야 한다.
// 통합 서버에서는 basePath(/ch3/09)를 떼어낸 뒤 라우팅한다.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const lib = require('../_lib.js');

const PORT = 3009;
const FLAG = 'ROAST{ch3_09_race_condition}';
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const CHECK_DELAY_MS = 400; // "검사"에 걸리는 시간

function landingPage(basePath, msg) {
  return lib.page({
    title: '레시피 업로드 (정밀 검사)',
    step: '3장 로스팅 · 09',
    monster: 'ch3-f10.webp',
    showExecHint: true,
    inner:
      '<h1>로스팅 레시피 업로드 (정밀 검사)</h1>' +
      '<p class="lead">파일을 저장한 뒤 내용을 검사해서, 위험하면 그제서야 지웁니다. 업로드 직후 <code>' + basePath + '/uploads/파일명?cmd=flag</code>를 아주 빠르게 반복 요청해 보십시오.</p>' +
      (msg ? '<p class="error">' + msg + '</p>' : '') +
      '<form method="POST" action="' + basePath + '/upload" enctype="multipart/form-data">' +
      '<input type="file" name="recipe">' +
      '<button type="submit" class="btn">업로드</button></form>'
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

  // 취약 지점: 1) 먼저 실행 가능한 위치에 저장 2) 뒤늦게 검사해서 위험하면 삭제
  if (req.method === 'POST' && url.pathname === '/upload') {
    return lib.parseMultipart(req, function (form) {
      const file = form.files[0];
      if (!file) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(landingPage(basePath, '파일을 선택하십시오.'));
      }
      const dest = path.join(UPLOAD_DIR, path.basename(file.filename));
      try {
        fs.writeFileSync(dest, file.data); // 1) 먼저 저장
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(landingPage(basePath, '파일 이름에 사용할 수 없는 문자가 있습니다.'));
      }
      setTimeout(function () {
        const content = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : '';
        if (content.indexOf(lib.EXEC_MARKER) !== -1) {
          fs.unlinkSync(dest); // 3) 위험하면 그제서야 삭제
        }
      }, CHECK_DELAY_MS);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(landingPage(basePath, '업로드 완료: ' + basePath + '/uploads/' + lib.escapeHtml(file.filename)));
    });
  }

  const um = url.pathname.match(/^\/uploads\/([a-zA-Z0-9_.-]+)$/);
  if (req.method === 'GET' && um) {
    const fp = path.join(UPLOAD_DIR, um[1]);
    if (!fs.existsSync(fp)) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(lib.contentPage({ step: '3장 로스팅 · 09', monster: 'ch3-f10.webp', title: um[1], content: '삭제됨 또는 없음 (검사에 걸려 지워졌거나, 애초에 존재하지 않음)', label: '상태', showExecHint: true }));
    }
    const content = fs.readFileSync(fp, 'utf8');
    const cmd = url.searchParams.get('cmd');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (content.indexOf(lib.EXEC_MARKER) !== -1 && cmd === 'flag') {
      return res.end(lib.contentPage({ step: '3장 로스팅 · 09', monster: 'ch3-f10.webp', title: um[1] + '?cmd=flag', content: FLAG, flag: FLAG, label: '실행 결과', showExecHint: true }));
    }
    return res.end(lib.contentPage({ step: '3장 로스팅 · 09', monster: 'ch3-f10.webp', title: um[1], content: content, label: '파일 내용', showExecHint: true }));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(handle).listen(PORT, function () {
    console.log('C9 문제 서버 실행: http://localhost:' + PORT + '/');
  });
}
