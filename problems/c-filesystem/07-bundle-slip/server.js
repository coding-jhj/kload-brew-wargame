// C단계 7번 문제 — 압축을 풀면 열리는 뒷문 (Zip Slip)
// 실제 zip 포맷 대신, 같은 구조적 취약점을 가르치는 단순 텍스트 "묶음 파일"
// (.bundle) 포맷을 쓴다. #ENTRY <경로> 로 지정한 경로를 검증 없이 그대로
// 꺼내 쓰기 때문에, ../ 를 포함한 경로를 넣으면 지정한 폴더 밖에 파일을 쓸 수 있다.
// 통합 서버에서는 basePath(/ch3/07)를 떼어낸 뒤 라우팅한다.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const lib = require('../_lib.js');

const PORT = 3007;
const FLAG = 'ROAST{ch3_07_bundle_slip}';
const RECIPES_DIR = path.join(__dirname, 'recipes'); // 묶음을 푸는 기본 위치
const LIVE_DIR = path.join(__dirname, 'live');        // 웹에서 직접 실행 가능한 위치 (원래는 못 써야 함)
fs.mkdirSync(RECIPES_DIR, { recursive: true });
fs.mkdirSync(LIVE_DIR, { recursive: true });

function landingPage(basePath, msg) {
  return lib.page({
    title: '레시피 묶음 업로드',
    step: '3장 로스팅 · 07',
    monster: 'ch3-f09.webp',
    showExecHint: true,
    inner:
      '<!-- dev note: 번들 항목은 서버가 recipes/ 폴더에 풀어주는데, 경로에 상대 경로(../)를 쓰면 바로 위 live/ 폴더까지 빠져나가 파일을 쓸 수 있음. live/ 안의 파일은 ' + basePath + '/live/<파일명>?cmd=flag 로 접근 가능. 경로 정규화 아직 안 함. -->' +
      '<h1>레시피 묶음 업로드</h1>' +
      '<p class="lead">.bundle 텍스트 파일을 업로드하면 서버가 recipes/ 폴더에 그대로 풀어줍니다.<br>' +
      '형식: 한 줄에 <code>#ENTRY 경로</code> 다음 줄부터 내용, 마지막은 <code>#END</code>.</p>' +
      (msg ? '<p class="error">' + msg + '</p>' : '') +
      '<form method="POST" action="' + basePath + '/upload-bundle" enctype="multipart/form-data">' +
      '<input type="file" name="bundle">' +
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

  // 취약 지점: 엔트리 경로를 검증하지 않고 recipes/ 기준으로 그대로 꺼낸다
  if (req.method === 'POST' && url.pathname === '/upload-bundle') {
    return lib.parseMultipart(req, function (form) {
      const file = form.files[0];
      if (!file) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(landingPage(basePath, '파일을 선택하십시오.'));
      }
      const entries = lib.parseBundle(file.data.toString('utf8'));
      entries.forEach(function (e) {
        if (e.type === 'FILE') {
          try {
            const dest = path.join(RECIPES_DIR, e.name); // ../ 를 그대로 믿는다
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.writeFileSync(dest, e.content);
          } catch (err) {
            // 항목 이름에 사용할 수 없는 문자가 있으면 이 항목만 건너뛴다
          }
        }
      });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(landingPage(basePath, '묶음을 풀었습니다. (' + entries.length + '개 항목)'));
    });
  }

  const lm = url.pathname.match(/^\/live\/([a-zA-Z0-9_.-]+)$/);
  if (req.method === 'GET' && lm) {
    const fp = path.join(LIVE_DIR, lm[1]);
    // 방어: 번들을 풀면서 생긴 디렉토리를 그대로 읽으면 readFileSync가 EISDIR 예외를
    // 던져 서버가 죽으므로, 디렉토리면 미리 "파일 없음"으로 처리한다.
    if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end('404'); }
    const content = fs.readFileSync(fp, 'utf8');
    const cmd = url.searchParams.get('cmd');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (content.indexOf(lib.EXEC_MARKER) !== -1 && cmd === 'flag') {
      return res.end(lib.contentPage({ step: '3장 로스팅 · 07', monster: 'ch3-f09.webp', title: '/live/' + lm[1] + '?cmd=flag', content: FLAG, flag: FLAG, label: '실행 결과', showExecHint: true }));
    }
    return res.end(lib.contentPage({ step: '3장 로스팅 · 07', monster: 'ch3-f09.webp', title: '/live/' + lm[1], content: content, label: '파일 내용', showExecHint: true }));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(handle).listen(PORT, function () {
    console.log('C7 문제 서버 실행: http://localhost:' + PORT + '/');
  });
}
