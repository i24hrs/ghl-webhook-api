'use strict';

const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// 
￼
 PASTE YOUR API KEY HERE
const GHL_API_KEY = 'pit-d6507e9f-e7d6-4d76-bfbe-f6985ccdbdaf';

app.use(express.json());

// --- SIMPLE TIME EXTRACTOR ---
function extractCallbackTime(message) {
  if (!message || typeof message !== 'string') return null;

  const timePattern =
    /(?:(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i;

  const match = message.match(timePattern);
  if (!match) return null;

  let day = match[1] ? match[1].toLowerCase() : null;
  let time = match[2].toLowerCase();

  return day ? `${day} ${time}` : time;
}

// --- HEALTH CHECK ---
app.get('/api/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

// --- MAIN WEBHOOK ---
app.post('/api/extract-callback-time', async (req, res) => {
  try {
    const { message, contact_id } = req.body || {};

    if (!message || !contact_id) {
      return res.status(400).json({ error: 'Missing message or contact_id' });
    }

    const extractedTime = extractCallbackTime(message);

    // 
￼
 SEND DATA BACK TO GHL
    await axios.put(
      `https://services.leadconnectorhq.com/contacts/${contact_id}`,
      {
        customFields: [
          {
            key: 'rq_extracted_time',
            field_value: extractedTime || '',
          },
          {
            key: 'rq_raw_message',
            field_value: message,
          },
          {
            key: 'rq_raw_phrase',
            field_value: message,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${GHL_API_KEY}`,
          Version: '2021-07-28',
          'Content-Type': 'application/json',
        },
      }
    );

    return res.json({
      success: true,
      rq_extracted_time: extractedTime,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// --- FALLBACK ---
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});


