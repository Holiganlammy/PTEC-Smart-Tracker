import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OPS_CONNECTION } from '../../database/database.module';

export interface VenderItem {
  venderCode: string;
  venderName: string;
}

/** รายชื่อบริษัทผู้รับเหมา — อ่านจาก Supplier/Vendor ของ OPS (ย้ายมาจาก SP OPS_Mobile_List_Vender) */
@Injectable()
export class VenderService {
  constructor(
    @InjectDataSource(OPS_CONNECTION) private readonly ops: DataSource,
  ) {}

  /** รายชื่อบริษัททั้งหมด เรียงตามชื่อ (ใช้กับ dropdown หน้าลงทะเบียน) */
  async getVenders(): Promise<VenderItem[]> {
    const rows = await this.ops.query<VenderItem[]>(`
      SELECT
        COALESCE(v.Vendor_Code, s.Code, '')    AS venderCode,
        COALESCE(v.Vendor_Name, s.Company, '') AS venderName
      FROM dbo.Supplier s
      LEFT JOIN dbo.Vendor v ON s.Code = v.Vendor_Code
      WHERE COALESCE(v.Vendor_Code, s.Code, '') <> ''
        AND COALESCE(v.Vendor_Name, s.Company, '') <> ''
      ORDER BY venderName
    `);

    // JOIN อาจได้รหัสเดียวกันซ้ำ (Supplier/Vendor มีหลายแถวต่อรหัส) — เก็บรหัสละ 1 รายการ
    const seen = new Set<string>();
    return rows.filter((r) => {
      if (seen.has(r.venderCode)) return false;
      seen.add(r.venderCode);
      return true;
    });
  }

  /** map รหัสบริษัท → ชื่อบริษัท (ใช้แสดงในรายการผู้ใช้ของแอดมิน) */
  async getNames(codes: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(codes.filter(Boolean))];
    const names = new Map<string, string>();
    if (unique.length === 0) return names;

    const placeholders = unique.map((_, i) => `@${i}`).join(',');
    const rows = await this.ops.query<VenderItem[]>(
      `
      SELECT
        COALESCE(v.Vendor_Code, s.Code, '')    AS venderCode,
        COALESCE(v.Vendor_Name, s.Company, '') AS venderName
      FROM dbo.Supplier s
      LEFT JOIN dbo.Vendor v ON s.Code = v.Vendor_Code
      WHERE COALESCE(v.Vendor_Code, s.Code, '') IN (${placeholders})
      `,
      unique,
    );
    for (const r of rows) names.set(r.venderCode, r.venderName);
    return names;
  }

  /** เช็กว่ารหัสบริษัทนี้มีอยู่จริงใน OPS */
  async exists(venderCode: string): Promise<boolean> {
    const rows = await this.ops.query<{ ok: number }[]>(
      `
      SELECT TOP 1 1 AS ok
      FROM dbo.Supplier s
      LEFT JOIN dbo.Vendor v ON s.Code = v.Vendor_Code
      WHERE COALESCE(v.Vendor_Code, s.Code, '') = @0
      `,
      [venderCode],
    );
    return rows.length > 0;
  }
}
