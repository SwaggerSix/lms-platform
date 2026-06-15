-- Provenance for course cover images: where each image came from and its
-- licensing status, so we can prove every catalog image is cleared for use.
alter table courses add column if not exists cover_source_url text;
alter table courses add column if not exists cover_source_name text;
alter table courses add column if not exists cover_license text;
alter table courses add column if not exists cover_attribution text;
alter table courses add column if not exists cover_origin text;

comment on column courses.cover_source_url is 'Origin URL of the cover image (CC0/public-domain source), or empty for AI-generated.';
comment on column courses.cover_source_name is 'Source library/name, e.g. Unsplash, Pexels, Wikimedia Commons, or AI-generated.';
comment on column courses.cover_license is 'License of the cover image, e.g. CC0, Public Domain, Original (AI-generated).';
comment on column courses.cover_attribution is 'Attribution text, if the license requires crediting the creator.';
comment on column courses.cover_origin is 'Normalized origin: cc0 | public_domain | original_ai | licensed | other.';
