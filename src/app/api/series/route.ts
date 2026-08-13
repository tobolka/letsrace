import { NextResponse } from "next/server";
import { listSeries } from "@/lib/events";

export async function GET() {
  const series = await listSeries();
  return NextResponse.json(series);
}
