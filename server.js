const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 완전 해제
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['*']
}));

// 정적 파일 서빙 (웹앱)
app.use(express.static('.'));

// Notion API 프록시
app.use('/api/notion', createProxyMiddleware({
  target: 'https://api.notion.com/v1',
  changeOrigin: true,
  pathRewrite: {
    '^/api/notion': ''
  },
  onProxyReq: (proxyReq, req, res) => {
    // 모든 헤더 그대로 전달
    if (req.headers.authorization) {
      proxyReq.setHeader('Authorization', req.headers.authorization);
    }
    proxyReq.setHeader('Notion-Version', '2022-06-28');
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy error' });
  }
}));

// 메인 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Access: http://localhost:${PORT}`);
});