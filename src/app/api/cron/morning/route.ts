import { NextResponse } from "next/server";
import { runMorning } from "@/lib/morning";

// Vercel runs this every morning (see vercel.json). It sends the Authorization header with CRON_SECRET.
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  const result = await runMorning();
  return NextResponse.json(result);
}
