# Building a ReAct Agent from Scratch in Python

## Audience

This tutorial is for developers who want to understand how a basic AI agent works internally. We will build a small **ReAct agent** from scratch in Python.

ReAct means **Reason + Act**. A ReAct agent alternates between:

- Thinking about what to do next
- Choosing a tool/action
- Observing the result
- Continuing until it can answer the user

This is the same basic pattern behind many practical agent systems.

## 1. What We Are Building

We will build a command-line agent that can:

1. Accept a user question.
2. Ask an LLM what to do.
3. Let the LLM call simple tools.
4. Feed tool results back into the LLM.
5. Stop when the LLM returns a final answer.

The agent will support these tools:

- `calculator`: evaluate safe arithmetic expressions.
- `search_knowledge_base`: search a tiny local knowledge base.
- `get_current_time`: return the current system time.

The architecture will look like this:

```text
User
 │
 ▼
Agent Loop
 │
 ├── Build prompt
 │
 ├── Call LLM
 │
 ├── Parse response
 │
 ├── If action requested:
 │      ├── Run tool
 │      └── Add observation to scratchpad
 │
 └── If final answer:
        └── Return answer to user
```

## 2. ReAct Prompt Format

A classic ReAct agent uses a text protocol like this:

```text
Question: What is 12 * 8?
Thought: I need to calculate 12 times 8.
Action: calculator
Action Input: 12 * 8
Observation: 96
Thought: I have the result.
Final Answer: 12 * 8 is 96.
```

The model is asked to emit one of two things:

1. An action:

```text
Thought: ...
Action: tool_name
Action Input: tool input
```

2. A final answer:

```text
Thought: ...
Final Answer: answer to the user
```

Our Python code will parse this format.

## 3. Project Setup

Create a new directory:

```bash
mkdir react-agent-python
cd react-agent-python
```

Create a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install the OpenAI client:

```bash
pip install openai
```

Set your API key:

```bash
export OPENAI_API_KEY="your_api_key_here"
```

If you use another OpenAI-compatible provider, set a custom base URL in the code or environment.

## 4. Complete Minimal Agent

Create `react_agent.py`:

