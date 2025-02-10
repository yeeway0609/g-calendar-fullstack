const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const url = require("url");
const { google } = require("googleapis");
require("dotenv").config();

const APP_ORIGIN = "http://localhost:5173";
const PORT = 8000;
const TOKEN_PATH = path.join(__dirname, "tokens.json");
const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/calendar",
];

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: APP_ORIGIN,
    methods: ["GET", "POST"],
  })
);

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

  // REFACTOR: 如果 tokens.json 中已經有這個 userId 的資料，好像就不用再更新
  data[userId] = {
    user_email: userEmail,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  };

  fs.writeFileSync(TOKEN_PATH, JSON.stringify(data, null, 2));
  console.log("Tokens saved for user:", userId);
}

/** 根據 userId 取得授權的 OAuth2 client */
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
  // TODO: 檢查 access_token 是否過期，如果過期則使用 refresh_token 取得新的 access_token

  return oauthClient;
}

// 用戶授權後的 callback，會取得 code 並換取 tokens，再將用戶導回到 app 首頁並附帶 userId
app.get("/auth/callback", async (req, res) => {
  let q = url.parse(req.url, true).query;

  if (q.error) {
    console.log("Error:" + q.error);
  } else {
    let { tokens } = await oauthClient.getToken(q.code);
    oauthClient.setCredentials(tokens);

    // 當取得 tokens 時，將用戶的 refresh_token 儲存到本地 tokens.json
    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token,
    });

    const payload = ticket.getPayload();
    const userId = payload.sub;
    const userEmail = payload.email;

    if (tokens.refresh_token) {
      // 只有用戶第一次授權時才會收到 refresh_token，之後就不會只會收到 access_token
      // 除非他在這裡撤銷了授權：https://myaccount.google.com/connections/overview
      saveTokensToFile(userId, userEmail, tokens);
    }

    res.redirect(`${APP_ORIGIN}?userId=${userId}`);
  }
});

/** 在指定使用者的 Google 日曆上新增活動 */
async function createEvent(userId, event) {
  try {
    const oauthClient = getAuthClient(userId);

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

/** API 1: 導向到 Google 登入頁 */
app.get("/api/auth", (req, res) => {
  res.redirect(authorizationUrl);
});

/** API 2: 新增活動  */
app.post("/api/create-event", async (req, res) => {
  const { userId, event } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    const response = await createEvent(userId, event);

    if (response.error === "REAUTH_REQUIRED") {
      return res.status(401).json({ error: "Reauthorization required" });
    }

    return res.status(200).json({ message: "Event created", event: response });
  } catch (error) {
    return res.status(500).json({ error: "Failed to create event" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
