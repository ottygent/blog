# AI/ML Learning Roadmap in the Style of Andrej Karpathy

> A practical, build-first tutorial for learning AI/ML by following the philosophy Andrej Karpathy often demonstrates: understand the fundamentals, implement things from scratch, inspect tensors, train small models, scale gradually, and develop intuition by making things work.

## Who this is for

This guide is for someone who wants to learn modern AI/ML seriously, especially neural networks and LLMs, without getting lost in abstract theory first.

You do **not** need to start with advanced math or huge GPUs. You need:

- Python basics
- Comfort using the terminal
- Curiosity about how models actually work
- Patience to debug shapes, losses, gradients, and data

## The Karpathy-style learning principle

A good summary of the approach is:

> Do not only read about neural networks. Build them, break them, inspect them, and train them on small problems until the ideas feel obvious.

This style usually emphasizes:

1. **Start tiny.** Build the smallest working thing.
2. **Implement from scratch.** Avoid hiding the core idea behind libraries too early.
3. **Understand tensors and gradients.** Most ML bugs are shape, data, or optimization bugs.
4. **Train real models.** Even tiny models teach more than passive reading.
5. **Scale only after understanding.** Move from toy data to real data slowly.
6. **Debug scientifically.** Look at losses, samples, activations, gradients, and failure cases.
7. **Prefer projects over certificates.** A portfolio of working notebooks/tools is more valuable than a pile of watched videos.

---

# Part 1: Set up your mental model

## What is machine learning?

Traditional programming:

```text
rules + data -> answers
```

Machine learning:

```text
data + answers -> learned rules/model
```

A model is a function with parameters:

```text
y = f(x, parameters)
```

Training means adjusting the parameters so the model's predictions become less wrong.

The basic loop:

```text
input batch
  -> model forward pass
  -> prediction
  -> loss function
  -> backward pass / gradients
  -> optimizer update
  -> repeat
```

If you understand this loop deeply, you understand the skeleton of most modern AI.

## The three things to always track

When training a model, always ask:

1. **Data:** What exactly goes into the model?
2. **Loss:** What exactly is the model optimizing?
3. **Optimization:** How do parameters change after each batch?

Most beginner ML confusion comes from not knowing which of these three is broken.

---

# Part 2: Learn Python for ML

You do not need to become a Python wizard first. Learn enough to manipulate data and write clean experiments.

## Learn these Python skills

- Lists, dictionaries, tuples
- Functions
- Classes, lightly
- File I/O
- Virtual environments
- Basic CLI usage
- Debugging with prints and assertions
- NumPy arrays
- Plotting with matplotlib

## Mini project 1: Build a tiny dataset explorer

Create a script that:

1. Loads a text file.
2. Counts characters.
3. Counts words.
4. Shows the top 20 most frequent tokens.
5. Saves a small report.

Why this matters:

- LLMs start with text.
- Token frequency teaches distribution.
- Data inspection is a core ML skill.

Example:

```python
from collections import Counter
from pathlib import Path

text = Path("sample.txt").read_text(encoding="utf-8")
words = text.lower().split()
counts = Counter(words)

print("Characters:", len(text))
print("Words:", len(words))
print("Top words:")
for word, count in counts.most_common(20):
    print(word, count)
```

---

# Part 3: Learn the math you actually need

Do not try to finish every math textbook before coding. Learn math just-in-time.

## Essential math topics

### 1. Linear algebra

You need to understand:

- Scalars
- Vectors
- Matrices
- Matrix multiplication
- Dot products
- Shapes
- Transposes

In neural networks, most computation is matrix multiplication plus nonlinearities.

### 2. Calculus

You need:

- Derivatives as slopes
- Chain rule
- Partial derivatives
- Gradients

Backpropagation is mainly the chain rule applied repeatedly.

### 3. Probability

You need:

- Distributions
- Sampling
- Expected value
- Cross-entropy
- Softmax
- Log probabilities

Language models predict probability distributions over the next token.

### 4. Statistics

