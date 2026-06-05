# Hermes Agent: How It Works and System Architecture

## Audience

This tutorial is for users or developers who want to understand Hermes Agent as a system: what components exist, how a request flows through them, where tools/memory/skills fit, and how Hermes runs across the CLI, messaging platforms, scheduled jobs, and subagents.

## 1. What Hermes Agent Is

Hermes Agent is an AI agent framework that lets an LLM do useful work with tools. It can run in:

- A terminal CLI
- Messaging platforms such as Telegram, Discord, Slack, WhatsApp, Signal, Matrix, and email
- Scheduled cron jobs
- Webhook-triggered runs
- Subagent/delegated workflows
- MCP/tool-integrated environments

At its core, Hermes is not just a chatbot. It is a loop that:

1. Builds a system prompt with configuration, memory, skills, tool schemas, and environment hints.
2. Sends the current conversation to a selected model/provider.
3. Receives either normal assistant text or tool calls.
4. Executes tool calls against the local machine, browser, files, APIs, messaging platforms, or other backends.
5. Feeds tool results back to the model.
6. Repeats until the task is complete or the configured iteration limit is reached.

## 2. High-Level Architecture

```text
                          ┌──────────────────────────┐
                          │        User Input         │
                          │ CLI / Telegram / Cron /   │
                          │ Webhook / API / Platform  │
                          └─────────────┬────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────────┐
│                        Hermes Runtime                            │
│                                                                  │
│  ┌────────────────┐   ┌──────────────────┐   ┌────────────────┐  │
│  │ Session Store  │   │ Prompt Builder   │   │ Config/Profile │  │
│  │ SQLite + FTS5  │   │ system context   │   │ config/env     │  │
│  └───────┬────────┘   └────────┬─────────┘   └───────┬────────┘  │
│          │                     │                     │           │
│          └─────────────┬───────┴─────────────┬───────┘           │
│                        ▼                     ▼                   │
│              ┌──────────────────────────────────┐                │
│              │       Agent Conversation Loop     │                │
│              │ model call → tool call → result   │                │
│              └───────────────┬──────────────────┘                │
│                              │                                   │
│            ┌─────────────────┴─────────────────┐                 │
│            ▼                                   ▼                 │
│  ┌──────────────────┐                ┌──────────────────┐        │
│  │ Model Providers  │                │ Tool Dispatcher  │        │
│  │ OpenRouter, etc. │                │ registry/schema  │        │
│  └──────────────────┘                └─────────┬────────┘        │
│                                                │                 │
│                 ┌──────────────────────────────┼───────────────┐ │
│                 ▼                              ▼               ▼ │
│        ┌────────────────┐             ┌────────────────┐ ┌──────┐│
│        │ Files/Terminal │             │ Browser/Web    │ │ Other ││
│        │ Git/processes  │             │ Search/extract │ │ APIs  ││
│        └────────────────┘             └────────────────┘ └──────┘│
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## 3. Core Runtime Flow

The basic request lifecycle looks like this:

```text
User message
   │
   ▼
Gateway or CLI receives input
   │
   ▼
Load profile config, memory, skills, session history, and tool schemas
   │
   ▼
Build system prompt
   │
   ▼
Call selected LLM provider
   │
   ├── If assistant returns final text:
   │       send response to user and store session
   │
   └── If assistant returns tool calls:
           execute tool calls
           redact secrets if configured
           append tool results to conversation
           call LLM again
```

The important idea: Hermes keeps the model in a tool-using loop until the agent can produce a grounded final answer.

## 4. Main Components

### 4.1 CLI

The CLI is the interactive terminal interface. Common commands include:

```bash
hermes
hermes chat -q "Summarize this repository"
hermes setup
hermes model
hermes doctor
hermes config
hermes tools list
hermes skills list
```

The CLI is useful for local development, coding tasks, direct shell access, and interactive debugging.

### 4.2 Gateway

The gateway connects Hermes to messaging platforms. It allows the same agent to operate through Telegram, Discord, Slack, WhatsApp, Signal, Matrix, email, and other adapters.

Typical gateway commands:

```bash
hermes gateway setup
hermes gateway run
hermes gateway install
hermes gateway start
hermes gateway status
hermes gateway restart
```

The gateway receives platform messages, maps them into Hermes sessions, runs the agent loop, and sends responses back to the correct chat/thread/channel.

### 4.3 Agent Conversation Loop

The agent loop is the heart of Hermes. It performs repeated model calls and tool calls.

Conceptually:

```python
while not done and turns < max_turns:
    response = call_model(messages, tools)

    if response.has_tool_calls:
        for tool_call in response.tool_calls:
            result = execute_tool(tool_call)
            messages.append(result)
        continue

    return response.text
