const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");
require("dotenv").config();

const PORT = 8000;
const app = express();
app.use(cors());
app.use(express.json());

let storedAccessToken = null; // 儲存 access_token，這裡是簡單示範，實際情況應儲存在資料庫
let authClient = null;
let calendarClient = null;

/** API 1: 儲存 access_token 並初始化 Google API 客戶端 */
app.post("/api/auth", (req, res) => {
  const { access_token } = req.body;
  if (!access_token) {
    return res.status(400).json({ error: "Access token is required" });
  }
  storedAccessToken = access_token;

  authClient = new google.auth.OAuth2();
  authClient.setCredentials({ access_token: storedAccessToken });

  calendarClient = google.calendar({ version: "v3", auth: authClient });

  console.log("Access token saved and Google API clients initialized.");
  return res.status(200).json({ message: "Access token saved successfully" });
});

/** API 2: 取得近期活動 */
app.get("/api/recent-events", async (req, res) => {
  if (!calendarClient) {
    return res.status(400).json({ error: "Calendar client is not initialized" });
  }

  try {
    const response = await calendarClient.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = response.data.items || [];
    return res.json({ events });
  } catch (error) {
    console.error("Error fetching events:", error);
    return res.status(500).json({ error: "Failed to fetch events" });
  }
});

/** API 3: 新增活動  */
app.post("/api/create-event", async (req, res) => {
  if (!calendarClient) {
    return res.status(400).json({ error: "Google Calendar client is not initialized" });
  }

  try {
    const event = req.body.event;
    console.log("Creating event:", event);

    const response = await calendarClient.events.insert({
      calendarId: "primary",
      resource: event,
    });

    return res.status(200).json({ message: "Event created", event: response.data });
  } catch (error) {
    console.error("Error creating event:", error);
    return res.status(500).json({ error: "Failed to create event" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
