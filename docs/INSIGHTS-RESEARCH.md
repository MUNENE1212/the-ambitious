# Insight Engine — Research Findings

> **Provenance.** A research agent built llama.cpp from source, ran
> grammar-constrained decoding against a real M-Pesa SMS, and benchmarked three
> GGUF models for resident memory. **Its measurements are reproduced here rather
> than believed, because they overturn a design decision** — and the addendum in
> §4 came from the same agent's follow-up. The verbatim report is in
> `research/06-vps-inference.md`.
>
> **As-reported, second-hand, not independently verified by me** — I have not
> re-run the benchmarks. Recorded so the reasoning behind the architecture in
> `PLATFORM-PLAN.md` §4.12 can be re-checked.
>
> The **design change** the first finding forced has been applied to §4.12 — see
> "Extraction is not parsing" there. This document is the supporting evidence.

---

## 1. The finding that changed the design

**Grammar/schema-constrained output guarantees the format, not the truth.**
This was tested, not theorised: llama.cpp built from source, grammar-constrained
decoding, a real M-Pesa SMS as input.

```json
{
  "amount": 1500.00,                    // correct
  "transaction_code": "KSH1500",        // hallucinated
  "timestamp": "2023-07-12T00:00:00Z"   // fabricated
}
```

Structurally perfect. Right keys, right types. Two of three values invented.

On **Qwen3-0.6B** it was worse: `amount: 2000000000` from a KSh 2,000 SMS, and
unbounded digit repetition.

**Why this matters here specifically:** the ledger is append-only by design
(`PLATFORM-PLAN.md` §4.4). A wrong extraction therefore arrives well-formed,
correctly typed, indistinguishable from a real value — and can only be undone
with a reversing entry. The property that makes the books trustworthy is the
same one that makes an extraction mistake expensive and quiet.

**The lesson is architectural, not about model size.** A constrained decoder is
a format constraint at 0.6B, 1.7B and Haiku 5.5 alike. The asymmetry that matters
is **regex fails visibly on an unknown template; a model fails silently with a
confident wrong answer.**

Applied to §4.12:

- Money fields (amount, transaction code, timestamp) are **regex-only**, validated
  in code, and a code that does not match the expected format becomes `null`.
- Extraction schemas are designed so **`null` is a representable answer** — a
  field that cannot be null will be filled in to satisfy the shape.
- Natural-language queries get the same treatment: the model names fields, a
  deterministic builder validates types and ranges, and an unrecognisable
  request returns "I didn't understand that" rather than a confident wrong sum.

## 2. On-device and local models: not viable here

**Recommendation stands: use a hosted API.** Two reasons, both now better
evidenced than when it was first given.

**In the browser it is out.** WebGPU requires **Chrome 155+**. Against a
low-end-Android, no-GPU-assumption target (§4.12 sizing), that is not a
population to design for.

**On the VPS it costs RAM and buys a hallucination risk we do not currently
have.** Measured, in case that is revisited:

| Measurement | Value |
|---|---|
| RSS vs model file | **≈ 2.9×** — Qwen3-0.6B Q4_K_M is 378 MiB on disk, **1,087 MiB resident**. Size the box against RSS. |
| KV cache @ 4K context | **448 MiB** — and *identical* for 0.6B and 1.7B (GQA). **At 0.6B the KV cache exceeds the weights.** Linear: 16K → 1.75 GB, 32K → 3.5 GB. |
| Budget | ~2.2 GB RSS for a 1.7B at 4K context. Do not run large contexts on a 4–8 GB box. |
| Decode | ≈34.5 tok/s on 4 cores, reproduced independently. **Optimistic bound** — that was a mobile i7, not shared cloud vCPUs. |
| Usable floor | **1.7B, not 0.6B.** 0.6B has digit-level errors that make it unusable for money. |

## 3. Upstream bug (academic, given §2 — recorded for completeness)

- [llama.cpp issue #29006](https://github.com/ggml-org/llama.cpp/issues/29006) —
  *"JSON Schema grammar fails on chat-template control tokens while equivalent
  GBNF succeeds"* — **OPEN**, filed 2026-09-17.
- [PR #29066](https://github.com/ggml-org/llama.cpp/pull/29066) — the fix —
  **still OPEN**, `mergedAt: null`.

Reproduced: `--json-schema-file` and inline `-j` return HTTP 400 (*Failed to
initialize samplers*); hand-written `--grammar-file` works. Root cause is
sampler init prefilling the generation prompt into the grammar rules. Affects
**`llama-server` only** — `node-llama-cpp` has its own grammar layer with no
reference to `common_sampler`, though that is a code-inspection inference rather
than a runtime verification.

## 4. Implementation note — grammars ship with the binding, and still are not enough

Follow-up from the benchmarking work, and worth recording because it is the
kind of thing that costs an afternoon to rediscover.

**`json.gbnf` ships inside `node-llama-cpp` itself** (`package/llama/grammars/`),
and `LlamaGrammar.getFor(llama, "json")` is a first-class API. Supported types:
`"json" | "json_arr" | "english" | "list" | "c" | "arithmetic" | "japanese" |
"chess"`. **So if we ever take the GBNF-workaround route from §3, or want a
permissive fallback layer, we do not need to source grammars externally** — and
unlike `-j`, it works today via `--grammar-file`.

**But note precisely what it does not do**, because this is the whole argument
of §1 again:

> The generic `json` grammar guarantees **syntactically valid JSON**. It does
> **not** enforce your schema's field names, types, or enum values. For the
> M-Pesa case a **schema-specific GBNF is still required.**

And a schema-specific GBNF constrains *shape*, not *truth* — which is the
finding §1 was about. **A valid GBNF is a floor, not a defence.** It can stop a
malformed response; it cannot stop a hallucinated transaction code, which will
match the grammar perfectly. That is why §4.12's money fields are regex-only and
validated in code, and it is worth restating here so the grammar tooling is not
later mistaken for the validation layer.

## 5. Not received

The main report's remaining sections were not delivered. Missing from this
note: LLM API pricing tiers (§1 of the relay), the Kenyan T-bill machine-readable
source, M-Pesa SMS format catalogues and bank-statement export formats, Android
device ceilings, and the ODPC automated-decision-making position.

Those remain open in `RESEARCH-BRIEF.md` §5 (items 12–15). The architectural
conclusion in §4.12 does not depend on them — which is itself the useful result:
**the engine was designed so that none of these answers can change whether the
books are correct.**