You need:

- Mean and variance
- Train/validation/test split
- Overfitting
- Generalization
- Evaluation metrics

## Karpathy-style math rule

For every formula, write code.

If you learn softmax, implement softmax:

```python
import numpy as np

def softmax(x):
    x = x - np.max(x)
    exp = np.exp(x)
    return exp / exp.sum()

print(softmax(np.array([1.0, 2.0, 3.0])))
```

Do not let equations remain decorative. Turn them into working code.

---

# Part 4: Build a neural network from scratch

This is the most important early milestone.

## Goal

Build a tiny automatic differentiation engine, then train a small neural network.

This mirrors the spirit of Karpathy's `micrograd`: a small scalar-based autograd engine that makes backpropagation understandable.

## What you should learn

- Computational graphs
- Forward pass
- Backward pass
- Gradients
- Parameters
- Loss
- Optimization

## Minimal autograd concept

A value stores:

- data
- gradient
- previous values
- operation that created it
- backward function

Tiny sketch:

```python
class Value:
    def __init__(self, data, children=(), op=""):
        self.data = data
        self.grad = 0.0
        self._prev = set(children)
        self._op = op
        self._backward = lambda: None

    def __add__(self, other):
        other = other if isinstance(other, Value) else Value(other)
        out = Value(self.data + other.data, (self, other), "+")

        def _backward():
            self.grad += out.grad
            other.grad += out.grad

        out._backward = _backward
        return out

    def __mul__(self, other):
        other = other if isinstance(other, Value) else Value(other)
        out = Value(self.data * other.data, (self, other), "*")

        def _backward():
            self.grad += other.data * out.grad
            other.grad += self.data * out.grad

        out._backward = _backward
        return out
```

This is not production code. It is a learning tool. The point is to understand the mechanism.

## Exercise

Implement:

- addition
- multiplication
- power
- tanh or ReLU
- topological sort
- backward pass
- a tiny multilayer perceptron

Then train it on a toy dataset like XOR or a simple 2D classification problem.

---

# Part 5: Learn PyTorch after building from scratch

Once you understand the training loop, move to PyTorch.

## Why PyTorch?

PyTorch gives you:

- tensors
- GPU support
- automatic differentiation
- neural network modules
- optimizers
- dataset utilities

But do not treat PyTorch as magic. Treat it as a faster version of what you already built manually.

## The PyTorch training loop

```python
import torch
import torch.nn as nn

model = nn.Sequential(
    nn.Linear(2, 16),
    nn.ReLU(),
    nn.Linear(16, 1),
)

optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
loss_fn = nn.BCEWithLogitsLoss()

for step in range(1000):
    logits = model(x_train)
    loss = loss_fn(logits, y_train)

    optimizer.zero_grad()
    loss.backward()
    optimizer.step()

    if step % 100 == 0:
        print(step, loss.item())
```

Memorize this structure. It appears everywhere.

## Debug checklist

When training fails, check:

- Are tensor shapes correct?
- Is the loss decreasing?
- Are labels encoded correctly?
- Is the learning rate too high or too low?
- Are gradients zero, exploding, or NaN?
- Can the model overfit one tiny batch?

The “overfit one batch” test is extremely useful. If a model cannot memorize a tiny batch, something is probably broken.

---

# Part 6: Learn language modeling the Karpathy way

After neural network basics, move to character-level and token-level language models.

## Project 1: Character-level bigram model

Train a model that predicts the next character from the current character.

Example:

```text
input:  h
output: e
```

For a name dataset:

```text
emma
olivia
ava
```

The model learns which characters often follow which characters.

## Why this matters

A bigram model is simple, but it introduces:

- tokenization
- train/validation split
- negative log likelihood
- sampling
- generation
- model evaluation

## Project 2: MLP character model

Instead of predicting from one character, predict from a context window.

```text
context: e m m
target:  a
```

This teaches:

- embeddings
- hidden layers
- batching
- context length
- train/validation/test split

## Project 3: Tiny transformer

