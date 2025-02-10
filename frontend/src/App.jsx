import { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";

const API_BASE_URL = "http://localhost:8000/api";
const SCOPE = "https://www.googleapis.com/auth/calendar";

export default function App() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);

  const handleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      // 把 access token 傳到後端
      await fetch(`${API_BASE_URL}/auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_token: tokenResponse.access_token,
        }),
      });
    },
    onError: (error) => setError(error.message),
    scope: SCOPE,
  });

  const fetchEvents = async () => {
    const response = await fetch(`${API_BASE_URL}/recent-events`, {
      method: "GET",
    });
    const data = await response.json();
    setEvents(data.events);
  };

  const handleNewEvent = async (e) => {
    e.preventDefault();

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
        body: JSON.stringify({ event }),
      });

      if (response.status === 200) {
        fetchEvents();
      } else {
        alert("Failed to create event.");
      }
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div>
      <h1>Google Calendar Events</h1>
      <div style={{ display: "flex", gap: "6px" }}>
        <button onClick={handleLogin}>Login with Google</button>
        <button onClick={fetchEvents}>Show recent event</button>
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

      <h2>Upcoming Events</h2>
      <ul>
        {events.map((event, index) => (
          <li key={index}>{event.summary}</li>
        ))}
      </ul>
    </div>
  );
}
