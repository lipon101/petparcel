// Runs before every test file. The routers import `_core/db` (for
// `isUniqueViolation`), and `_core/env.ts` binds required variables at import
// time - so the runner needs well-formed values even though every data call in
// the tests is mocked. The platform injects the real ones at runtime.
process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/petparcel_test";
process.env.JWT_SECRET ??= "test-jwt-secret-not-for-production";
