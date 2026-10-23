# Boostify Funding — V1 UI

The Funding page is mounted at `/funding`; `/funding/eligibility`, `/application`, `/documents`, `/status`, `/offers`, and `/dashboard` reuse the same module surface. It is available through Boostify's existing route wrapper and bottom navigation.

## Current behavior

- A five-step readiness flow collects profile, catalog, rights, revenue and request context.
- A configurable readiness estimate lives in `config/fundingRules.ts`. Its result is based on whether information is present, not partner underwriting criteria.
- Draft answers and the local status marker are stored in user-scoped browser `sessionStorage` for this prototype. They are not submitted to Boostify's server or RUN.
- Document checkboxes are a preparation checklist only. No file is uploaded or stored.
- Support links open Boostify's existing `/messages` inbox.
- RUN is shown as Funding Partner #1 with criteria pending confirmation.

## Production integration needed

Before collecting real applications, move draft data into an authenticated, owner-scoped server API; add private document storage with access control and audit logs; persist explicit partner consent server-side; and connect partner submissions only after requirements and consent copy are approved. The repository currently uses Clerk, Drizzle and Firebase messaging rather than a configured Supabase Funding service.
