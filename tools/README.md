# 개발용 도구 (제출물 아님)

이 폴더는 Claude가 작업하면서 쓴 보조 스크립트입니다. 워게임 문제 자체와는 상관없고, 나중에 다시 검증하거나 풀이집 PDF를 다시 만들 때만 필요합니다.

## 처음 한 번만 설치

```
cd tools
npm init -y
npm install playwright
npx playwright install chromium
```

(Node.js 자체가 없다면 nodejs.org에서 먼저 설치하십시오.)

## md2pdf.js — 풀이집(.md)을 PDF로 변환

```
node md2pdf.js "..\problems\d-auth-session\walkthrough-d.md" "..\problems\d-auth-session\walkthrough-d.pdf" "D단계 풀이집"
```

변환 중간에 같은 이름의 `.html` 파일이 생기는데, PDF만 남기고 지워도 됩니다.

## verify-browser.js — 23개 문제(D8-D15, C1-C15) 전체를 실제 Chromium으로 자동 풀이·검증

```
node verify-browser.js
```

각 문제 서버를 직접 띄우고, 실제 브라우저로 로그인·업로드·쿠키 조작까지 수행해 플래그가 나오는지 확인합니다. `screenshots` 폴더에 주요 화면 캡처도 남습니다. 실행 전에 포트(3001-3015, 4008-4015)를 쓰는 다른 프로그램이 없는지 확인하십시오.
