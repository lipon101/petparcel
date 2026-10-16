// The admin panel's data source - the ONE seam between the panel and its data.
//
// There is exactly one source now: the REAL server. Every page reads and writes
// through `useAdminData()`, which returns a live source backed by the
// `admin.*` tRPC procedures (see live-source.ts). The panel no longer ships any
// demo, mock, seeded or static rows - what you see is the production database.
//
// The storefront is unaffected: it reads the real catalog through the
// `catalog.*` procedures and never imports anything from this folder.
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createLiveSource } from "./live-source";
import type { AdminDataSource } from "./types";

/** The real, database-backed source. */
export function makeAdminDataSource(): AdminDataSource {
  return createLiveSource();
}

// A module-level singleton so the panel talks to one client for its lifetime.
let singleton: AdminDataSource | null = null;
export function getAdminDataSource(): AdminDataSource {
  if (!singleton) singleton = makeAdminDataSource();
  return singleton;
}

const AdminDataContext = createContext<AdminDataSource | null>(null);

/** Provides the admin data source to the panel. Defaults to the singleton, but
 *  accepts an override so tests can inject a stub. */
export function AdminDataProvider({
  children,
  source,
}: {
  children: ReactNode;
  source?: AdminDataSource;
}) {
  const value = useMemo(() => source ?? getAdminDataSource(), [source]);
  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

/** The data source every admin page reads and writes through. */
export function useAdminData(): AdminDataSource {
  const ctx = useContext(AdminDataContext);
  return ctx ?? getAdminDataSource();
}
