"use client";

import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";

export function MobileTopBar({
  locale,
  menu,
  filters,
}: {
  locale: string;
  menu: ReactNode;
  filters: ReactNode;
}) {
  return (
    <div className="pointer-events-auto flex w-full flex-col gap-2">
      <div className="flex h-12 items-center justify-between rounded-[1.75rem] bg-card py-0.5 pr-1 pl-4 shadow-md ring-1 ring-black/8">
        <BrandMark href={`/${locale}`} size="sm" />
        {menu}
      </div>
      <div className="min-w-0 overflow-x-auto overscroll-x-contain rounded-2xl bg-card/95 p-1 shadow-sm ring-1 ring-black/8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filters}
      </div>
    </div>
  );
}
