# LinkedIn Lead Generation Plan

## Goal

Create a compliant, repeatable lead-generation workflow using LinkedIn as the discovery and relationship-building channel, not as a stealth scraping target.

The goal is to identify high-fit prospects, enrich them with permitted data, prioritize them, and move them into a CRM or outreach workflow with clear tracking.

## Compliance boundary

LinkedIn is sensitive to automation and data extraction. This plan avoids unsafe practices.

### Use

- LinkedIn Sales Navigator
- LinkedIn search and filters
- LinkedIn Lead Gen Forms
- LinkedIn Ads / Campaign Manager
- Manual research
- Official partner/API integrations where approved
- CRM integrations
- User-consented form data
- Public company websites
- Permissioned enrichment providers

### Avoid

- Browser spoofing
- Account rotation
- CAPTCHA bypass
- Proxy rotation to evade limits
- Scraping private/logged-in pages at scale
- Sending spammy mass connection requests
- Exporting personal data without a valid lawful basis
- Ignoring LinkedIn terms, local privacy rules, or opt-out requests

The safest strategy is not to “scrape LinkedIn.” The best strategy is to use LinkedIn for discovery and relationship signals, then enrich through compliant sources.

---

# 1. Define the ideal customer profile

Before collecting anything, define exactly who counts as a lead.

## ICP fields

Create a simple ICP document:

```text
Target companies:
- Industry:
- Geography:
- Company size:
- Funding/stage:
- Technology stack:
- Hiring signals:
- Pain points:

Target people:
- Job titles:
- Seniority:
- Departments:
- Keywords in profile/headline:
- Exclusions:

Offer:
- What problem are we solving?
- Why now?
- What proof do we have?
```

## Example ICP

```text
Companies:
- B2B SaaS companies
- 11–200 employees
- US, UK, Canada, EU
- Recently hiring AI/ML, data, or automation roles

People:
- Founder
- Head of Growth
- RevOps Manager
- CTO
- Product Lead

Signals:
- Recently posted about AI adoption
- Hiring automation or data roles
- Using manual workflows
- Recently raised funding
```

Deliverable:

```text
icp.md
```

---

# 2. Choose LinkedIn lead sources

Use multiple LinkedIn-native sources instead of one brittle scraping path.

## Source A: Sales Navigator searches

Best for high-intent prospect discovery.

Filters:

- Geography
- Industry
- Company headcount
- Seniority
- Function
- Title keywords
- Company growth
- Recent job changes
- Posted on LinkedIn recently

Output:

- Saved lead lists
- Saved account lists
- Manual review queue

## Source B: LinkedIn company pages

Use for:

- Company description
- Employee count range
- Recent posts
- Hiring signals
- Decision-maker discovery

Do not scrape aggressively. Treat this as manual or low-volume research unless using an approved integration.

## Source C: LinkedIn posts and comments

Use for intent signals:

- People discussing a pain point
- People asking for tools
- Companies announcing growth
- Hiring posts
- Product launch posts

Good keywords:

```text
"looking for"
"recommendations for"
"hiring"
"automation"
"AI workflow"
"RevOps"
"customer support automation"
"data pipeline"
"LLM"
"internal tools"
```

## Source D: LinkedIn Lead Gen Forms

Best for compliant data capture.

Use ads or sponsored content to collect consented leads.

Capture:

- Name
- Email
- Company
- Job title
- Company size
- Use case
- Consent checkbox where required

## Source E: Existing network

Use first-degree and second-degree relationships:

- Warm introductions
- Alumni networks
- Past employers
- Existing customers
- Founder communities

Warm LinkedIn leads usually convert better than cold scraped lists.

---

# 3. Lead data model

Use a structured schema so leads can be scored and routed.

## Lead record

```json
{
  "lead_id": "linkedin:person:generated-id",
  "source": "sales_navigator | lead_form | manual_research | post_signal | referral",
  "linkedin_profile_url": "https://www.linkedin.com/in/...",
  "full_name": "",
  "title": "",
  "company_name": "",
  "company_linkedin_url": "",
  "location": "",
  "seniority": "",
  "department": "",
  "lead_status": "new | reviewed | enriched | qualified | contacted | replied | disqualified",
  "fit_score": 0,
  "intent_score": 0,
  "confidence": "low | medium | high",
  "notes": "",
  "created_at": "",
  "updated_at": ""
}
```

