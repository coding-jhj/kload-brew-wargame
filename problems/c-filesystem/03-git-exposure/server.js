// C단계 3번 문제 — 지워지지 않은 배포 흔적 (.git 노출)
// 배포할 때 .git 폴더까지 그대로 올라가 버렸다. 이 워게임에서는 실제 git
// 명령어 도구 없이도 풀 수 있도록, .git 폴더 자체를 평범한 디렉토리 목록처럼
// 보여준다(실제 git 저장소 복원 없이도 같은 교훈: "지금 안 보인다고 안전한
// 게 아니다"를 배울 수 있다).
// 통합 서버에서는 basePath(/ch3/03)를 떼어낸 뒤 라우팅한다.
'use strict';
const http = require('http');
const lib = require('../_lib.js');

const PORT = 3003;
const FLAG = 'ROAST{ch3_03_git_exposure}';
const GIT_FILES = {
  'HEAD': 'ref: refs/heads/main',
  'config': '[core]\n\trepositoryformatversion = 0\n\tbare = false',
  'logs': '(디렉토리) → <a href="/.git/logs/">/.git/logs/</a>'
};
const LOG_FILES = {
  'old-recipe-flag.txt.orig': '지난 배포에서 삭제된 줄 알았던 파일입니다.\n' + FLAG
};

function landingPage(basePath) {
  return lib.page({
    title: '로스팅 공장 사이트',
    step: '3장 로스팅 · 03',
    monster: 'ch3-f03.webp',
    inner:
      '<h1>로스팅 공장 사이트</h1>' +
      '<p class="lead">배포 스크립트가 소스 폴더를 통째로 복사했다는 소문이 있습니다. 혹시 지워졌어야 할 폴더가 남아있지 않을까요.</p>' +
      '<div class="panel raw"><strong>힌트</strong><p><a href="' + basePath + '/.git/">' + basePath + '/.git/</a> 경로를 확인해 보십시오.</p></div>'
  });
}

function listing(title, files, hrefPrefix) {
  const rows = Object.keys(files).map(function (name) {
    const href = hrefPrefix + name + (name === 'logs' ? '/' : ''); // logs는 하위 폴더라 끝에 슬래시가 필요함
    return '<li><a href="' + href + '">' + name + '</a></li>';
  }).join('');
  return lib.page({
    title: title,
    step: '3장 로스팅 · 03',
    monster: 'ch3-f03.webp',
    inner: '<h1>' + title + '</h1><div class="panel raw"><strong>폴더 목록</strong><ul class="file-list">' + rows + '</ul></div>'
  });
}

function fileViewPage(name, content) {
  const isFlag = content.indexOf(FLAG) !== -1;
  const body = isFlag
    ? content.replace(FLAG, '<span class="flag-chip">' + FLAG + '</span>')
    : content;
  return lib.page({
    title: name,
    step: '3장 로스팅 · 03',
    monster: 'ch3-f03.webp',
    inner:
      '<h1>' + name + '</h1>' +
      '<div class="panel' + (isFlag ? ' open' : ' raw') + '"><strong>파일 내용</strong><p style="white-space:pre-wrap">' + body + '</p></div>'
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

  if (req.method === 'GET' && url.pathname === '/.git/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(listing('Index of /.git/', GIT_FILES, basePath + '/.git/'));
  }

  if (req.method === 'GET' && url.pathname === '/.git/logs/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(listing('Index of /.git/logs/', LOG_FILES, basePath + '/.git/logs/'));
  }

  // 방어: GIT_FILES/LOG_FILES는 일반 객체 리터럴이라 constructor, __proto__,
  // toString 같은 이름을 요청하면 Object 프로토타입의 함수/객체가 조회되어
  // fileViewPage의 content.indexOf(...) 호출에서 TypeError가 나 서버가 죽는다.
  // 조회값이 실제 문자열일 때만 사용한다.
  const gm = url.pathname.match(/^\/\.git\/([a-zA-Z0-9_.-]+)$/);
  if (req.method === 'GET' && gm && gm[1] !== 'logs' && typeof GIT_FILES[gm[1]] === 'string') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fileViewPage(gm[1], GIT_FILES[gm[1]]));
  }

  const lm = url.pathname.match(/^\/\.git\/logs\/([a-zA-Z0-9_.-]+)$/);
  if (req.method === 'GET' && lm && typeof LOG_FILES[lm[1]] === 'string') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fileViewPage(lm[1], LOG_FILES[lm[1]]));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(handle).listen(PORT, function () {
    console.log('C3 문제 서버 실행: http://localhost:' + PORT + '/');
  });
}
