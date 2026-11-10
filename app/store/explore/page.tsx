import { Suspense } from "react";
import { ExploreScreen } from "@/components/store/ExploreScreen";
import { firstParam } from "@/lib/params";

export const metadata = {
  title: "Explore vinyls",
};

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-6 pt-16 font-display text-3xl text-[#3d6b36]">Opening the racks…</p>}>
      <ExploreGate searchParams={searchParams} />
    </Suspense>
  );
}

async function ExploreGate({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <ExploreScreen
      username={firstParam(params.u) ?? null}
      initialQuery={firstParam(params.q) ?? ""}
    />
  );
}
