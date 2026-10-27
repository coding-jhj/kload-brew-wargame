# SQL Injection — OWASP 공식 기준

출처 (2026-10-27 확인, 공식 사이트 원문 직접 대조):
- https://top10.owasp.org/2025/A05_2025-Injection/
- https://api-security.owasp.org/

**분류 위치**: OWASP Top 10:2025의 **A05 Injection** 카테고리 안에 있습니다. 2021판에서는 A03이었는데, 2025판에서 A03 to A05로 순위가 내려갔습니다 (원문: "Injection falls two spots from #3 to #5"). SQL Injection에 해당하는 CWE는 **CWE-89**(일반 SQL 인젝션)와 **CWE-564**(Hibernate 같은 ORM 환경에서의 SQL 인젝션) 두 개입니다.

> 주의: OWASP 공식 문서는 SQL Injection을 "classic/union-based/blind" 같은 세부 기법으로 나누지 않습니다. CWE 이름 두 개만 명시합니다. 아래 기법별 분류는 보안 실무에서 널리 쓰는 분류 체계이며, OWASP 문서 자체의 하위 항목이 아님을 밝혀둡니다.

**개념**: SQL Injection은 사용자가 입력한 값이 SQL 질의문(데이터베이스에 보내는 명령)의 일부로 그대로 섞여 들어가서, 공격자가 원래 의도하지 않은 SQL 명령을 실행시키는 공격입니다. 예를 들어 서버 코드가 `"SELECT * FROM users WHERE id = '" + 입력값 + "'"` 처럼 문자열을 그냥 이어붙이면, 입력값 안에 SQL 문법을 넣어서 질의문 자체를 바꿀 수 있습니다.

---

## 1. Union-based (Classic) SQL Injection — 난이도 하

**개념**: SQL의 `UNION SELECT` 구문을 이용해서, 원래 질의가 보여주는 결과에 공격자가 원하는 다른 테이블의 데이터를 이어붙여 화면에 출력시키는 기법입니다. 화면에 질의 결과가 그대로 보이는 경우에 씁니다.

**흐름**: 정상 사용자는 상품 검색창에 상품명을 입력합니다. 공격자는 상품명 자리에 SQL 문법을 넣어서, 원래 상품 목록 대신 사용자 테이블의 아이디·비밀번호를 같은 화면에 출력시킵니다.

**명령어 예시**:
```
먼저 컬럼 개수 확인: ' ORDER BY 1-- , ' ORDER BY 2-- , ... (에러가 나는 지점에서 컬럼 수 확정)
그 다음: ' UNION SELECT username, password, 3 FROM users-- -
```
검색창에 `' UNION SELECT username, password, 3 FROM users-- -` 를 그대로 입력합니다.

---

## 2. Error-based SQL Injection — 난이도 하

**개념**: 질의문에 일부러 문법 오류를 일으켜서, 서버가 돌려주는 에러 메시지 안에 데이터베이스 구조나 데이터 일부가 노출되게 만드는 기법입니다.

**흐름**: 공격자가 의도적으로 잘못된 SQL 문법을 입력창에 넣으면, 서버가 "에러 숨김 처리"를 제대로 안 했을 경우 에러 메시지에 테이블 이름, 컬럼 이름까지 그대로 나옵니다.

**명령어 예시** (MySQL 기준):
```
' AND extractvalue(1, concat(0x7e, (SELECT password FROM users LIMIT 1)))-- -
```
`extractvalue` 함수가 일부러 깨지면서 에러 메시지 안에 비밀번호 값이 섞여 나옵니다.

---

## 3. Blind SQL Injection — Boolean 기반 — 난이도 중

**개념**: 화면에 질의 결과나 에러 메시지가 전혀 안 보이지만, 조건이 참인지 거짓인지에 따라 화면 내용이 조금이라도 달라지는 경우(예: "검색 결과 있음" vs "없음")를 이용해서 한 글자씩 데이터를 알아내는 기법입니다.

**흐름**: 공격자가 참/거짓 조건을 담은 질의를 반복해서 보내며, 화면 반응의 차이만으로 데이터베이스 안의 값을 한 글자씩 추측해냅니다.

