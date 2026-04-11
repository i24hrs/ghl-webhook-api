'use strict';

const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const GHL_API_KEY = 'pit-d6507e9f-e7d6-4d76-bfbe-f6985ccdbdaf';

app.use(express.json());

function getMessageText(message) {
  if (!message) return '';
  if (typeof message === 'string') return message.trim();
  if (typeof message === 'object' && typeof message.body === 'string') {
    return message.body.trim();
  }
  return String(message).trim();
}

function extractCallbackTime(messageText) {
  if (!messageText || typeof messageText !== 'string') return '';

  const match = messageText.match(/(\d{1,2}(?::\d{2})?\s*(am|pm))/i);
  if (!match) return '';

  return match[0];
}

app.get('/api/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/extract-callback-time', async (req, res) => {
  try {
    const { message, contact_id } = req.body || {};

    if (!contact_id) {
      return res.status(400).json({ error: 'Missing contact_id' });
    }

    const messageText = getMessageText(message);

    if (!messageText) {
      return res.status(400).json({ error: 'Missing message text' });
    }

    const extractedTime = extractCallbackTime(messageText);

    await axios.put(
      `https://services.leadconnectorhq.com/contacts/${contact_id}`,
      {
        customFields: [
          {
            id: 'rq_extracted_time',
            value: extractedTime
          },
          {
            id: 'rq_raw_message',
            value: messageText
          },
          {
            id: 'rq_raw_phrase',
            value: messageText
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

    res.json({
      success: true,
      message_text: messageText,
      extracted_time: extractedTime
    });
  } catch (err) {
    console.error(
      'Webhook error:',
      err.response ? err.response.data : err.message
    );
    res.status(500).json({
      error: 'Server error',
      details: err.response ? err.response.data : err.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});