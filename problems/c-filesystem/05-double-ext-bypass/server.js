// C단계 5번 문제 — 사진처럼 보이는 레시피 (이중 확장자/매직바이트 우회)
// 파일 내용은 검사하지 않고, 파일명에 '.jpg'가 포함되는지와 클라이언트가
// 보낸 Content-Type(둘 다 속일 수 있음)만 검사한다.
// 통합 서버에서는 basePath(/ch3/05)를 떼어낸 뒤 라우팅한다.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const lib = require('../_lib.js');

const PORT = 3005;
const FLAG = 'ROAST{ch3_05_double_ext_bypass}';
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function landingPage(basePath, msg) {
  return lib.page({
    title: '레시피 업로드',
    step: '3장 로스팅 · 05',
    monster: 'ch3-f07.webp',
    showExecHint: true,
    inner:
      '<!-- dev note: 업로드 파일명 확장자 검사가 이름 안에 \'.php\'라는 글자가 들어 있는지만 보고, 정확히 \'.php\'로 끝나는지는 확인하지 않음. 교체 예정. -->' +
      '<h1>로스팅 레시피 업로드 (이미지 전용)</h1>' +
      '<p class="lead">이미지 파일만 허용됩니다. 업로드 후 <code>' + basePath + '/uploads/파일명?cmd=flag</code>로 접근해 보십시오.</p>' +
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

  // 취약 지점: 파일명에 '.jpg'가 포함되는지, Content-Type이 이미지인지만 검사한다
  // (둘 다 공격자가 그대로 조작해서 보낼 수 있는 값)
  if (req.method === 'POST' && url.pathname === '/upload') {
    return lib.parseMultipart(req, function (form) {
      const file = form.files[0];
      if (!file) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(landingPage(basePath, '파일을 선택하십시오.'));
      }
      const name = file.filename;
      if (name.indexOf('.jpg') === -1 && name.indexOf('.png') === -1) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(landingPage(basePath, '이미지 파일만 허용됩니다.'));
      }
      if (['image/jpeg', 'image/png'].indexOf(file.contentType) === -1) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(landingPage(basePath, '잘못된 파일 형식입니다.'));
      }
      try {
        fs.writeFileSync(path.join(UPLOAD_DIR, path.basename(name)), file.data);
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(landingPage(basePath, '파일 이름에 사용할 수 없는 문자가 있습니다.'));
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(landingPage(basePath, '업로드 완료: ' + basePath + '/uploads/' + lib.escapeHtml(name)));
    });
  }

  const um = url.pathname.match(/^\/uploads\/([a-zA-Z0-9_.-]+)$/);
  if (req.method === 'GET' && um) {
    const fp = path.join(UPLOAD_DIR, um[1]);
    if (!fs.existsSync(fp)) { res.writeHead(404); return res.end('404'); }
    const content = fs.readFileSync(fp, 'utf8');
    const cmd = url.searchParams.get('cmd');
    // 파일명에 .php가 포함되어 있으면(이중 확장자) 서버 설정상 PHP로 해석된다고 가정
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (um[1].toLowerCase().indexOf('.php') !== -1 && content.indexOf(lib.EXEC_MARKER) !== -1 && cmd === 'flag') {
      return res.end(lib.contentPage({ step: '3장 로스팅 · 05', monster: 'ch3-f07.webp', title: um[1] + '?cmd=flag', content: FLAG, flag: FLAG, label: '실행 결과', showExecHint: true }));
    }
    return res.end(lib.contentPage({ step: '3장 로스팅 · 05', monster: 'ch3-f07.webp', title: um[1], content: content, label: '파일 내용', showExecHint: true }));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(handle).listen(PORT, function () {
    console.log('C5 문제 서버 실행: http://localhost:' + PORT + '/');
  });
}
