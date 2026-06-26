import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./lib/AuthContext";
import { IngestProvider } from "./lib/IngestContext";
import { LiveDataProvider } from "./lib/LiveDataContext";
import { registerServiceWorker } from "./lib/pwa";
import { ThemeProvider } from "./lib/ThemeContext";
import "./index.css";

void registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <LiveDataProvider>
          <IngestProvider>
            <App />
          </IngestProvider>
        </LiveDataProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>,
);