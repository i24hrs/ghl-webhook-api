'use strict';

const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Replace with your current private integration token
const GHL_API_KEY = 'pit-d6507e9f-e7d6-4d76-bfbe-f6985ccdbdaf';

app.use(express.json());

const WEEKDAYS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

const MONTHS = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11
};

function getMessageText(message) {
  if (!message) return '';
  if (typeof message === 'string') return message.trim();
  if (typeof message === 'object' && typeof message.body === 'string') {
    return message.body.trim();
  }
  return String(message).trim();
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatLocalDateTime(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseTime(timeText) {
  if (!timeText) return null;

  const match = String(timeText).trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2] || '0', 10);
  const ampm = match[3].toLowerCase();

  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;

  if (ampm === 'am' && hour === 12) hour = 0;
  if (ampm === 'pm' && hour !== 12) hour += 12;

  return { hour, minute };
}

function nextWeekday(baseDate, targetDayIndex, useThisModifier) {
  const date = new Date(baseDate);
  date.setSeconds(0, 0);

  const currentDay = date.getDay();
  let diff = (targetDayIndex - currentDay + 7) % 7;

  if (useThisModifier) {
    // "this Friday" means upcoming Friday, including today if same day
  } else {
    // plain "Friday" means next occurrence, not today if same day
    if (diff === 0) diff = 7;
  }

  date.setDate(date.getDate() + diff);
  return date;
}

function resolveSchedulePhrase(messageText) {
  if (!messageText) {
    return {
      rawPhrase: '',
      extractedTime: '',
      scheduledDateTime: ''
    };
  }

  const text = messageText.trim();
  const lower = text.toLowerCase();

  const timeMatch = lower.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
  if (!timeMatch) {
    return {
      rawPhrase: '',
      extractedTime: '',
      scheduledDateTime: ''
    };
  }

  const rawTime = timeMatch[1];
  const parsedTime = parseTime(rawTime);
  if (!parsedTime) {
    return {
      rawPhrase: '',
      extractedTime: '',
      scheduledDateTime: ''
    };
  }

  const now = new Date();
  now.setSeconds(0, 0);

  let targetDate = null;
  let rawPhrase = '';

  // today
  if (/\btoday\b/i.test(lower)) {
    targetDate = new Date(now);
    rawPhrase = text.match(/\b(today\b.*?\d{1,2}(?::\d{2})?\s*(?:am|pm))/i)?.[1] || `today at ${rawTime}`;
  }

  // tomorrow
  if (!targetDate && /\btomorrow\b/i.test(lower)) {
    targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + 1);
    rawPhrase = text.match(/\b(tomorrow\b.*?\d{1,2}(?::\d{2})?\s*(?:am|pm))/i)?.[1] || `tomorrow at ${rawTime}`;
  }

  // this/next weekday
  if (!targetDate) {
    const weekdayMatch = lower.match(/\b(?:(this|next)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    if (weekdayMatch) {
      const modifier = weekdayMatch[1] || '';
      const weekdayName = weekdayMatch[2];
      const weekdayIndex = WEEKDAYS[weekdayName];

      targetDate = nextWeekday(now, weekdayIndex, modifier === 'this');

      if (modifier === 'next') {
        targetDate.setDate(targetDate.getDate() + 7);
      }

      rawPhrase =
        text.match(new RegExp(`\\b((?:this|next)?\\s*${weekdayName}\\b.*?\\d{1,2}(?::\\d{2})?\\s*(?:am|pm))`, 'i'))?.[1] ||
        `${modifier ? modifier + ' ' : ''}${weekdayName} ${rawTime}`;
    }
  }

  // month name date: April 13 at 4pm
  if (!targetDate) {
    const monthNameMatch = lower.match(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{1,2})\b/i);
    if (monthNameMatch) {
      const monthIndex = MONTHS[monthNameMatch[1]];
      const day = parseInt(monthNameMatch[2], 10);

      targetDate = new Date(now.getFullYear(), monthIndex, day);
      if (targetDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        targetDate.setFullYear(targetDate.getFullYear() + 1);
      }

      rawPhrase =
        text.match(/\b([A-Za-z]+\s+\d{1,2}.*?\d{1,2}(?::\d{2})?\s*(?:am|pm))/i)?.[1] ||
        `${monthNameMatch[1]} ${day} ${rawTime}`;
    }
  }

  // numeric date: 4/13 4pm
  if (!targetDate) {
    const numericDateMatch = lower.match(/\b(\d{1,2})\/(\d{1,2})\b/);
    if (numericDateMatch) {
      const month = parseInt(numericDateMatch[1], 10) - 1;
      const day = parseInt(numericDateMatch[2], 10);

      targetDate = new Date(now.getFullYear(), month, day);
      if (targetDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        targetDate.setFullYear(targetDate.getFullYear() + 1);
      }

      rawPhrase =
        text.match(/\b(\d{1,2}\/\d{1,2}.*?\d{1,2}(?::\d{2})?\s*(?:am|pm))/i)?.[1] ||
        `${numericDateMatch[1]}/${numericDateMatch[2]} ${rawTime}`;
    }
  }

  // fallback: just time today
  if (!targetDate) {
    targetDate = new Date(now);
    rawPhrase = rawTime;
  }

  targetDate.setHours(parsedTime.hour, parsedTime.minute, 0, 0);

  return {
    rawPhrase: rawPhrase.trim(),
    extractedTime: rawTime.trim(),
    scheduledDateTime: formatLocalDateTime(targetDate)
  };
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

    const parsed = resolveSchedulePhrase(messageText);

    await axios.put(
      `https://services.leadconnectorhq.com/contacts/${contact_id}`,
      {
        customFields: [
          {
            id: 'rq_raw_message',
            value: messageText
          },
          {
            id: 'rq_raw_phrase',
            value: parsed.rawPhrase || messageText
          },
          {
            id: 'rq_extracted_time',
            value: parsed.scheduledDateTime || parsed.extractedTime || ''
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
      raw_phrase: parsed.rawPhrase,
      extracted_time: parsed.extractedTime,
      scheduled_datetime: parsed.scheduledDateTime
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