Build a small GPT-style model.

Concepts:

- token embeddings
- positional embeddings
- self-attention
- causal masking
- multi-head attention
- feedforward blocks
- layer normalization
- residual connections
- sampling temperature

A transformer is complicated at first, but every part has a reason.

The core attention formula:

```text
Attention(Q, K, V) = softmax(QKᵀ / sqrt(d_k)) V
```

In plain English:

- Query: what am I looking for?
- Key: what information does each token offer?
- Value: what information should be copied forward?
- Softmax: how much attention should each token receive?

---

# Part 7: Tokenization

Tokenization is not a boring preprocessing step. It is part of the model interface.

## Learn these tokenizer ideas

- Character tokens
- Word tokens
- Subword tokens
- Byte Pair Encoding
- Vocabulary size
- Compression ratio
- Unknown tokens
- Special tokens

## Exercise

Build a small Byte Pair Encoding tokenizer.

Steps:

1. Start with bytes or characters.
2. Count adjacent pairs.
3. Merge the most frequent pair.
4. Repeat until vocabulary reaches target size.
5. Encode and decode text.

Why this matters:

- LLMs do not see raw text directly.
- Bad tokenization can make simple tasks harder.
- Tokenization affects cost, context length, and multilingual performance.

---

# Part 8: The AI/ML project sequence

Follow this order.

## Stage 1: Foundations

Build:

- Python text analyzer
- NumPy linear regression
- Logistic regression from scratch
- Tiny autograd engine
- Tiny neural network

You should understand:

- loss
- gradients
- optimization
- overfitting
- train/validation split

## Stage 2: PyTorch basics

Build:

- MLP classifier
- CNN image classifier
- RNN or simple sequence model
- character-level language model

You should understand:

- tensors
- batches
- modules
- optimizers
- GPU basics
- model evaluation

## Stage 3: LLM foundations

Build:

- bigram language model
- MLP language model
- tiny GPT
- tokenizer
- simple text generation app

You should understand:

- embeddings
- attention
- transformers
- sampling
- context windows
- pretraining objective

## Stage 4: Practical LLM applications

Build:

- document Q&A system
- summarizer
- classification pipeline
- agent with tool use
- evaluation harness
- prompt/version tracking

You should understand:

- retrieval
- chunking
- citations
- eval datasets
- latency/cost tradeoffs
- hallucination control

## Stage 5: Research taste

Read papers and reproduce small pieces.

Start with:

- perceptron/logistic regression basics
- backpropagation
- CNNs
- word2vec
- attention
- transformer
- GPT-style language modeling
- instruction tuning
- RLHF/direct preference optimization basics

Do not only read papers. Implement small parts.

---

# Part 9: How to study each topic

Use this loop:

```text
1. Watch/read one explanation.
2. Write the idea in your own words.
3. Implement a tiny version.
4. Train it on a small dataset.
5. Plot or print what happens.
6. Break it intentionally.
7. Fix it.
8. Write a short note: what did I learn?
```

## Example: learning attention

Bad approach:

```text
Read five transformer explainers and move on.
```

Better approach:

```text
Implement single-head causal self-attention on random tensors.
Print the shapes.
Visualize the attention matrix.
Train a tiny character model.
Change context length.
Change number of heads.
Observe what breaks.
```

---

# Part 10: Weekly learning plan

## Week 1: Python + NumPy

- Learn arrays and broadcasting.
- Implement linear regression.
- Plot loss over time.

Deliverable:

```text
linear_regression_from_scratch.py
```

## Week 2: Classification

- Implement logistic regression.
- Learn cross-entropy.
- Train on a toy dataset.

Deliverable:

```text
logistic_regression_numpy.py
```

## Week 3: Autograd

- Build a tiny scalar autograd engine.
- Implement backprop manually.

Deliverable:

```text
micro_autograd.py
```

## Week 4: Neural net from scratch

- Build a tiny MLP.
- Train on XOR or moons dataset.

Deliverable:

```text
tiny_mlp_from_scratch.py
```

