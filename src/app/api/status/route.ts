import { fixtureSummaries } from "@/lib/fixtures";
import { liveEnabled } from "@/lib/guard";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ live: liveEnabled(), fixtures: fixtureSummaries() });
}
