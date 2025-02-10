const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const url = require("url");
const { google } = require("googleapis");
require("dotenv").config();

const APP_ORIGIN = "http://localhost:5173";
const PORT = 8000;
const app = express();
app.use(
  cors({
    origin: APP_ORIGIN,
    methods: ["GET", "POST"],
  })
);
app.use(express.json());

let storedAccessToken = null; // 儲存 access_token，這裡是簡單示範，實際情況應儲存在資料庫
let calendarClient = null;

const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/calendar",
];

const FAKE_EVENT = {
  summary: "會議測試",
  location: "Google Meet",
  description: "這是一個測試會議",
  start: {
    dateTime: "2025-02-12T10:00:00+08:00",
    timeZone: "Asia/Taipei",
  },
  end: {
    dateTime: "2025-02-12T11:00:00+08:00",
    timeZone: "Asia/Taipei",
  },
};

const oauthClient = new google.auth.OAuth2(
  process.env.GCP_CLIENT_ID,
  process.env.GCP_CLIENT_SECRET,
  process.env.GCP_REDIRECT_URI
);

const authorizationUrl = oauthClient.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
  include_granted_scopes: true,
});

const TOKEN_PATH = path.join(__dirname, "tokens.json");

// 讀取 tokens.json
function readTokensFile() {
  try {
    if (!fs.existsSync(TOKEN_PATH)) {
      fs.writeFileSync(TOKEN_PATH, JSON.stringify({}, null, 2));
    }
    return JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
  } catch (error) {
    console.error("Error reading tokens file:", error);
    return {};
  }
}

// 儲存 tokens 到本地 tokens.json
function saveTokensToFile(userId, userEmail, tokens) {
  let data = readTokensFile();

  data[userId] = {
    user_email: userEmail,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  };

  fs.writeFileSync(TOKEN_PATH, JSON.stringify(data, null, 2));
  console.log("Tokens saved for user:", userId);
}

function getAuthClient(userId) {
  const tokens = readTokensFile();

  if (!tokens[userId] || !tokens[userId].refresh_token) {
    throw new Error("Refresh token not found for user");
  }

  const oauthClient = new google.auth.OAuth2(
    process.env.GCP_CLIENT_ID,
    process.env.GCP_CLIENT_SECRET,
    process.env.GCP_REDIRECT_URI
  );

  oauthClient.setCredentials({ refresh_token: tokens[userId].refresh_token });
  return oauthClient;
}

/** API 1: 儲存 access_token 並初始化 Google API 客戶端 */
app.get("/api/auth", (req, res) => {
  res.redirect(authorizationUrl);
});

app.get("/auth/callback", async (req, res) => {
  let q = url.parse(req.url, true).query;

  if (q.error) {
    console.log("Error:" + q.error);
  } else {
    let { tokens } = await oauthClient.getToken(q.code);
    oauthClient.setCredentials(tokens);

    res.redirect(APP_ORIGIN);
  }
});

oauthClient.on("tokens", async (tokens) => {
  const ticket = await oauthClient.verifyIdToken({
    idToken: tokens.id_token,
  });

  const payload = ticket.getPayload();
  const userId = payload.sub;
  const userEmail = payload.email;

  // 只有用戶第一次授權時會收到 refresh_token，之後就不會再收到，除非他撤銷了授權
  if (tokens.refresh_token) {
    saveTokensToFile(userId, userEmail, tokens);
  }

  console.log("Creating event for user:", userId);
  createEvent(userId, FAKE_EVENT);
});

/** 在指定使用者的 Google 日曆上新增活動 */
async function createEvent(userId, event) {
  try {
    const oauthClient = getAuthClient(userId);
    const { credentials } = await oauthClient.refreshAccessToken(); // 取得新的 access_token
    oauthClient.setCredentials(credentials);

    const calendar = google.calendar({ version: "v3", auth: oauthClient });

    const response = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
    });

    console.log("Event created successfully:", response.data.summary);
    return response.data;
  } catch (error) {
    console.error("Error creating event:", error);
    throw new Error("Failed to create event");
  }
}

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
