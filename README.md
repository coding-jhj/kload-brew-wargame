# KLOAD 커피 워게임 — 3장·4장 (파일시스템 / 인증·세션)

가상의 커피 공장 KLOAD BREW를 배경으로 한 웹 해킹 CTF 워게임입니다. 3장 "로스팅"(파일시스템 취약점)과 4장 "추출"(인증/세션 취약점), 두 장에 걸쳐 총 20개 문제로 구성되어 있습니다.

## 폴더 구조

- `wargame/` — 정적 프론트엔드(메인 화면, 전투, 장 지도). `index.html`을 직접 열거나 정적 서버로 서빙합니다.
- `problems/c-filesystem/` — 3장(로스팅) 문제 10개(`01-open-backup` ~ `10-image-cmd-injection`)와 이들을 한 포트로 묶어 제공하는 `combined-server.js`.
- `problems/d-auth-session/` — 4장(추출) 문제 10개(`01-bean-core` ~ `10-2fa-bypass`)와 `combined-server.js`.
- `problems/*/extra-not-in-game/` — 실제 게임 20문제에는 쓰이지 않는 여분 문제.
- `problems/design-guide-3step.md` / `.pdf` — 문제 설계 가이드.
- `tools/` — 풀이집 PDF 변환, 브라우저 자동 검증용 개발 보조 스크립트. 워게임 실행에는 필요 없습니다.
- `render.yaml` — Render Blueprint 배포 설정.

## 로컬 실행

문제 서버는 장별로 따로 띄웁니다.

```bash
cd problems/c-filesystem && node combined-server.js   # 3장, 기본 포트 3000
cd problems/d-auth-session && node combined-server.js # 4장, 기본 포트 4000
```

프론트엔드(`wargame/`)는 `index.html`을 브라우저로 바로 열거나, `npx serve wargame` 같은 정적 서버로 띄우면 됩니다.
