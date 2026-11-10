import { Suspense } from "react";
import { WallDashboard } from "@/components/store/WallDashboard";
import { firstParam } from "@/lib/params";

export const metadata = {
  title: "The wall",
};

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-6 pt-16 font-display text-3xl text-leaf">Opening the room…</p>}>
      <WallGate searchParams={searchParams} />
    </Suspense>
  );
}

async function WallGate({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = firstParam(params.record);
  const id = raw ? Number(raw) : Number.NaN;
  return (
    <WallDashboard
      username={firstParam(params.u) ?? null}
      initialRecordId={Number.isInteger(id) && id > 0 ? id : null}
    />
  );
}
