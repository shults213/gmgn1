import { createFileRoute } from "@tanstack/react-router";
import { DeskShell } from "@/components/desk/desk-shell";
import { fetchDeskSnapshot } from "@/lib/gmgn/api";

export const Route = createFileRoute("/")({
  loader: () => fetchDeskSnapshot({ data: { interval: "5m", platform: "all" } }),
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  return <DeskShell initial={initial} />;
}
