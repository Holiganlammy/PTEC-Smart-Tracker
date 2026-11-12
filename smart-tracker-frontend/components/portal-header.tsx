import { WrenchIcon } from "lucide-react";

/** แถบหัวสีเข้มของ Contractor Portal */
export function PortalHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center gap-3 bg-neutral-900 px-4 py-3 text-white">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
        <WrenchIcon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-[0.14em] text-white/60">
          CONTRACTOR PORTAL
        </p>
        <h1 className="truncate font-heading text-lg leading-tight font-medium">
          {title}
        </h1>
      </div>
    </header>
  );
}
