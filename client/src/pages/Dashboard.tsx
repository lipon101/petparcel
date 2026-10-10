// Scaffold leftover: the template's demo item-list page. The real store has no
// /dashboard route — the customer overview lives in @/pages/Account and the
// operations dashboard in @/pages/Admin. This re-export keeps the old import
// path compiling for anything that still references it.
export { AdminDashboard as default } from "@/pages/Admin";
