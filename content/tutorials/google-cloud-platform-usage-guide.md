# Google Cloud Platform Usage Guide: From First Project To Production

Google Cloud Platform, usually called GCP or Google Cloud, is a cloud platform for running applications, storing files, hosting databases, building APIs, processing data, managing machine learning workloads, and operating production systems without buying servers.

This tutorial is a practical path through Google Cloud usage. It is written for someone who wants to move from "I have a Google Cloud account" to "I can create projects, deploy apps, manage access, control cost, and debug production services without guessing."

The examples use the Google Cloud CLI, `gcloud`, because commands are repeatable and work well in automation. You can do many of the same tasks in the Google Cloud Console, but a terminal-first workflow makes it easier to document, review, and reproduce your setup.

## What You Will Learn

- How Google Cloud accounts, organizations, projects, billing accounts, and resources fit together.
- How to install and use the Google Cloud CLI.
- How to structure projects for development, staging, and production.
- How to enable APIs intentionally instead of clicking around randomly.
- How Identity and Access Management works.
- How to deploy a web app to Cloud Run.
- How to choose between Cloud Storage, Firestore, Cloud SQL, and BigQuery.
- How to handle secrets, environment variables, logs, metrics, budgets, and alerts.
- How to move toward a production-ready setup without overengineering the first version.

## Official References

Use the official docs whenever you are about to make production decisions:

- Google Cloud CLI install docs: `https://docs.cloud.google.com/sdk/docs/install`
- IAM roles overview: `https://cloud.google.com/iam/docs/roles-overview`
- Service accounts overview: `https://docs.cloud.google.com/iam/docs/service-account-overview`
- Cloud Run source deploy docs: `https://docs.cloud.google.com/run/docs/deploying-source-code`
- Google Cloud budgets and alerts: `https://docs.cloud.google.com/billing/docs/how-to/budgets`

## 1. The Mental Model: Organizations, Projects, Services, And Resources

Google Cloud is organized in layers.

At the top, larger teams may have an organization. The organization represents a company or domain. Under that, teams can create folders. Under folders, or directly under the organization, you create projects. A project is the main working container.

Most individual developers and small teams can think in projects first:

```text
Google account or organization
  └── Project
        ├── Enabled APIs
        ├── IAM permissions
        ├── Billing link
        ├── Cloud Run services
        ├── Storage buckets
        ├── Databases
        ├── Logs
        └── Monitoring data
```

A project is not just a folder. It is the boundary where billing, access control, quotas, service enablement, logs, and resources meet. If you put development and production in the same project, you make access reviews, billing reports, and incident response harder. Use separate projects for separate environments whenever the app matters.

A clean naming pattern looks like this:

```text
myapp-dev
myapp-staging
myapp-prod
```

For a storefront, you might use:

```text
lumalens-dev
lumalens-staging
lumalens-prod
```

This helps you understand risk at a glance. A command targeting `lumalens-dev` is much safer than one targeting `lumalens-prod`.

## 2. Create Your First Project

Install the Google Cloud CLI first. After installation, authenticate:

```bash
gcloud init
```

This walks you through login and default project selection. To create a project:

```bash
gcloud projects create lumalens-dev --name="LumaLens Dev"
gcloud config set project lumalens-dev
```

Check the active project before running important commands:

```bash
gcloud config get-value project
```

List your projects:

```bash
gcloud projects list
```

Describe one project:

```bash
gcloud projects describe lumalens-dev
```

The project ID is globally unique and often becomes part of service account emails, URLs, and resource names. Pick it carefully.

## 3. Billing: Enable It, Then Put Guardrails Around It

Google Cloud resources can cost money. A project must be linked to a billing account before paid services can run.

List billing accounts:

```bash
gcloud billing accounts list
```

Link a project to a billing account:

```bash
gcloud beta billing projects link lumalens-dev \
  --billing-account=BILLING_ACCOUNT_ID
```

Budget alerts are one of the first things you should configure. They are alerts, not hard caps, but they tell you when actual or forecasted spend crosses thresholds.

Recommended starter budget thresholds:

