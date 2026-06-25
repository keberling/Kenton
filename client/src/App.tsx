import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { PhotosPage } from "./pages/PhotosPage";
import { SiteDetailPage } from "./pages/SiteDetailPage";
import { SitesPage } from "./pages/SitesPage";
import { UploadPage } from "./pages/UploadPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<UploadPage />} />
        <Route path="sites" element={<SitesPage />} />
        <Route path="sites/:id" element={<SiteDetailPage />} />
        <Route path="photos" element={<PhotosPage />} />
      </Route>
    </Routes>
  );
}