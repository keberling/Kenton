export interface NearbyPhotoInsight {
  photoId: string;
  originalName: string;
  lat: number;
  lng: number;
  distanceM: number;
  withinRadius: boolean;
}

export interface Site {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  radiusMeters: number;
  geocodeSource: string | null;
  createdAt: number;
  updatedAt: number;
  photoCount?: number;
  previewPhotos?: string[];
  nearestUnassigned?: NearbyPhotoInsight | null;
  unassignedWithinRadius?: number;
  unassignedWithGps?: number;
  nearbyUnassigned?: NearbyPhotoInsight[];
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