## Week 5: PyTorch

- Rebuild the same MLP in PyTorch.
- Compare manual vs PyTorch training.

Deliverable:

```text
pytorch_mlp.py
```

## Week 6: Character language model

- Build a bigram model.
- Sample generated text.

Deliverable:

```text
bigram_language_model.py
```

## Week 7: Embeddings + MLP language model

- Use context windows.
- Add embeddings.
- Generate names/text.

Deliverable:

```text
mlp_language_model.py
```

## Week 8: Attention

- Implement self-attention.
- Understand causal masking.

Deliverable:

```text
attention_demo.py
```

## Week 9–10: Tiny GPT

- Build a transformer block.
- Stack multiple blocks.
- Train on a small text corpus.

Deliverable:

```text
tiny_gpt.py
```

## Week 11: Tokenizer

- Implement a small BPE tokenizer.
- Compare character vs subword tokenization.

Deliverable:

```text
mini_bpe_tokenizer.py
```

## Week 12: Capstone

Build one useful AI application:

- personal document Q&A
- HN/Reddit summarizer
- codebase explainer
- scholarship/opportunity classifier
- Telegram knowledge assistant

Deliverable:

```text
capstone_ai_app/
```

---

# Part 11: What to ignore at first

Do not start with:

- Kubernetes for ML
- giant cloud training jobs
- advanced RL
- every new paper on X/Twitter
- model leaderboard chasing
- prompt hacks as your only skill
- copying notebooks without understanding them

These can come later. First, understand training, data, loss, gradients, and models.

---

# Part 12: Common beginner mistakes

## Mistake 1: Watching too much, building too little

Fix:

For every hour watching, spend two hours coding.

## Mistake 2: Starting too big

Fix:

Train tiny models first. If you cannot debug a tiny model, a large model will only hide the problem.

## Mistake 3: Not inspecting data

Fix:

Print examples. Count labels. Check missing values. Look at token distributions.

## Mistake 4: Not checking baselines

Fix:

Compare against simple models. A neural network that cannot beat a simple baseline may be broken or unnecessary.

## Mistake 5: Treating loss as magic

Fix:

Know exactly what your loss function rewards and punishes.

## Mistake 6: Ignoring evaluation

Fix:

Keep validation sets. Track metrics. Save examples of failures.

---

# Part 13: Recommended project portfolio

By the end, aim to have these projects:

1. **Linear regression from scratch**
2. **Logistic regression from scratch**
3. **Micrograd-style autograd engine**
4. **Tiny neural network from scratch**
5. **PyTorch MLP classifier**
6. **Character-level language model**
7. **Tiny GPT**
8. **Mini BPE tokenizer**
9. **Document Q&A system with citations**
10. **One practical AI app connected to your real workflow**

Each project should include:

- README
- clear explanation
- runnable code
- sample output
- what you learned
- known limitations

---

# Part 14: How to know you are progressing

You are progressing if you can:

- Explain backpropagation without hand-waving.
- Implement a training loop from memory.
- Debug tensor shapes.
- Make a model overfit a tiny batch.
- Explain attention with queries, keys, and values.
- Build a tiny language model that generates text.
- Read an ML paper and identify the objective, architecture, data, and evaluation.
- Turn a vague AI idea into a small working prototype.

You are not progressing if you only:

- Watch videos passively.
- Collect courses endlessly.
- Memorize equations without implementing them.
- Use APIs without understanding model behavior.
- Chase every new tool without finishing projects.

---

# Final roadmap summary

The Karpathy-style path is:

```text
Python
  -> NumPy
  -> gradients
  -> neural nets from scratch
  -> PyTorch
  -> language models
  -> attention
  -> transformers
  -> tokenizers
  -> practical LLM apps
  -> evaluation and deployment
```

The spirit is simple:

> Build the thing. Make it tiny. Understand every line. Then scale.

If you follow that approach, AI/ML stops being a mysterious field and becomes a set of systems you can inspect, debug, and improve.
