ALTER TABLE payment_invoice DROP CONSTRAINT payment_invoice_status_check;
ALTER TABLE payment_invoice ADD CONSTRAINT payment_invoice_status_check CHECK (status IN ('DRAFT', 'PAID'));
ALTER TABLE payment_invoice ADD COLUMN version integer NOT NULL DEFAULT 0;
ALTER TABLE payment_invoice ADD COLUMN paid_at timestamp with time zone;
ALTER TABLE payment_invoice ADD CONSTRAINT payment_invoice_paid_at_check CHECK ((status = 'PAID') = (paid_at IS NOT NULL));