- 50 percent actual spend.
- 75 percent actual spend.
- 90 percent forecasted spend.
- 100 percent actual spend.

Also add labels to resources wherever possible:

```text
app=lumalens
env=dev
owner=shuvrojit
cost-center=personal
```

Labels make billing reports useful. Without labels, your bill becomes a pile of service names with no human meaning.

## 4. Use CLI Configurations Instead Of Constantly Switching By Hand

If you work across multiple projects, named `gcloud` configurations save you from mistakes.

Create a configuration:

```bash
gcloud config configurations create lumalens-dev
gcloud config set project lumalens-dev
gcloud config set run/region us-central1
```

Create another one:

```bash
gcloud config configurations create lumalens-prod
gcloud config set project lumalens-prod
gcloud config set run/region us-central1
```

Switch between them:

```bash
gcloud config configurations activate lumalens-dev
gcloud config configurations activate lumalens-prod
```

List configurations:

```bash
gcloud config configurations list
```

This is a simple habit that prevents a lot of accidental production changes.

## 5. Enable APIs Intentionally

Google Cloud services are accessed through APIs. New projects often need APIs enabled before services work.

For a basic web app on Cloud Run, enable:

```bash
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable logging.googleapis.com
gcloud services enable monitoring.googleapis.com
```

Why these matter:

- Cloud Run runs the app.
- Cloud Build can build source code into deployable artifacts.
- Artifact Registry stores container images.
- Secret Manager stores sensitive values.
- Cloud Logging captures application and platform logs.
- Cloud Monitoring powers metrics, dashboards, and alerts.

List enabled APIs:

```bash
gcloud services list --enabled
```

Disable unused APIs when experiments are finished:

```bash
gcloud services disable SERVICE_NAME
```

Do not enable every API "just in case." Keep the project understandable.

## 6. IAM: Give The Smallest Permission That Works

IAM, or Identity and Access Management, controls who can do what.

The basic IAM shape is:

```text
member + role + resource = permission
```

Examples of members:

- A user: `user:person@example.com`
- A group: `group:developers@example.com`
- A service account: `serviceAccount:app-runner@project.iam.gserviceaccount.com`

Examples of roles:

- `roles/viewer`
- `roles/run.admin`
- `roles/secretmanager.secretAccessor`
- `roles/cloudsql.client`
- `roles/iam.serviceAccountUser`

Avoid broad basic roles like Owner and Editor for normal work. They are convenient, but they make it easy to accidentally grant too much.

For people, prefer groups:

```bash
gcloud projects add-iam-policy-binding lumalens-dev \
  --member="group:developers@example.com" \
  --role="roles/viewer"
```

For applications, use service accounts.

Create a runtime service account:

```bash
gcloud iam service-accounts create lumalens-runner \
  --display-name="LumaLens runtime service account"
```

Grant it permission to read secrets:

```bash
gcloud projects add-iam-policy-binding lumalens-dev \
  --member="serviceAccount:lumalens-runner@lumalens-dev.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

View a project's IAM policy:

```bash
gcloud projects get-iam-policy lumalens-dev
```

Production rule: the account that deploys your app and the account your app runs as should usually be different. Deployment needs power to update infrastructure. Runtime should only have access to the resources the app needs while serving requests.

## 7. Service Accounts Are Software Identities

A service account is an identity for software. Cloud Run services, build pipelines, background workers, VMs, and scheduled jobs can run as service accounts.

Good service account names describe the workload:

```text
lumalens-web-runner
lumalens-worker-runner
lumalens-ci-deployer
lumalens-backup-job
```

Bad names:

```text
admin
test
default
new-service-account
```

Avoid long-lived JSON keys when possible. Google Cloud services can usually attach service accounts directly. CI systems can often use workload identity federation instead of storing keys. If you must create a key, treat it like a password.

List service accounts:

```bash
gcloud iam service-accounts list
```

Describe one:

```bash
gcloud iam service-accounts describe \
  lumalens-runner@lumalens-dev.iam.gserviceaccount.com
