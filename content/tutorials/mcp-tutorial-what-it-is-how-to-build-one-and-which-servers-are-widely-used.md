# MCP Tutorial: What It Is, How to Build One, and Which MCP Servers Are Widely Used

Model Context Protocol, usually shortened to **MCP**, is an open standard for connecting AI applications to external systems. People often say “create an MCP,” but the more precise phrase is **create an MCP server**.

The simplest mental model is this:

> MCP is a plugin and API layer for AI agents. It gives a model a standard way to ask for context, inspect data, and request actions from external systems.

An MCP server can expose tools for actions, resources for readable context, and prompts for reusable instruction templates. A host app such as Claude Desktop, VS Code, Cursor, Codex CLI, or another AI app can connect to one or more MCP servers and make those capabilities available to the model.

This tutorial explains MCP from first principles, shows how to design an MCP server for a real technology, walks through a Python Postgres MCP server, gives a TypeScript skeleton, and lists widely used MCP servers by category.

## 1. MCP basics

### The three main pieces

MCP uses a host/client/server architecture.

- **Host:** the AI app the user interacts with. Examples: Claude Desktop, VS Code, Cursor, ChatGPT-style apps, Codex CLI, or a custom agent UI.
- **Client:** the connection inside the host that talks to one MCP server. Most hosts create one client connection per configured server.
- **Server:** your program that exposes capabilities. Examples: GitHub MCP, Postgres MCP, Figma MCP, or a custom MCP server for your internal API.

A typical flow looks like this:

```text
User
  │
  ▼
AI host app
  │
  ├── MCP client ── MCP server: GitHub tools
  ├── MCP client ── MCP server: Postgres resources
  └── MCP client ── MCP server: Figma design context
```

The protocol uses JSON-RPC messages. Common transports include local **stdio** and remote **Streamable HTTP**. Stdio is common for local developer tools because the host starts a process and communicates with it through standard input/output. HTTP is useful when the server is remote, shared, or deployed behind normal web infrastructure.

Official docs:

