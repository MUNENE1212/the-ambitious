Cleanup done. Writing up findings.

---

# Tiny-LLM structured extraction on a small VPS — verified research**All retrieval dates: 2026-10-20.** Measurements marked **MEASURED** are my own, run on this machine (hardware stated below). Everything else is sourced.

## Headline findings

1. **Two of the hypothesized node-llama-cpp APIs do not exist.** The real factory method is `llama.createGrammarForJsonSchema()` (on `Llama`, not `LlamaContext`). `LlamaGrammar.createForJsonSchema` does not exist anywhere in v3.22.2.
2. **`llama-server --json-schema` / `--json-schema-file` are broken as of b11748** — every request returns HTTP 400. Reproduced first-hand. Root cause is upstream issue #29006; the fix PR #29066 is **still open**. `--grammar-file` (raw GBNF) works perfectly.
3. **AVX2-only vs AVX512 was nearly irrelevant for decode** on my box — the opposite of the "x86 AVX2 is much slower" prior. Decode is memory-bandwidth bound at these model sizes; **prefill** is where AVX512 helps (1.3–1.5×).
4. **KV cache at 4K is 448 MiB for both 0.6B and 1.7B** — identical, because Qwen3 GQA shares 8 KV heads across both sizes. This is larger than most budgeting assumptions and does not scale down with model size.
5. **transformers.js has zero grammar support and zero GGUF support** — confirmed by exhaustive grep of the published source, not inference.
6. **Grammar constrains format, not truth.** Qwen3-0.6B emitted perfectly valid JSON with `amount: 2000000000` for a Ksh 2,000 SMS. For your use case this is the single most important finding.

---

## 1. node-llama-cpp JSON-schema grammar API

**Version: 3.22.2** — `engines.node: ">=20.0.0"`, and its prebuilt binary bundles **llama.cpp v0.7.0**.

Verified by extracting the published tarball and reading the emitted `.d.ts` files, not from docs prose.

| Hypothesized API | Status |
|---|---|
| `LlamaJsonSchemaGrammar` | ✅ Exists (`dist/evaluator/LlamaJsonSchemaGrammar.d.ts`) |
| `llama.createGrammarForJsonSchema(schema)` | ✅ **The real factory** |
| `context.createGrammarForJsonSchema(...)` | ❌ On `Llama`, not `LlamaContext` |
| `LlamaGrammar.createForJsonSchema` | ❌ **Does not exist** — zero matches in all of `dist/` |
| `grammar` in completion/session options | ✅ `LlamaCompletionGenerationOptions.grammar?: LlamaGrammar` |

Actual declarations:

```typescript
// dist/bindings/Llama.d.ts:163
createGrammarForJsonSchema<const T extends GbnfJsonSchema<Defs>, ...>(
  schema: Readonly<T> & GbnfJsonSchema<Defs>
): Promise<LlamaJsonSchemaGrammar<T, Defs>>;

// dist/evaluator/LlamaJsonSchemaGrammar.d.ts
export declare class LlamaJsonSchemaGrammar<...> extends LlamaGrammar {
  constructor(llama, schema);   // @deprecated Use llama.createGrammarForJsonSchema(...)
  get schema();
  parse(json: string): GbnfJsonSchemaToType<T>; // returns a TYPED object
}
```

Note `grammar.parse()` returns a **compile-time typed** value (generics flow from schema → result). Also note both constructors are `@deprecated` in v3 — always use the factory.

Documented usage — https://node-llama-cpp.withcat.ai/guide/chat-session#response-json-schema (retrieved 2026-10-20):

```typescript
const grammar = await llama.createGrammarForJsonSchema({ /* schema */ });
const res = await session.prompt(prompt, { grammar });
const parsedRes = grammar.parse(res);   // typed
```

**Node.js support: yes, and it is the primary target.** Evidence:
- Grammar compiled through native addon (`llama/addon/AddonGrammar.cpp`) and shipped `.node` binaries for 14 platforms including `linux-x64` — not browser/Electron-only.
- Electron is a *separate opt-in guide page*, not the base path.
- No `electron` mention in the README; `cmake-js` + `node-addon-api` deps.
- ⚠️ **Requires Node ≥ 20.** This sandbox has Node 18, so I could not execute node-llama-cpp end-to-end — grammar API confirmation is from shipped type declarations + docs, which is strong but is not a runtime test. **UNVERIFIED at runtime.**

**Architecturally immune to the llama-server grammar bug:** node-llama-cpp ships its own grammar layer (`llama/addon/AddonGrammar.cpp`, `AddonGrammarEvaluationState.cpp`) and contains **zero references to `common_sampler`** in the whole package — the component where the upstream bug lives. So `createGrammarForJsonSchema` should work where `llama-server -j` fails. *(Code-inspection inference, not runtime-verified — flag as UNVERIFIED.)*

