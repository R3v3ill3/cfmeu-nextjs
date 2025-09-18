ALTER TABLE public.employers
DROP COLUMN IF EXISTS incolink_employer_id,
DROP COLUMN IF EXISTS last_incolink_payment_date;
