/** ชนิดไฟล์แนบ (ตรงกับ Jobs_Attatch.kind) ผูกกับขั้นตอนของงาน */
export type AttatchKind =
  | 'report' // รูปตอนแจ้งงาน (มาจาก OPS)
  | 'accepted' // ยืนยันรับงาน
  | 'progress' // กำลังดำเนินงาน
  | 'completed' // ส่งงาน
  | 'document';

/** ชนิดที่ผู้ใช้อัปโหลดจากระบบเราได้ (report มาจาก OPS เท่านั้น) */
export type UploadKind = 'accepted' | 'progress' | 'completed';

export interface JobAttatchItem {
  id: string;
  source: 'ops' | 'strack';
  kind: AttatchKind;
  originalName: string | null;
  mimeType: string | null;
  isImage: boolean;
  sizeBytes: number | null;
  uploadedByName: string | null;
  createdAt: string;
  /** ผู้ใช้คนนี้ลบไฟล์นี้ได้ */
  canDelete: boolean;
}

/** ไฟล์ที่ multer ส่งมา (ใช้ memoryStorage) */
export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
