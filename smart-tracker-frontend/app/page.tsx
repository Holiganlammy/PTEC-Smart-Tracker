import { redirect } from "next/navigation";

// ตอนนี้มีหน้าเดียวคือลงทะเบียน — ภายหลังจะเช็กสถานะผู้ใช้แล้วพาไป dashboard
export default function Home() {
  redirect("/register");
}
