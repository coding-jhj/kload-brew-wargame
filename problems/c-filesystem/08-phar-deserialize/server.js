// C단계 8번 문제 — 압축 안에 숨은 객체 (phar 역직렬화와 같은 원리)
// 업로드한 "객체 묶음" 파일은, 평범한 파일 확인(존재 여부 확인) 요청만
// 들어와도 내부적으로 자동으로 "역직렬화"되어 그 안에 적힌 클래스가 즉시
// 동작한다고 가정한다(PHP unserialize + phar 스트림 체이닝과 같은 원리를
// 단순화한 시뮬레이션).
// 통합 서버에서는 basePath(/ch3/08)를 떼어낸 뒤 라우팅한다.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const lib = require('../_lib.js');

const PORT = 3008;
const FLAG = 'ROAST{ch3_08_phar_deserialize}';
const OBJECTS_DIR = path.join(__dirname, 'objects');
fs.mkdirSync(OBJECTS_DIR, { recursive: true });
const DANGEROUS_CLASS = 'LogCleaner'; // "소멸자"가 자동으로 flag 파일을 출력한다고 가정하는 클래스

function landingPage(basePath, msg) {
  return lib.page({
    title: '객체 묶음 업로드',
    step: '3장 로스팅 · 08',
    monster: 'ch3-f10.webp',
    inner:
      '<!-- dev note: LogCleaner 클래스의 소멸자가 역직렬화 시 자동 실행되는 문제, 아직 패치 못 함. -->' +
      '<h1>객체 묶음 업로드</h1>' +
      '<p class="lead">업로드한 파일은 <code>' + basePath + '/check-object?name=파일명</code>으로 "존재 확인"만 해도 내부 객체가 자동으로 복원되어 동작합니다.<br>' +
      '형식: <code>#ENTRY object</code> 다음 줄에 <code>CLASS:클래스이름</code>, 마지막은 <code>#END</code>.</p>' +
      (msg ? '<p class="error">' + msg + '</p>' : '') +
      '<form method="POST" action="' + basePath + '/upload-object" enctype="multipart/form-data">' +
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

  if (req.method === 'POST' && url.pathname === '/upload-object') {
    return lib.parseMultipart(req, function (form) {
      const file = form.files[0];
      if (!file) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(landingPage(basePath, '파일을 선택하십시오.'));
      }
      try {
        fs.writeFileSync(path.join(OBJECTS_DIR, path.basename(file.filename)), file.data);
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(landingPage(basePath, '파일 이름에 사용할 수 없는 문자가 있습니다.'));
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(landingPage(basePath, '업로드 완료: ' + lib.escapeHtml(file.filename)));
    });
  }

  // 취약 지점: "존재 확인"처럼 안전해 보이는 요청이, 실제로는 파일 내용을
  // 역직렬화해서 그 안의 클래스를 실행시켜 버린다.
  if (req.method === 'GET' && url.pathname === '/check-object') {
    const name = url.searchParams.get('name') || '';
    const base = path.basename(name);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    // 방어: name이 비어있거나 '.'/'..'이면 path.basename() 결과가 디렉토리 경로
    // 자체가 되어 readFileSync가 EISDIR 예외를 던져 서버가 죽는다. 미리 "파일 없음"으로 처리한다.
    if (base === '' || base === '.' || base === '..') {
      return res.end(lib.contentPage({ step: '3장 로스팅 · 08', monster: 'ch3-f10.webp', title: 'check-object?name=' + name, content: '존재하지 않습니다.' }));
    }
    const fp = path.join(OBJECTS_DIR, base);
    if (!fs.existsSync(fp)) {
      return res.end(lib.contentPage({ step: '3장 로스팅 · 08', monster: 'ch3-f10.webp', title: 'check-object?name=' + name, content: '존재하지 않습니다.' }));
    }
    const entries = lib.parseBundle(fs.readFileSync(fp, 'utf8'));
    const hasDangerous = entries.some(function (e) {
      return e.type === 'FILE' && e.content.indexOf('CLASS:' + DANGEROUS_CLASS) !== -1;
    });
    if (hasDangerous) {
      const msg = '역직렬화됨 — ' + DANGEROUS_CLASS + ' 소멸자 실행됨\n' + FLAG;
      return res.end(lib.contentPage({ step: '3장 로스팅 · 08', monster: 'ch3-f10.webp', title: 'check-object?name=' + name, content: msg, flag: FLAG, label: '실행 결과' }));
    }
    return res.end(lib.contentPage({ step: '3장 로스팅 · 08', monster: 'ch3-f10.webp', title: 'check-object?name=' + name, content: '존재합니다.' }));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}

module.exports = handle;

if (require.main === module) {
  http.createServer(handle).listen(PORT, function () {
    console.log('C8 문제 서버 실행: http://localhost:' + PORT + '/');
  });
}
