'use strict';

const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const DAY_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const MONTH_INDEX = {
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
  dec: 11,
};

function cloneDate(date) {
  return new Date(date.getTime());
}

function parseTimeTo24Hour(timeStr) {
  const cleaned = String(timeStr).trim().toLowerCase();
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2] || '0', 10);
  const meridiem = match[3].toLowerCase();

  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;

  if (meridiem === 'am') {
    if (hour === 12) hour = 0;
  } else {
    if (hour !== 12) hour += 12;
  }

  return { hour, minute };
}

function formatLocal(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function getTodayBase(now) {
  const d = cloneDate(now);
  d.setSeconds(0, 0);
  return d;
}

function getTomorrowBase(now) {
  const d = getTodayBase(now);
  d.setDate(d.getDate() + 1);
  return d;
}

function getWeekdayBase(dayName, modifier, now) {
  const target = DAY_INDEX[dayName.toLowerCase()];
  if (target === undefined) return null;

  const base = getTodayBase(now);
  const current = base.getDay();
  let daysAhead = (target - current + 7) % 7;

  if (modifier === 'next') {
    if (daysAhead === 0) {
      daysAhead = 7;
    } else {
      daysAhead += 7;
    }
  } else if (modifier === 'this') {
    if (daysAhead === 0) {
      daysAhead = 0;
    }
  } else {
    if (daysAhead === 0) {
      daysAhead = 7;
    }
  }

  base.setDate(base.getDate() + daysAhead);
  return base;
}

function getExplicitDateBase(monthToken, dayNumber, now) {
  const month = MONTH_INDEX[monthToken.toLowerCase()];
  if (month === undefined) return null;

  const year = now.getFullYear();
  const base = new Date(year, month, dayNumber);
  if (
    base.getMonth() !== month ||
    base.getDate() !== dayNumber
  ) {
    return null;
  }

  if (base < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    base.setFullYear(year + 1);
  }

  base.setSeconds(0, 0);
  return base;
}

function getNumericDateBase(monthNumber, dayNumber, now) {
  const month = monthNumber - 1;
  if (month < 0 || month > 11) return null;

  const year = now.getFullYear();
  const base = new Date(year, month, dayNumber);
  if (
    base.getMonth() !== month ||
    base.getDate() !== dayNumber
  ) {
    return null;
  }

  if (base < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    base.setFullYear(year + 1);
  }

  base.setSeconds(0, 0);
  return base;
}

function applyTime(baseDate, parsedTime) {
  if (!baseDate || !parsedTime) return null;
  const d = cloneDate(baseDate);
  d.setHours(parsedTime.hour, parsedTime.minute, 0, 0);
  return d;
}

function findTime(message) {
  const timeRegex = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i;
  const match = message.match(timeRegex);
  if (!match) return null;

  const parsed = parseTimeTo24Hour(match[1]);
  if (!parsed) return null;

  return {
    raw: match[1].trim(),
    parsed,
    index: match.index || 0,
  };
}

function extractCallbackTime(message, now = new Date()) {
  if (!message || typeof message !== 'string') return null;

  const text = message.trim();
  const lower = text.toLowerCase();

  const timeInfo = findTime(text);
  if (!timeInfo) return null;

  let baseDate = null;
  let rawPhrase = null;

  const todayMatch = lower.match(/\b(today)\b/);
  const tomorrowMatch = lower.match(/\b(tomorrow)\b/);

  if (todayMatch) {
    baseDate = getTodayBase(now);
    rawPhrase = `today ${timeInfo.raw}`;
  } else if (tomorrowMatch) {
    baseDate = getTomorrowBase(now);
    rawPhrase = `tomorrow ${timeInfo.raw}`;
  }

  if (!baseDate) {
    const weekdayMatch = lower.match(/\b(?:(this|next)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    if (weekdayMatch) {
      const modifier = weekdayMatch[1] || null;
      const weekday = weekdayMatch[2];
      baseDate = getWeekdayBase(weekday, modifier, now);
      rawPhrase = `${modifier ? modifier + ' ' : ''}${weekday} ${timeInfo.raw}`.trim();
    }
  }

  if (!baseDate) {
    const monthNameDateMatch = lower.match(
      /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{1,2})\b/
    );
    if (monthNameDateMatch) {
      const monthToken = monthNameDateMatch[1];
      const dayNumber = parseInt(monthNameDateMatch[2], 10);
      baseDate = getExplicitDateBase(monthToken, dayNumber, now);
      rawPhrase = `${monthNameDateMatch[0]} ${timeInfo.raw}`;
    }
  }

  if (!baseDate) {
    const numericDateMatch = lower.match(/\b(\d{1,2})\/(\d{1,2})\b/);
    if (numericDateMatch) {
      const monthNumber = parseInt(numericDateMatch[1], 10);
      const dayNumber = parseInt(numericDateMatch[2], 10);
      baseDate = getNumericDateBase(monthNumber, dayNumber, now);
      rawPhrase = `${numericDateMatch[0]} ${timeInfo.raw}`;
    }
  }

  if (!baseDate) {
    baseDate = getTodayBase(now);
    rawPhrase = timeInfo.raw;
  }

  const resolved = applyTime(baseDate, timeInfo.parsed);
  if (!resolved) return null;

  return {
    raw_phrase: rawPhrase,
    iso_datetime: resolved.toISOString(),
    local_display: formatLocal(resolved),
  };
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

  return res.json({
    rq_raw_phrase: extracted ? extracted.raw_phrase : null,
    rq_extracted_time: extracted ? extracted.iso_datetime : null,
    rq_extracted_time_local: extracted ? extracted.local_display : null,
  });
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


