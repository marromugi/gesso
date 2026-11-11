import { Outlet, createRootRoute } from "@tanstack/react-router";
import { AccountMenu } from "@/components/account/AccountMenu";
import { ToastRegion } from "@/components/ui/ToastRegion";

export const Route = createRootRoute({
  component: RootLayout,
  // A sign-in that failed comes back with Better Auth's error code in `?error=`.
  validateSearch: (search: Record<string, unknown>): { error?: string } =>
    typeof search.error === "string" ? { error: search.error } : {},
});

function RootLayout() {
  const { error } = Route.useSearch();
  return (
    <>
      <header className="flex items-center justify-between gap-4 p-4">
        <h1 className="text-xl font-bold">gesso</h1>
        <AccountMenu signInError={error} />
      </header>
      <main className="p-4">
        <Outlet />
      </main>
      <ToastRegion />
    </>
  );
}
