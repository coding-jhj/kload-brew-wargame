/*
 * 게임 데이터
 * - 장 4개, 장마다 몬스터 HP 10 = 문제 10개
 * - 문제 내용은 아직 미정이라 빈 슬롯으로 둔다.
 * - flagHash 가 null 인 문제는 테스트 플래그(test)로 통과한다.
 * - 실제 플래그 해시: node -e "console.log(require('crypto').createHash('sha256').update('플래그').digest('hex'))"
 */
window.GAME_DATA = {
  brand: 'KLOAD',
  maxHp: 10,
  testFlagHash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', // "test"

  chapters: [
    {
      id: 1,
      name: '커피나무',
      goal: '길을 따라 올라가며 숲의 수호자에게서 열매를 빼앗아 보세요',
      monster: '숲의 수호자',
      art: 'tree',
      portrait: 'assets/ch1-portrait.webp',
      intro: '숲의 수호자 커피나무가 나타났다!',
      hitLine: '나무에 칼집이 하나 늘었다.',
      clearLine: '커피나무가 쓰러지며 열매를 떨어뜨렸다!'
    },
    {
      id: 2,
      name: '열매 군단',
      goal: '열매 군단 10명을 한 명씩 물리쳐 생두를 얻어 보세요',
      monster: '커피 열매 군단',
      art: 'berries',
      intro: '커피 열매 군단이 길을 막아섰다!',
      hitLine: '열매 병사 하나가 쓰러졌다.',
      clearLine: '열매 군단을 물리치고 생두를 얻었다!'
    },
    {
      id: 3,
      name: '로스팅',
      goal: '불을 키워 생두를 노릇한 원두로 볶아 보세요',
      monster: '불판 위의 생두',
      art: 'greenbean',
      intro: '생두가 불판 위에서 버티고 있다!',
      hitLine: '불길이 한층 더 거세졌다.',
      clearLine: '생두가 노릇하게 볶아져 원두가 되었다!'
    },
    {
      id: 4,
      name: '추출',
      goal: '원두를 새까맣게 물들여 커피로 만들어 보세요',
      monster: '고집 센 원두',
      art: 'roastbean',
      intro: '원두가 마지막으로 저항한다!',
      hitLine: '원두가 더 검게 물들었다.',
      clearLine: '원두가 새까만 커피로 변했다!'
    }
  ],

  // 장별 문제 슬롯. 1장·2장은 문제 내용이 아직 미정이라 10개 빈 슬롯으로 둔다.
  // 3장(로스팅)·4장(추출)은 환주님 담당 문제가 재번호화를 거쳐 10문제씩(장당 HP 10과
  // 같은 개수로) 채워져 있다. url 에 http(s) 주소를 넣으면 '문제보기' 창 안에 문제
  // 페이지가 열린다.
  // 문제 서버는 프론트엔드와 같은 서버(루트 server.js)에서 돈다. 그래서 url 은 현재 페이지의
  // origin 을 기준으로 만든다. game.js 는 http(s) 주소만 iframe 에 띄우므로 상대 경로 대신
  // 절대 주소를 만든다. index.html 을 file:// 로 직접 열었을 때는 origin 이 http(s) 가 아니므로
  // 로컬에서 `node server.js` 로 띄운 기본 주소(http://localhost:3000)를 쓴다.
  problems: (function () {
    var BASE = (location.protocol === 'http:' || location.protocol === 'https:')
      ? location.origin
      : 'http://localhost:3000';

    function emptySlots(ch, count) {
      var list = [];
      for (var i = 1; i <= count; i++) {
        list.push({ ch: ch, no: i, title: '', desc: '', url: '', flagHash: null });
      }
      return list;
    }

    return [
      emptySlots(1, 10),
      emptySlots(2, 10),
      [
        { ch: 3, no: 1, title: '잠기지 않은 납품 창고', desc: '로스팅 공장 뒤편 납품 창고 문이 열려 있어서, 안에 쌓인 서류함을 그대로 들여다볼 수 있을 듯합니다.', url: BASE + '/ch3/01/', flagHash: '1c9af6029c8918bc8257df1e634c0423109d252614dba0c900b39133032ea102' },
        { ch: 3, no: 2, title: '뒤엉킨 레시피 서랍', desc: '레시피를 한 장씩 꺼내 주는 창구인데, 서랍 안쪽이 생각보다 더 깊이 이어져 있는 느낌이 듭니다.', url: BASE + '/ch3/02/', flagHash: 'ac2713df5085df0e9dec65b394c6fc8f57585f6d7b338c92436e3ef1e35f6004' },
        { ch: 3, no: 3, title: '지우지 못한 공사 흔적', desc: '설비를 고치고 간 자리에, 작업 기록이 적힌 낡은 수첩이 치워지지 않고 그대로 남아 있습니다.', url: BASE + '/ch3/03/', flagHash: '14ef5f948bc1ef77202f5ce16872d683615faf200c23cf60707e07c3fec8dfb4' },
        { ch: 3, no: 4, title: '누군가 흘린 비밀 쪽지', desc: '공장 설정을 적어 둔 쪽지 한 장이 보이지 않아야 할 자리에 그대로 놓여 있는 듯합니다.', url: BASE + '/ch3/04/', flagHash: '447dcfbd97fe96a0b66302a179cf29c725f7dde27f702fbfc3a6b60a981f62fd' },
        { ch: 3, no: 5, title: '사진인 척하는 납품물', desc: '사진만 받는 입고 창구가 이름과 포장만 사진처럼 꾸민 납품물까지는 가려내지 못하는 모양입니다.', url: BASE + '/ch3/05/', flagHash: 'c8558404f4b5f463c2a143c0798639d018edb71f1d3e037f51bfb5a7a26596ba' },
        { ch: 3, no: 6, title: '방문자 명부에 남긴 손글씨', desc: '공장 방문자 명부는 누구나 한 줄을 남길 수 있는데, 그 명부를 그대로 다시 불러와 보여주는 창구도 따로 있습니다.', url: BASE + '/ch3/06/', flagHash: 'cf8b3adfa1b7e97cf9de0fc5b0a6a98ff77e3c6b02facb7b28de7dc0cc56770b' },
        { ch: 3, no: 7, title: '묶음 보따리 뒤편의 통로', desc: '레시피 묶음 보따리를 풀어 주는 창구 뒤편에 평소에는 없던 통로가 하나 생겨날 수도 있다고 합니다.', url: BASE + '/ch3/07/', flagHash: '2918a34a9d48f9700b558b5e4546de9c8ccb001064424f76ffc39b2381ed4ce0' },
        { ch: 3, no: 8, title: '열어 보기만 해도 깨어나는 보따리', desc: '묶음 보따리 안의 이름표 하나가, 단순히 있는지 확인만 하는 순간에도 저절로 움직이기 시작한다는 소문이 있습니다.', url: BASE + '/ch3/08/', flagHash: '25a2e7b221696f3982edd6a0e19e8422804194698671dd9c4212643bacea8368' },
        { ch: 3, no: 9, title: '검수와 폐기 사이의 틈', desc: '입고된 물건은 결국 위험 판정을 받아 치워지지만, 검수가 끝나고 치워지기까지 아주 짧은 틈이 있다고 합니다.', url: BASE + '/ch3/09/', flagHash: 'c8746d2ced555acf688bc2eef9e849aa4f8562ee015b4baf40f8f701d033a983' },
        { ch: 3, no: 10, title: '현상소로 넘어간 수상한 이름표', desc: '입고된 사진은 공장 바깥 현상소로 넘겨져 자동으로 인화되는데, 그 현상소가 사진 이름표를 지나치게 곧이곧대로 읽는다는 소문이 있습니다. 이 문제를 풀면 3장 로스팅의 마지막 봉인이 풀립니다.', url: BASE + '/ch3/10/', flagHash: '83242cda6f59f1232526c65a0d28dbda4bc3bc57671edb65e4a50453431371bd' }
      ],
      [
        { ch: 4, no: 1, title: '덜 볶인 척하는 시치미', desc: '추출실 앞을 지키는 원두 몬스터가 아직 덜 볶였다고 우기고 있는데, 정말로 그런지는 직접 확인해 보아야 알 듯합니다.', url: BASE + '/ch4/01/', flagHash: '69433cf04b35c4cc235d4a2fef827d0d3900dc97dd24b834e2d272036d2ecc2f' },
        { ch: 4, no: 2, title: '번호표만 다른 배치 기록', desc: '내 배치 기록으로 가는 길과 다른 배치 기록으로 가는 길이 번호표 하나만 다를 뿐 똑같이 열려 있는 듯합니다.', url: BASE + '/ch4/02/', flagHash: '8be00d614042a319a5691aeaf898b6fcd77376bef7b7d2ef01145caece03539c' },
        { ch: 4, no: 3, title: '건너뛸 수 있을 것 같은 결재란', desc: '핵심 배치를 폐기하려면 1차 검토와 2차 승인을 순서대로 거쳐야 하는데, 중간 한 칸을 그냥 지나쳐도 되는지는 아직 확인되지 않았습니다.', url: BASE + '/ch4/03/', flagHash: 'a2dc491eb791c47b018d0f6e2ea79e7dc33f1d68eccaa32d46fa0393d3d54ce4' },
        { ch: 4, no: 4, title: '둥지 봉인 요청이 새어 나간다는 소문', desc: '둥지를 봉인하는 요청은 로그인한 사람의 것이면 무엇이든 받아 준다는데, 그 요청을 반드시 공장 안에서 눌러야만 하는지는 의문입니다.', url: BASE + '/ch4/04/', flagHash: 'd3d93574ae54204126b7b220732106618f75b7257bd7b046940949bfeaa82426' },
        { ch: 4, no: 5, title: '몇 번을 틀려도 잠기지 않는 보안 코드', desc: '창고를 긴급 개방하는 네 자리 보안 코드를 아무리 여러 번 틀려도 경고도 잠금도 걸리지 않는 듯합니다.', url: BASE + '/ch4/05/', flagHash: '67ee2f2d0741340d855c7b5339822d3f23f85ffe9f6e80643f16e95983b0e7a6' },
        { ch: 4, no: 6, title: '로그아웃해도 살아 있는 출입증', desc: '분명히 로그아웃했는데도 조금 전까지 쓰던 출입증을 다시 들이대면 문이 열릴지도 모릅니다.', url: BASE + '/ch4/06/login', flagHash: '4ee0b66849c5c55d76f80254f30634097669e73598ffebfef7edecf64d9c12a0' },
        { ch: 4, no: 7, title: '들어오지 말라고 적힌 안내판', desc: '유지보수 포털 한쪽에 들어오지 말라고만 적힌 안내판이 있는데, 그 안내판이 오히려 무언가 있다는 표시처럼 보입니다.', url: BASE + '/ch4/07/', flagHash: 'e9fcca22118b00071283d9b8811ccd21b0065ce9620bf068d5d10cad47b2fd37' },
        { ch: 4, no: 8, title: '공개된 열쇠로도 흉내 낼 수 있다는 서명', desc: '제어실 전체 통제 열람증은 공개된 열쇠와 비밀 열쇠가 따로 있는 방식으로 서명되는데, 공개된 열쇠 하나만으로도 서명을 흉내 낼 방법이 있다는 소문이 있습니다.', url: BASE + '/ch4/08/', flagHash: 'a8d5bf6745dc6d54f58e29576e9961209e4a2b98db23491c9fc651ad4a5a0a50' },
        { ch: 4, no: 9, title: '확인 없이 연동되는 제휴 계정', desc: '제휴 계정 연동 콜백이 위조 방지용 확인값을 내어주긴 하지만, 그 값이 실제로 맞는지는 아무도 확인하지 않는 듯합니다.', url: BASE + '/ch4/09/', flagHash: '5954f4c221aa9ddfb7c4bfeb5af96c871ba1d490bdaf940aa60ff1b8f04d2242' },
        { ch: 4, no: 10, title: '2단계를 건너뛰어도 열리는 최종 제어실', desc: '보안 코드를 입력하는 2단계 화면은 분명히 있지만, 그 화면을 거치지 않고 최종 제어실 주소로 바로 들어가도 막히지 않을지도 모릅니다. 이 문제를 풀면 4장 추출, 그리고 전체 워게임의 마지막 봉인이 풀립니다.', url: BASE + '/ch4/10/login', flagHash: '0607cf34f3f86b6eda51ed4551741d249d063c3b8714ab40eecb7e7ae80380df' }
      ]
    ];
  })()
};
