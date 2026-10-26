// C단계 10번 문제 — 이미지 처리 프로그램 커맨드 인젝션 (3장·챕터 전체 마지막 문제)
// 업로드된 레시피 사진을 썸네일로 바꿔주는 별도 이미지 처리 프로그램이 있다고
// 가정한다. 그 프로그램이 파일 이름 안의 특정 패턴을 명령어로 착각해 실행하는
// 오래된 취약점을 가지고 있다. 여기까지의 1-9번은 전부 "이 서버 코드 자체"의
// 허점이었다면, 이건 "서버가 믿고 가져다 쓰는 외부 프로그램"까지 공격 범위를
// 넓히는 마무리 문제다.
// 통합 서버에서는 basePath(/ch3/10)를 떼어낸 뒤 라우팅한다.
'use strict';
const http = require('http');
const crypto = require('crypto');
const lib = require('../_lib.js');

const PORT = 3010;
const FLAG = 'ROAST{ch3_10_image_cmd_injection}';
const THUMBNAIL_DELAY_MS = 500;
// 공격 성공 여부를 전역 변수 1개가 아니라 접속자(세션) 쿠키값별로 저장한다.
// 같은 배포 서버를 여러 팀이 공유해도, 한 팀의 성공이 다른 팀에게 새지 않는다.
const thumbnailExploited = new Map(); // c10_session 쿠키값 -> boolean

// 파일명 안에 역따옴표(`)로 감싼 명령어 패턴이 있으면, 썸네일 변환 프로그램이
// 그걸 셸 명령으로 착각해 실행한다고 가정한다.
const CMD_PATTERN = /`([^`]+)`/;

function landingPage(basePath, msg) {
  return lib.page({
    title: '레시피 사진 썸네일 생성',
    step: '3장 로스팅 · 10 (최종)',
    monster: 'ch3-f10.webp',
    inner:
      '<!-- dev note: 이미지 처리 프로그램이 오래된 버전이라 파일 이름 안의 역따옴표(`)로 감싼 부분을 셸 명령으로 착각해 실행하는 문제가 있음(ImageTragick류). 아직 교체 못 함. -->' +
      '<h1>레시피 사진 썸네일 생성</h1>' +
      '<p class="lead">업로드한 사진은 외부 이미지 처리 프로그램이 자동으로 썸네일로 바꿔줍니다. 파일 이름도 그 프로그램에 그대로 전달됩니다.</p>' +
      (msg ? '<p class="error">' + msg + '</p>' : '') +
      '<form method="POST" action="' + basePath + '/upload-photo" enctype="multipart/form-data">' +
      '<input type="file" name="photo">' +
      '<button type="submit" class="btn">업로드</button></form>' +
      '<p class="lead"><a href="' + basePath + '/thumbnail-status">썸네일 처리 상태 확인</a></p>'
  });
}

function handle(req, res, basePath) {
  basePath = basePath || '';
  const url = new URL(req.url, 'http://localhost');
  if (basePath && url.pathname.indexOf(basePath) === 0) {
    url.pathname = url.pathname.slice(basePath.length) || '/';
  }
  if (lib.commonRoutes(req, res, url)) return;

  // 접속자 식별용 쿠키 발급/복원 (세션별 성공 상태 분리를 위해)
  const cookies = lib.parseCookies(req);
  let session = cookies.c10_session;
  let setCookieHeader = null;
  if (!session) {
    session = crypto.randomBytes(12).toString('hex');
    setCookieHeader = 'c10_session=' + session + '; Path=' + (basePath || '/');
  }
  function htmlHeaders() {
    const h = { 'Content-Type': 'text/html; charset=utf-8' };
    if (setCookieHeader) h['Set-Cookie'] = setCookieHeader;
    return h;
  }

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, htmlHeaders());
    return res.end(landingPage(basePath));
  }

  // 취약 지점: 파일 이름이 이미지 처리 프로그램에 그대로 전달되고, 역따옴표로
  // 감싼 부분을 셸 명령으로 착각해 실행한다(ImageTragick류 취약점과 같은 원리).
  if (req.method === 'POST' && url.pathname === '/upload-photo') {
    return lib.parseMultipart(req, function (form) {
      const file = form.files[0];
      if (!file) {
        res.writeHead(200, htmlHeaders());
        return res.end(landingPage(basePath, '파일을 선택하십시오.'));
      }
      const name = file.filename;
      setTimeout(function () {
        if (CMD_PATTERN.test(name)) {
          thumbnailExploited.set(session, true);
        }
      }, THUMBNAIL_DELAY_MS);
      res.writeHead(200, htmlHeaders());
      return res.end(landingPage(basePath, '업로드 완료, 썸네일 생성 중입니다. 잠시 후 상태를 확인하십시오.'));
    });
  }

  if (req.method === 'GET' && url.pathname === '/thumbnail-status') {
    if (thumbnailExploited.get(session)) {
      res.writeHead(200, htmlHeaders());
      return res.end(lib.page({
        title: '썸네일 처리 상태',
        step: '3장 로스팅 · 10 (최종)',
        monster: 'ch3-f10.webp',
        inner: '<h1>썸네일 처리 상태</h1><div class="panel open"><strong>명령 실행됨</strong><p>3장·전체 워게임 최종 봉인번호 <span class="flag-chip">' + FLAG + '</span></p></div>'
      }));
    }
    res.writeHead(200, htmlHeaders());
    return res.end(lib.page({
      title: '썸네일 처리 상태',
      step: '3장 로스팅 · 10 (최종)',
      monster: 'ch3-f10.webp',
      inner: '<h1>썸네일 처리 상태</h1><div class="panel locked"><strong>정상 처리됨</strong><p>특이사항 없음.</p></div>'
    }));
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