```python
import ast
import operator
import os
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Callable, Dict, Optional

from openai import OpenAI


# -----------------------------
# Tool system
# -----------------------------

@dataclass
class Tool:
    name: str
    description: str
    function: Callable[[str], str]


def safe_calculator(expression: str) -> str:
    """Safely evaluate simple arithmetic expressions."""

    allowed_operators = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.Pow: operator.pow,
        ast.USub: operator.neg,
    }

    def eval_node(node):
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return node.value

        if isinstance(node, ast.BinOp):
            op_type = type(node.op)
            if op_type not in allowed_operators:
                raise ValueError(f"Operator {op_type.__name__} is not allowed")
            left = eval_node(node.left)
            right = eval_node(node.right)
            return allowed_operators[op_type](left, right)

        if isinstance(node, ast.UnaryOp):
            op_type = type(node.op)
            if op_type not in allowed_operators:
                raise ValueError(f"Unary operator {op_type.__name__} is not allowed")
            operand = eval_node(node.operand)
            return allowed_operators[op_type](operand)

        raise ValueError(f"Unsupported expression: {ast.dump(node)}")

    try:
        tree = ast.parse(expression, mode="eval")
        result = eval_node(tree.body)
        return str(result)
    except Exception as exc:
        return f"calculator error: {exc}"


def get_current_time(_: str) -> str:
    return datetime.now().isoformat(timespec="seconds")


KNOWLEDGE_BASE = {
    "python": "Python is a high-level programming language known for readability.",
    "react agent": "A ReAct agent alternates between reasoning traces and tool actions.",
    "llm": "An LLM is a large language model trained to predict and generate text.",
    "tool use": "Tool use lets an AI model call external functions to get information or perform actions.",
}


def search_knowledge_base(query: str) -> str:
    query_lower = query.lower()
    matches = []

    for key, value in KNOWLEDGE_BASE.items():
        if query_lower in key.lower() or query_lower in value.lower():
            matches.append(f"{key}: {value}")

    if not matches:
        return "No matching knowledge base entries found."

    return "\n".join(matches)


TOOLS: Dict[str, Tool] = {
    "calculator": Tool(
        name="calculator",
        description="Evaluate simple arithmetic expressions. Input example: 12 * (4 + 5)",
        function=safe_calculator,
    ),
    "get_current_time": Tool(
        name="get_current_time",
        description="Return the current local datetime. Input can be empty.",
        function=get_current_time,
    ),
    "search_knowledge_base": Tool(
        name="search_knowledge_base",
        description="Search a small local knowledge base. Input should be a search query.",
        function=search_knowledge_base,
    ),
}


# -----------------------------
# Prompting
# -----------------------------

def render_tools_description() -> str:
    lines = []
    for tool in TOOLS.values():
        lines.append(f"- {tool.name}: {tool.description}")
    return "\n".join(lines)


SYSTEM_PROMPT = f"""
You are a ReAct-style agent.

You can solve problems by thinking and using tools.

Available tools:
{render_tools_description()}

Use this exact format when you need a tool:

Thought: explain what you need to do next
Action: one of [{", ".join(TOOLS.keys())}]
Action Input: input for the action

When you know the final answer, use this exact format:

Thought: explain why you can answer now
Final Answer: your final answer to the user

Rules:
- Use tools when they are helpful.
- Do not invent tool results.
- After an Observation, continue reasoning from that observation.
- Only use tool names from the available tools list.
""".strip()


# -----------------------------
# LLM client
# -----------------------------

class LLM:
    def __init__(self, model: str = "gpt-4o-mini"):
        self.client = OpenAI()
        self.model = model

    def complete(self, prompt: str) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0,
        )
        return response.choices[0].message.content or ""


# -----------------------------
# Parsing model responses
# -----------------------------

@dataclass
class AgentAction:
    thought: str
    tool_name: str
    tool_input: str


@dataclass
class AgentFinalAnswer:
    thought: str
    answer: str


def parse_response(text: str):
    final_match = re.search(
        r"Thought:\s*(.*?)\s*Final Answer:\s*(.*)",
        text,
        re.DOTALL | re.IGNORECASE,
    )
    if final_match:
        return AgentFinalAnswer(
            thought=final_match.group(1).strip(),
            answer=final_match.group(2).strip(),
        )

    action_match = re.search(
        r"Thought:\s*(.*?)\s*Action:\s*(.*?)\s*Action Input:\s*(.*)",
        text,
        re.DOTALL | re.IGNORECASE,
    )
    if action_match:
        return AgentAction(
            thought=action_match.group(1).strip(),
            tool_name=action_match.group(2).strip(),
            tool_input=action_match.group(3).strip(),
        )

    raise ValueError(f"Could not parse model response:\n{text}")


# -----------------------------
# Agent loop
# -----------------------------

class ReActAgent:
    def __init__(self, llm: LLM, max_steps: int = 6):
        self.llm = llm
        self.max_steps = max_steps

    def run(self, question: str) -> str:
        scratchpad = ""

        for step in range(1, self.max_steps + 1):
            prompt = self.build_prompt(question, scratchpad)
            model_output = self.llm.complete(prompt)

            print(f"\n--- Step {step}: model output ---")
            print(model_output)

            parsed = parse_response(model_output)

            if isinstance(parsed, AgentFinalAnswer):
                return parsed.answer

            if parsed.tool_name not in TOOLS:
                observation = f"Unknown tool: {parsed.tool_name}"
            else:
                tool = TOOLS[parsed.tool_name]
                observation = tool.function(parsed.tool_input)

            print(f"\n--- Step {step}: observation ---")
            print(observation)

            scratchpad += (
                f"Thought: {parsed.thought}\n"
                f"Action: {parsed.tool_name}\n"
                f"Action Input: {parsed.tool_input}\n"
                f"Observation: {observation}\n"
            )

        return "I reached the maximum number of steps without producing a final answer."

    @staticmethod
    def build_prompt(question: str, scratchpad: str) -> str:
        return f"""
Question: {question}

Previous reasoning and observations:
{scratchpad if scratchpad else "None yet."}

What is the next step?
""".strip()


# -----------------------------
# CLI entry point
# -----------------------------

if __name__ == "__main__":
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("Please set OPENAI_API_KEY before running this script.")

    agent = ReActAgent(llm=LLM())

    print("ReAct Agent. Type 'exit' to quit.")
    while True:
        question = input("\nQuestion: ").strip()
        if question.lower() in {"exit", "quit"}:
            break
        answer = agent.run(question)
        print("\nFinal Answer:")
        print(answer)
```

## 5. Run the Agent

Run:

```bash
python react_agent.py
```

Try:

```text
Question: What is 12 * (8 + 4)?
```

Expected behavior:

