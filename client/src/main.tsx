import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./lib/AuthContext";
import { IngestProvider } from "./lib/IngestContext";
import { LiveDataProvider } from "./lib/LiveDataContext";
import { ThemeProvider } from "./lib/ThemeContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <ThemeProvider>
      <LiveDataProvider>
        <AuthProvider>
          <IngestProvider>
            <App />
          </IngestProvider>
        </AuthProvider>
      </LiveDataProvider>
    </ThemeProvider>
  </BrowserRouter>,
);