**명령어 예시**:
```
' AND SUBSTRING((SELECT password FROM users LIMIT 1), 1, 1) = 'a'-- -
```
이 요청의 화면 반응이 평소와 같으면 비밀번호 첫 글자가 `a`라는 뜻이고, 다르면 다음 글자(`b`, `c`, ...)로 바꿔서 반복합니다. 보통 도구(sqlmap 등)로 자동화합니다.
```
sqlmap -u "https://target/search?q=테스트" --cookie="session=쿠키" --technique=B
```

---

## 4. Blind SQL Injection — Time-based — 난이도 중

**개념**: 화면 반응 차이가 전혀 없을 때, 조건이 참이면 데이터베이스가 일부러 몇 초간 대기하게 만드는 함수(`SLEEP()` 등)를 써서 "응답 시간이 길어지면 참"이라는 신호로 데이터를 알아내는 기법입니다.

**흐름**: 공격자가 조건을 건 질의에 `SLEEP(5)`를 붙여 보냅니다. 응답이 5초 늦게 오면 조건이 참이라는 뜻입니다.

**명령어 예시**:
```
' AND IF(SUBSTRING((SELECT password FROM users LIMIT 1), 1, 1) = 'a', SLEEP(5), 0)-- -
```
```
sqlmap -u "https://target/search?q=테스트" --cookie="session=쿠키" --technique=T
```

---

## 5. Second-order (Stored) SQL Injection — 난이도 상

**개념**: 악성 입력이 당장 실행되지 않고 일단 데이터베이스에 저장된 뒤, 나중에 **다른 기능**이 그 저장된 값을 가져와서 SQL 질의에 다시 섞어 쓸 때 실행되는 기법입니다. 입력 지점과 실행 지점이 분리돼 있어서 찾기 어렵습니다.

**흐름**: 공격자가 회원가입 시 "이름" 필드에 SQL 페이로드를 넣어 저장합니다. 그 이름 필드는 가입 시에는 안전하게 처리됐지만, 몇 달 뒤 관리자가 "이름으로 검색" 기능에서 그 저장된 이름 값을 다시 SQL 질의에 섞어 쓰는 코드가 있다면 그때 실행됩니다.

**명령어 예시**:
```
회원가입 시 이름 필드: ', (SELECT password FROM users LIMIT 1), '
```
이후 관리자가 "이름으로 검색"을 실행하는 순간 그 값이 질의문에 섞여 실행됩니다. 공격자가 직접 실행 시점을 통제할 수 없어서 난이도가 높습니다.

---

## 6. ORM Injection (Hibernate 등, CWE-564) — 난이도 상

**개념**: ORM(Object-Relational Mapping, 객체와 DB 테이블을 자동으로 연결해주는 도구)을 쓰면 보통 SQL을 직접 안 쓰지만, HQL(Hibernate Query Language) 같은 ORM 전용 질의어도 문자열을 그대로 이어붙이면 똑같이 인젝션이 됩니다. "ORM을 쓰니까 안전하다"는 착각 때문에 실제로 자주 발견됩니다.

**흐름**: 개발자가 `"FROM User WHERE name = '" + 입력값 + "'"` 처럼 HQL을 문자열로 이어붙이면, 일반 SQL Injection과 똑같은 방식으로 공격이 들어갑니다.

**명령어 예시**:
```
이름 입력란에: ' OR '1'='1
```
HQL 질의가 `FROM User WHERE name = '' OR '1'='1'`이 되어 전체 사용자 목록이 반환됩니다.

---

## 참고 — A05 Injection 카테고리의 다른 형제 항목

A05는 SQL Injection 외에도 다음을 포함합니다 (CWE 매핑 37개 중 일부): OS Command Injection(CWE-78), LDAP Injection(CWE-90), XML/XPath Injection(CWE-91, 643), Code/Eval Injection(CWE-94, 95), Expression Language Injection(CWE-917), 그리고 **XSS도 이 A05 카테고리 안에 포함**됩니다 (별도 파일 `03-xss.md` 참고). OWASP 원문: "Injection includes Cross-site Scripting (high frequency, low impact)... and SQL Injection (low frequency, high impact)."