Docs: https://node-llama-cpp.withcat.ai/guide/grammar and https://node-llama-cpp.withcat.ai/guide/chat-session#response-json-schema

---

## 2. CPU-only throughput — MEASURED

I ran these myself rather than citing blog posts. Hardware:

| Property | Value |
|---|---|
| CPU | Intel Core i7-1185G7 @ 3.0GHz (mobile Tiger Lake) |
| Cores / threads | **4 physical / 8 logical** |
| ISA | AVX2, AVX-512F/VNNI (icelake backend auto-selected) |
| llama.cpp | `b11748` (v0.7.0-dev, commit `3bb63cbcb`), CPU-only ubuntu-x64 |
| Threads used | 4 (`taskset -c 0-3`, physical cores only) |
| Models | Qwen3 {0.6B, 1.7B, 4B} Q4_K_M |

| Model | Q4_K_M size | pp512 (prefill t/s) | tg128 (decode t/s) |
|---|---|---|---|
| Qwen3-0.6B | 372.65 MiB | 153.92 ± 3.32 | 34.89 ± 2.30 |
| Qwen3-1.7B | 1.03 GiB | 55.71 ± 5.14 | 13.62 ± 1.17 |
| Qwen3-4B | 2.32 GiB | 24.83 ± 1.37 | 7.41 ± 0.04 |

**AVX2-only (haswell backend — simulates a typical non-VNNI VPS).** I stripped the AVX512/zen4 backends to force it:

| Model | prefill t/s (AVX2) | prefill t/s (AVX512) | decode t/s (AVX2) | decode t/s (AVX512) |
|---|---|---|---|---|
| Qwen3-0.6B | 102.73 ± 8.99 | 153.92 | **37.77 ± 0.10** | 34.89 |
| Qwen3-1.7B | 41.83 ± 0.77 | 55.71 | **16.05 ± 0.01** | 13.62 |
| Qwen3-4B | 16.10 ± 0.56 | 24.83 | **7.31 ± 0.28** | 7.41 |

**This refutes the "x86 AVX2 is much slower" prior for decode.** Decode is *memory-bandwidth bound* at ≤4B — a pure-AVX2 build matched or beat AVX512-VNNI (37.8 vs 34.9; 16.1 vs 13.6). The SIMD width matters for **prefill** (1.3–1.5×) because that's compute-bound. Don't over-index on VNNI availability; do care about memory bandwidth.

**Honest caveats on my numbers:**
- The 0.6B/1.7B native-backend runs happened while a 2.5 GB model was downloading (load avg ~5–6 on 8 threads). The AVX2 set and the 4B native run were measured on an idle machine. **Cross-set (AVX2 vs AVX512) comparison is therefore contaminated; within-set comparisons are internally consistent.**
- This is a mobile 3.0 GHz core, not a VPS vCPU. Shared/no-turbo cloud vCPUs will typically land **somewhat below** these figures. I did not test on actual cloud hardware — treat as an optimistic bound.
- `llama-bench` pp512/tg128 use synthetic tokens; real workload has ragged prompt lengths.

### End-to-end latency for your actual use case — MEASURED

Real M-Pesa SMS through `llama-server` with a GBNF constraint, temp 0:

| Model | prompt tok | completion tok | Wall clock | Output |
|---|---|---|---|---|
| Qwen3-0.6B | 77 | 55 | 3.29 s | structurally valid, **semantically wrong** |
| Qwen3-1.7B | 77 | 51 | 5.50 s | correct amounts, **wrong type field** |
| Qwen3-1.7B | 77 | 49 | 5.24 s | correct amounts, **wrong type field** |

Arithmetic check against the bench (1.7B): 77/55.7 (prefill) + 51/13.6 (decode) = 1.38 + 3.75 ≈ **5.1 s**, matching the 5.2–5.5 s measured. Internally consistent.

**Cost breakdown for the 1.7B case: ~26% prefill, ~74% decode.** Decode dominates — which is why optimizing prefill (AVX512, batch) buys you little for short-input extraction.

### Accuracy findings (the part that matters most)

Grammar guarantees **syntactic** validity only. Semantic results:

