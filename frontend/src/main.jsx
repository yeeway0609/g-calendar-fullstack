import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { GoogleOAuthProvider } from "@react-oauth/google";

const CLIENT_ID = "521320255264-3q0f5dcnh9ebif8d21lia87ctjf8kkij.apps.googleusercontent.com"

createRoot(document.getElementById("root")).render(
  <GoogleOAuthProvider clientId={CLIENT_ID}>
    <App />
  </GoogleOAuthProvider>
);
