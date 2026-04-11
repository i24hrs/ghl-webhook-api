const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// 🔐 ENV VARIABLES (set these in Render)
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

// 🧠 Extract time from message (basic but effective)
function extractTime(text) {
  const regex = /(tomorrow)?\s*(at)?\s*(\d{1,2})(:\d{2})?\s*(am|pm)/i;
  const match = text.match(regex);

  if (!match) return null;

  let hour = parseInt(match[3]);
  const minutes = match[4] ? parseInt(match[4].replace(':', '')) : 0;
  const period = match[5].toLowerCase();

  if (period === 'pm' && hour !== 12) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;

  const now = new Date();

  // 👉 If "tomorrow" is mentioned
  if (match[1]) {
    now.setDate(now.getDate() + 1);
  }

  now.setHours(hour);
  now.setMinutes(minutes);
  now.setSeconds(0);
  now.setMilliseconds(0);

  return now;
}

// 🔥 FIXED: Proper ISO format for GHL DATE field
function formatLocalDateTime(date) {
  return date.toISOString();
}

// 🚀 Webhook endpoint
app.post('/api/extract-callback-time', async (req, res) => {
  try {
    const { message, contact_id } = req.body;

    if (!message || !contact_id) {
      return res.status(400).json({ error: 'Missing message or contact_id' });
    }

    const extractedDate = extractTime(message);

    let formattedDate = '';
    let rawPhrase = '';

    if (extractedDate) {
      formattedDate = formatLocalDateTime(extractedDate);

      const phraseMatch = message.match(/(tomorrow.*?\d{1,2}(:\d{2})?\s*(am|pm))/i);
      rawPhrase = phraseMatch ? phraseMatch[0] : message;
    }

    // 🧾 Prepare update payload
    const payload = {
      customFields: [
        {
          id: 'rq_raw_message',
          field_value: message
        },
        {
          id: 'rq_raw_phrase',
          field_value: rawPhrase
        },
        {
          id: 'rq_extracted_time',
          field_value: formattedDate
        },
        {
          id: 'rq_scheduled_call_time', // ✅ your DATE field
          field_value: formattedDate
        }
      ]
    };

    // 📡 Send to GHL
    await axios.put(
      `https://services.leadconnectorhq.com/contacts/${contact_id}`,
      payload,
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
      extracted_time: formattedDate
    });

  } catch (error) {
    console.error(error.response?.data || error.message);

    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.response?.data || error.message
    });
  }
});

// 🚀 Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});