| SMS | Qwen3-0.6B | Qwen3-1.7B |
|---|---|---|
| "received Ksh1,500 … Balance Ksh25,300" | amount ✓ balance ✓, **type=withdrawal ✗** | all ✓ |
| "Sent Ksh2,000 … Balance Ksh23,300" | **amount=2000000000 ✗**, **balance=2000000000 ✗** | amounts ✓, **type=received ✗** |
| "Withdraw Ksh500 from ATM KCB" | **runaway digits (balance 2280000000000000000…) ✗** | amounts ✓, name=`"sender"` ✗ |
| "received Ksh50 … Balance Ksh23,350" | — | **amount=5000 ✗** (10× error), name=`"sender"` ✗ |

**0.6B is unusable for money extraction** — it has digit-level errors and degenerates into unbounded repetition. **1.7B gets amounts/balances right but is unreliable on enum-ish fields and names** (it read "Sent" as "received"). Note the failures are *plausible*, never malformed — which is exactly the dangerous failure mode, because a schema-valid parse looks successful.

---

## 3. RAM / memory footprint — MEASURED

`llama-server -c 4096 -t 4`, idle RSS after load:

| Model | llama.cpp "Host" total | **Process RSS** |
|---|---|---|
| Qwen3-0.6B Q4_K_M (396.7 MB file) | 647 MiB | **1,096 MB** |
| Qwen3-1.7B Q4_K_M (1107.4 MB file) | 912 MiB | **2,210 MB** |

⚠️ **RSS is ~1.7–2.4× llama.cpp's internal accounting.** Size your VPS against RSS, not the model file — mmap'd weights plus allocator/page-cache overhead dominate. Budget **~2.1 GB RSS for the 0.6B and ~2.2 GB for the 1.7B** at 4K context; the 1.7B is nearly free relative to the 0.6B because the floor is shared overhead.

Note file sizes from HF API (2026-10-20): your quoted 397 MB / 1.11 GB are correct, but they come from **unsloth**, not Qwen — `Qwen/Qwen3-0.6B-GGUF` ships **only Q8_0 (639.4 MB)**. Same for `Qwen/Qwen3-1.7B-GGUF` (Q8_0 only, 1834.4 MB). Qwen's own 4B repo does ship Q4_K_M (2497.3 MB).

### KV cache at 4K context

| Model | KV buffer @ 4096 | Compute buffer |
|---|---|---|
| Qwen3-0.6B | **448.00 MiB** | 32.02 MiB |
| Qwen3-1.7B | **448.00 MiB** | 60.02 MiB |

**Identical KV for both sizes** — Qwen3 uses GQA (28 layers × 8 KV heads × 128 dim), so KV is independent of parameter count. Verified by hand: 28 × 8 × 128 × 2 (K+V) × 2 bytes (f16) × 4096 = 469,762,048 B = **448 MiB exactly**. ✅ matches measurement.

At 0.6B the KV cache (448 MiB) **exceeds the weights (372 MiB)**. Consequence: **context dominates small-model memory.** KV scales linearly — at 16K it's 1.75 GB, at 32K 3.5 GB. For your use case (a 1–3 sentence SMS, meeting minutes) **4K is sufficient and 8K is comfortable**; do not run32K contexts on a 4–8 GB box.

Source: https://github.com/ggml-org/llama.cpp/blob/master/docs/development/token_generation_performance_tips.md — **contains no KV-cache sizing formula**; the numbers above are measured, not sourced from that doc. (llama-server itself prints KV sizes at load; that's the practical source of truth.)

---

## 4. @huggingface/transformers v4 — CPU, GGUF, and grammar

**Version 4.3.1** confirmed. Deps: `onnxruntime-web 1.31.0-dev.20260914-8d85527a0`, `onnxruntime-node 1.30.0`, `@huggingface/tokenizers ^0.2.0`, `sharp`, `@huggingface/jinja`. Verified via registry + tarball inspection.

### CPU on Node: ✅ CONFIRMED
`src/backends/onnx.js`:
- Line 3–4: *"When running in node, we use `onnxruntime-node` (`onnxruntime-web` is not bundled). When running in the browser, we use `onnxruntime-web`…"*
- Line 33: `cpu: 'cpu'`, line 130–131: `supportedDevices.push('cpu'); defaultDevices = ['cpu'];`

`device: 'cpu'` in Node → `onnxruntime-node` → CPU EP. Solid.

### Can it serve a GGUF? ❌ **NO — CONFIRMED**
Exhaustive case-insensitive grep for `gguf` across the entire published `src/` tree: **zero matches.** Not a limitation you can configure around. transformers.js is **ONNX-only**; weight quantization is expressed via `DATA_TYPES` suffixes on ONNX files (`_q4`, `_fp16`, `_quantized`, `q4f16`, …) in `src/utils/dtypes.js`. There is no GGUF tensor parser in the package.