```

In practice, Hermes also handles:

- Context compression
- Tool schema filtering
- Secret redaction
- Memory injection
- Skill loading
- Provider routing
- Session persistence
- Platform-specific delivery
- Background process tracking
- Error handling and retries

### 4.4 Model Providers

Hermes is provider-agnostic. The model layer routes calls to providers such as:

- OpenRouter
- Anthropic
- OpenAI-compatible APIs
- Nous Portal
- Google Gemini
- DeepSeek
- xAI / Grok
- Hugging Face
- Custom endpoints
- Local or self-hosted providers, depending on configuration

Provider and model selection are configured with:

```bash
hermes model
hermes setup model
hermes config set model.provider <provider>
hermes config set model.default <model>
```

Secrets usually live in:

```text
~/.hermes/.env
```

Non-secret config usually lives in:

```text
~/.hermes/config.yaml
```

### 4.5 Tool Registry and Toolsets

Tools are callable capabilities exposed to the model. Examples include:

- `terminal`: run shell commands
- `read_file`, `write_file`, `patch`, `search_files`: work with files
- `browser`: interact with web pages
- `web`: search and extract web content
- `memory`: save durable facts
- `session_search`: search prior conversations
- `delegate_task`: spawn subagents
- `cronjob`: schedule recurring or one-shot work
- `send_message`: send messages through connected platforms
- `text_to_speech`: generate audio
- `vision_analyze`: inspect images

Toolsets are groups of tools that can be enabled or disabled per platform/session. For example:

```bash
hermes tools list
hermes tools enable terminal
hermes tools disable browser
```

Toolset changes usually apply after a new session or reset, because tool schemas are included in the prompt context.

### 4.6 Skills

Skills are reusable procedural knowledge stored as markdown. They tell Hermes how to perform recurring tasks correctly.

A skill can include:

- Trigger conditions
- Step-by-step workflow
- Exact commands
- Pitfalls
- Verification steps
- References, templates, scripts, or assets

Common commands:

```bash
hermes skills list
hermes skills search <query>
hermes skills install <id>
hermes skills inspect <id>
hermes skills update
```

In a session, a skill may be loaded explicitly with:

```text
/skill hermes-agent
```

Skills are one reason Hermes improves over time: when a workflow is discovered or corrected, it can be saved and reused later.

### 4.7 Memory

Memory stores durable facts across sessions. It is different from normal session history.

Good memory entries:

- User preferences
- Stable environment details
- Long-lived project conventions
- Recurring workflow facts

Bad memory entries:

- Temporary task progress
- One-off bug fixes
- PR numbers
- Stale status updates
- Secrets or credentials

Memory helps Hermes avoid asking the same questions repeatedly.

### 4.8 Session Store

Hermes stores sessions in a local SQLite database, commonly:

```text
~/.hermes/state.db
```

The session store supports full-text search, which allows Hermes to recall prior conversations through session search.

Related commands:

```bash
hermes sessions list
hermes sessions browse
hermes sessions export sessions.jsonl
hermes sessions stats
```

### 4.9 Profiles

Profiles are isolated Hermes environments. Each profile can have its own:

- Config
- Environment variables
- Memory
- Skills
- Sessions
- Plugins
- Cron jobs

Profile layout:

```text
~/.hermes/profiles/<name>/
```

Useful commands:

```bash
hermes profile list
hermes profile create <name>
hermes profile use <name>
hermes --profile <name>
```

Profiles are useful when you want separate agents for separate projects, organizations, clients, or roles.

## 5. Important Files and Directories

Typical default paths:

```text
~/.hermes/config.yaml       Main config
~/.hermes/.env              API keys and secrets
~/.hermes/state.db          SQLite session store
~/.hermes/sessions/         Session artifacts and routing data
~/.hermes/logs/             Logs, including gateway logs
~/.hermes/skills/           Installed skills
~/.hermes/auth.json         OAuth tokens and credential pools
~/.hermes/hermes-agent/     Source code if git-installed
```

For named profiles:

```text
~/.hermes/profiles/<profile-name>/config.yaml
~/.hermes/profiles/<profile-name>/.env
~/.hermes/profiles/<profile-name>/skills/
~/.hermes/profiles/<profile-name>/state.db
```

## 6. Gateway Architecture

The gateway is the bridge between external messaging platforms and the Hermes runtime.

```text
Telegram / Discord / Slack / WhatsApp / Email / API
       │
       ▼
