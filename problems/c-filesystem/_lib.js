// c-filesystem(3장 로스팅, 파일 시스템 취약점) 10문제 공용 헬퍼.
// D단계(d-auth-session)와 같은 철학: 의존성 없이 Node 내장 모듈만 사용한다.
// 단, 이 장은 파일 업로드·압축 해제처럼 코드량이 많은 파싱이 여러 문제에서
// 반복되기 때문에, 이 파일에서만 공용 헬퍼를 모아 각 server.js에서 가져다 쓴다.
'use strict';
const fs = require('fs');
const path = require('path');

const SHARED_CSS = path.join(__dirname, 'shared.css');
const BG_IMG = path.join(__dirname, 'assets', 'title-bg.webp');

// 실제로 서버 명령을 실행하지 않는다. 대신 "이 내용이 포함된 파일이 실행 가능한
// 위치에서 실행 조건을 만족하며 호출되면, 그 결과로 flag.txt를 출력했다"는
// 상황을 안전하게 흉내 낸다 (실제 system() 호출 없이 동일한 학습 효과).
const EXEC_MARKER = '<<EXEC>>';

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  raw.split(';').forEach(function (p) {
    const i = p.indexOf('=');
    if (i < 0) return;
    out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function parseUrlEncodedBody(req, cb) {
  let data = '';
  req.on('data', function (c) { data += c; });
  req.on('end', function () {
    const out = {};
    data.split('&').forEach(function (p) {
      const i = p.indexOf('=');
      if (i < 0) return;
      out[decodeURIComponent(p.slice(0, i))] = decodeURIComponent((p.slice(i + 1) || '').replace(/\+/g, ' '));
    });
    cb(out);
  });
}

function splitBuffer(buf, delim) {
  const parts = [];
  let start = 0, idx;
  while ((idx = buf.indexOf(delim, start)) !== -1) {
    if (idx > start) parts.push(buf.slice(start, idx));
    start = idx + delim.length;
  }
  return parts;
}

// multipart/form-data 요청을 파싱한다 (busboy/multer 등 외부 패키지 없이 직접 구현).
function parseMultipart(req, cb) {
  const chunks = [];
  req.on('data', function (c) { chunks.push(c); });
  req.on('end', function () {
    const buf = Buffer.concat(chunks);
    const ct = req.headers['content-type'] || '';
    const m = ct.match(/boundary=(?:"([^"]+)"|([^;]+))/);
    if (!m) return cb({ fields: {}, files: [] });
    const boundary = Buffer.from('--' + (m[1] || m[2]));
    const parts = splitBuffer(buf, boundary);
    const fields = {};
    const files = [];
    parts.forEach(function (partBuf) {
      const sep = partBuf.indexOf('\r\n\r\n');
      if (sep === -1) return;
      const headerStr = partBuf.slice(0, sep).toString('utf8');
      let body = partBuf.slice(sep + 4);
      if (body.slice(-2).toString('latin1') === '\r\n') body = body.slice(0, -2);
      const nameMatch = headerStr.match(/name="([^"]*)"/);
      const filenameMatch = headerStr.match(/filename="([^"]*)"/);
      const ctMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
      if (filenameMatch && filenameMatch[1]) {
        files.push({
          field: nameMatch ? nameMatch[1] : '',
          filename: filenameMatch[1],
          contentType: ctMatch ? ctMatch[1].trim() : '',
          data: body
        });
      } else if (nameMatch) {
        fields[nameMatch[1]] = body.toString('utf8');
      }
    });
    cb({ fields: fields, files: files });
  });
}

