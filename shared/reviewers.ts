// Reviewer identity helpers for the avatar mark.
//
// WHY THIS IS ITS OWN MODULE. These two facts used to live at the bottom of
// `shared/catalog-data.ts` - a ~270 kB file holding every product, variant and
// description. They are `const` bindings, so they cannot be tree-shaken out of a
// module that is imported for them: the moment any client component imported
// `reviewerGender` from the catalogue, the bundler had to keep the whole file,
// and the entire product catalogue shipped in the initial JavaScript of EVERY
// page - including the checkout, which never renders a product. Moving them here
// lets the catalogue stay on the server (and in the route chunks that genuinely
// need it) while the avatar mark pulls in a few hundred bytes.

/** Reviewers whose presentation is known, keyed by the name shown on the review.
 *
 *  Deliberately EMPTY, and that is the correct state: it is populated only for
 *  reviewers whose gender is actually known. An unknown name renders the neutral
 *  mark (see `ReviewerMark`), never a guess. Add an entry only when the fact is
 *  known - never infer one from a first name. */
export const REVIEWER_GENDER: Record<string, "male" | "female"> = {};

/** The known presentation for a reviewer, or null when it is not known. */
export function reviewerGender(name: string): "male" | "female" | null {
  return REVIEWER_GENDER[name.trim()] ?? null;
}
