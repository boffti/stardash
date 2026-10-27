import { NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { createApiToken, listApiTokens, revokeApiToken } from "@/lib/api-tokens"

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ tokens: listApiTokens(user.id) })
}

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { name } = (await request.json().catch(() => ({}))) as { name?: string }
  return NextResponse.json(createApiToken(user.id, typeof name === "string" ? name : "token"))
}

export async function DELETE(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = (await request.json().catch(() => ({}))) as { id?: string }
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  return NextResponse.json({ ok: revokeApiToken(user.id, id) })
}
