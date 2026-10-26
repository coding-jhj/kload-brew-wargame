// C단계 5번 문제 — 지워진 줄 알았던 설정 파일 (.bak 백업 파일 노출)
// 설정 파일을 수정하면서 원본을 지우지 않고 .bak로 이름만 바꿔 남겨뒀다.
// .php로 끝나지 않아 코드로 실행되지 않고 그냥 텍스트로 보인다.
// 통합 서버에서는 basePath(/ch3/05)를 떼어낸 뒤 라우팅한다.
'use strict';
const http = require('http');
const lib = require('../_lib.js');

const PORT = 3005;
const FLAG = 'ROAST{ch3_05_backup_file_leak}';
const BAK_CONTENT = '<?php\n$DB_PASS = "old_super_secret";\ndefine("FLAG_SALT", "' + FLAG + '");\n?>';

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function landingPage() {
  return lib.page({
    title: '로스팅 공장 사이트',
    step: '3장 로스팅 · 05',
    monster: 'ch3-f05.webp',
    inner:
      '<h1>로스팅 공장 사이트</h1>' +
      '<p class="lead">지난달 설정 파일을 손봤다는 로그가 있는데, 원본을 정말 지웠을까요. 흔한 백업 파일 이름 패턴(.bak, .old, ~)을 몇 가지 시도해 보십시오. 대상 파일 이름은 <code>config.php</code>입니다.</p>'
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

  // 취약 지점: 확장자만 바꾼 백업 파일이 웹에서 그대로 읽힌다
  if (req.method === 'GET' && url.pathname === '/config.php.bak') {
    const body = escapeHtml(BAK_CONTENT).replace(FLAG, '<span class="flag-chip">' + FLAG + '</span>');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(lib.page({
      title: 'config.php.bak',
      step: '3장 로스팅 · 05',
      monster: 'ch3-f05.webp',
      inner: '<h1>config.php.bak</h1><div class="panel open"><strong>파일 내용</strong><p style="white-space:pre-wrap">' + body + '</p></div>'
    }));
  }

  if (req.method === 'GET' && (url.pathname === '/config.php.old' || url.pathname === '/config.php~')) {
    const body = escapeHtml(BAK_CONTENT).replace(FLAG, '<span class="flag-chip">' + FLAG + '</span>');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(lib.page({
      title: url.pathname.slice(1),
      step: '3장 로스팅 · 05',
      monster: 'ch3-f05.webp',
      inner: '<h1>' + url.pathname.slice(1) + '</h1><div class="panel open"><strong>파일 내용</strong><p style="white-space:pre-wrap">' + body + '</p></div>'
    }));
  }

  // 진짜 config.php는 당연히 평범하게 동작한다(코드가 실행되어 설정 내용이 안 보임)
  if (req.method === 'GET' && url.pathname === '/config.php') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(lib.page({
      title: 'config.php',
      step: '3장 로스팅 · 05',
      monster: 'ch3-f05.webp',
      inner: '<h1>config.php</h1><div class="panel raw"><strong>안내</strong><p>설정이 적용되었습니다.</p></div>'
    }));
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
