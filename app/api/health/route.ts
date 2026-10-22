import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export function GET() {
  try {
    db.prepare("select 1").get()
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 503 })
  }
}
