export type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

/** ผู้รับเหมาช่วงในบริษัท (ใช้เลือกตอนมอบหมายงาน) */
export interface SubContractorItem {
  id: string;
  name: string;
}
