require('dotenv').config();

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const https   = require('https');

const app          = express();
const PORT         = process.env.PORT || 3000;
const DATA_DIR     = path.join(__dirname, 'data');
const LEADS_FILE   = path.join(DATA_DIR, 'leads.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ─── helpers ─── */

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildMessage(lead) {
  const lines = ['🪵 <b>Новая заявка с сайта</b>', ''];

  if (lead.type)    lines.push(`<b>Тип:</b> ${escapeHtml(lead.type)}`);
  if (lead.source)  lines.push(`<b>Источник:</b> ${escapeHtml(lead.source)}`);
  if (lead.name)    lines.push(`<b>Имя:</b> ${escapeHtml(lead.name)}`);
  if (lead.phone)   lines.push(`<b>Телефон:</b> ${escapeHtml(lead.phone)}`);
  if (lead.email)   lines.push(`<b>Email:</b> ${escapeHtml(lead.email)}`);
  if (lead.comment) lines.push(`<b>Комментарий:</b> ${escapeHtml(lead.comment)}`);

  if (Array.isArray(lead.items) && lead.items.length) {
    lines.push('', '<b>Товары:</b>');
    lead.items.forEach(item => {
      const qty   = item.qty   ?? 1;
      const price = item.price ?? '';
      lines.push(`• ${escapeHtml(item.name)} × ${qty}${price ? ' — ' + escapeHtml(price) : ''}`);
    });
  }

  if (lead.total) lines.push('', `<b>Сумма:</b> ${escapeHtml(lead.total)}`);
  if (lead.page)  lines.push('', `<b>Страница:</b> ${escapeHtml(lead.page)}`);

  const ts = lead.createdAt || lead.date || new Date().toISOString();
  lines.push(`<b>Дата:</b> ${escapeHtml(ts)}`);

  return lines.join('\n');
}

function sendTelegramLead(lead) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chat_id:    TELEGRAM_CHAT_ID,
      text:       buildMessage(lead),
      parse_mode: 'HTML',
    });

    const req = https.request({
      hostname: 'api.telegram.org',
      path:     `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(raw);
          if (!result.ok) reject(new Error(result.description || 'Telegram API error'));
          else resolve(result);
        } catch {
          reject(new Error('Invalid Telegram response'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/* ─── routes ─── */

// GET /api/products
app.get('/api/products', (req, res) => {
  try {
    const data = fs.readFileSync(PRODUCTS_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch {
    res.status(500).json({ error: 'Не удалось загрузить товары' });
  }
});

// POST /api/lead
app.post('/api/lead', async (req, res) => {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return res.status(500).json({ success: false, message: 'Telegram не настроен' });
  }

  const lead = {
    id:        Date.now(),
    createdAt: new Date().toISOString(),
    ...req.body,
  };

  // сохраняем в файл (локально)
  try {
    let leads = [];
    if (fs.existsSync(LEADS_FILE)) {
      try { leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8')); } catch { leads = []; }
      if (!Array.isArray(leads)) leads = [];
    }
    leads.push(lead);
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
  } catch (e) {
    console.error('Ошибка записи leads.json:', e.message);
  }

  // отправляем в Telegram
  try {
    await sendTelegramLead(lead);
    return res.json({ success: true, message: 'Заявка отправлена' });
  } catch (err) {
    console.error('Ошибка отправки в Telegram:', err.message);
    return res.status(500).json({ success: false, message: 'Ошибка отправки заявки' });
  }
});

// catch-all → index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  const tgOk = TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID;
  console.log(`✓ Сервер запущен: http://localhost:${PORT}`);
  console.log(`  Telegram: ${tgOk ? '✓ настроен' : '✗ не настроен (.env не найден?)'}`);
});
