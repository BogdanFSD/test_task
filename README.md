# Coding Challenges Solutions

This repository contains solutions to two algorithmic coding challenges with comprehensive test coverage, multiple implementations, and detailed documentation.

---

## Table of Contents

- [Installation](#installation)
- [Task 1: Concurrent URL Fetching](#task-1-concurrent-url-fetching)
- [Task 2: DMV License Plate Generator](#task-2-dmv-license-plate-generator)
- [Running Tests](#-running-tests)
- [Project Structure](#project-structure)

---

## Installation

```bash
# Clone the repository
git clone https://github.com/BogdanFSD/test_task.git
cd test_task

# Install dependencies
npm install
```

**Requirements:**
- Node.js 18+ (for native `fetch` and `AbortSignal.timeout`)
- TypeScript 5.9+

---

## Task 1: Concurrent URL Fetching

### Problem Statement

> Given an array of URLs and a `MAX_CONCURRENCY` integer, implement a function that will asynchronously fetch each URL, not requesting more than `MAX_CONCURRENCY` URLs at the same time. The URLs should be fetched as soon as possible. The function should return an array of responses for each URL in the original order.

### Solutions

#### Solution 1: `fetchAllWithConcurrency` (Simple)

**Location:** `tasks/concurrency_fetch/src/fetchAllWithConcurrency.ts`

**Features:**
- Worker pool pattern with configurable concurrency
- Preserves response order
- Fail-fast error handling
- Custom fetch implementation support

**Example:**

```typescript
import { fetchAllWithConcurrency } from "./fetchAllWithConcurrency.js";

const urls = [
  "https://api.example.com/data/1",
  "https://api.example.com/data/2",
  "https://api.example.com/data/3",
  "https://api.example.com/data/4",
  "https://api.example.com/data/5",
];

const maxConcurrency = 2; // Only 2 concurrent requests at a time

const responses = await fetchAllWithConcurrency(urls, maxConcurrency);
console.log(responses); // Array of Response objects in original order
```

**Run Demo:**
```bash
npm run fetch:demo
```

---

#### Solution 2: `fetchAllWithConcurrency2` (Advanced)

**Location:** `tasks/concurrency_fetch/src/fetchAllWithConcurrency.ts`

**Features:**
- All features from Solution 1, plus:
- Per-request timeout support
- Global abort signal
- Configurable fail-fast behavior
- Proper request cancellation and cleanup
- Production-ready error handling

**Example:**

```typescript
import { fetchAllWithConcurrency2 } from "./fetchAllWithConcurrency.js";

const urls = [
  "https://api.example.com/slow",
  "https://api.example.com/fast",
  "https://api.example.com/data",
];

const responses = await fetchAllWithConcurrency2(urls, 3, {
  timeoutMs: 5000,        // 5 second timeout per request
  failFast: true,         // Stop all on first failure
  signal: abortSignal,    // Optional external abort signal
  fetchImpl: customFetch, // Optional custom fetch
});
```

**Run Demo:**

 **Note:** The demo expects a local server. Start it first:

```bash
# Terminal 1: Start the local test server
npm run fetch:server

# Terminal 2: Run the demo
npm run fetch:demo2

# Or with environment variables
MAX_CONCURRENCY=3 TIMEOUT_MS=10000 npm run fetch:demo2
```

---

### Local Test Server

A lightweight HTTP server for testing concurrent requests with realistic delays and failures.

**Location:** `tasks/concurrency_fetch/server/localServer.ts`

**Endpoints:**
- `GET /delay?ms=<number>&label=<string>` - Returns after specified delay
- `GET /fail` - Returns HTTP 500 error
- `GET /metrics` - Returns server metrics (in-flight, total, aborted)

**Start Server:**
```bash
npm run fetch:server

# Or with custom port
PORT=4000 npm run fetch:server
```

**Example Usage:**
```bash
# In another terminal:
curl "http://localhost:3000/delay?ms=500&label=test"
curl "http://localhost:3000/metrics"
```

**For Testing:** The integration tests automatically start and stop their own ephemeral server on random ports, so you **don't need to manually start the server** before running tests.

---

### How It Works

**Worker Pool Pattern:**
```
URLs: [A, B, C, D, E, F]
Max Concurrency: 2

Time →
0ms   [Worker 1: A]  [Worker 2: B]
      │              │
      │              ✓ (B done, starts C)
      │              [Worker 2: C]
      ✓ (A done, starts D)
      [Worker 1: D]  │
      │              ✓ (C done, starts E)
      │              [Worker 2: E]
      ✓ (D done, starts F)
      [Worker 1: F]  │
      │              ✓ (E done)
      ✓ (F done)

Result: [A, B, C, D, E, F] (order preserved)
```

---

### Test Coverage

**17 tests for `fetchAllWithConcurrency`:**
- ✅ Concurrency limiting and order preservation
- ✅ Fail-fast error handling
- ✅ Edge cases (empty array, single URL, maxConcurrency > URLs)
- ✅ Sequential execution (maxConcurrency = 1)
- ✅ Large batch processing (50 URLs)
- ✅ Input validation (invalid concurrency, null URLs)
- ✅ Integration tests with real HTTP server

**3 tests for `fetchAllWithConcurrency2`:**
- ✅ Advanced concurrency control
- ✅ Timeout and abort handling
- ✅ Fail-fast with proper cleanup

**3 integration tests:**
- ✅ Server-side concurrency verification
- ✅ Client abort detection
- ✅ Timeout disconnect handling

**Run Tests:**
```bash
# All tests
npm test

# Specific test suites
npm run test:fetch        # Basic implementation tests
npm run test:fetch2       # Advanced implementation tests
npm run test:integration  # Server integration tests
npm run test:all-fetch    # All fetch-related tests
```

---

## Task 2: DMV License Plate Generator

### Problem Statement

The DMV generates license plates sequentially with a specific alphanumeric pattern:
- 6 characters total (always digits before letters)
- Sequence: `000000`, `000001`, ..., `999999`, `00000A`, `00001A`, ..., `99999Z`, `0000AA`, ..., `ZZZZZZ`

**Goal:** Write the most efficient function that can return the nth element in this sequence.

### Sequence Pattern

```
Block 0: 000000 → 999999     (1,000,000 plates, 6 digits)
Block 1: 00000A → 99999Z     (2,600,000 plates, 5 digits + 1 letter)
Block 2: 0000AA → 9999ZZ     (67,600,000 plates, 4 digits + 2 letters)
Block 3: 000AAA → 999ZZZ     (1,757,600,000 plates, 3 digits + 3 letters)
...
Total: 501,363,136 possible plates
```

**Examples:**
```
n = 0          → "000000"
n = 999,999    → "999999"
n = 1,000,000  → "00000A"
n = 1,000,001  → "00001A"
n = 1,099,999  → "99999A"
n = 1,100,000  → "00000B"
n = 3,600,000  → "0000AA"
n = 3,609,999  → "9999AA"
n = 3,610,000  → "0000AB"
```

---

### Solutions

#### Algorithm A: Block Arithmetic (WINNER)

**Location:** `tasks/algorithms_collection/src/algorithms/baseBlock.ts`

**Time Complexity:** O(1) constant time  
**Space Complexity:** O(1)

**Strategy:**
1. Pre-compute block sizes
2. Find which block contains `n` by subtraction
3. Calculate offset within block
4. Convert to digits + letters

**Best for:** Production use - fastest and correct

---

#### Algorithm B: Binary Search

**Location:** `tasks/algorithms_collection/src/algorithms/binarySearch.ts`

**Time Complexity:** O(log n)  
**Space Complexity:** O(1)

**Strategy:**
1. Pre-compute cumulative block boundaries
2. Binary search to find correct block
3. Calculate offset and convert

**Best for:** When you want to understand binary search approach

---

#### Algorithm C: Sequential

**Location:** `tasks/algorithms_collection/src/algorithms/sequential.ts`

**Time Complexity:** O(n) linear time  
**Space Complexity:** O(1)

**Strategy:**
- Simulate the sequence step by step
- Increment through all values until reaching `n`

**Best for:** Educational purposes - clearly shows the pattern  
⚠️ **Warning:** Very slow for large `n` (unusable for n > 100,000)

---

#### Algorithm D: Base-36 (INCORRECT)

**Location:** `tasks/algorithms_collection/src/algorithms/base36.ts`

**Time Complexity:** O(1)  
**Space Complexity:** O(1)

**Why it's wrong:** Base-36 encoding doesn't match DMV order (produces `999999` → `LFL0T` instead of `00000A`)

**Best for:** Understanding why naive base conversion doesn't work

---

### Running the Solutions

#### Showcase All Algorithms

Compare all 4 algorithms with validation and benchmarks:

```bash
npm run plate:showcase
```

**Output:**
```
🧩 DMV License Plate Generator — Validation & Logic Checks
✅ Core transitions verified
✅ A, B, and C produce identical results up to 20,000

⚡ PERFORMANCE COMPARISON — Different Algorithms
📊 Running 10,000 random calls...
  A  Block arithmetic (✅ Correct, fastest)        → total=   2.157 ms | avg=0.000216 ms
  B  Binary search (✅ Correct, slightly slower)   → total=   2.893 ms | avg=0.000289 ms
  C  Sequential (✅ Correct, but very slow)        → total= 457.321 ms | avg=0.045732 ms
  D  Base-36 (❌ Wrong order, ultra fast)          → total=   1.024 ms | avg=0.000102 ms
```

---

#### Explain a Specific Plate Number

See detailed breakdown of how a plate number is calculated:

```bash
npm run plate:explain 3600000
```

**Output:**
```
--- DMV LICENSE PLATE EXPLAINER ---
Target n = 3,600,000

--- Block configuration ---
Block 0: digits=6, letters=0, combinations=1,000,000
Block 1: digits=5, letters=1, combinations=2,600,000
Block 2: digits=4, letters=2, combinations=67,600,000
...

--- RESULT ---
Block index: 2
Digits count: 4
Letters count: 2
Offset inside block: 0
✅ Final plate = 0000AA
```

---

#### Verbose Demo (Winner Algorithm)

Run comprehensive validation, examples, and benchmarks:

```bash
npm run plate:winner
```

Shows:
- ✅ Block configuration explanation
- ✅ Step-by-step calculation for key transitions
- ✅ Automated validation tests
- ✅ Examples across the sequence
- ✅ Performance benchmarks (10 → 1,000,000 runs)

---

### Performance Comparison

| Algorithm | 100K calls | 1M calls | Correctness |
|-----------|------------|----------|-------------|
| **A: Block Arithmetic** | ~20ms | ~200ms | ✅ Correct |
| **B: Binary Search** | ~30ms | ~300ms | ✅ Correct |
| **C: Sequential** | **45,000ms** | **N/A** | ✅ Correct (too slow) |
| **D: Base-36** | ~10ms | ~100ms | ❌ Wrong order |

**Winner:** Algorithm A (Block Arithmetic) - Best balance of speed and correctness

---

## 🧪 Running Tests

```bash
# All tests (both tasks)
npm test

# Concurrency fetch tests only
npm run test:fetch           # Basic implementation (17 tests)
npm run test:fetch2          # Advanced implementation (3 tests)
npm run test:integration     # Server integration (3 tests)
npm run test:all-fetch       # All fetch tests (23 tests)

# Build TypeScript
npm run build
```

---

## Project Structure

```
test_task/
├── tasks/
│   ├── concurrency_fetch/          # Task 1: URL Fetching
│   │   ├── src/
│   │   │   ├── fetchAllWithConcurrency.ts    # Simple & advanced implementations
│   │   │   ├── concurrencyFetch.ts           # Basic demo
│   │   │   └── concurrencyFetch2Demo.ts      # Advanced demo
│   │   ├── server/
│   │   │   └── localServer.ts                # Test HTTP server
│   │   ├── tests/
│   │   │   ├── fetchAllWithConcurrency.test.ts       # 17 unit tests
│   │   │   ├── fetchAllWithConcurrency2.test.ts      # 3 advanced tests
│   │   │   └── integration.local.test.ts             # 3 integration tests
│   │   └── README.md
│   │
│   └── algorithms_collection/      # Task 2: License Plates
│       ├── src/
│       │   ├── algorithms/
│       │   │   ├── baseBlock.ts              # Algorithm A (WINNER)
│       │   │   ├── binarySearch.ts           # Algorithm B
│       │   │   ├── sequential.ts             # Algorithm C
│       │   │   ├── base36.ts                 # Algorithm D (incorrect)
│       │   │   └── shared.ts                 # Utilities
│       │   ├── showcase.ts                   # Compare all algorithms
│       │   ├── explain.ts                    # Explain specific plate
│       │   └── verbose_demo_winner.ts        # Full demo of winner
│       └── README.md
│
├── package.json                    # Scripts and dependencies
├── tsconfig.json                   # TypeScript configuration
└── README.md                       # This file
```

---

# 🎯 Key Features

### Concurrency Fetch
- ✅ Worker pool with precise concurrency control
- ✅ Order preservation
- ✅ Timeout and abort handling
- ✅ Fail-fast with proper cleanup
- ✅ 23 comprehensive tests
- ✅ Local test server with metrics

### License Plate Generator
- ✅ O(1) constant time solution
- ✅ 4 different algorithm implementations
- ✅ Detailed explanations and visualizations
- ✅ Comprehensive benchmarking
- ✅ Validation tests

---

## Quick Start

### Task 1: Concurrent Fetch Demo

```bash
# Install dependencies
npm install

# Terminal 1: Start local test server (for demo only)
npm run fetch:server

# Terminal 2: Run demos
npm run fetch:demo         # Simple demo
npm run fetch:demo2        # Advanced demo with local server

# Run tests (server not needed - tests start their own)
npm run test:fetch         # 17 unit tests
npm run test:integration   # 3 integration tests
npm test                   # All 23 tests
```

### Task 2: License Plate Generator

```bash
# Compare all 4 algorithms with benchmarks
npm run plate:showcase

# Explain a specific plate number
npm run plate:explain 3600000

# Verbose demo of the winning algorithm
npm run plate:winner
```

### Code Examples

**Fetch URLs with Concurrency:**
```typescript
import { fetchAllWithConcurrency } from "./tasks/concurrency_fetch/src/fetchAllWithConcurrency.js";

const urls = ["url1", "url2", "url3", "url4", "url5"];
const responses = await fetchAllWithConcurrency(urls, 2); // max 2 concurrent
```

**Generate License Plate:**
```typescript
import { getPlateA } from "./tasks/algorithms_collection/src/algorithms/baseBlock.js";

console.log(getPlateA(0));          // "000000"
console.log(getPlateA(999999));     // "999999"
console.log(getPlateA(1000000));    // "00000A"
console.log(getPlateA(3600000));    // "0000AA"
```

---

## License

MIT

## 👤 Author

Bogdan FSD

---

##  Contributing

Feel free to open issues or submit pull requests!

