import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/merriweather/400.css";
import "@fontsource/merriweather/700.css";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