```text
Thought: I need to calculate the arithmetic expression.
Action: calculator
Action Input: 12 * (8 + 4)
Observation: 144
Thought: I now have the calculated result.
Final Answer: 12 * (8 + 4) is 144.
```

Try another:

```text
Question: What is a ReAct agent?
```

The model should call `search_knowledge_base`, observe the result, then answer.

## 6. Why This Works

The agent works because the LLM is not asked to answer everything directly. Instead, the LLM is given a controlled loop:

```text
Think → choose action → receive observation → think again → answer
```

The Python program enforces the loop. The model only decides what action to request. The program decides whether that action is valid and executes the real tool.

This separation is important:

- The LLM handles reasoning and planning.
- Python handles execution and validation.
- Tools provide grounded external information.
- Observations prevent the model from needing to invent results.

## 7. Important Design Choices

### 7.1 Text Protocol vs Function Calling

This tutorial uses a simple text protocol because it is easier to understand.

Production systems often use structured tool calling instead, where the model returns JSON-like tool calls directly.

Text protocol:

```text
Action: calculator
Action Input: 2 + 2
```

Structured tool call:

```json
{
  "tool": "calculator",
  "arguments": {
    "expression": "2 + 2"
  }
}
```

Structured tool calling is more reliable, but the ReAct loop is conceptually the same.

### 7.2 Scratchpad

The scratchpad stores previous reasoning, actions, and observations:

```text
Thought: ...
Action: ...
Action Input: ...
Observation: ...
```

It is sent back to the model at every step so the model can continue from actual tool results.

### 7.3 Max Steps

The `max_steps` limit prevents infinite loops.

Without it, a confused model could keep calling tools forever.

### 7.4 Tool Validation

The agent checks whether the requested tool exists:

```python
if parsed.tool_name not in TOOLS:
    observation = f"Unknown tool: {parsed.tool_name}"
```

This prevents arbitrary tool execution.

### 7.5 Safe Calculator

The calculator does not use raw `eval`. It parses the expression with Python's `ast` module and only allows arithmetic nodes.

Avoid this in production:

```python
eval(user_input)
```

That can execute arbitrary code.

## 8. Adding a New Tool

To add a weather tool, create a function:

```python
def get_weather(city: str) -> str:
    # Replace this with a real API call.
    return f"The weather in {city} is sunny."
```

Register it:

```python
TOOLS["get_weather"] = Tool(
    name="get_weather",
    description="Get weather for a city. Input should be a city name.",
    function=get_weather,
)
```

Because the system prompt renders `TOOLS`, the model will see the new tool automatically.

## 9. Making the Parser More Robust

The regex parser is intentionally simple. In real systems, make parsing stricter.

Potential improvements:

- Require exact line-based format.
- Parse JSON instead of free text.
- Reject multi-action outputs.
- Normalize tool names.
- Validate action inputs.
- Add retry logic when parsing fails.

Example stricter response format:

```json
{
  "thought": "I need to calculate the expression.",
  "action": "calculator",
  "action_input": "12 * 8"
}
```

Then parse with:

```python
import json
parsed = json.loads(model_output)
```

## 10. Adding Conversation Memory

The current agent handles one question at a time. To support conversation memory, store prior user/assistant messages.

Simple approach:

```python
history = []

history.append({"role": "user", "content": question})
history.append({"role": "assistant", "content": answer})
```

Then include recent history in the prompt.

Be careful: conversation history grows over time and can exceed the model context window. Production agents summarize or retrieve only relevant memories.

## 11. Adding Retrieval-Augmented Generation

The `search_knowledge_base` tool is a toy retriever. A better version could:

1. Store documents in a vector database.
2. Embed the user query.
3. Retrieve the top matching chunks.
4. Return those chunks to the agent as observations.

Architecture:

```text
Question
  │
  ▼
Agent chooses search tool
  │
  ▼
Retriever searches documents
  │
  ▼
Observation contains relevant chunks
  │
  ▼
Agent writes grounded answer
```

This is how many research, documentation, and support agents work.

## 12. Adding Real Function Calling

Modern LLM APIs support tool/function calling. In that setup, you give the model schemas like:

```json
{
  "name": "calculator",
  "description": "Evaluate arithmetic expressions",
  "parameters": {
    "type": "object",
    "properties": {
      "expression": {
        "type": "string"
      }
    },
    "required": ["expression"]
  }
}
```

The model then returns a structured tool call instead of plain text.

The loop becomes:

```text
Call model with tool schemas
  │
  ├── Model returns tool call
  │      ├── Execute tool
  │      └── Append tool result
  │
  └── Model returns final text
```

