import { NextRequest, NextResponse } from "next/server";
import { isValidGSTINFormat } from "@/lib/gst";

// TODO: swap for your chosen provider. Options as of 2026:
// - gstincheck.co.in — simplest, cheapest, good for MVP validation
// - Masters India / Deepvue / Perfios — GSP-authorized, better for
//   compliance-grade vendor onboarding once you have real customers
const GST_API_KEY = process.env.GST_VERIFY_API_KEY;

export async function GET(req: NextRequest) {
  const gstin = req.nextUrl.searchParams.get("gstin")?.trim().toUpperCase();

  if (!gstin) {
    return NextResponse.json({ error: "GSTIN is required" }, { status: 400 });
  }
  if (!isValidGSTINFormat(gstin)) {
    return NextResponse.json(
      { error: "Invalid GSTIN format" },
      { status: 400 }
    );
  }
  if (!GST_API_KEY) {
    return NextResponse.json(
      { error: "GST verification isn't configured yet — add GST_VERIFY_API_KEY to your environment." },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(
      `https://sheet.gstincheck.co.in/check/${GST_API_KEY}/${gstin}`,
      { cache: "no-store" }
    );
    const data = await res.json();

    if (!data?.flag) {
      return NextResponse.json(
        { error: data?.message ?? "GSTIN not found or inactive" },
        { status: 404 }
      );
    }

    // TODO: log this verification (gstin, timestamp, result, user/org id)
    // to your database for audit trail — required for real compliance workflows.

    return NextResponse.json({
      legalName: data.data?.lgnm ?? "",
      tradeName: data.data?.tradeNam ?? "",
      status: data.data?.sts ?? "",
      address: data.data?.pradr?.addr ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Verification service unavailable, try again shortly." },
      { status: 502 }
    );
  }
}