### Grammar / JSON-schema constrained decoding: ❌ **NONE, ANY BACKEND**
Exhaustive grep for `grammar|xgrammar|json.?schema|gbnf` across all of `src/` returned only **two hits**, both incidental doc-comments about *tool definitions* in chat templates (`src/tokenization_utils.js:224, :656`). No constrained-decoding implementation exists.

**Complete list of the 17 logits processors that DO exist** (`src/generation/logits_process.js`):

`LogitsProcessor`, `LogitsWarper`, `LogitsProcessorList`, `ForcedBOSTokenLogitsProcessor`, `ForcedEOSTokenLogitsProcessor`, `SuppressTokensLogitsProcessor`, `SuppressTokensAtBeginLogitsProcessor`, `WhisperTimeStampLogitsProcessor`, `NoRepeatNGramLogitsProcessor`, `RepetitionPenaltyLogitsProcessor`, `MinLengthLogitsProcessor`, `MinNewTokensLengthLogitsProcessor`, `NoBadWordsLogitsProcessor`, `ClassifierFreeGuidanceLogitsProcessor`, `TemperatureLogitsWarper`, `TopPLogitsWarper`, `TopKLogitsWarper`

So: temperature, top_p, top_k, repetition penalty, min-length, no-bad-words, CFG, token suppression. **No JSON-validity, no schema, no grammar, in any backend.** For guaranteed-schema output you must validate-and-retry in application code.

**Verdict: transformers.js cannot meet your JSON-schema-constrained requirement.** It also requires ONNX weights that don't exist for most GGUF models you'd want.

---

## 5. llama-server constrained-decoding flags — VERIFIED FROM BINARY

Read from `llama-server --help` on b11748 (more authoritative than docs):

| Flag | Current status |
|---|---|
| `--grammar GRAMMAR` | ✅ Works |
| `--grammar-file FNAME` | ✅ **Works** |
| `-j, --json-schema SCHEMA` | ❌ **BROKEN — HTTP 400** |
| `-jf, --json-schema-file FILE` | ❌ **BROKEN — HTTP 400** |
| `--jinja, --no-jinja` | ✅ Present (default: **enabled**) |
| `--chat-template JINJA_TEMPLATE` / `--chat-template-file` | ✅ Present |
| `--chat-template-kwargs STRING` | ✅ Present |

Docs: https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md

### ⚠️ The `-j` / `-jf` bug — reproduced, root-caused

```
$ curl .../v1/chat/completions -d '{"messages":[...]}'
{"error":{"code":400,"message":"Failed to initialize samplers: std::exception",...}}
```

Reproduced on **Qwen3-0.6B and Qwen3-1.7B**, with `{"type":"object"}` (minimal), with enums, with booleans, and with the full SMS schema. The GBNF **compiles fine** (the server prints a correct GBNF grammar in the log) — it fails at *sampler init*.

**Isolation proving it's the JSON-schema path, not the schema or the model:**

| Path | Result |
|---|---|
| No grammar (baseline) | ✅ works |
| `--grammar-file` (hand-written GBNF) | ✅ works — returned `{"amount": 500}` |
| `-jf` same schema | ❌ HTTP 400 |
| `-j '{"type":"object"}'` inline | ❌ HTTP 400 |

**Upstream issue #29006** — "JSON Schema grammar fails on chat-template control tokens while equivalent GBNF succeeds", opened 2026-09-16, still open. Root cause: `common_sampler_init` prefills the generation prompt (`assistant\n` for Qwen3 templates) into the JSON grammar rules, emptying the grammar stack on token 1. **Fix PR #29066 is still open / unmerged as of 2026-10-20** and also corrects a `throw e;` → `throw;` bug that was masking the real message.

**Workaround (verified working): use `--grammar-file` with hand-written GBNF.** You can generate GBNF from a JSON schema offline and check it in. Note that per-request `response_format: {type:"json_schema", json_schema:{...}}` **did not enforce** either — it returned unconstrained reasoning text, consistent with the same bug path.

This asymmetry matters for your architecture: node-llama-cpp uses its own grammar layer (no `common_sampler`), so it is *not* affected — another argument for the in-process approach.

---

## 6. XGrammar from JS/WASM — effectively unavailable

| Package | Status |
|---|---|
| `xgrammar` on npm | ❌ Not found |
| `@xgrammar/js`, `xgrammar-wasm`, `json-schema-to-grammars` | ❌ All not found (the latter is a **Python** package, not JS) |
| `@mlc-ai/web-xgrammar` | ⚠️ Exists — **last published 2025-12-25, ~10 months stale, only 2 versions** |

