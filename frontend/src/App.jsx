import { useState, useEffect } from "react";

const API_BASE_URL = "http://localhost:8000/api";

export default function App() {
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get("userId");

    if (userId) {
      setUserId(userId);
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  const handleLogin = async () => {
    window.location.href = `${API_BASE_URL}/auth`;
  };

  const handleNewEvent = async (e) => {
    e.preventDefault();

    if (!userId) {
      setError("請先登入！");
      return;
    }

    const form = e.target;
    const eventName = form.eventName.value;
    const startTime = new Date(form.startTime.value).toISOString();
    const endTime = new Date(form.endTime.value).toISOString();

    const event = {
      summary: eventName,
      start: { dateTime: startTime, timeZone: "Asia/Taipei" },
      end: { dateTime: endTime, timeZone: "Asia/Taipei" },
    };

    try {
      const response = await fetch(`${API_BASE_URL}/create-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userId,
          event: event,
        }),
      });

      if (response.status !== 200) throw new Error("Failed to create event");

      alert("成功建立活動！");
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div>
      <h1>Google Calendar Events</h1>
      <div style={{ display: "flex", gap: "6px" }}>
        <button onClick={handleLogin}>Login with Google</button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <h2>Add New Event</h2>
      <form onSubmit={handleNewEvent}>
        <label>Event Name:</label>
        <input type="text" name="eventName" required />
        <br />
        <label>Start Time:</label>
        <input type="datetime-local" name="startTime" required />
        <br />
        <label>End Time:</label>
        <input type="datetime-local" name="endTime" required />
        <br />
        <button type="submit">Create Event</button>
      </form>
    </div>
  );
}
