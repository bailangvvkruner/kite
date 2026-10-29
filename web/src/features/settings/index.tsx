import { Outlet } from "@tanstack/react-router";

import { AppHeader } from "@/components/layout/app-header";
import { Main } from "@/components/layout/main";

// Each section heads its own page: the app sidebar already lists the
// sections, so the page repeats neither a menu nor a title over them, and
// each names the tab after itself.
export function Settings() {
  return (
    <>
      <AppHeader />

      <Main fixed>
        <Outlet />
      </Main>
    </>
  );
}
