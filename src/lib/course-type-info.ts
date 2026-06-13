/**
 * Plain-language definitions for the course delivery/format types shown to
 * learners, used for hover tooltips. Keyed by the lower-cased display label so
 * both the catalog vocabulary (Video/Interactive/Document/Blended) and the
 * delivery vocabulary (Self-Paced/Instructor-Led/SCORM/External/E-Learning)
 * resolve.
 */
export const COURSE_TYPE_DEFINITIONS: Record<string, string> = {
  "self-paced":
    "Learn on your own schedule — work through the material anytime, at your own pace, with no scheduled sessions.",
  "instructor-led":
    "Delivered by an instructor in scheduled live sessions, in person or virtual.",
  blended:
    "A mix of self-paced online content and instructor-led live sessions.",
  scorm:
    "An interactive e-learning module (SCORM standard) that runs inside the course player.",
  external:
    "Content hosted outside the platform — you'll be directed to an external site or tool.",
  "e-learning":
    "Online, self-paced digital coursework you complete in your browser.",
  video: "Self-paced video lessons you can watch anytime, at your own pace.",
  interactive:
    "Hands-on, interactive coursework — often activity-based or instructor-led.",
  document:
    "Reading-based material such as documents, PDFs, or SCORM e-learning packages.",
};

/** Look up a course-type definition by its display label (case-insensitive). */
export function courseTypeDefinition(label?: string | null): string | undefined {
  if (!label) return undefined;
  return COURSE_TYPE_DEFINITIONS[label.trim().toLowerCase()];
}
