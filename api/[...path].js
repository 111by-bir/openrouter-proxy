export default async function handler(req, res) {
  // 从动态路由中取出真实路径，例如 ['chat', 'completions']
  const { path } = req.query;
  const fullPath = '/' + (path ? path.join('/') : '');
  const targetUrl = 'https://openrouter.ai/api/v1' + fullPath;

  // 设置允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 转发请求（body 自动解析）
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.authorization || '',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.text();
    res.status(response.status);
    // 转发 OpenRouter 返回的重要头部
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    res.send(data);
  } catch (error) {
    res.status(500).json({ error: 'Proxy Error: ' + error.message });
  }
}