```

## 8. Deploy A Web App To Cloud Run

Cloud Run is a strong default for web apps and APIs. It runs containers, handles HTTPS, scales automatically, supports revisions, and can scale down when idle.

From a project directory, you can deploy from source:

```bash
gcloud run deploy lumalens-web \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

This asks Cloud Build to build the app and deploy it to Cloud Run. For early projects, source deploys are easy. For larger teams, explicit Dockerfiles and CI/CD pipelines give more control.

Describe the service:

```bash
gcloud run services describe lumalens-web --region us-central1
```

Read recent logs:

```bash
gcloud run services logs read lumalens-web \
  --region us-central1 \
  --limit 100
```

Set a max instance limit to prevent surprise scale:

```bash
gcloud run services update lumalens-web \
  --region us-central1 \
  --max-instances 10
```

Set environment variables:

```bash
gcloud run services update lumalens-web \
  --region us-central1 \
  --set-env-vars NODE_ENV=production,APP_ENV=dev
```

Use a specific runtime service account:

```bash
gcloud run services update lumalens-web \
  --region us-central1 \
  --service-account lumalens-runner@lumalens-dev.iam.gserviceaccount.com
```

Cloud Run keeps revisions. That means each deploy has a revision name and you can move traffic between revisions.

List revisions:

```bash
gcloud run revisions list \
  --service lumalens-web \
  --region us-central1
```

Rollback traffic to a known revision:

```bash
gcloud run services update-traffic lumalens-web \
  --region us-central1 \
  --to-revisions REVISION_NAME=100
```

## 9. Public vs Private Cloud Run Services

Use `--allow-unauthenticated` only for services that should be public, such as a public website or public API.

For internal tools, leave unauthenticated access disabled:

```bash
gcloud run deploy admin-tool \
  --source . \
  --region us-central1 \
  --no-allow-unauthenticated
```

Then grant invoker access only to the right identities:

```bash
gcloud run services add-iam-policy-binding admin-tool \
  --region us-central1 \
  --member="user:person@example.com" \
  --role="roles/run.invoker"
```

For a real company admin panel, also consider Identity-Aware Proxy, private ingress, or a separate authentication layer. Do not expose admin tools publicly just because they have a login screen.

## 10. Store Files In Cloud Storage

Cloud Storage is for objects: images, uploads, exports, backups, static files, and generated reports.

Create a bucket:

```bash
gcloud storage buckets create gs://lumalens-dev-assets \
  --location us-central1
```

Upload a file:

```bash
gcloud storage cp ./logo.png gs://lumalens-dev-assets/logo.png
```

List files:

```bash
gcloud storage ls gs://lumalens-dev-assets
```

Download a file:

```bash
gcloud storage cp gs://lumalens-dev-assets/logo.png ./logo.png
```

Cloud Storage is not a relational database. Do not use it to manage complex application state. It is excellent for blobs and files.

Good uses:

- Product images.
- User uploads.
- PDF exports.
- CSV imports.
- Backups.
- Static assets.

Bad uses:

- Shopping cart state.
- Order transactions.
- User permissions.
- Anything requiring relational constraints.

## 11. Choose The Right Database

Google Cloud has many data products. Pick based on access patterns.

### Cloud SQL

Cloud SQL is managed PostgreSQL, MySQL, or SQL Server.

Use it when you need:

- SQL.
- Transactions.
- Joins.
- Constraints.
- Relational data.
- Compatibility with existing frameworks.

Create a PostgreSQL instance:

```bash
gcloud sql instances create lumalens-db \
  --database-version POSTGRES_16 \
  --region us-central1 \
  --tier db-f1-micro
```

Create a database:

```bash
gcloud sql databases create app \
  --instance lumalens-db
```

### Firestore

Firestore is a serverless document database.

Use it when you need:

- Flexible document records.
- Serverless scaling.
- Simple app-driven queries.
- Real-time or mobile-friendly patterns.

Avoid it when your app depends heavily on relational joins.

### BigQuery

BigQuery is for analytics, reporting, and large-scale data analysis.

Use it when you need:

