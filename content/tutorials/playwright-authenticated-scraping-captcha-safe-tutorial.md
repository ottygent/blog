# Building an Authenticated Playwright Scraper in Python — CAPTCHA-Safe, Ethical, and Production-Ready

## Important Scope Note

The original topic asks for “advanced stealth web scraping with Playwright with username and password” and “how to bypass CAPTCHA.” This tutorial intentionally **does not teach CAPTCHA bypass, evasion, solver abuse, fingerprint spoofing, account abuse, or techniques designed to defeat a website’s access controls**.

Instead, it teaches a production-grade and defensible approach:

- Use Playwright for browser automation when you have permission to access the site.
- Authenticate with a username/password safely using environment variables.
- Save and reuse authenticated browser state.
- Respect `robots.txt`, terms of service, rate limits, and account boundaries.
- Detect CAPTCHA/challenge pages and stop, request human review, or switch to an official API.
- Log blocked/challenge states clearly instead of trying to bypass them.

If a site presents CAPTCHA, the correct production response is usually one of:

1. Use the site’s official API.
2. Get written permission or a partner data-access route.
3. Ask a human operator to complete the challenge manually.
4. Stop the automation and mark the job as blocked.

## Research Sources Used

Before writing this tutorial, I checked the current documentation and standards below:

- Playwright Python authentication docs: `https://playwright.dev/python/docs/auth`
- Playwright Python locator docs: `https://playwright.dev/python/docs/locators`
- Robots Exclusion Protocol RFC 9309: `https://www.rfc-editor.org/rfc/rfc9309.txt`
- OWASP Automated Threats to Web Applications: `https://owasp.org/www-project-automated-threats-to-web-applications/`
- Google reCAPTCHA verification docs: `https://developers.google.com/recaptcha/docs/verify`

Key takeaways:

- Playwright supports saving authenticated browser state and reusing it across sessions.
- Stable locators are preferred over brittle CSS/XPath selectors.
- `robots.txt` is a standardized mechanism for declaring crawler access rules.
- Automated abuse is a known web security risk; automation should be permissioned, rate-limited, and auditable.
- CAPTCHA systems are meant to verify users, not to be bypassed by bots.

## 1. What We Are Building

We will build a Python project that can:

1. Launch Playwright.
2. Log into a website using username/password from environment variables.
3. Save authenticated session state to disk.
4. Reuse the session state on later runs.
5. Scrape permitted pages after login.
6. Detect CAPTCHA/challenge pages.
7. Stop safely when blocked.
8. Emit structured logs and JSON output.

The architecture:

```text
.env credentials
      │
      ▼
Login script
      │
      ├── opens browser
      ├── fills username/password
      ├── waits for successful login
      └── saves storage_state.json

Scraper script
      │
      ├── loads storage_state.json
      ├── visits allowed pages
      ├── checks robots/allowlist policy
      ├── detects CAPTCHA/challenges
      ├── extracts data
      └── writes JSONL output
```

## 2. Project Layout

Create this structure:

```text
playwright-auth-scraper/
├── .env.example
├── requirements.txt
├── README.md
├── data/
│   ├── output.jsonl
│   └── blocked.jsonl
├── state/
│   └── .gitkeep
└── src/
    ├── config.py
    ├── login.py
    ├── scrape.py
    ├── policy.py
    ├── extractors.py
    └── utils.py
```

Create the project:

```bash
mkdir -p playwright-auth-scraper/src playwright-auth-scraper/data playwright-auth-scraper/state
cd playwright-auth-scraper
```

## 3. Install Dependencies

Create `requirements.txt`:

```txt
playwright==1.49.1
python-dotenv==1.0.1
```

Install:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
```

If your environment uses a different package manager, keep the dependency list small and explicit.

## 4. Environment Variables

Create `.env.example`:

```bash
TARGET_BASE_URL=https://example.com
LOGIN_URL=https://example.com/login
USERNAME=your_username_here
PASSWORD=your_password_here

# Comma-separated allowlist. Keep this narrow.
ALLOWED_HOSTS=example.com

# Browser behavior
HEADLESS=false
SLOW_MO_MS=50
REQUEST_DELAY_SECONDS=2

