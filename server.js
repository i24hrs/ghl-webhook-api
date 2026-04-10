'use strict';

const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function extractCallbackTime(message) {
  if (!message || typeof message !== 'string') return null;

  const timePattern =
    /(?:(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))/gi;

  const match = timePattern.exec(message);
  if (!match) return null;

  const day = match[1] ? match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() : null;
  const time = match[2].trim();

  return day ? `${day} ${time}` : time;
}

app.get('/api/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/extract-callback-time', (req, res) => {
  const { message } = req.body || {};

  if (message === undefined || message === null) {
    return res.status(400).json({ error: 'Missing required field: message' });
  }

  const extracted = extractCallbackTime(String(message));
  return res.json({ rq_extracted_time: extracted });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Webhook server running on port ${PORT}`);
});

module.exports = app;
