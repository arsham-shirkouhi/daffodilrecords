import { redirect } from "next/navigation";
import { Suspense } from "react";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <SendToStore params={params} />
    </Suspense>
  );
}

async function SendToStore({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/store/collection?record=${encodeURIComponent(id)}`);
  return null;
}
