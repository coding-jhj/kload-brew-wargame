// C단계 6번 문제 — 접속 기록에 숨긴 코드 (LFI + 로그 포이즈닝)
// page 파라미터를 검증 없이 그대로 불러온다(로컬 파일 포함). 직접 코드를
// 써넣을 수는 없지만, 모든 요청의 User-Agent가 접속 기록에 남는다는 점을
// 이용해 그 기록 자체에 표식을 심고, page로 기록 파일을 불러오게 만든다.
// 통합 서버에서는 basePath(/ch3/06)를 떼어낸 뒤 라우팅한다.
'use strict';
const http = require('http');
const lib = require('../_lib.js');

const PORT = 3006;
const FLAG = 'ROAST{ch3_06_lfi_log_poison}';
const PAGES = { home: '환영합니다, 로스팅 공장입니다.' };
const accessLog = []; // 모든 요청의 User-Agent가 쌓인다

function landingPage(basePath) {
  return lib.page({
    title: '다국어 지원 페이지',
    step: '3장 로스팅 · 06',
    monster: 'ch3-f08.webp',
    showExecHint: true,
    inner:
      '<h1>다국어 지원 페이지</h1>' +
      '<p class="lead"><code>' + basePath + '/page?name=home</code>처럼 페이지 이름을 받아 보여줍니다. 이 사이트의 모든 요청은 접속 기록(access log)에 남습니다.</p>'
  });
}

function handle(req, res, basePath) {
  basePath = basePath || '';
  const url = new URL(req.url, 'http://localhost');
  if (basePath && url.pathname.indexOf(basePath) === 0) {
    url.pathname = url.pathname.slice(basePath.length) || '/';
  }
  if (lib.commonRoutes(req, res, url)) return;

  accessLog.push(req.headers['user-agent'] || '');

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(landingPage(basePath));
  }

  // 취약 지점: name 파라미터를 검증 없이 "불러온다". access 라는 이름을 넣으면
  // 접속 기록(access log) 자체가 "불러와진" 것으로 취급한다.
  if (req.method === 'GET' && url.pathname === '/page') {
    const name = url.searchParams.get('name') || '';
    const cmd = url.searchParams.get('cmd');
    let content;
    if (/access/i.test(name)) {
      content = accessLog.join('\n');
    } else {
      // 방어: PAGES는 일반 객체 리터럴이라 constructor, __proto__ 같은 이름을 요청하면
      // Object 프로토타입의 함수/객체가 조회되어 .indexOf() 호출에서 TypeError가 나 서버가 죽는다.
      content = typeof PAGES[name] === 'string' ? PAGES[name] : '(존재하지 않는 페이지입니다)';
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (content.indexOf(lib.EXEC_MARKER) !== -1 && cmd === 'flag') {
      return res.end(lib.contentPage({ step: '3장 로스팅 · 06', monster: 'ch3-f08.webp', title: 'page?name=' + name, content: FLAG, flag: FLAG, label: '실행 결과', showExecHint: true }));
    }
    return res.end(lib.contentPage({ step: '3장 로스팅 · 06', monster: 'ch3-f08.webp', title: 'page?name=' + name, content: content, label: '불러온 내용', showExecHint: true }));
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
