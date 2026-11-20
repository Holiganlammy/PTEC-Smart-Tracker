/** การเปลี่ยนค่าของแต่ละช่อง เก็บเป็น JSON ใน Jobs_Logs.changes */
export type JobLogChanges = Record<
  string,
  { from: string | null; to: string | null }
>;
