const MAX_SIDE = 1600; // ย่อด้านยาวสุดก่อนอัปโหลด (รูปจากมือถือมักใหญ่หลาย MB)
const JPEG_QUALITY = 0.82;

/** ย่อรูป + แปลงเป็น JPEG ในเบราว์เซอร์ (ไฟล์ที่ไม่ใช่รูป/ย่อไม่ได้ ส่งไฟล์เดิม) */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