# Files
STORAGE_STATE_PATH=state/storage_state.json
OUTPUT_PATH=data/output.jsonl
BLOCKED_PATH=data/blocked.jsonl
```

Then create your real `.env`:

```bash
cp .env.example .env
```

Edit `.env` and add your real credentials.

Security rules:

- Do not commit `.env`.
- Do not commit `state/storage_state.json`.
- Treat saved browser state like a credential.
- Rotate credentials if state files are exposed.

Create `.gitignore`:

```gitignore
.env
state/storage_state.json
data/*.jsonl
__pycache__/
.venv/
```

## 5. Configuration Loader

Create `src/config.py`:

```python
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    target_base_url: str
    login_url: str
    username: str
    password: str
    allowed_hosts: set[str]
    headless: bool
    slow_mo_ms: int
    request_delay_seconds: float
    storage_state_path: Path
    output_path: Path
    blocked_path: Path


def get_settings() -> Settings:
    username = os.getenv("USERNAME", "")
    password = os.getenv("PASSWORD", "")

    if not username or not password:
        raise RuntimeError("USERNAME and PASSWORD must be set in .env")

    allowed_hosts = {
        item.strip().lower()
        for item in os.getenv("ALLOWED_HOSTS", "").split(",")
        if item.strip()
    }

    if not allowed_hosts:
        raise RuntimeError("ALLOWED_HOSTS must contain at least one host")

    return Settings(
        target_base_url=os.getenv("TARGET_BASE_URL", "").rstrip("/"),
        login_url=os.getenv("LOGIN_URL", ""),
        username=username,
        password=password,
        allowed_hosts=allowed_hosts,
        headless=os.getenv("HEADLESS", "true").lower() == "true",
        slow_mo_ms=int(os.getenv("SLOW_MO_MS", "0")),
        request_delay_seconds=float(os.getenv("REQUEST_DELAY_SECONDS", "2")),
        storage_state_path=Path(os.getenv("STORAGE_STATE_PATH", "state/storage_state.json")),
        output_path=Path(os.getenv("OUTPUT_PATH", "data/output.jsonl")),
        blocked_path=Path(os.getenv("BLOCKED_PATH", "data/blocked.jsonl")),
    )
```

## 6. Utility Functions

Create `src/utils.py`:

```python
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def append_jsonl(path: Path, record: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as file:
        file.write(json.dumps(record, ensure_ascii=False) + "\n")


def redact(value: str, keep: int = 2) -> str:
    if not value:
        return ""
    if len(value) <= keep:
        return "*" * len(value)
    return value[:keep] + "*" * (len(value) - keep)
```

## 7. Access Policy

Create `src/policy.py`:

```python
from urllib.parse import urlparse


def is_allowed_host(url: str, allowed_hosts: set[str]) -> bool:
    host = urlparse(url).hostname or ""
    host = host.lower()
    return host in allowed_hosts


def looks_like_captcha_or_challenge(text: str) -> bool:
    markers = [
        "captcha",
        "recaptcha",
        "hcaptcha",
        "turnstile",
        "verify you are human",
        "checking your browser",
        "security check",
        "bot detection",
        "automated access",
        "unusual traffic",
        "please enable cookies",
    ]
    text_lower = text.lower()
    return any(marker in text_lower for marker in markers)
```

This function does **not** bypass CAPTCHA. It detects likely block/challenge pages so the scraper can stop safely.

## 8. Login Script

Create `src/login.py`:

```python
import asyncio

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

from config import get_settings
from policy import looks_like_captcha_or_challenge
from utils import append_jsonl, utc_now, redact


async def login() -> None:
    settings = get_settings()
    settings.storage_state_path.parent.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            headless=settings.headless,
            slow_mo=settings.slow_mo_ms,
        )
        context = await browser.new_context()
        page = await context.new_page()

        print(f"Opening login page: {settings.login_url}")
        await page.goto(settings.login_url, wait_until="domcontentloaded")

        body_text = await page.locator("body").inner_text(timeout=10_000)
        if looks_like_captcha_or_challenge(body_text):
            append_jsonl(settings.blocked_path, {
                "timestamp": utc_now(),
                "phase": "login",
                "url": settings.login_url,
                "reason": "captcha_or_challenge_detected_before_login",
            })
            await browser.close()
            raise RuntimeError("CAPTCHA/challenge detected before login. Stop and request human/API access.")

        # Adjust these selectors to your target site.
        # Prefer stable labels/placeholders/test IDs when available.
        await page.get_by_label("Username").fill(settings.username)
        await page.get_by_label("Password").fill(settings.password)
        await page.get_by_role("button", name="Log in").click()

        try:
            await page.wait_for_load_state("networkidle", timeout=15_000)
        except PlaywrightTimeoutError:
            print("Network did not become idle; continuing with post-login checks.")

        body_text = await page.locator("body").inner_text(timeout=10_000)
        if looks_like_captcha_or_challenge(body_text):
            append_jsonl(settings.blocked_path, {
                "timestamp": utc_now(),
                "phase": "login",
                "url": page.url,
                "reason": "captcha_or_challenge_detected_after_login_submit",
                "username": redact(settings.username),
            })
            await browser.close()
            raise RuntimeError("CAPTCHA/challenge detected after login. Do not bypass it.")

        # Replace this with a site-specific success check.
        # Examples: account menu visible, dashboard URL, logout button visible.
        if "login" in page.url.lower():
            print("Still appears to be on a login URL. Verify selectors and credentials.")

        await context.storage_state(path=str(settings.storage_state_path))
        print(f"Saved authenticated state to {settings.storage_state_path}")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(login())
```

Run it:

```bash
PYTHONPATH=src python src/login.py
```

### Selector Notes

The selectors in the example are placeholders:

```python
page.get_by_label("Username")
page.get_by_label("Password")
page.get_by_role("button", name="Log in")
```

For your target site, inspect the form and use stable selectors such as:

- `get_by_label("Email")`
- `get_by_placeholder("Email address")`
- `get_by_role("button", name="Sign in")`
- `locator('[data-testid="login-button"]')`

Prefer Playwright locators over brittle XPath.

## 9. Extractor

Create `src/extractors.py`:

```python
from playwright.async_api import Page


async def extract_page_summary(page: Page) -> dict:
    title = await page.title()

    h1 = ""
    if await page.locator("h1").count() > 0:
        h1 = await page.locator("h1").first.inner_text(timeout=5_000)

    body = await page.locator("body").inner_text(timeout=10_000)
    body_preview = " ".join(body.split())[:1000]

    return {
        "url": page.url,
        "title": title,
        "h1": h1,
        "body_preview": body_preview,
    }
```

## 10. Scraper Script

Create `src/scrape.py`:

```python
import asyncio
from urllib.parse import urljoin

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

from config import get_settings
from extractors import extract_page_summary
from policy import is_allowed_host, looks_like_captcha_or_challenge
from utils import append_jsonl, utc_now


START_PATHS = [
    "/",
    # Add allowed authenticated paths here, for example:
    # "/account",
    # "/dashboard",
]


async def scrape_url(page, url: str) -> dict:
    await page.goto(url, wait_until="domcontentloaded", timeout=30_000)

    try:
        await page.wait_for_load_state("networkidle", timeout=10_000)
    except PlaywrightTimeoutError:
        pass

    body_text = await page.locator("body").inner_text(timeout=10_000)
    if looks_like_captcha_or_challenge(body_text):
        return {
            "timestamp": utc_now(),
            "url": url,
            "blocked": True,
            "reason": "captcha_or_challenge_detected",
        }

    data = await extract_page_summary(page)
    data["timestamp"] = utc_now()
    data["blocked"] = False
    return data


async def main() -> None:
    settings = get_settings()

    if not settings.storage_state_path.exists():
        raise RuntimeError(
            f"Missing {settings.storage_state_path}. Run login.py first."
        )

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            headless=settings.headless,
            slow_mo=settings.slow_mo_ms,
        )
        context = await browser.new_context(
            storage_state=str(settings.storage_state_path)
        )
        page = await context.new_page()

        for path in START_PATHS:
            url = urljoin(settings.target_base_url + "/", path.lstrip("/"))

            if not is_allowed_host(url, settings.allowed_hosts):
                append_jsonl(settings.blocked_path, {
                    "timestamp": utc_now(),
                    "url": url,
                    "blocked": True,
                    "reason": "host_not_allowed",
                })
                continue

            print(f"Scraping: {url}")
            result = await scrape_url(page, url)

            if result.get("blocked"):
                append_jsonl(settings.blocked_path, result)
                print(f"Blocked/challenge detected: {url}")
            else:
                append_jsonl(settings.output_path, result)
                print(f"Saved: {url}")

            await asyncio.sleep(settings.request_delay_seconds)

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
```

Run:

```bash
PYTHONPATH=src python src/scrape.py
```

## 11. CAPTCHA-Safe Handling

Do not implement CAPTCHA bypass. A CAPTCHA is an explicit signal that the site wants user verification.

Recommended handling:

### Option A: Human-in-the-loop login

Run login with `HEADLESS=false`. If a CAPTCHA appears during login, a human can complete it in the visible browser. After the login succeeds, save `storage_state.json`.

This is acceptable only when:

- You own the account.
- You are allowed to automate the account.
- The site’s terms permit this use.
- You are not scaling around the challenge system.

### Option B: Stop and mark blocked

The scraper should write a blocked record:

```json
{
  "timestamp": "2026-01-01T00:00:00Z",
  "url": "https://example.com/protected",
  "blocked": true,
  "reason": "captcha_or_challenge_detected"
}
```

Then stop or skip the URL.

### Option C: Use official API access

If you need reliable data at scale, request official API credentials, partner access, export files, or webhooks.

### Option D: Ask for permission

For business-critical scraping, get written authorization and ask the site owner for a dedicated route that does not trigger user-facing bot protections.

## 12. What Not to Do

Do not:

- Use CAPTCHA solver services to defeat access controls.
- Rotate throwaway accounts to avoid restrictions.
- Spoof fingerprints to impersonate real users.
- Hammer login endpoints.
- Scrape behind authentication without permission.
- Store passwords in source code.
- Ignore `robots.txt` or terms of service.
- Continue scraping when the site clearly blocks automation.

## 13. Responsible “Stealth” vs Evasion

In legitimate automation, “stealth” should mean:

- Low request volume.
- Predictable schedules.
- Clear allowlists.
- Stable user-agent identification if appropriate.
- Respectful delays.
- Good error handling.
- No unnecessary page reloads.
- No abusive concurrency.
- No scraping outside permissioned areas.

It should **not** mean bypassing security controls.

A better term is **polite authenticated browser automation**.

## 14. Rate Limiting and Backoff

Add conservative delay between requests. For larger jobs, use exponential backoff.

Example:

```python
import asyncio
import random


async def polite_delay(base_seconds: float = 2.0) -> None:
    jitter = random.uniform(0.5, 1.5)
    await asyncio.sleep(base_seconds * jitter)
```

Use it after each page:

```python
await polite_delay(settings.request_delay_seconds)
```

## 15. Structured Block Telemetry

Always record why a scrape failed.

Useful fields:

- `timestamp`
- `url`
- `phase`
- `blocked`
- `reason`
- `status_code` if available
- `page_title`
- `host`
- `attempt_index`
- `duration_ms`

Example blocked record:

```json
{
  "timestamp": "2026-01-01T12:00:00Z",
  "url": "https://example.com/dashboard",
  "phase": "scrape",
  "blocked": true,
  "reason": "captcha_or_challenge_detected",
  "page_title": "Security Check"
}
```

This makes blocked states auditable and avoids confusing them with parser bugs.

## 16. Session State Security

Playwright `storage_state.json` can contain cookies and local storage. Treat it like a secret.

Recommended controls:

```bash
chmod 700 state
chmod 600 state/storage_state.json
```

Operational rules:

- Do not commit state files.
- Do not send state files to chat tools.
- Rotate account credentials if state is exposed.
- Use a dedicated low-privilege account when permitted.
- Keep session lifetime short when possible.

## 17. Robots.txt Awareness

The Robots Exclusion Protocol allows a site to publish crawling rules in `/robots.txt`.

For production systems, check it before scraping public pages.

Minimal check example:

```python
from urllib.robotparser import RobotFileParser
from urllib.parse import urljoin


def allowed_by_robots(base_url: str, user_agent: str, target_url: str) -> bool:
    parser = RobotFileParser()
    parser.set_url(urljoin(base_url, "/robots.txt"))
    parser.read()
    return parser.can_fetch(user_agent, target_url)
```

Note: authenticated areas may not be fully described by `robots.txt`. Terms of service and written permission still matter.

## 18. Testing Against a Safe Site

Before running against a real authenticated target, test your browser automation against a site you own or a local app.

Example local test page:

```bash
python -m http.server 8000
```

Then point `TARGET_BASE_URL` to:

```text
http://localhost:8000
```

For login flows, create a small local test app rather than experimenting on production login endpoints.

## 19. Production Hardening Checklist

Before production use:

- Confirm written permission or API access.
- Use a dedicated account with least privilege.
- Store credentials in a secret manager or environment variables.
- Save session state securely.
- Implement host allowlists.
- Add rate limits and backoff.
- Log every blocked/challenge state.
- Stop on CAPTCHA instead of bypassing it.
- Add automated tests for extraction logic.
- Add monitoring for failed login attempts.
- Rotate credentials safely.
- Keep output schemas stable.
- Review legal and compliance requirements.

## 20. Common Failure Modes

### Login selector fails

Use Playwright’s codegen or inspector to identify stable locators:

```bash
python -m playwright codegen https://example.com/login
```

Prefer role, label, placeholder, or test ID selectors.

### Session expires

Re-run `login.py` to refresh `storage_state.json`.

### CAPTCHA appears

Stop the automation or complete manually if permitted. Do not bypass it.

### Output is empty

Check:

- Are you logged in?
- Did the page load?
- Did a challenge page appear?
- Are selectors correct?
- Is the target host in `ALLOWED_HOSTS`?

### Scraper gets blocked after many pages

Reduce volume, add delays, request API access, or stop. Do not escalate into evasion.

## 21. Final Takeaways

- Authenticated scraping must be permissioned and auditable.
- Use Playwright storage state to avoid logging in repeatedly.
- Use environment variables for credentials.
- Treat browser state as a secret.
- Detect CAPTCHA and challenge pages; do not bypass them.
- Prefer official APIs for reliable access.
- Keep automation polite, low-volume, and transparent.

The goal of production scraping is not to “beat” a website. The goal is to collect permitted data reliably, safely, and respectfully.
