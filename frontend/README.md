Phase 7 — Convert “Jobs” into a real job workflow
7.1 Job actions (must-have)

Assign staff (job assignedTo userId, plus “My Jobs” filter)

Job checklists (custom per org + per job)

Job attachments (photos, PDFs, site docs)

Start simple: S3/R2 storage + DB metadata

Job comments / internal notes thread (audit who wrote what)

7.2 On-site time tracking (quick win)

Start/stop timer per job

Store time entries: startedAt, endedAt, note, userId

Job totals: labour hours and labour cost (optional later)

7.3 Job scheduling (calendar worthy)

Drag/drop calendar (weekly view)

Conflict warnings if staff double-booked

SMS/email reminders to customer (later)

Phase 8 — Invoices + Payments (revenue enabling)
8.1 Invoicing

Convert job → invoice

Invoice statuses: draft → sent → paid → overdue → void

Invoice PDF generation

Email invoice to customer (same mailer system you built)

8.2 Payments

Stripe Payment Link or hosted checkout for invoice

Record payment events via webhook

Receipt email to customer

Optional: partial payments + deposits

Phase 9 — Pricebook + Templates that scale
9.1 Pricebook upgrades

Categories + tags

“Favourite items”

Bundles / Kits (e.g., “Hot Water Install Pack”)

9.2 Quote templates

Templates by job type (plumbing/electrical/general)

Pre-filled scope text + default line items

“Duplicate quote” as template

Phase 10 — Customer portal (high retention feature)

Customer can:

View quote history + accept

View job status

View invoices + pay

Upload photos / documents

This reduces admin calls massively.

Phase 11 — Notifications + Activity log

Global activity feed per org:

“Quote sent”, “Job scheduled”, “Invoice paid”

Email notifications:

Quote sent

Quote accepted/declined

Job scheduled

Invoice overdue

Phase 12 — Admin + SaaS hardening

Role permissions (fine-grained)

staff can’t edit org/billing

Rate limiting on auth + public routes

Audit log export (CSV)

Backup/restore strategy (Mongo + file storage)












Accepted Quote → Job → Invoice → Send/Pay → Receipt/Status updates, all with one canonical totals engine (quoteMath.computeQuoteTotals) and billing gating (requireActiveBilling) where needed.

What we should build next (Phase 6)
A) “Create invoice from job” (and/or from accepted quote)

Backend

POST /api/jobs/:id/invoices (creates draft invoice from job snapshot)

Prevent duplicates: if job already has an invoice, return it (idempotent)

Invoice lines + totals computed using computeQuoteTotals()

Frontend

Job detail page: Create Invoice button (only when job is completed or at least in_progress, your choice)

After creation: navigate to invoice detail view

B) Invoice lifecycle + delivery

Statuses: draft → issued/sent → paid → void

POST /api/invoices/:id/send (email PDF to customer)

GET /api/invoices/:id/pdf (download/preview)

Optional next: Stripe payment link per invoice (or “Pay invoice” public page like your public quote)

C) Billing gate the revenue features (without breaking auth/refresh)

Gate: invoice creation, sending, job creation from quote, etc.

Don’t gate: auth refresh endpoints, public quote/invoice pages, org billing pages

The minimum files I need next (so I don’t assume anything)

Please paste these files exactly as they are:

Backend (must-have)

backend/models/Invoice.js

backend/routes/invoice.routes.js

backend/routes/job.routes.js

backend/routes/quote.routes.js (the part where quote becomes accepted / job created if you already did that)

backend/server.js (just the routes mounting section)

Frontend (must-have)

frontend/src/api/invoicesApi.ts

frontend/src/api/jobsApi.ts

frontend/src/pages/Jobs/JobDetail.tsx

frontend/src/pages/Invoices/Invoices.tsx and frontend/src/pages/Invoices/InvoicesList.tsx

frontend/src/App.tsx (routes only is fine)

While you grab those: what I’m going to implement (no surprises)

Once I have the files above, I’ll patch in:

Backend changes

Job → Invoice creation endpoint

pulls from job.customerSnapshot, job.lines, job.orgId

totals computed via computeQuoteTotals({ lines, orgTaxRate })

Add invoiceId reference onto Job (recommended)

Add idempotency check (job can’t spawn multiple invoices)

Add requireAuth + requireActiveBilling() on create/send endpoints

Frontend changes

In JobDetail.tsx: Create Invoice CTA that calls jobsApi.createInvoice(jobId) then routes to invoice

Invoices list uses your invoicesApi.list(...)

Invoice detail page (if you have one) gets Send invoice + Download PDF