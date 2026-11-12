import { CheckIcon } from "lucide-react";

const BENEFITS = [
  "รับแจ้งเตือนงานผ่าน LINE",
  "ติดตามสถานะและปิดงานได้",
  "ดูประวัติงานและคะแนนของฉัน",
];

/** "หลังลงทะเบียนแล้วทำอะไรได้บ้าง" */
export function BenefitsCard() {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="font-heading font-medium">หลังลงทะเบียนแล้วทำอะไรได้บ้าง</h2>
      <ul className="mt-3 space-y-2.5">
        {BENEFITS.map((text) => (
          <li key={text} className="flex items-center gap-3 text-sm">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-white">
              <CheckIcon className="size-4" />
            </span>
            {text}
          </li>
        ))}
      </ul>
    </section>
  );
}
