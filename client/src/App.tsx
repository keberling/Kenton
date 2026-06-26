import { Navigate, Route, Routes } from "react-router-dom";
import { AuthRedirectHandler } from "./components/AuthRedirectHandler";
import { Layout } from "./components/Layout";
import { PublicUploadLayout } from "./components/PublicUploadLayout";
import { RequireAuth } from "./components/RequireAuth";
import { BackupsPage } from "./pages/BackupsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { MatchQueuePage } from "./pages/MatchQueuePage";
import { PhotosPage } from "./pages/PhotosPage";
import { PublicUploadPage } from "./pages/PublicUploadPage";
import { SiteDetailPage } from "./pages/SiteDetailPage";
import { SitesPage } from "./pages/SitesPage";
import { MapPage } from "./pages/MapPage";
import { APP_BASE } from "./lib/routes";

export default function App() {
  return (
    <>
      <AuthRedirectHandler />
      <Routes>
        <Route element={<PublicUploadLayout />}>
          <Route index element={<PublicUploadPage />} />
        </Route>

        <Route
          path={APP_BASE}
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="sites" replace />} />
          <Route path="sites" element={<SitesPage />} />
          <Route path="sites/:id" element={<SiteDetailPage />} />
          <Route path="match" element={<MatchQueuePage />} />
          <Route path="photos" element={<PhotosPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="backups" element={<BackupsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </>
  );
}