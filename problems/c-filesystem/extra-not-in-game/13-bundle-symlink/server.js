// C단계 13번 문제 — 지름길로 빠져나가기 (압축파일 안 심볼릭 링크 악용)
// 업로드하는 "묶음 파일" 안에 #LINK 항목으로 지름길(심볼릭 링크)을 심을 수
// 있다. 서버가 이 묶음을 풀 때 지름길을 그대로 믿고 등록해버려서, 평범해
// 보이는 이름으로 요청해도 실제로는 지름길이 가리키는 서버 안쪽 파일이 읽힌다.
// 통합 서버에서는 basePath(/ch3/13)를 떼어낸 뒤 라우팅한다.
'use strict';
const http = require('http');
const path = require('path');
const lib = require('../_lib.js');

const PORT = 3013;
const FLAG = 'ROAST{ch3_13_bundle_symlink}';
const SECRET_CONFIG_PATH = '/etc/kload/roast-secret.conf'; // 실제 파일은 아니고, 서버 안쪽 가상 경로
const SERVER_FILES = {}; // 가상 파일시스템: 경로 -> 내용
SERVER_FILES[SECRET_CONFIG_PATH] = 'admin_token=xyz\nFLAG=' + FLAG;

const linkMap = {}; // 공개된 이름 -> 실제 가리키는 경로

function landingPage(basePath, msg) {
  return lib.page({
    title: '레시피 묶음 업로드 (지름길 주의)',
    step: '3장 로스팅 · 13',
    monster: 'ch3-f10.webp',
    inner:
      '<!-- dev note: /etc/kload/ 아래 설정 파일(roast-secret.conf)이 아직도 외부에서 접근 가능한 상태로 남아있음. -->' +
      '<h1>레시피 묶음 업로드</h1>' +
      '<p class="lead">서버 설정이 어딘가에 있다고 들었습니다. 묶음 파일 안에 ' +
      '<code>#LINK 이름 -> 대상경로</code> 를 넣으면 지름길을 만들 수 있습니다. 업로드 후 <code>' + basePath + '/files/이름</code>으로 접근해 보십시오.</p>' +
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

  // 취약 지점: LINK 항목의 대상 경로를 전혀 검증하지 않고 그대로 등록한다
  if (req.method === 'POST' && url.pathname === '/upload-bundle') {
    return lib.parseMultipart(req, function (form) {
      const file = form.files[0];
      if (!file) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(landingPage(basePath, '파일을 선택하십시오.'));
      }
      const entries = lib.parseBundle(file.data.toString('utf8'));
      entries.forEach(function (e) {
        if (e.type === 'LINK') linkMap[e.name] = e.target;
        if (e.type === 'FILE') SERVER_FILES['/__uploads/' + e.name] = e.content;
      });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(landingPage(basePath, '묶음을 풀었습니다. (' + entries.length + '개 항목)'));
    });
  }

  const fm = url.pathname.match(/^\/files\/([a-zA-Z0-9_.-]+)$/);
  if (req.method === 'GET' && fm) {
    const name = fm[1];
    const realPath = linkMap[name] ? linkMap[name] : '/__uploads/' + name;
    const content = SERVER_FILES[realPath];
    if (content === undefined) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(lib.contentPage({ step: '3장 로스팅 · 13', monster: 'ch3-f10.webp', title: '/files/' + name, content: content, flag: FLAG, label: '파일 내용' }));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(handle).listen(PORT, function () {
    console.log('C13 문제 서버 실행: http://localhost:' + PORT + '/');
  });
}
