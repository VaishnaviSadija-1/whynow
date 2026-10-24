import type { Metadata } from "next";
import { RunWorkspace } from "@/components/run/RunWorkspace";

export const metadata: Metadata = { title: "Demo · WhyNow" };

export default async function RunPage({ searchParams }: PageProps<"/run">) {
  const { domain } = await searchParams;
  return <RunWorkspace initialDomain={typeof domain === "string" ? domain : undefined} />;
}
