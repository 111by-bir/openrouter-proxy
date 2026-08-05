export default async function handler(req, res) {
  // 不管 BiuBiu酱 带的是什么路径，全部去掉 /api 前缀，直接接上正确的 OpenRouter 地址
  let cleanPath = req.url.replace(/^\/api(\/v1)?/, '');
  let targetUrl = 'https://openrouter.ai/api/v1' + cleanPath;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization || '',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const reader = response.body.getReader();
    const pump = () => {
      return reader.read().then(({ done, value }) => {
        if (done) { res.end(); return; }
        res.write(value);
        return pump();
      });
    };
    await pump();
  } catch (error) {
    res.status(500).json({ error: 'Proxy Error: ' + error.message });
  }
}
