const fs   = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const file = path.join(process.cwd(), 'data', 'products.json');
    const data = fs.readFileSync(file, 'utf8');
    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.json(JSON.parse(data));
  } catch {
    return res.status(500).json({ error: 'Не удалось загрузить товары' });
  }
};
