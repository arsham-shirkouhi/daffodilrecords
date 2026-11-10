import { Suspense } from "react";
import { StoreScreen } from "@/components/store/StoreScreen";
import { firstParam } from "@/lib/params";

export const metadata = {
  title: "The collection",
};

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-6 pt-16 font-display text-3xl text-leaf">Opening the crates…</p>}>
      <CollectionGate searchParams={searchParams} />
    </Suspense>
  );
}

async function CollectionGate({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = firstParam(params.record);
  const id = raw ? Number(raw) : Number.NaN;
  return (
    <StoreScreen
      username={firstParam(params.u) ?? null}
      initialRecordId={Number.isInteger(id) && id > 0 ? id : null}
    />
  );
}