This is more reliable than parsing text manually.

## 13. Production Hardening Checklist

Before using an agent in production, add these safeguards:

### Tool safety

- Explicit allowlist of tools.
- Input validation for every tool.
- Timeout for slow tools.
- Rate limits.
- Clear error messages.
- No raw shell execution unless heavily sandboxed.

### Prompt safety

- Strong instruction hierarchy.
- Do not expose secrets in prompts.
- Do not let retrieved content override system instructions.
- Clearly separate observations from instructions.

### Runtime safety

- Max step limit.
- Max token limit.
- Logging and traces.
- Error handling and retries.
- Human approval for dangerous actions.
- Sandboxed execution for code tools.

### Observability

Log every step:

- User request
- Model output
- Parsed action
- Tool input
- Tool result
- Final answer
- Errors
- Latency
- Token usage

### Evaluation

Create test cases:

- Simple arithmetic
- Multi-step reasoning
- Unknown tool requests
- Bad parser output
- Tool errors
- Max-step exhaustion
- Retrieval accuracy
- Safety refusal cases

## 14. Common Failure Modes

### The model does not follow the format

Add a retry step:

```python
try:
    parsed = parse_response(model_output)
except ValueError:
    scratchpad += "Observation: Your previous response did not follow the required format. Try again.\n"
    continue
```

### The model calls a nonexistent tool

Return an observation telling it which tools are valid.

```python
observation = f"Unknown tool. Valid tools are: {list(TOOLS)}"
```

### The agent loops forever

Use `max_steps` and optionally detect repeated actions.

### The model invents observations

Never trust model-written observations. Only the Python runtime should add observations after executing tools.

### Tool output is too large

Summarize, truncate, or paginate tool output before adding it to the scratchpad.

## 15. Minimal Offline Version Without an LLM

If you want to test the loop without calling an API, create a fake LLM:

```python
class FakeLLM:
    def __init__(self):
        self.calls = 0

    def complete(self, prompt: str) -> str:
        self.calls += 1
        if self.calls == 1:
            return """
Thought: I need to calculate this.
Action: calculator
Action Input: 2 + 2
""".strip()
        return """
Thought: I have the observation and can answer.
Final Answer: The answer is 4.
""".strip()
```

Use it:

```python
agent = ReActAgent(llm=FakeLLM())
print(agent.run("What is 2 + 2?"))
```

This is useful for unit testing the agent loop.

## 16. Suggested Unit Tests

Create `test_react_agent.py`:

```python
from react_agent import parse_response, AgentAction, AgentFinalAnswer, safe_calculator


def test_parse_action():
    text = """
Thought: I need math.
Action: calculator
Action Input: 2 + 2
""".strip()

    parsed = parse_response(text)
    assert isinstance(parsed, AgentAction)
    assert parsed.tool_name == "calculator"
    assert parsed.tool_input == "2 + 2"


def test_parse_final_answer():
    text = """
Thought: I know the answer.
Final Answer: The answer is 4.
""".strip()

    parsed = parse_response(text)
    assert isinstance(parsed, AgentFinalAnswer)
    assert parsed.answer == "The answer is 4."


def test_safe_calculator():
    assert safe_calculator("2 + 2") == "4"
```

Run tests:

```bash
pip install pytest
pytest -q
```

## 17. From Toy Agent to Real Agent

To turn this into a real system, evolve it in stages:

1. Replace text parsing with structured tool calling.
2. Add persistent conversation history.
3. Add retrieval over documents.
4. Add streaming responses.
5. Add typed tool schemas.
6. Add tool permissions.
7. Add human approval for risky tools.
8. Add tracing and replay.
9. Add automated evaluations.
10. Add deployment as an API service.

A production architecture might look like this:

```text
Frontend / API
    │
    ▼
Agent Service
    │
    ├── LLM Provider Client
    ├── Tool Registry
    ├── Memory Store
    ├── Retrieval System
    ├── Trace Logger
    ├── Policy / Safety Layer
    └── Human Approval Queue
```

## 18. Final Takeaways

- A ReAct agent is a loop, not a single LLM call.
- The model decides what action to request.
- The program executes tools and provides observations.
- The scratchpad lets the model reason across steps.
- Safety comes from tool validation, step limits, parsing, and sandboxing.
- Production agents should use structured tool calling, logging, memory, tests, and human approval for dangerous actions.

The small agent in this tutorial is intentionally simple, but it contains the core idea used by much larger agent systems: **reason, act, observe, repeat**.
