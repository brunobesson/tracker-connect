export type Vendor = 'strava' | 'suunto';

export interface Activity {
  id: number;
  userId: number;
  vendor: Vendor;
  vendorId: string;
  date: string; // ISO 8601
  name: string;
  type?: string;
}
