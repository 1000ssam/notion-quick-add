// CORS 우회용 북마클릿 생성기
function createNotionBookmarklet(token, databaseId, title = '새 페이지') {
  const code = `
javascript:(function(){
  const data = {
    parent: { database_id: '${databaseId}' },
    properties: {
      'Name': { title: [{ text: { content: '${title}' } }] }
    }
  };
  
  fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ${token}',
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  }).then(r => r.json()).then(d => {
    if(d.id) alert('✅ 성공!');
    else alert('❌ 실패: ' + JSON.stringify(d));
  });
})();
  `.trim();
  
  return code;
}

// GitHub Pages에서 바로 사용할 수 있는 방법
function addToNotion() {
  const token = localStorage.getItem('notion-token');
  const dbId = localStorage.getItem('notion-db-id');
  
  if (!token || !dbId) {
    alert('설정을 먼저 완료해주세요!');
    return;
  }
  
  const title = prompt('페이지 제목을 입력하세요:') || '새 페이지';
  
  // 북마클릿 코드 생성
  const bookmarkletCode = createNotionBookmarklet(token, dbId, title);
  
  // 북마클릿 실행
  eval(bookmarkletCode.replace('javascript:', ''));
}

// 설정 저장
function saveSettings() {
  const token = document.getElementById('token').value;
  const dbId = document.getElementById('dbId').value;
  
  localStorage.setItem('notion-token', token);
  localStorage.setItem('notion-db-id', dbId);
  
  alert('설정이 저장되었습니다!');
}