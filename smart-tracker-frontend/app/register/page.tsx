import type { Metadata } from "next";
import { PortalHeader } from "@/components/portal-header";
import RegisterForm from "@/components/register/register-form";

export const metadata: Metadata = { title: "ลงทะเบียนผู้รับเหมา | PTEC" };

export default function RegisterPage() {
  return (
    <>
      <PortalHeader title="ลงทะเบียนผู้รับเหมา" />
      <RegisterForm />
    </>
  );
}
