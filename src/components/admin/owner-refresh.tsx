"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function OwnerRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 60000);
    return () => window.clearInterval(timer);
  }, [router]);
  return null;
}

export function OwnerRefreshButton(){
  const router=useRouter();
  return <Button variant="outline" onClick={()=>router.refresh()}>Zkusit načíst přehled</Button>;
}
