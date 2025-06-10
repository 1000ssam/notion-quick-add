export default function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Notion API 프록시
  const notionUrl = `https://api.notion.com/v1${req.url.replace('/api/notion', '')}`;
  
  const proxyRequest = async () => {
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
    res.status(response.status).json(data);
  };
  
  proxyRequest().catch(err => {
    res.status(500).json({ error: err.message });
  });
}