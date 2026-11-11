-- Certificate expiry reminders and working share links.
--
-- 1. expiry_reminders_sent: which "expires in N days" emails a certificate's
--    holder has had (90, 30). The daily cron
--    (/api/cron/certification-expiry) skips a tier already in the list, so a
--    missed day never means a missed reminder, and a re-award resets it.
--
-- 2. verification_code: the code in a certificate's public link
--    (/verify/<code>). It used to be minted only when the learner first
--    opened their certificate, so "Copy link" and "Share on LinkedIn" before
--    then pointed at a code that didn't exist. Every row now gets one when it
--    is written, in the same format the app uses (LMS-XXXX-XXXX-XXXX, no
--    I/O/0/1), and rows without one are filled in.

ALTER TABLE public.user_certifications
  ADD COLUMN IF NOT EXISTS expiry_reminders_sent integer[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.new_certificate_verification_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = ''
AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  -- 32 symbols divide 256 evenly, so byte % 32 is unbiased.
  bytes bytea := extensions.gen_random_bytes(12);
  code text := '';
BEGIN
  FOR i IN 0..11 LOOP
    IF i > 0 AND i % 4 = 0 THEN
      code := code || '-';
    END IF;
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  END LOOP;
  RETURN 'LMS-' || code;
END;
$$;

ALTER TABLE public.user_certifications
  ALTER COLUMN verification_code SET DEFAULT public.new_certificate_verification_code();

UPDATE public.user_certifications
SET verification_code = public.new_certificate_verification_code()
WHERE verification_code IS NULL;
