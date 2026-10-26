// C단계 11번 문제 — 열쇠 한 장의 실행 권한 확장 (.htaccess 악용)
// 업로드 파일의 진짜 매직바이트(JPEG 헤더 FF D8 FF)를 검사하지만, .htaccess
// 설정 파일 자체를 올리는 것은 막지 않는다. 그 설정 파일로 폴더의 .jpg를
// 전부 "실행 가능"하게 바꾼 뒤, 진짜 이미지 헤더 뒤에 표식을 붙인 폴리글랏
// 파일을 올리면 실행된다.
// 통합 서버에서는 basePath(/ch3/11)를 떼어낸 뒤 라우팅한다.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const lib = require('../_lib.js');

const PORT = 3011;
const FLAG = 'ROAST{ch3_11_htaccess_abuse}';
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

let htaccessActive = false;

function landingPage(basePath, msg) {
  return lib.page({
    title: '레시피 업로드 (매직바이트 검사)',
    step: '3장 로스팅 · 11',
    monster: 'ch3-f10.webp',
    showExecHint: true,
    inner:
      '<h1>로스팅 레시피 업로드 (매직바이트 검사)</h1>' +
      '<p class="lead">이번엔 진짜 이미지 헤더(FF D8 FF)까지 검사합니다. 허용 확장자: jpg, jpeg, png, htaccess.</p>' +
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

  if (req.method === 'POST' && url.pathname === '/upload') {
    return lib.parseMultipart(req, function (form) {
      const file = form.files[0];
      if (!file) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(landingPage(basePath, '파일을 선택하십시오.'));
      }
      const ext = (path.extname(file.filename).slice(1) || '').toLowerCase();
      const isHtaccess = file.filename.toLowerCase() === '.htaccess';

      // 취약 지점 1: .htaccess는 허용 목록에 있지만 매직바이트 검사 대상이 아니다
      if (isHtaccess) {
        if (file.data.toString('utf8').indexOf('AddType') !== -1 && file.data.toString('utf8').indexOf('.jpg') !== -1) {
          htaccessActive = true;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(landingPage(basePath, '.htaccess 업로드 완료.'));
      }

      if (['jpg', 'jpeg', 'png'].indexOf(ext) === -1) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(landingPage(basePath, '허용되지 않는 확장자입니다.'));
      }
      // 취약 지점 2: 진짜 이미지 헤더만 있으면 뒤에 무엇이 와도 "이미지"로 인정한다(폴리글랏)
      if (file.data.slice(0, 3).compare(JPEG_MAGIC) !== 0) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(landingPage(basePath, '올바른 이미지 파일이 아닙니다.'));
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
    const buf = fs.readFileSync(fp);
    const cmd = url.searchParams.get('cmd');
    const ext = (path.extname(um[1]).slice(1) || '').toLowerCase();
    // 취약 지점 3: .htaccess 규칙이 활성화된 폴더에서는 .jpg도 실행된다고 가정
    if (htaccessActive && (ext === 'jpg' || ext === 'jpeg') && buf.toString('utf8').indexOf(lib.EXEC_MARKER) !== -1 && cmd === 'flag') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(lib.contentPage({ step: '3장 로스팅 · 11', monster: 'ch3-f10.webp', title: um[1] + '?cmd=flag', content: FLAG, flag: FLAG, label: '실행 결과', showExecHint: true }));
    }
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    return res.end(buf);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(handle).listen(PORT, function () {
    console.log('C11 문제 서버 실행: http://localhost:' + PORT + '/');
  });
}
