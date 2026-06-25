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

export interface AuthUser {
  microsoftOid: string;
  tenantId: string;
  displayName: string;
  email: string | null;
  preferredUsername: string | null;
  jobTitle: string | null;
  department: string | null;
  officeLocation: string | null;
}

export interface User extends AuthUser {
  id: string;
  firstSeenAt: number;
  lastSeenAt: number;
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
  /** When true, background auto-match skips this photo until explicitly retried. */
  matchHold?: boolean;
  siteName?: string | null;
  lat: number | null;
  lng: number | null;
  takenAt: number | null;
  uploadedAt: number;
  width: number | null;
  height: number | null;
  url: string;
  uploader?: PhotoUploader | null;
}

export interface PhotoExif {
  lat: number | null;
  lng: number | null;
  takenAt: number | null;
  width: number | null;
  height: number | null;
}