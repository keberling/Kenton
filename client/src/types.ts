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

export interface PhotoUploader {
  userId: string;
  microsoftOid: string;
  displayName: string;
  email: string | null;
  preferredUsername: string | null;
  jobTitle: string | null;
  department: string | null;
  officeLocation: string | null;
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
  sizeBytes?: number;
  ingestMs?: number;
  matchStatus?: "routed" | "queued" | "no_fix";
  uploader?: PhotoUploader | null;
}

export interface AddressSuggestion {
  id: string;
  label: string;
  shortLabel: string;
  lat: number;
  lng: number;
  source: "photon" | "nominatim";
  kind?: string;
}

export interface DeploymentRecommendation {
  id: string;
  photoCount: number;
  photoIds: string[];
  centroidLat: number;
  centroidLng: number;
  suggestedAddress: string | null;
  suggestedAddressSource: string | null;
}

export interface Stats {
  totalPhotos: number;
  unassignedPhotos: number;
  sites: number;
  photosWithGps: number;
}