- [MCP introduction](https://modelcontextprotocol.io/docs/getting-started/intro)
- [MCP architecture](https://modelcontextprotocol.io/docs/concepts/architecture)
- [MCP transports](https://modelcontextprotocol.io/docs/concepts/transports)

### Tools, resources, and prompts

MCP servers expose three main primitive types.

- **Tool:** an action the AI can call.
  - Examples: `create_github_issue`, `query_database`, `send_slack_message`, `restart_service`.
- **Resource:** readable context or data.
  - Examples: `file://README.md`, `postgres://schema/public`, `notion://page/123`.
- **Prompt:** a reusable instruction template.
  - Example: “Analyze this bug report and suggest fixes.”

A good MCP server is not just a random API wrapper. It should expose safe, useful, well-scoped capabilities that make sense for an AI assistant.

## 2. How to design an MCP server for a particular technology

Suppose you want to create an MCP server for Postgres, Jira, Shopify, Redis, Kubernetes, Figma, Stripe, WordPress, or an internal API.

Do not start by wrapping everything the API can do. Start by deciding what the AI assistant actually needs.

### Step 1: Choose the technology boundary

Pick a narrow first scope.

Good first scopes:

- **Postgres:** read schema, list tables, sample rows, run approved read-only queries.
- **Jira:** search issues, get issue details, add comments, update status.
- **Figma:** read design metadata, inspect nodes, export component information.
- **Kubernetes:** list pods, inspect deployments, view logs, restart approved workloads.
- **Stripe:** search customers, retrieve payments, create draft invoices.
- **GitHub:** search code, list pull requests, open issues, comment on PRs.
- **Internal API:** search records, fetch details, run approved workflow actions.

A strong first version usually has only three to six tools. Add more after you observe what users actually need.

### Step 2: Decide what should be a tool versus a resource

Use **resources** for data the model can read. Use **tools** for actions or parameterized operations.

Postgres example:

- `postgres://schema/public` as a resource: lets the model inspect schema context.
- `list_tables` as a tool: returns available tables.
- `describe_table` as a tool: shows columns and types.
- `sample_rows` as a tool: returns a small safe sample.
- `run_readonly_query` as a tool: optional, only with strict limits.

Jira example:

- `jira://project/ENG` as a resource: project summary.
- `search_issues` as a tool: search with safe filters or JQL.
- `get_issue` as a tool: retrieve issue details.
- `add_comment` as a tool: write action.
- `transition_issue` as a tool: riskier write action, often requiring confirmation.

### Step 3: Apply least privilege

For any real MCP server, least privilege is the most important design rule.

Prefer these safer designs:

- Read-only database user instead of database admin credentials.
- Allowlisted shell commands instead of an arbitrary `run_command` tool.
- Read-only SQL with timeout and row limit instead of unrestricted SQL.
- GitHub token scoped to selected repositories instead of a broad personal token.
- Kubernetes namespace-limited service account instead of `cluster-admin`.
- Separate write/delete tools instead of one generic “do anything” tool.
- Human confirmation for destructive, expensive, or irreversible operations.

Local MCP servers can execute code on the user’s machine, so treat them like any other local automation tool. Restrict paths, sandbox where possible, scope credentials, and never log secrets.

## 3. Build a simple MCP server in Python

The official Python SDK includes **FastMCP**, a convenient way to build MCP servers using Python type hints and docstrings.

In this section, we will build a practical read-only Postgres MCP server with:

- `list_tables`
- `describe_table`
- `sample_rows`
- `postgres://schema/{schema}` resource

### Create the project

```bash
uv init postgres-mcp
cd postgres-mcp
uv add "mcp[cli]" "psycopg[binary]"
```

### Create `server.py`

```python
import os
import re
from typing import Any

import psycopg
from psycopg.rows import dict_row
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("postgres-readonly")

DATABASE_URL = os.environ.get("DATABASE_URL")
IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def safe_identifier(value: str, field_name: str) -> str:
    """
    Prevent SQL injection through schema/table identifiers.

    Parameterized SQL protects values, but not table or schema names.
    So we only allow normal SQL identifiers here.
    """
    if not IDENTIFIER.fullmatch(value):
        raise ValueError(f"Invalid {field_name}: {value!r}")
    return value


def connect():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL environment variable is required")

    conn = psycopg.connect(
        DATABASE_URL,
        row_factory=dict_row,
        autocommit=True,
    )

    # Prevent long-running queries.
    conn.execute("SET statement_timeout = '5000ms'")
    return conn


@mcp.tool()
def list_tables(schema: str = "public") -> str:
    """List base tables in a Postgres schema."""
    schema = safe_identifier(schema, "schema")

    with connect() as conn:
        rows = conn.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_type = 'BASE TABLE'
            ORDER BY table_name
            """,
            (schema,),
        ).fetchall()

    if not rows:
        return "No tables found."

    return "\n".join(row["table_name"] for row in rows)


@mcp.tool()
def describe_table(table: str, schema: str = "public") -> str:
    """Describe columns for a table."""
    schema = safe_identifier(schema, "schema")
    table = safe_identifier(table, "table")

    with connect() as conn:
        rows = conn.execute(
            """
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = %s
              AND table_name = %s
            ORDER BY ordinal_position
            """,
            (schema, table),
        ).fetchall()

    if not rows:
        return "Table not found."

    return "\n".join(
        f'{row["column_name"]}: {row["data_type"]}, nullable={row["is_nullable"]}'
        for row in rows
    )


@mcp.tool()
def sample_rows(
    table: str,
    schema: str = "public",
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Return a limited sample of rows from a table."""
    schema = safe_identifier(schema, "schema")
    table = safe_identifier(table, "table")
    limit = max(1, min(int(limit), 100))

    with connect() as conn:
        rows = conn.execute(
            f'SELECT * FROM "{schema}"."{table}" LIMIT %s',
            (limit,),
        ).fetchall()

    return [dict(row) for row in rows]


@mcp.resource("postgres://schema/{schema}")
def schema_summary(schema: str = "public") -> str:
    """Return a schema summary as an MCP resource."""
    tables = list_tables(schema)

    if tables == "No tables found.":
        return tables

    blocks = []
    for table in tables.splitlines():
        blocks.append(f"Table: {table}\n{describe_table(table, schema)}")

    return "\n\n".join(blocks)


if __name__ == "__main__":
    mcp.run(transport="stdio")
```

### Run it

```bash
DATABASE_URL="postgresql://readonly_user:password@localhost:5432/mydb" \
uv run server.py
```

For production, create a real read-only database user. Do not use an admin user.

## 4. Test your MCP server with MCP Inspector

MCP Inspector is an interactive developer tool for testing MCP servers. It lets you inspect tools, resources, and prompts before connecting the server to a real host app.

Run:

```bash
npx -y @modelcontextprotocol/inspector \
  uv --directory /ABSOLUTE/PATH/postgres-mcp run server.py
```

Then test:

- `list_tables`
- `describe_table`
- `sample_rows`
- `postgres://schema/public`

Good tests to run:

- `list_tables("public")` returns known tables.
- `describe_table("users")` returns expected columns.
- `sample_rows("users", limit=5)` returns at most five rows.
- An invalid table name such as `users; DROP TABLE users;` is rejected.
- A huge limit such as `100000` is capped to `100`.
- Missing `DATABASE_URL` returns a clear error.

Official docs:

- [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)

## 5. Connect your MCP server to a host app

A typical local MCP config looks like this:

```json
{
  "mcpServers": {
    "postgres-readonly": {
      "command": "uv",
      "args": [
        "--directory",
        "/ABSOLUTE/PATH/postgres-mcp",
        "run",
        "server.py"
      ],
      "env": {
        "DATABASE_URL": "postgresql://readonly_user:password@localhost:5432/mydb"
      }
    }
  }
}
```

The exact config file location depends on the host app. The important pieces are:

- server name
- command
- args
- environment variables

For stdio servers, do not write logs to stdout. Stdout is reserved for protocol messages. Write logs to stderr instead.

## 6. TypeScript MCP server skeleton

The official TypeScript SDK package is `@modelcontextprotocol/sdk`. The stable v1 API commonly uses `McpServer` and `StdioServerTransport`.

Install:

```bash
mkdir my-tech-mcp
cd my-tech-mcp
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node tsx
```

Example `server.ts`:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "my-tech-mcp",
  version: "1.0.0",
});

server.registerTool(
  "search_docs",
  {
    title: "Search documentation",
    description: "Search documentation for this technology",
    inputSchema: {
      query: z.string().describe("Search query"),
    },
  },
  async ({ query }) => {
    // Replace this with your real adapter:
    // - call your API
    // - search your docs index
    // - query a database
    // - call an SDK
    return {
      content: [
        {
          type: "text",
          text: `Search results for: ${query}`,
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

Run during development:

```bash
npx tsx server.ts
```

The design idea is the same as Python: define a server, register tools/resources/prompts, and connect it through stdio or HTTP.

Official SDKs:

- [Python SDK](https://github.com/modelcontextprotocol/python-sdk)
- [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

## 7. Adapting MCP to different technologies

Here is a practical design map.

### Databases

Useful resources:

- schemas
- table metadata
- saved reports
- data dictionaries

Useful tools:

- `list_tables`
- `describe_table`
- `sample_rows`
- `run_readonly_query`

Safety rule: use read-only credentials, statement timeouts, row limits, query validation, and audit logs.

### SaaS apps

Useful resources:

- current workspace
- user profile
- project metadata
- dashboard summaries

Useful tools:

- `search_records`
- `get_record`
- `create_comment`
- `update_status`
- `assign_owner`

Safety rule: scope OAuth permissions narrowly and separate reads from writes.

### Git and repositories

Useful resources:

- repo status
- files
- branches
- pull request context

Useful tools:

- `search_code`
- `create_issue`
- `comment_on_pr`
- `run_tests`
- `read_file`

Safety rule: restrict repositories, protect destructive git operations, and avoid arbitrary shell tools unless explicitly needed.

### Browser automation

Useful resources:

- current page
- DOM snapshot
- console logs
- network errors

Useful tools:

- `navigate`
- `click`
- `fill_form`
- `screenshot`
- `get_console_errors`

Safety rule: use domain allowlists, timeouts, and clear user authorization for logged-in workflows.

### Cloud platforms

Useful resources:

- inventory
- logs
- metrics
- configs

Useful tools:

- `list_resources`
- `view_logs`
- `deploy`
- `rollback`
- `restart_service`

Safety rule: avoid broad admin credentials and require confirmation for production writes.

### Documentation systems

Useful resources:

- articles
- API docs
- examples
- changelogs

Useful tools:

- `search_docs`
- `fetch_article`
- `summarize_reference`

Safety rule: return sources and citations so the model can ground its answer.

### Internal business systems

Useful resources:

- records
- reports
- workflow status

Useful tools:

- `lookup_record`
- `approve_request`
- `reject_request`
- `escalate_case`

Safety rule: add audit logs, role checks, and human approval for sensitive workflows.

### Local filesystem

Useful resources:

- files
- folders
- project context

Useful tools:

- `read_file`
- `write_file`
- `search_files`
- `patch_file`

Safety rule: restrict allowed directories and never expose the whole machine by default.

## 8. Production checklist

Before calling your MCP server production-ready, check these areas.

### Tool design

- Tool names are specific, such as `create_jira_comment`, not `do_action`.
- Each tool does one clear thing.
- Read tools and write tools are separated.
- Risky actions require confirmation or policy checks.

### Input validation

- Every input has a schema.
- Strings have length limits.
- Numeric limits are capped.
- Identifiers are validated.
- File paths are restricted to allowed roots.

### Permissions

- Credentials are least privilege.
- Tokens are scoped to the minimum resources.
- Production and development credentials are separate.
- Destructive permissions are not enabled by default.

### Secrets

- Never log tokens, passwords, cookies, API keys, or connection strings.
- Do not return secret values in tool responses.
- Store secrets in the host app, secret manager, or environment, not in code.

### Logging

- For stdio servers, logs go to stderr, not stdout.
- Logs include enough information to debug tool failures.
- Logs do not include sensitive payloads.

### Errors

- Return useful error messages.
- Do not leak internal stack traces to the model.
- Make auth failures clear.
- Make rate limit and timeout errors clear.

### Testing

- Test with MCP Inspector.
- Test normal calls.
- Test invalid inputs.
- Test auth failures.
- Test timeouts and rate limits.
- Test write-action guardrails.

### Remote servers

- Use proper authentication and authorization.
- Use TLS.
- Add rate limiting.
- Add audit logs.
- Consider tenant isolation if multiple users share one server.

### Publishing

- Add metadata.
- Document required permissions.
- Document environment variables.
- Verify package ownership.
- Publish only after testing a clean install.

The official SDK page currently classifies TypeScript, Python, C#, and Go as Tier 1 SDKs, with other languages at lower support levels. The official MCP Registry is also available as a registry for server metadata and discovery.

## 9. Popular and widely used MCP servers

There is no single public source that proves exact install counts across every MCP client. The best public signals are:

- official example repositories
- vendor-backed servers
- Docker MCP Catalog entries
- MCP directories such as PulseMCP
- GitHub stars and activity
- repeated usage in AI coding workflows

Treat popularity lists as directional, not definitive.

### High-visibility MCP servers to know

- **Playwright:** browser automation for testing, scraping, and UI workflows.
- **Fetch:** fetches web pages and converts them into useful text.
- **Context7:** provides up-to-date documentation and code context.
- **Chrome DevTools:** browser debugging, performance, and frontend diagnostics.
- **Filesystem:** read/write local files and folders.
- **PostHog:** product analytics and event inspection.
- **AWS Documentation:** AWS docs search and cloud troubleshooting context.
- **GitHub:** repositories, issues, pull requests, code search, and comments.
- **Google Maps Tools:** geocoding, places, maps, and routes.
- **Git:** local git repository operations.
- **Storybook:** UI component context for frontend development.
- **Excel file manipulation:** spreadsheet operations.
- **Sequential Thinking:** structured reasoning and planning helper.
- **Time:** time and timezone utilities.
- **Atlassian Cloud:** Jira and Confluence workflows.
- **DuckDB:** local analytics database workflows.
- **Office Word:** document operations.
- **Google Toolbox for Databases:** database tooling around Google systems.
- **Knowledge Graph Memory:** persistent structured memory.
- **Supabase:** Supabase database and project operations.
- **Google Kubernetes Engine:** GKE operations.
- **Figma Context:** design-to-code and design inspection.
- **n8n:** workflow automation.
- **Searchcode:** public code search.
- **Unity:** game development and editor workflows.
- **MongoDB:** MongoDB access.
- **PostgreSQL:** Postgres access.
- **Zapier:** broad app automation.
- **Tavily:** AI-oriented web search.
- **Everything / Demo:** protocol demonstration and client testing.

### Official/reference MCP servers

Reference-style servers are useful when learning because they demonstrate common MCP patterns.

- **Everything:** tests all major MCP primitives.
- **Fetch:** fetches web content.
- **Filesystem:** works with local files and folders.
- **Git:** performs Git repository operations.
- **Memory / Knowledge Graph Memory:** stores and retrieves structured memory.
- **Sequential Thinking:** supports step-by-step reasoning workflows.
- **Time:** provides date/time and timezone utilities.

### Major vendor-backed MCP servers

Several major platforms provide official or vendor-backed MCP servers or MCP integrations. Examples include:

- GitHub for repositories, issues, pull requests, and code search.
- Figma for design context.
- Atlassian for Jira and Confluence.
- Supabase for project and database operations.
- Stripe for Stripe API operations.
- Notion for workspace access.
- AWS for AWS documentation and cloud assistance.
- Microsoft Learn for Microsoft technical documentation.
- Google developer documentation and database tooling.
- Playwright for browser automation.
- Chrome DevTools for browser debugging.

Docker also maintains an MCP Catalog with verified servers packaged as Docker images, which is useful when you want a more standardized way to run servers.

## 10. Recommended MCP servers by category

### Software development

Start with:

- GitHub
- Git
- Filesystem
- Playwright
- Chrome DevTools
- Context7
- Sequential Thinking
- Fetch
- Microsoft Learn
- AWS Documentation
- Google Developer Knowledge

### Data and databases

Start with:

- PostgreSQL
- MongoDB
- DuckDB
- Supabase
- Google Toolbox for Databases
- Excel file manipulation

### Product, design, and business workflows

Start with:

- Figma / Figma Context
- Atlassian Cloud
- Notion
- Slack
- Zapier
- n8n
- PostHog
- Office Word
- Google Maps Tools

### Search and knowledge

Start with:

- Tavily Search
- Fetch
- Context7
- Searchcode
- AWS Documentation
- Microsoft Learn
- Google Developer Knowledge

## 11. A practical template for building any MCP server

Use this template for almost any technology.

1. **Name the server:** use `<technology>-mcp`, such as `postgres-mcp` or `jira-mcp`.
2. **Define the user:** developer, analyst, support agent, designer, operator, or customer-support assistant.
3. **Define safe resources:** decide what context the AI can read.
4. **Define read tools:** start with `list_*`, `get_*`, `search_*`, `describe_*`, and `summarize_*`.
5. **Define write tools:** add `create_*`, `update_*`, `comment_*`, `trigger_*`, or `deploy_*` only when needed.
6. **Add guardrails:** allowlists, row limits, rate limits, auth scopes, path restrictions, and confirmations.
7. **Test locally:** MCP Inspector, sample calls, invalid inputs, missing auth, and timeouts.
8. **Connect to a host:** add an `mcpServers` config or remote MCP URL.
9. **Publish:** add metadata, package cleanly, document permissions, and verify a clean install.

## 12. Example first tool sets by technology

Use these as starting points.

- **Postgres:** `list_tables`, `describe_table`, `sample_rows`, `run_readonly_query`.
- **MongoDB:** `list_collections`, `describe_collection`, `find_documents`, `aggregate_readonly`.
- **Redis:** `list_keys`, `get_key`, `describe_ttl`, `scan_keys`.
- **Jira:** `search_issues`, `get_issue`, `add_comment`, `transition_issue`.
- **GitHub:** `search_code`, `list_pull_requests`, `get_pull_request`, `create_issue`, `comment_on_pr`.
- **Figma:** `get_file`, `inspect_node`, `list_components`, `export_node_metadata`.
- **Stripe:** `search_customers`, `get_payment`, `list_invoices`, `create_draft_invoice`.
- **Kubernetes:** `list_pods`, `describe_deployment`, `get_logs`, `restart_deployment`.
- **Filesystem:** `read_file`, `search_files`, `write_file`, `patch_file`.
- **Documentation:** `search_docs`, `fetch_doc`, `list_examples`, `summarize_doc`.

## 13. Common mistakes

### Mistake: creating a giant wrapper around an API

Better: expose a small set of high-value tools with clear names and limits.

### Mistake: giving the server admin credentials

Better: create a dedicated service account or token with least privilege.

### Mistake: one generic `run` tool

Better: create specific tools such as `list_tables`, `create_jira_comment`, or `restart_deployment`.

### Mistake: no input limits

Better: cap row counts, string lengths, file sizes, query time, and API result counts.

### Mistake: writing logs to stdout for stdio servers

Better: write logs to stderr so stdout remains reserved for JSON-RPC protocol messages.

### Mistake: hiding side effects

Better: make write tools explicit and require confirmation for dangerous actions.

## 14. Final mental model

MCP is not magic. It is a standard contract between AI apps and external systems.

A useful MCP server answers three questions:

1. What context should the model be allowed to read?
2. What actions should the model be allowed to request?
3. What guardrails keep those reads and actions safe?

If you answer those questions carefully, an MCP server becomes a clean bridge between an AI assistant and the systems where real work happens.

## Sources and further reading

- [Model Context Protocol introduction](https://modelcontextprotocol.io/docs/getting-started/intro)
- [MCP architecture](https://modelcontextprotocol.io/docs/concepts/architecture)
- [MCP transports](https://modelcontextprotocol.io/docs/concepts/transports)
- [MCP tools](https://modelcontextprotocol.io/docs/concepts/tools)
- [MCP resources](https://modelcontextprotocol.io/docs/concepts/resources)
- [MCP prompts](https://modelcontextprotocol.io/docs/concepts/prompts)
- [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)
- [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Reference MCP servers](https://github.com/modelcontextprotocol/servers)
- [Docker MCP Catalog](https://github.com/docker/mcp-registry)
- [PulseMCP directory](https://www.pulsemcp.com/)
