// Google sign-in helpers, shared with the server so the callback path is one
// value on both sides (the server builds the URL it hands to the provider, and
// the client route has to match it). The implementation and its reasoning live
// in `@shared/google-auth`; this re-export keeps the client import path stable.
export {
  GOOGLE_CALLBACK_PATH,
  GOOGLE_EXPIRED_MESSAGE,
  GOOGLE_FAILURE_MESSAGE,
  GOOGLE_SESSION_VERIFIER_PARAM,
  googleCallbackUrl,
  googleReturnedError,
  readSessionVerifier,
  stripSessionVerifier,
} from "@shared/google-auth";