// 압축파일(zip) 대신 쓰는 단순 텍스트 "묶음 파일" 포맷.
// #ENTRY <경로>  : 그 경로에 뒤따르는 내용을 담은 파일 하나
// #LINK <이름> -> <대상경로> : 이름이 대상경로를 가리키는 지름길(심볼릭 링크)
// #END : 묶음 끝
function parseBundle(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  let current = null;
  lines.forEach(function (line) {
    if (line.indexOf('#ENTRY ') === 0) {
      if (current) entries.push(current);
      current = { type: 'FILE', name: line.slice(7).trim(), content: '' };
    } else if (line.indexOf('#LINK ') === 0) {
      if (current) entries.push(current);
      current = null;
      const mm = line.slice(6).match(/^(.*?)\s*->\s*(.*)$/);
      if (mm) entries.push({ type: 'LINK', name: mm[1].trim(), target: mm[2].trim() });
    } else if (line.indexOf('#END') === 0) {
      if (current) entries.push(current);
      current = null;
    } else if (current && current.type === 'FILE') {
      current.content += (current.content ? '\n' : '') + line;
    }
  });
  if (current) entries.push(current);
  return entries;
}

function serveAsset(res, filePath, contentType) {
  fs.readFile(filePath, function (err, buf) {
    if (err) { res.writeHead(404); return res.end(''); }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(buf);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function page(opts) {
  // opts: { title, step, monster(ex: 'ch3-f03.webp'), inner, showExecHint(선택, 기본 false) }
  // showExecHint가 true인 문제(<<EXEC>> 실행 표식을 실제로 쓰는 문제)에서만 아래 QA 힌트 주석을 노출한다.
  return '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">' +
    (opts.showExecHint ? '<!-- TODO(QA팀): 로컬 실행 테스트용 표식 <<EXEC>> 가 아직 제거되지 않음. 배포 전 삭제 필요. -->' : '') +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + escapeHtml(opts.title) + ' — KLOAD</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=Jua&family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;700&display=swap" rel="stylesheet">' +
    '<link rel="stylesheet" href="/shared.css"></head><body><div class="wrap">' +
    '<div class="hud"><span class="logo">KLOAD</span><span class="step">' + opts.step + '</span></div>' +
    '<div class="card">' +
    '<div class="monster"><img src="/assets/' + opts.monster + '" alt="생두 몬스터"></div>' +
    '<div class="inner">' + opts.inner + '</div></div>' +
    '</div></body></html>';
}

function commonRoutes(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/shared.css') {
    serveAsset(res, SHARED_CSS, 'text/css; charset=utf-8');
    return true;
  }
  if (req.method === 'GET' && url.pathname === '/assets/title-bg.webp') {
    serveAsset(res, BG_IMG, 'image/webp');
    return true;
  }
  const am = url.pathname.match(/^\/assets\/(ch3-f\d\d\.webp)$/);
  if (req.method === 'GET' && am) {
    serveAsset(res, path.join(__dirname, 'assets', am[1]), 'image/webp');
    return true;
  }
  return false;
}

// 원시 텍스트 응답(파일 내용, 실행 결과 등)을 게임 디자인으로 감싸는 공용 헬퍼.
// opts: { step, monster, title, content, flag(선택), label(선택) }
function contentPage(opts) {
  let body = opts.content;
  const isFlag = !!(opts.flag && body.indexOf(opts.flag) !== -1);
  if (isFlag) body = body.split(opts.flag).join('<span class="flag-chip">' + opts.flag + '</span>');
  return page({
    title: opts.title,
    step: opts.step,
    monster: opts.monster,
    showExecHint: opts.showExecHint,
    inner: '<h1>' + escapeHtml(opts.title) + '</h1><div class="panel' + (isFlag ? ' open' : ' raw') +
      '"><strong>' + (opts.label || '내용') + '</strong><p style="white-space:pre-wrap">' + body + '</p></div>'
  });
}

module.exports = {
  EXEC_MARKER: EXEC_MARKER,
  escapeHtml: escapeHtml,
  parseCookies: parseCookies,
  parseUrlEncodedBody: parseUrlEncodedBody,
  parseMultipart: parseMultipart,
  parseBundle: parseBundle,
  page: page,
  contentPage: contentPage,
  commonRoutes: commonRoutes,
  serveAsset: serveAsset
};