Platform Adapter
       │
       ▼
Gateway Router
       │
       ├── Identify user/chat/thread
       ├── Load or create session
       ├── Normalize message into Hermes format
       └── Dispatch to agent loop
                │
                ▼
          Hermes Runtime
                │
                ▼
       Send final response back through platform adapter
```

Important gateway concepts:

- A platform adapter knows how to receive and send messages for one platform.
- The gateway maps platform conversations to Hermes sessions.
- Some platforms support topics, threads, attachments, media, or voice.
- Gateway commands like `/restart`, `/status`, `/platforms`, and `/sethome` help manage runtime behavior.

## 7. Tool Execution and Safety

Hermes can act on the local system, so tool safety matters.

Safety mechanisms include:

- Tool enable/disable controls
- Destructive command approval prompts
- Secret redaction
- PII redaction options for gateway messages
- Separate config and secret files
- Profile isolation
- Explicit tool schemas
- Background process tracking

Command approval modes:

```bash
hermes config set approvals.mode manual
hermes config set approvals.mode smart
hermes config set approvals.mode off
```

`manual` is safest. `off` is equivalent to YOLO mode and should be used carefully.

Secret redaction is separate from command approval. Disabling approvals does not disable secret redaction.

## 8. Context, Compression, and Prompt Building

Hermes builds a prompt that includes:

- Persona/instructions
- Current user message
- Conversation history
- Tool schemas
- Loaded skills
- Memory
- Environment hints
- Relevant session context
- Platform/runtime metadata

Because model context windows are finite, Hermes can compress older context when a threshold is reached. This lets long conversations continue without losing the most important information.

Typical compression settings live under the `compression` section of config.

## 9. Delegation and Subagents

Hermes can delegate work to subagents. A subagent receives an isolated context and toolset, completes a task, and returns a summary.

Use delegation when:

- A subtask is independent
- You want parallel research or code review
- The subtask would produce too much intermediate output
- You want to isolate reasoning work

Conceptual flow:

```text
Parent agent
   │
   ├── delegate_task: "Review this API design"
   │       │
   │       ▼
   │   Child agent in isolated context
   │       │
   │       ▼
   │   Summary returned to parent
   │
   ▼
