export interface AutotaskZoneInfo {
  zoneName: string;
  url: string;
  webUrl: string;
  ci: number;
}

export interface AutotaskCompany {
  id: number;
  companyName: string;
  companyType: number | null;
  isActive: boolean;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  phone: string | null;
}

export interface AutotaskCompanyListItem {
  id: number;
  companyName: string;
  companyType: number | null;
  isActive: boolean;
  address: string;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  alreadyImported: boolean;
  existingSiteId: string | null;
}

export interface AutotaskImportResult {
  created: number;
  updated: number;
  skipped: number;
  geocoded: number;
  matchedPhotos: number;
}