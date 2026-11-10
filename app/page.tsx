import { Suspense } from "react";
import { Landing } from "@/components/Landing";
import { firstParam } from "@/lib/params";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<Landing error={null} />}>
      <LandingGate searchParams={searchParams} />
    </Suspense>
  );
}

async function LandingGate({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <Landing error={firstParam(params.error) ?? null} />;
}
