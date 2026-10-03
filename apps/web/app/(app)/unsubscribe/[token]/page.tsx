import type { Metadata } from "next";
import { getUnsubscribe } from "@/lib/api-server";
import { UnsubscribeView } from "./unsubscribe-view";

export const metadata: Metadata = {
  title: "Email preferences · UserHQ",
  referrer: "no-referrer",
};

interface UnsubscribePageProps {
  params: Promise<{ token: string }>;
}

export default async function UnsubscribePage({
  params,
}: UnsubscribePageProps): Promise<React.JSX.Element> {
  const { token } = await params;
  const result = await getUnsubscribe(token);

  return (
    <div className="flex flex-1 justify-center items-start pt-8 sm:pt-16">
      <UnsubscribeView token={token} initialResult={result} />
    </div>
  );
}
