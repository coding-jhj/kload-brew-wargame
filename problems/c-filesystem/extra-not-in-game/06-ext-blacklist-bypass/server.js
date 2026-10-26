// C단계 6번 문제 — 느슨한 확장자 검사 (웹셸 업로드 #1)
// 업로드 기능이 '.php' 확장자만 막는다. 서버 설정상 .phtml/.php5/.pht 같은
// 변종도 PHP처럼 실행된다고 가정한다. 이 서버는 실제 명령을 실행하지 않고,
// "실행 가능하다고 간주되는 확장자 + 특정 표식이 담긴 파일에 ?cmd=flag로
// 접근하면 플래그를 출력한다"는 방식으로 같은 상황을 안전하게 흉내 낸다.
// 통합 서버에서는 basePath(/ch3/06)를 떼어낸 뒤 라우팅한다.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const lib = require('../_lib.js');

const PORT = 3006;
const FLAG = 'ROAST{ch3_06_ext_blacklist_bypass}';
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXECUTABLE_EXT = /\.(phtml|php3|php4|php5|pht)$/i;
const BLOCKED_EXT = /\.php$/i;

function landingPage(basePath, msg) {
  return lib.page({
    title: '레시피 업로드',
    step: '3장 로스팅 · 06',
    monster: 'ch3-f06.webp',
    showExecHint: true,
    inner:
      '<h1>로스팅 레시피 업로드</h1>' +
      '<p class="lead">.php 확장자만 막혀 있습니다. 업로드 후 <code>' + basePath + '/uploads/파일명?cmd=flag</code>로 접근해 보십시오.</p>' +
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

  // 취약 지점: '.php' 하나만 막고 다른 실행 가능 확장자는 그대로 통과시킨다
  if (req.method === 'POST' && url.pathname === '/upload') {
    return lib.parseMultipart(req, function (form) {
      const file = form.files[0];
      if (!file) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(landingPage(basePath, '파일을 선택하십시오.'));
      }
      if (BLOCKED_EXT.test(file.filename)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(landingPage(basePath, 'php 파일은 업로드할 수 없습니다.'));
      }
      try {
        fs.writeFileSync(path.join(UPLOAD_DIR, path.basename(file.filename)), file.data);
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(landingPage(basePath, '파일 이름에 사용할 수 없는 문자가 있습니다.'));
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(landingPage(basePath, '업로드 완료: ' + basePath + '/uploads/' + lib.escapeHtml(file.filename)));
    });
  }

  const um = url.pathname.match(/^\/uploads\/([a-zA-Z0-9_.-]+)$/);
  if (req.method === 'GET' && um) {
    const fp = path.join(UPLOAD_DIR, um[1]);
    if (!fs.existsSync(fp)) { res.writeHead(404); return res.end('404'); }
    const content = fs.readFileSync(fp, 'utf8');
    const cmd = url.searchParams.get('cmd');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (EXECUTABLE_EXT.test(um[1]) && content.indexOf(lib.EXEC_MARKER) !== -1 && cmd === 'flag') {
      return res.end(lib.contentPage({ step: '3장 로스팅 · 06', monster: 'ch3-f06.webp', title: um[1] + '?cmd=flag', content: FLAG, flag: FLAG, label: '실행 결과', showExecHint: true }));
    }
    return res.end(lib.contentPage({ step: '3장 로스팅 · 06', monster: 'ch3-f06.webp', title: um[1], content: content, label: '파일 내용', showExecHint: true }));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(handle).listen(PORT, function () {
    console.log('C6 문제 서버 실행: http://localhost:' + PORT + '/');
  });
}
