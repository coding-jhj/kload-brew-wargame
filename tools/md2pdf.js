'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s) {
  s = escapeHtml(s);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return s;
}

function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  let html = '';
  let i = 0;
  let inList = false;
  let inCode = false;
  let codeBuf = [];

  function closeList() {
    if (inList) { html += '</ol>\n'; inList = false; }
  }

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (!inCode) { inCode = true; codeBuf = []; }
      else {
        closeList();
        html += '<pre><code>' + escapeHtml(codeBuf.join('\n')) + '</code></pre>\n';
        inCode = false;
      }
      i++; continue;
    }
    if (inCode) { codeBuf.push(line); i++; continue; }

    if (/^#\s+/.test(line)) { closeList(); html += '<h1>' + inline(line.replace(/^#\s+/, '')) + '</h1>\n'; i++; continue; }
    if (/^##\s+/.test(line)) { closeList(); html += '<h2>' + inline(line.replace(/^##\s+/, '')) + '</h2>\n'; i++; continue; }
    if (/^###\s+/.test(line)) { closeList(); html += '<h3>' + inline(line.replace(/^###\s+/, '')) + '</h3>\n'; i++; continue; }

    if (/^\|.*\|\s*$/.test(line)) {
      closeList();
      const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) {
        if (!/^\|[\s:|-]+\|\s*$/.test(lines[i])) {
          const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
          rows.push(cells);
        }
        i++;
      }
      if (rows.length) {
        html += '<table><thead><tr>' + rows[0].map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>';
        for (let r = 1; r < rows.length; r++) {
          html += '<tr>' + rows[r].map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>';
        }
        html += '</tbody></table>\n';
      }
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      if (!inList) { html += '<ol>\n'; inList = true; }
      html += '<li>' + inline(line.replace(/^\d+\.\s+/, '')) + '</li>\n';
      i++; continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!inList) { html += '<ol class="bullet">\n'; inList = true; }
      html += '<li>' + inline(line.replace(/^[-*]\s+/, '')) + '</li>\n';
      i++; continue;
    }

    closeList();
    if (line.trim() === '') { i++; continue; }
    if (line.trim() === '---') { html += '<hr>\n'; i++; continue; }
    html += '<p>' + inline(line) + '</p>\n';
    i++;
  }
  closeList();
  return html;
}

const TEMPLATE = (title, bodyHtml) => `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=Noto+Sans+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
  @page { margin: 22mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Noto Sans KR', sans-serif;
    color: #2A1A10;
    line-height: 1.7;
    font-size: 11.5pt;
  }
  h1 {
    font-size: 20pt;
    color: #8A4B12;
    border-bottom: 3px solid #E08A2B;
    padding-bottom: 8px;
    margin-top: 0;
  }
  h2 {
    font-size: 14.5pt;
    color: #B5651D;
    background: #FFF4DA;
    border-left: 6px solid #E08A2B;
    padding: 6px 12px;
    margin-top: 28px;
  }
  h3 {
    font-size: 12.5pt;
    color: #8A4B12;
    margin-top: 18px;
  }
  p { margin: 6px 0; }
  code {
    font-family: 'Noto Sans Mono', monospace;
    background: #F3E7D3;
    color: #7A2E0E;
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 10pt;
  }
  pre {
    background: #2A1A10;
    color: #FFE9B8;
    padding: 9px 12px;
    border-radius: 8px;
    font-size: 8.7pt;
    line-height: 1.5;
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }
  pre code { background: none; color: inherit; padding: 0; white-space: pre-wrap; overflow-wrap: break-word; }
  code { overflow-wrap: break-word; }
  ol { padding-left: 22px; margin: 8px 0; }
  ol.bullet { list-style-type: disc; }
  li { margin: 3px 0; }
  strong { color: #8A4B12; }
  hr { border: none; border-top: 1px solid #E8D8BC; margin: 24px 0; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0 16px; font-size: 10pt; }
  th, td { border: 1px solid #E0C89A; padding: 5px 9px; text-align: left; vertical-align: top; }
  th { background: #F3E0B8; color: #6B3A0E; }
  tbody tr:nth-child(even) { background: #FFFBF2; }
  td code, th code { font-size: 9pt; }
</style></head>
<body>${bodyHtml}</body></html>`;

async function main() {
  const jobs = [
    { md: process.argv[2], out: process.argv[3], title: process.argv[4] || 'Document' }
  ];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const job of jobs) {
    const md = fs.readFileSync(job.md, 'utf8');
    const html = TEMPLATE(job.title, mdToHtml(md));
    const tmpHtml = job.out.replace(/\.pdf$/, '.html');
    fs.writeFileSync(tmpHtml, html, 'utf8');
    await page.goto('file:///' + tmpHtml.replace(/\\/g, '/'));
    await page.waitForTimeout(500);
    await page.pdf({ path: job.out, format: 'A4', printBackground: true });
    console.log('written: ' + job.out);
  }
  await browser.close();
}

main();
