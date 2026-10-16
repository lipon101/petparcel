// Template leftover. The real signup page is @/pages/Register, which uses the
// storefront's own design system. This keeps the old import path harmless
// instead of leaving a dead page that navigates to a route that no longer exists.
import { Redirect } from "wouter";

export default function Signup() {
  return <Redirect to="/register" />;
}