- Event analytics.
- Large reporting tables.
- SQL analytics over big data.
- Data warehouse workflows.

Do not use BigQuery as the live transactional database for a checkout flow.

## 12. Store Secrets In Secret Manager

Secrets include:

- Database URLs.
- API keys.
- OAuth client secrets.
- Stripe secret keys.
- Webhook signing secrets.
- Private tokens.

Create a secret:

```bash
gcloud secrets create stripe-secret-key \
  --replication-policy automatic
```

Add a version:

```bash
printf '%s' 'sk_live_example' | \
  gcloud secrets versions add stripe-secret-key --data-file=-
```

Attach it to Cloud Run as an environment variable:

```bash
gcloud run services update lumalens-web \
  --region us-central1 \
  --set-secrets STRIPE_SECRET_KEY=stripe-secret-key:latest
```

Give the runtime service account access:

```bash
gcloud secrets add-iam-policy-binding stripe-secret-key \
  --member="serviceAccount:lumalens-runner@lumalens-dev.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Rules:

- Do not commit `.env` files.
- Do not paste secrets into issue comments or chat.
- Separate staging and production secrets.
- Rotate secrets after exposure.
- Avoid sharing one secret across many environments.

## 13. Logging: Make Debugging Possible

Cloud Logging collects logs from managed services. For Cloud Run:

```bash
gcloud run services logs read lumalens-web \
  --region us-central1 \
  --limit 100
```

Read logs through the logging API:

```bash
gcloud logging read 'resource.type="cloud_run_revision"' \
  --limit 50
```

Good logs answer:

- What happened?
- Which service handled it?
- Which request or job was involved?
- Was it a success, warning, or error?
- What should an operator do next?

Bad logs:

- Leak passwords or tokens.
- Dump full customer profiles.
- Print noisy messages every millisecond.
- Hide errors behind vague text like `something went wrong`.

Prefer structured logs in production:

```json
{
  "severity": "ERROR",
  "message": "checkout payment failed",
  "orderId": "ord_123",
  "paymentProvider": "stripe",
  "retryable": false
}
```

Never log payment card data.

## 14. Monitoring And Alerts

Monitoring turns platform and application signals into dashboards and alerts.

Start with alerts for:

- Service unavailable.
- High error rate.
- High latency.
- Failed builds.
- Database connection exhaustion.
- Budget forecast over threshold.

Good alerts are user-impact focused. CPU alerts can be useful, but users usually care about errors, latency, and downtime.

A simple alerting philosophy:

```text
Page someone when users are hurt.
Notify a channel when action is needed soon.
Create a dashboard when context helps investigation.
Do not alert on noise nobody will act on.
```

## 15. CI/CD: Deploy From Commits, Not From Memory

Manual deploys are fine while learning. Production deploys should be repeatable.

You can deploy from GitHub Actions, Cloud Build, or another CI system. A common flow:

```text
push to main
  -> install dependencies
  -> run tests
  -> build app
  -> deploy to Cloud Run
  -> run smoke check
```

A deployment account may need:

- Cloud Run Admin.
- Service Account User.
- Artifact Registry Writer.
- Cloud Build permissions if Cloud Build is used.

Keep deployer permissions separate from runtime permissions.

## 16. Domains And HTTPS

Cloud Run services get a generated URL by default. For production, map a custom domain.

Create a domain mapping:

```bash
gcloud run domain-mappings create \
  --service lumalens-web \
  --domain example.com \
  --region us-central1
```

Then follow the DNS instructions Google Cloud provides. HTTPS certificates are managed for mapped domains.

For static sites, Google Cloud Storage, Firebase Hosting, Cloudflare Pages, Vercel, Netlify, and GitHub Pages may be simpler. Use Cloud Run when you need dynamic server behavior, APIs, secrets, or background work.

## 17. Cost Control Checklist

Cloud cost problems usually come from forgotten resources or unbounded scale.

Use this checklist:

- Create budget alerts immediately.
- Label resources.
- Set Cloud Run max instances.
- Delete old test resources.
- Review logs retention.
- Stop oversized development databases.
- Watch egress traffic.
- Separate production from experiments.
- Review billing weekly while actively building.

Cloud Run max instances:

```bash
gcloud run services update lumalens-web \
  --region us-central1 \
  --max-instances 10
