import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

// Self-hosted fonts from /fonts (see fonts.css). Critical weights are preloaded in
// index.html so they land before first paint, with no layout shift on swap.
import "./fonts.css";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
