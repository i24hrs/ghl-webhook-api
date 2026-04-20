const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// ENV VARIABLES (set in Render)
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

// Format date as: YYYY-MM-DD HH:mm:ss
function formatDateTimeForGHL(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Extract time safely
function extractTime(input) {
  let text = input;

  if (typeof input === 'object' && input.body) {
    text = input.body;
  }

  if (typeof text !== 'string') return null;

  const regex = /(tomorrow)?\s*(at)?\s*(\d{1,2})(:\d{2})?\s*(am|pm)/i;
  const match = text.match(regex);

  if (!match) return null;

  let hour = parseInt(match[3], 10);
  const minute = match[4] ? parseInt(match[4].replace(':', ''), 10) : 0;
  const period = match[5].toLowerCase();

  if (period === 'pm' && hour !== 12) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;

  const now = new Date();

  if (match[1]) {
    now.setDate(now.getDate() + 1);
  }

  now.setHours(hour, minute, 0, 0);

  return formatDateTimeForGHL(now);
}

function getRawMessage(input) {
  if (typeof input === 'object' && input.body) {
    return input.body;
  }
  if (typeof input === 'string') {
    return input;
  }
  return '';
}

app.post('/api/extract-callback-time', async (req, res) => {
  try {
    const { message, contact_id } = req.body;

    console.log('Incoming message:', message);

    const extractedTime = extractTime(message);
    const rawMessage = getRawMessage(message);

    await axios.put(
      `https://services.leadconnectorhq.com/contacts/${contact_id}`,
      {
        customFields: [
          {
            id: 'rq_raw_message',
            field_value: rawMessage || ''
          },
          {
            id: 'rq_raw_phrase',
            field_value: rawMessage || ''
          },
          {
            id: 'rq_extracted_time',
            field_value: extractedTime || ''
          },
          {
            id: 'rq_scheduled_call_time',
            field_value: extractedTime || ''
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${GHL_API_KEY}`,
          Version: '2021-07-28',
          'Content-Type': 'application/json'
        }
      }
    );

    return res.json({
      success: true,
      extractedTime
    });
  } catch (error) {
    console.error('ERROR:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});