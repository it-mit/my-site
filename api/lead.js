const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

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

  if (lead.total) {
    lines.push('', `<b>Сумма:</b> ${escapeHtml(lead.total)}`);
  }

  if (lead.page) {
    lines.push('', `<b>Страница:</b> ${escapeHtml(lead.page)}`);
  }

  const ts = lead.createdAt || lead.date || new Date().toISOString();
  lines.push(`<b>Дата:</b> ${escapeHtml(ts)}`);

  return lines.join('\n');
}

async function sendTelegramLead(lead) {
  const url  = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body = JSON.stringify({
    chat_id:    TELEGRAM_CHAT_ID,
    text:       buildMessage(lead),
    parse_mode: 'HTML',
  });

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  const result = await res.json();

  if (!result.ok) {
    throw new Error(result.description || 'Telegram API error');
  }

  return result;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return res.status(500).json({ success: false, message: 'Telegram не настроен' });
  }

  const lead = {
    createdAt: new Date().toISOString(),
    ...req.body,
  };

  try {
    await sendTelegramLead(lead);
    return res.json({ success: true, message: 'Заявка отправлена' });
  } catch (err) {
    console.error('Ошибка отправки в Telegram:', err.message);
    return res.status(500).json({ success: false, message: 'Ошибка отправки заявки' });
  }
};
