-- The store product for the $599 bundle (MOS-100 + MOS-230 + MOS-240) was still
-- called "Mosaic Certification Bundle". It earns one certification, Mosaic
-- Practitioner Certified (20261111190000), so it takes that name: the website
-- links to it as "Mosaic Practitioner Certification". Operator request
-- 2026-11-13. Idempotent; only this product, only the old name.
update products
set name = 'Mosaic Practitioner Certification',
    description = replace(description, 'Mosaic Certification Bundle', 'Mosaic Practitioner Certification'),
    updated_at = now()
where id = '4c513850-6985-4d2a-8de2-257bf8ef68c1'
  and name = 'Mosaic Certification Bundle';
