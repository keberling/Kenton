export interface Site {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  radiusMeters: number;
  createdAt: number;
  updatedAt: number;
  photoCount?: number;
}

export interface Photo {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  siteId: string | null;
  siteName?: string | null;
  lat: number | null;
  lng: number | null;
  takenAt: number | null;
  uploadedAt: number;
  width: number | null;
  height: number | null;
  url: string;
  autoMatched?: boolean;
  hasGps?: boolean;
}

export interface Stats {
  totalPhotos: number;
  unassignedPhotos: number;
  sites: number;
  photosWithGps: number;
}