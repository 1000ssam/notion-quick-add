export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    // URL에서 Notion API 경로 추출
    const notionPath = req.url.replace('/api/notion', '');
    const notionUrl = `https://api.notion.com/v1${notionPath}`;
    
    console.log('Proxying to:', notionUrl);
    console.log('Method:', req.method);
    console.log('Headers:', req.headers);
    
    const response = await fetch(notionUrl, {
      method: req.method,
      headers: {
        'Authorization': req.headers.authorization,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });
    
    const data = await response.json();
    
    console.log('Notion response status:', response.status);
    console.log('Notion response:', data);
    
    res.status(response.status).json(data);
    
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
}