## Account record

```json
{
  "account_id": "linkedin:company:generated-id",
  "company_name": "",
  "website": "",
  "linkedin_company_url": "",
  "industry": "",
  "headcount_range": "",
  "location": "",
  "funding_stage": "",
  "hiring_signals": [],
  "tech_signals": [],
  "pain_signals": [],
  "account_score": 0,
  "notes": ""
}
```

---

# 4. Collection workflow

## Step 1: Build saved searches

Create 3–5 Sales Navigator searches.

Example:

```text
Search 1: Founders at AI-curious B2B SaaS companies
Search 2: RevOps leaders at 51–500 employee SaaS companies
Search 3: CTOs hiring AI/ML engineers
Search 4: Product leaders posting about automation
Search 5: Support leaders discussing ticket volume or AI support
```

For each saved search, record:

```text
Search name:
URL:
Filters used:
Target persona:
Expected lead count:
Review cadence:
```

## Step 2: Review manually or with approved export path

For each candidate:

- Check title fit
- Check company fit
- Check recent activity
- Check if they match the offer
- Save profile/account to list
- Add notes

Do not attempt to bypass LinkedIn’s export limitations.

## Step 3: Enrich from permitted sources

After identifying a LinkedIn lead, enrich using:

- Company website
- Company careers page
- Press releases
- Crunchbase or similar, if licensed
- Apollo/Clearbit/People Data Labs, if licensed and compliant
- Public GitHub/org pages, if relevant
- News/search APIs

Enrichment should answer:

```text
Is this company real and active?
Is the person likely responsible for the problem?
Is there a current trigger?
Can we personalize outreach honestly?
```

## Step 4: Deduplicate

Deduplicate by:

- LinkedIn profile URL
- Company domain
- Email, if collected with permission
- CRM contact ID

Never create duplicate outreach records for the same person.

## Step 5: Score leads

Use a simple 100-point scoring model.

### Fit score: 0–50

```text
+15 correct title/seniority
+10 correct department
+10 correct company size
+10 correct industry
+5 correct geography
```

### Intent score: 0–30

```text
+10 recent relevant LinkedIn post
+10 hiring signal
+5 funding/growth signal
+5 recent tool/pain discussion
```

### Data confidence: 0–20

```text
+10 profile/company data verified
+5 company website verified
+5 role/responsibility verified
```

Qualification bands:

```text
80–100: high priority
60–79: qualified
40–59: nurture
0–39: disqualify or research more
```

---

# 5. Outreach workflow

## Principle

Use LinkedIn to start relevant conversations, not to spam.

## Outreach sequence

### Touch 1: Engage naturally

Before messaging:

- Read recent posts
- Like or comment only if genuinely useful
- Note a relevant trigger

### Touch 2: Connection request

Keep it short.

Template:

```text
Hi {first_name}, I saw your post about {specific_topic}. I’m researching how {persona}s are handling {pain_point}. Would be glad to connect.
```

### Touch 3: First message after acceptance

```text
Thanks for connecting, {first_name}. Your point about {specific_topic} stood out.

I’m working with teams that are trying to {outcome}. Curious — is {pain_point} something your team is dealing with right now?
```

### Touch 4: Value message

```text
A pattern I’m seeing: teams often start with {common_problem}, then get stuck at {bottleneck}.

I wrote a short checklist on how to evaluate this. Want me to send it over?
```

### Touch 5: Soft CTA

```text
If useful, I can share 2–3 ideas specific to {company}. No pitch — just quick notes based on what I saw publicly.
```

Avoid:

- fake personalization
- huge pitch messages
- immediate meeting links
- misleading claims
- high-frequency automation

---

# 6. CRM pipeline

Use a simple pipeline.

```text
New lead
  -> Reviewed
  -> Enriched
  -> Qualified
  -> Contacted
  -> Replied
  -> Meeting booked
  -> Opportunity
  -> Closed won/lost
  -> Nurture
```

Minimum fields in CRM:

```text
Name
LinkedIn URL
Company
Title
Source
ICP segment
Fit score
Intent score
Last touch date
Next action
Owner
Notes
```

Recommended tools:

- Airtable for simple tracking
- HubSpot for CRM
- Notion for early-stage manual pipeline
- Google Sheets for MVP
- Postgres/Airtable if building an internal lead engine

---

# 7. Automation architecture

