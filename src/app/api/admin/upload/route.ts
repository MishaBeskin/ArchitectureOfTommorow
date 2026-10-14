import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { handleUploadRequest } from "@/server/admin/handle-upload-request";
import { getAdmin } from "@/server/auth/require-admin";
import { getDb } from "@/server/db/client";
import { createUploadSlot } from "@/server/storage";

/**
 * Hands the admin's browser a one-time address to send one image to. Answers 401 (not a redirect)
 * when nobody is signed in, since this is called by script. The proxy does not cover /api, so this
 * check is the only gate.
 */
export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "That request was not valid." }, { status: 400 });
  }

  try {
    const result = await handleUploadRequest({ db: getDb(), createSlot: createUploadSlot, newId: randomUUID }, body);
    return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Preparing an upload failed", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
