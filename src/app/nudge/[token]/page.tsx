import NudgeResponseClient from "./nudge-response-client";

export const dynamic = "force-dynamic";

export default async function PublicNudgePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <NudgeResponseClient token={token} />;
}