```

List SQL instances:

```bash
gcloud sql instances list
```

List buckets:

```bash
gcloud storage buckets list
```

List Cloud Run services:

```bash
gcloud run services list
```

If you do not recognize a resource, investigate it before deleting. If it is clearly an old experiment, remove it.

## 18. A Practical Production Architecture

For a small ecommerce or SaaS app, a sensible Google Cloud architecture might be:

```text
GitHub
  -> GitHub Actions or Cloud Build
  -> Cloud Run web/API service
  -> Cloud SQL PostgreSQL
  -> Secret Manager
  -> Cloud Storage for uploads/assets
  -> Cloud Logging and Monitoring
  -> Budget alerts
```

For a static storefront with dynamic backend needs:

```text
GitHub Pages / Cloudflare Pages / Firebase Hosting
  -> static frontend

Cloud Run
  -> checkout API
  -> webhook receiver
  -> admin API
  -> background jobs

Cloud SQL or Firestore
  -> orders
  -> users
  -> product data

Secret Manager
  -> Stripe keys
  -> database URL
  -> OAuth secrets
```

This avoids forcing everything into one hosting model. Static pages stay fast and cheap. Backend services run where secrets and server logic are safe.

## 19. Pre-Launch Review

Before you call something production, review:

- Which project is production?
- Who has Owner or Editor?
- Which service accounts exist?
- Which secrets exist?
- Are staging and production secrets separate?
- Is billing linked correctly?
- Are budget alerts configured?
- Are logs readable?
- Are user-facing errors tracked?
- Is there a rollback command?
- Are database backups enabled?
- Has restore been tested?
- Is the admin surface private?
- Are public services intentionally public?

Write down the rollback command. Do not wait until an incident.

Example rollback:

```bash
gcloud run services update-traffic lumalens-web \
  --region us-central1 \
  --to-revisions PREVIOUS_REVISION=100
```

## 20. Common Mistakes

### Using one project for everything

It feels simpler at first, but it makes production risky. Separate environments early.

### Giving Editor to every service account

This is convenient and dangerous. Give each workload the smallest role that works.

### Storing secrets in `.env` and committing them

Never commit secrets. Use Secret Manager for deployed apps.

### Forgetting budget alerts

Budget alerts should exist before public services exist.

### Not setting max instances

Serverless does not mean costless. Set a ceiling for public services.

### Deploying from a laptop with no record

Deploy from commits through CI/CD when the project becomes important.

### Logging private data

Logs live longer and spread wider than people expect. Treat logs as semi-sensitive.

## 21. Daily Command Cheat Sheet

Check active project:

```bash
gcloud config get-value project
```

Switch configuration:

```bash
gcloud config configurations activate lumalens-dev
```

List projects:

```bash
gcloud projects list
```

List enabled APIs:

```bash
gcloud services list --enabled
```

Deploy to Cloud Run:

```bash
gcloud run deploy SERVICE_NAME --source . --region us-central1
```

Read Cloud Run logs:

```bash
gcloud run services logs read SERVICE_NAME --region us-central1 --limit 100
```

List Cloud Run services:

```bash
gcloud run services list
```

List secrets:

```bash
gcloud secrets list
```

List service accounts:

```bash
gcloud iam service-accounts list
```

List billing accounts:

```bash
gcloud billing accounts list
```

## Final Advice

Use Google Cloud in layers. First learn projects, billing, IAM, and the CLI. Then deploy one service. Then add secrets, logs, budgets, and a database. Then automate deployment. Then harden production.

The goal is not to memorize every Google Cloud product. The goal is to build a reliable operating loop:

```text
Create the right project.
Grant the right access.
Enable the right APIs.
Deploy the smallest useful service.
Observe it.
Control cost.
Document rollback.
Iterate.
```

If you follow that loop, Google Cloud becomes much less intimidating. It turns into a set of tools you can reason about, script, review, and improve over time.
