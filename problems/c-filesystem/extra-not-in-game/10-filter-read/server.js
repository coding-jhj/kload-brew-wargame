// C단계 10번 문제 — 필터를 통과한 소스 (php://filter 체이닝과 같은 원리)
// 지난 사고(8번) 이후, 불러오는 이름 뒤에 무조건 '.php'를 강제로 붙이도록
// 패치되어 직접 실행은 막혔다. 하지만 이름 앞에 "readfilter:" 접두사를 붙이면
// "코드로 실행" 하는 대신 "글자를 변환해서(base64) 그대로 보여주는" 특수 모드로
// 처리된다(PHP의 php://filter 스트림 래퍼와 같은 원리를 다른 이름으로 구현).
// 통합 서버에서는 basePath(/ch3/10)를 떼어낸 뒤 라우팅한다.
'use strict';
const http = require('http');
const lib = require('../_lib.js');

const PORT = 3010;
const FLAG = 'ROAST{ch3_10_filter_read}';
const CONFIG_SOURCE =
  '<?php\n' +
  '$DB_HOST = "localhost";\n' +
  '$DB_PASS = "roast_super_secret_2026";\n' +
  'define("FLAG_SALT", "' + FLAG + '");\n' +
  '?>';
const PAGES = { home: '환영합니다, 로스팅 공장입니다.' };

function landingPage(basePath) {
  return lib.page({
    title: '다국어 지원 페이지 (패치됨)',
    step: '3장 로스팅 · 10',
    monster: 'ch3-f10.webp',
    inner:
      '<!-- dev note: 8번 사고 이후 readfilter:<이름> 변환 모드를 아직 못 껐음. 급하게 .php 강제 "실행됨" 처리만 해둠. -->' +
      '<h1>다국어 지원 페이지 (패치됨)</h1>' +
      '<p class="lead"><code>' + basePath + '/page?name=값</code>으로 요청하면 이제 직접적인 실행 결과(소스 코드)는 보여주지 않고, "(실행되었습니다)"라는 안내만 표시합니다. 직접 실행은 막혔지만, 다른 방법이 있을지도 모릅니다.</p>'
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

  if (req.method === 'GET' && url.pathname === '/page') {
    const name = url.searchParams.get('name') || '';

    // 취약 지점: "readfilter:" 접두사가 있으면 .php 확장자가 붙어도 실행하지
    // 않고, 변환 모드로 대상 파일을 base64 인코딩해서 그대로 돌려준다.
    const fm = name.match(/^readfilter:(\w+)$/);
    if (fm) {
      const target = fm[1];
      if (target === 'config') {
        const b64 = Buffer.from(CONFIG_SOURCE, 'utf8').toString('base64');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(lib.contentPage({ step: '3장 로스팅 · 10', monster: 'ch3-f10.webp', title: 'readfilter:config', content: b64, label: 'base64 변환 결과 (복사해서 디코드하십시오)' }));
      }
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(lib.contentPage({ step: '3장 로스팅 · 10', monster: 'ch3-f10.webp', title: '대상 없음', content: '대상을 찾을 수 없습니다.' }));
    }

    // 일반 모드: .php가 강제로 붙어 "실행"된다고 가정 — 소스코드는 보여주지 않는다
    const content = PAGES[name];
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(lib.contentPage({ step: '3장 로스팅 · 10', monster: 'ch3-f10.webp', title: 'page?name=' + name, content: content || '(' + name + '.php 가 실행되었습니다. 소스는 보이지 않습니다)' }));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(handle).listen(PORT, function () {
    console.log('C10 문제 서버 실행: http://localhost:' + PORT + '/');
  });
}