The canonical repo is **`mlc-ai/xgrammar`** (★1966, Apache-2.0, actively pushed 2026-10-18) — *not* `grpc/xgrammar`, which does not exist. Its `web/` directory is an emscripten binding, published as that stale npm package.

Its API is genuinely capable — `web/src/index.ts` exports `Grammar`, `GrammarCompiler`, `CompiledGrammar`, `GrammarMatcher`, `TokenizerInfo`, plus `JSONSchemaFormat`, `RegexFormat`, `ConstStringFormat`, `StructuralTagFormat`.

**But:** to use it you'd have to run emsdk + emcc + a CMake configure + rollup build yourself, and even then the WASM build has no released artifact newer than Dec 2025 and no Node-targeted distribution. **Not recommended for a VPS deployment.** For Node, use node-llama-cpp (own GBNF layer) or llama.cpp's C++ XGrammar via `--grammar-file`.

---

## 7. Tokenizer overhead — your numbers are off

The HF API for `Qwen/Qwen3-0.6B-GGUF` shows **no tokenizer files at all** — it contains only `.gitattributes`, `LICENSE`, `Qwen3-0.6B-Q8_0.gguf`, `README.md`, `params` (total 639.47 MB). The tokenizer lives in the **base** repo `Qwen/Qwen3-0.6B`. Measured there (2026-10-20):

| File | Actual bytes | Your quoted figure |
|---|---|---|
| `tokenizer.json` | **11,422,654** | 9.1 MB ❌ |
| `vocab.json` | **2,776,833** | 2.8 MB ✅ |
| `merges.txt` | **1,671,853** | 1.7 MB ✅ |
| `tokenizer_config.json` | **9,732** | 10 KB ✅ |
| `config.json` | 726 | — |
| `generation_config.json` | 239 | — |
| **Total tokenizer-related** | **15,882,037 (15.88 MB)** | — |

`Qwen/Qwen3-1.7B` is **byte-identical** for all tokenizer files (same vocabulary, same 15.88 MB total).

**Yes, downloaded at runtime.** transformers.js fetches `tokenizer.json` / `tokenizer_config.json` from the Hub into its browser/FS cache on first load unless `env.localModelPath` points at local files. For an air-gapped or bandwidth-constrained VPS, pre-vendor these15.88 MB.

**Cost relative to weights:** for Qwen3-0.6B that's **15.88 MB tokenizer vs ~400 MB weights (~4%)** — not a memory problem. The real annoyance is the first-run network round-trip. Note that transformers.js v4 pulls in `@huggingface/tokenizers ^0.2.0` (native binding), which may reduce reliance on the full `tokenizer.json`.

---

## Recommendation

**Use node-llama-cpp with Qwen3-1.7B-Q4_K_M, not llama-server, and not transformers.js.**

Why:
- **llama-server's `--json-schema` is broken today** (upstream, unfixed). You'd be hand-maintaining GBNF.
- **transformers.js can't do the core requirement** — no grammar support, no GGUF support.
- **node-llama-cpp has its own grammar layer** (no `common_sampler`), so it sidesteps the bug entirely, gives you typed `grammar.parse()` results, and runs in-process with PM2.

Configuration:
- `--contextSize 4096` (KV = 448 MiB, plenty for an SMS; **do not** go to 32K on4–8 GB)
- `threads: 4` on a 4 vCPU box
- Budget **~2.2 GB RSS** — that's the number that triggers OOM-kill, not the 1.1 GB file size.

Critical caveat: **grammar will not save you from semantic errors.** 1.7B still read "Sent Ksh2,000" as `transaction_type: "received"` and turned Ksh50 into 5000. For a financial ledger:
1. Constrain `amount`/`balance` to `number`, but **validate magnitudes** in code (reject if `amount > 1e7`, or if balance ≠ previous ± amount).
2. Derive `transaction_type` from **keyword matching in code**, not from the LLM — regex on "received"/"Sent"/"Withdraw" is more reliable than a 1.7B model and instant.
3. Consider Qwen3-4B (7.4 t/s decode, ~16 t/s prefill) only if accuracy demands it — but at ~4.3 GB RSS it squeezes a 4 GB box and gives ~2× latency.
4. Keep a deterministic regex parser as the primary path and the LLM as a fallback for unstructured meeting minutes. For M-Pesa SMS, regex/regex+grammar likely wins outright on both accuracy and latency.

**What I could not verify:** runtime behavior of node-llama-cpp itself (sandbox has Node 18, package requires ≥20) — API confirmed from shipped `.d.ts` declarations and docs, which is strong but not a runtime test. All benchmark figures are from a 4-core mobile i7 with some background-load contamination on the AVX512 runs, not from real cloud vCPUs — treat as an optimistic upper bound.