Only automate safe, compliant steps.

## Safe automation

```text
Manual/approved LinkedIn source
  -> Lead import CSV/API
  -> Deduplication
  -> Enrichment from permitted APIs
  -> Scoring
  -> CRM update
  -> Outreach task creation
  -> Human review
```

## Avoid automation

```text
Automated profile scraping
Automated connection spam
Automated messages at high volume
Browser fingerprint spoofing
Proxy rotation
CAPTCHA bypass
Fake account farms
```

## Recommended MVP tool

Build a small local lead processor:

```text
input: leads.csv
output:
- normalized_leads.jsonl
- scored_leads.csv
- crm_import.csv
- outreach_tasks.md
```

Core modules:

```text
lead_normalizer.py
lead_enricher.py
lead_scorer.py
deduper.py
crm_exporter.py
```

---

# 8. Metrics

Track weekly.

## Source metrics

```text
leads reviewed
leads saved
qualified leads
source-to-qualified rate
```

## Outreach metrics

```text
connection requests sent
acceptance rate
messages sent
reply rate
positive reply rate
meetings booked
```

## Quality metrics

```text
percentage with verified company website
percentage with verified role
duplicate rate
bad-fit rate
```

## Business metrics

```text
qualified opportunities
pipeline generated
closed revenue
cost per qualified lead
```

---

# 9. Weekly operating cadence

## Monday: Source building

- Review ICP
- Update saved searches
- Add 50–100 candidate leads manually or via approved export/integration

## Tuesday: Enrichment

- Verify company websites
- Add trigger notes
- Score leads

## Wednesday: Outreach

- Send high-quality connection requests
- Write personalized first messages

## Thursday: Follow-up

- Reply to responses
- Move qualified leads to CRM
- Book calls

## Friday: Analytics

- Review metrics
- Remove poor sources
- Improve templates
- Update ICP

---

# 10. Implementation plan for a small lead engine

## Milestone 1: Manual MVP

Deliverables:

- `icp.md`
- `lead_sources.md`
- `leads.csv`
- `scoring_rules.md`
- `outreach_templates.md`

Success criteria:

- 100 leads reviewed
- 30 qualified leads
- 10 personalized outreach messages sent

## Milestone 2: Lead processor

Build a CLI tool that:

- Reads `leads.csv`
- Normalizes LinkedIn/company URLs
- Deduplicates contacts
- Scores leads
- Exports CRM-ready CSV

Success criteria:

- Duplicate rate below 5%
- Every lead has source, status, and score

## Milestone 3: Enrichment layer

Add permitted enrichment:

- company website lookup
- domain extraction
- public website metadata
- hiring page signal
- news/search signal

Success criteria:

- 80% of qualified leads have verified company website
- 50% have at least one intent signal

## Milestone 4: CRM integration

Push qualified leads to:

- Airtable
- HubSpot
- Notion
- Google Sheets

Success criteria:

- one-click export or API sync
- no duplicate contacts
- next-action tasks created

## Milestone 5: Reporting

Create weekly report:

```text
new leads
qualified leads
top sources
reply rate
meetings booked
pipeline created
```

Success criteria:

- weekly report generated automatically
- source quality visible

---

# 11. Risks and mitigations

## Risk: LinkedIn account restrictions

Mitigation:

- Avoid high-volume automation
- Use manual review
- Use Sales Navigator and approved integrations
- Do not bypass limits

## Risk: Low-quality leads

Mitigation:

- Tighten ICP
- Improve scoring
- Add disqualification rules
- Review bad-fit examples weekly

## Risk: Spammy outreach

Mitigation:

- Keep messages short
- Personalize based on real trigger
- Ask relevant questions
- Use human review

## Risk: Privacy/compliance issues

Mitigation:

- Store only necessary data
- Track source and lawful basis
- Honor deletion/opt-out requests
- Avoid sensitive personal data

---

# 12. Final recommended workflow

Use this workflow:

```text
Define ICP
  -> Build LinkedIn/Sales Navigator searches
  -> Save leads/accounts manually or through approved integration
  -> Enrich from permitted sources
  -> Deduplicate
  -> Score
  -> Human review
  -> CRM export
  -> Personalized outreach
  -> Track replies and meetings
  -> Improve weekly
```

The goal is not to extract the largest possible list. The goal is to build a high-quality, compliant lead engine that produces conversations.
