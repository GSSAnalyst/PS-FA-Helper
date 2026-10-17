# Roadmap: from team tool to national product

## Phase 1: Team rollout (done in v1.0.0)
Bring-your-own-key extension, store-ready: icons, privacy policy, key check, packaging script,
publishing guide. Publish as **Unlisted** and share the link with the team.

What to learn from the team before Phase 2: which questions they ask most, how often, what it
costs per person per month (check the Anthropic console), and what answers were wrong.

## Phase 2: Hosted service on Supabase (no payments yet)
Goal: staff install it and sign in. No API key needed. You pay Anthropic and control usage.

    Extension ──(Supabase auth JWT)──> Supabase Edge Function "ask" ──(your API key)──> Anthropic
                                            │
                                            └─ Postgres: users, orgs, usage (counts only, no question text)

Work items:
1. **Supabase project:** email magic-link or Google sign-in. Tables `orgs`, `profiles`
   (user → org, role), `usage` (user, date, tokens, request count).
2. **Edge Function `ask`:** verifies the JWT, checks the user's daily/monthly limit, forwards the
   request to Anthropic with the server-held key, records token usage, and returns the response.
   The PeopleBook search stays in the extension; only API calls move.
3. **Extension:** add a sign-in screen and replace the direct `fetch` in claude.js with a call to the
   function. Keep "use my own API key" as an advanced option.
4. **Manifest:** swap the host permission to `https://<project>.supabase.co/*`.
5. **Privacy policy update:** you now process data, so state retention (store no question text or
   screenshots, only usage counts) and sub-processors (Supabase, Anthropic).
6. **Admin view:** a simple Supabase dashboard or page listing usage per user and per school.

## Phase 3: Payments, when there's demand
- Schools buy per-office licenses through procurement (purchase orders, invoices), so plan for
  **Stripe invoices per institution** as well as individual subscriptions.
- Add a `plan` column on `orgs`; the edge function enforces limits by plan.
- Price above cost: measure the average cost per question in Phase 2 first.

## Before going national (non-code work)
- **Oracle content:** the bundled `kb/peoplebook-fa.json` is Oracle's copyrighted documentation.
  It's fine for internal use, but redistributing it in a public or paid product needs Oracle's
  permission. Alternatives: rely on web search of docs.oracle.com (already allowed), or have each
  school build the index from its own copy of the PDF.
- **State aid:** CSAC and Cal Grant are California-specific. Make state agency domains a setting.
- **FERPA and procurement:** schools will ask for a data processing agreement, a security
  questionnaire (HECVAT is standard in higher ed) and an accessibility statement (VPAT/WCAG 2.1 AA).
- **Business setup:** an LLC, a business bank account, terms of service, and a support email.
- **Trademarks:** don't use Oracle/PeopleSoft logos; keep the "not affiliated with" line.