Parent verifies and continues
```

Delegation is synchronous: if the parent task is interrupted, delegated children do not continue forever. For durable background work, use cron jobs or background terminal processes.

## 10. Cron Jobs

Hermes cron jobs let you schedule agent runs.

Examples:

```bash
hermes cron create "30m"
hermes cron create "0 9 * * *"
hermes cron list
hermes cron pause <job_id>
hermes cron resume <job_id>
hermes cron remove <job_id>
```

Cron jobs can:

- Run on intervals
- Deliver results to a chat/platform
- Use selected skills
- Use a specific model
- Run scripts before the agent prompt
- Chain context from other jobs
- Run in a specific working directory

Cron is best for recurring monitoring, reports, digests, reminders, and scheduled automation.

## 11. MCP and Plugins

Hermes can connect to MCP servers and plugins to add more tools.

MCP commands:

```bash
hermes mcp add <name>
hermes mcp list
hermes mcp test <name>
hermes mcp configure <name>
hermes mcp remove <name>
```

Plugins and MCP servers extend the agent without changing the core runtime.

## 12. Developer Architecture

A typical Hermes source layout looks like this:

```text
hermes-agent/
├── run_agent.py          # Core conversation loop
├── model_tools.py        # Tool discovery and dispatch
├── toolsets.py           # Toolset definitions
├── cli.py                # Interactive CLI
├── hermes_state.py       # SQLite session store
├── agent/                # Prompt builder, memory, routing, compression
├── hermes_cli/           # CLI commands, config, setup, command registry
├── tools/                # Individual tool implementations
├── gateway/              # Messaging gateway and platform adapters
├── cron/                 # Scheduler and cron job logic
├── tests/                # Test suite
└── website/              # Documentation site
```

Important developer concepts:

- Tool implementations register themselves with the central registry.
- Tool handlers should return JSON strings.
- Config belongs in `config.yaml`; secrets belong in `.env`.
- Paths should be profile-safe and use Hermes home resolution, not hardcoded `~/.hermes` assumptions.
- New slash commands should be added to the central command registry so CLI/help/autocomplete/gateway integrations remain consistent.

## 13. Example: A Simple Hermes Task

Suppose the user asks:

> Create a tutorial on how Hermes Agent works.

Hermes might do this:

1. Load the relevant `hermes-agent` skill.
2. Check remembered user preferences, such as where tutorials should be saved.
3. Create or update a file in the requested tutorial directory.
4. Verify the file exists and contains the expected content.
5. Return a concise completion summary.

This demonstrates the full agent pattern:

```text
Instruction → skill lookup → memory use → file tool → verification → final answer
```

## 14. Operational Checklist

Use this checklist when setting up or debugging Hermes:

- Run setup:

```bash
hermes setup
```

- Pick model/provider:

```bash
hermes model
```

- Check config:

```bash
hermes config
hermes config check
```

- Check system health:

```bash
hermes doctor
```

- Inspect tools:

```bash
hermes tools list
```

- Inspect skills:

```bash
hermes skills list
```

- Check gateway status:

```bash
hermes gateway status
```

- Check sessions:

```bash
hermes sessions list
```

- Check logs:

```bash
grep -i "error\|failed" ~/.hermes/logs/gateway.log | tail -20
```

## 15. Mental Model

The simplest way to understand Hermes:

```text
Hermes = LLM + prompt builder + tools + memory + skills + sessions + delivery channels
```

Or, more operationally:

```text
Hermes turns natural-language requests into verified actions by repeatedly asking a model what to do next, executing approved tool calls, and feeding the real results back into the model until the task is complete.
```

## 16. Key Takeaways

- Hermes is a tool-using agent runtime, not only a chat UI.
- The agent loop is model call → tool call → tool result → model call.
- Skills are reusable workflows.
- Memory stores stable long-term facts.
- Sessions store conversation history and support search.
- Toolsets control what the model can do.
- Profiles isolate configs, memory, skills, sessions, and credentials.
- Gateway adapters let the same agent work across messaging platforms.
- Cron jobs and webhooks make Hermes useful for durable automation.
- Safety depends on approvals, redaction, scoped tools, and careful profile/config management.

## 17. Suggested Next Steps

After reading this tutorial, try:

1. Run `hermes doctor` to inspect your setup.
2. Run `hermes tools list` to see available capabilities.
3. Run `hermes skills list` to inspect installed skills.
4. Open `~/.hermes/config.yaml` with `hermes config edit`.
5. If using messaging platforms, run `hermes gateway status`.
6. Create a small cron job with `hermes cron create "30m"` for a harmless recurring reminder or report.

## 18. Glossary

- **Agent loop**: The repeated process of model calls and tool calls.
- **Tool**: A callable function Hermes exposes to the model, such as terminal, file writing, browser automation, or memory.
- **Toolset**: A group of related tools that can be enabled or disabled.
- **Skill**: A reusable markdown procedure that teaches Hermes how to handle a class of tasks.
- **Memory**: Durable facts injected into future sessions.
- **Session**: A conversation record stored for continuity and search.
- **Gateway**: The service that connects Hermes to messaging platforms.
- **Profile**: An isolated Hermes home/config/memory/skills/session environment.
- **Cron job**: A scheduled Hermes run.
- **MCP**: Model Context Protocol, used to connect external tool servers.
