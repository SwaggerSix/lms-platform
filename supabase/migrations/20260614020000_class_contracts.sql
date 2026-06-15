-- Link a course delivery (class/cohort) to its commercial contract.
--
-- contract_number is the reference (e.g. a PO/contract ID); contract_url points
-- at the actual contract document stored in SharePoint, so admins can open it
-- from within the LMS. Access to these fields is restricted to admins in the
-- application layer — contracts are commercially sensitive and hidden from
-- instructors and learners.

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS contract_number TEXT,
  ADD COLUMN IF NOT EXISTS contract_url TEXT,
  ADD COLUMN IF NOT EXISTS contract_file_name TEXT;

CREATE INDEX IF NOT EXISTS idx_classes_contract_number ON public.classes(contract_number);
