'use strict';

const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const GHL_API_KEY = 'pit-d6507e9f-e7d6-4d76-bfbe-f6985ccdbdaf';

app.use(express.json());

function extractCallbackTime(message) {
  if (!message || typeof message !== 'string') return null;

  const match = message.match(/(\d{1,2}(?::\d{2})?\s*(am|pm))/i);
  if (!match) return null;

  return match[0];
}

app.get('/api/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/extract-callback-time', async (req, res) => {
  try {
    const { message, contact_id } = req.body || {};

    if (!message || !contact_id) {
      return res.status(400).json({ error: 'Missing message or contact_id' });
    }

    const extractedTime = extractCallbackTime(message);

    await axios.put(
      `https://services.leadconnectorhq.com/contacts/${contact_id}`,
      {
        customFields: [
          {
            id: 'rq_extracted_time',
            field_value: extractedTime || '',
          },
          {
            id: 'rq_raw_message',
            field_value: message,
          },
          {
            id: 'rq_raw_phrase',
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

    res.json({ success: true, extractedTime });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});