# Test Infrastructure & Verification Specification

**Project**: Arabic RTL Nuts E-Commerce Store ("محمصة الواحة الذهبية")  
**Target File**: `scripts/verify.mjs`  
**Execution Command**: `npm test` (`node scripts/verify.mjs`)  
**Runtime**: Node.js v24+ (Native ESM, zero external test dependencies)  
**Document Version**: 1.0.0  

---

## 1. Test Philosophy

The testing framework follows an **opaque-box requirement-driven verification** philosophy. All expected outputs and invariant assertions are derived strictly from `ORIGINAL_REQUEST.md` and the interface contracts in `PROJECT.md`, independent of internal implementation nuances.

### Core Principles
1. **Zero Facade Testing**: No mock facades or vacuous assertions. Every test asserts genuine mathematical, cryptographic, or operational outcomes.
2. **Deterministic State Isolation**: The test runner snapshots `data/store-db.json` before test execution and restores the original state in a `finally` block, guaranteeing idempotent, zero-side-effect test runs.
3. **4-Tier Verification Hierarchy**:
   - **Tier 1 (Feature Coverage)**: Validates primary happy paths and specification behaviors (>=5 test cases per requirement).
   - **Tier 2 (Boundary & Corner Cases)**: Validates extreme thresholds, malformed inputs, unauthorized access, and error states (>=5 test cases per requirement).
   - **Tier 3 (Cross-Feature Combinations)**: Validates pairwise subsystem interactions (Custom Box + Coupon, Custom Box + Invoice, Custom Box + CSV Export, Order Status Updates).
   - **Tier 4 (Real-World Customer & Admin Journeys)**: Validates full end-to-end multi-step flows mirroring real production usage.
4. **Encoding & Regional Rigor**: Explicit verification of Arabic text fidelity, Eastern/Western Arabic numerals normalization, and UTF-8 Byte Order Mark (`\uFEFF`) for Excel compatibility.

---

## 2. Feature Inventory & Requirements Traceability

| Requirement | Feature Description | Tier 1 Tests | Tier 2 Tests | Tier 3 & 4 Tests | Total Tests |
|-------------|---------------------|:------------:|:------------:|:----------------:|:-----------:|
| **R1** | Custom Mix Box Builder ("كوّن علبتك بنفسك") | 6 | 6 | 4 | **16** |
| **R2** | Admin Auth, API Guardrails, Invoicing & CSV | 6 | 5 | 3 | **14** |
| **R3** | Standalone Product Pages & Customer Reviews | 5 | 5 | 2 | **12** |
| **R4** | Codebase Hardening, Egyptian Phone & Pricing | 6 | 6 | 3 | **15** |
| **Acceptance**| Build Verification & Type Safety | 1 | 0 | 0 | **1** |
| **TOTAL** | **Full E2E Verification Suite** | **24** | **22** | **12** | **58** |

---

## 3. Test Architecture & Directory Structure

```
e:\all projects\newNuts/
├── TEST_INFRA.md            # This specification document
├── TEST_READY.md            # Test readiness report & verification matrix
├── package.json             # Configured with "test": "node scripts/verify.mjs"
├── scripts/
│   └── verify.mjs           # Native ESM programmatic test runner (Node v24 compatible)
├── data/
│   └── store-db.json        # Flat JSON database (isolated with backup/restore)
└── src/
    ├── app/                 # Next.js App Router endpoints & UI pages
    ├── lib/                 # Core domain logic (pricing, validation, auth, db)
    └── types/               # TypeScript interfaces & contracts
```

### Execution Flow & Harness Pipeline
```
[Start npm test]
       │
       ▼
[1. Pre-flight & DB Snapshot] ─── Saves temporary backup of data/store-db.json
       │
       ▼
[2. Build Verification] ───────── Verifies Next.js and TypeScript compilation
       │
       ▼
[3. Tier 1: Feature Coverage] ─── R1 Mix Box, R2 Auth & CSV, R3 SEO & Reviews, R4 Phone & Coupon
       │
       ▼
[4. Tier 2: Boundary Tests] ──── Capacity overflows, invalid phone formats, unauthorized mutations
       │
       ▼
[5. Tier 3: Combinations] ────── Pairwise cross-feature interactions (Mix Box + Coupons + Invoices)
       │
       ▼
[6. Tier 4: Real-World E2E] ──── Realistic customer order & admin fulfillment lifecycle
       │
       ▼
[7. DB State Restoration] ────── Restores original data/store-db.json
       │
       ▼
[8. Console Summary & Exit] ──── Displays structured results table with zero or non-zero exit code
```

---

## 4. Test Oracle & Mathematical Invariants

### 4.1 Custom Mix Box Pricing Invariant (R1)
For total box weight $W_{\text{box}} \in \{500, 1000, 2000\}$ grams and portions $i \in \{1 \dots n\}$ where $\sum p_i = 100\%$:
$$\text{BoxPrice} = \text{round}\left( \sum_{i=1}^n \left( \text{BasePrice}(P_i, W_{\text{box}}) \times \frac{p_i}{100} \right) \right)$$
- For $W_{\text{box}} = 500$: BasePrice is product's 500g variant price.
- For $W_{\text{box}} = 1000$: BasePrice is product's 1000g variant price.
- For $W_{\text{box}} = 2000$: BasePrice is product's 2000g variant price if defined, or $2 \times \text{Price}_{1000\text{g}}$.

### 4.2 Review Rating Recalculation Invariant (R3)
When an incoming rating $R_{\text{new}} \in [1, 5]$ is submitted for a product with existing average rating $R_0$ and review count $N_0$:
$$N_1 = N_0 + 1$$
$$R_1 = \text{round}\left( \frac{R_0 \times N_0 + R_{\text{new}}}{N_1}, 1 \right)$$

### 4.3 Egyptian Phone Validation Invariant (R4)
Valid formats must match:
```regex
^(?:\+?20|0020)?(01[0125]\d{8})$
```
- Exactly 11 digits when normalized.
- Prefixes restricted to: `010`, `011`, `012`, `015`.
- Eastern Arabic numerals (٠-٩) mapped to ASCII standard digits (0-9).

### 4.4 Admin API Protection Invariant (R2)
- Requests to `PUT /api/store` and `PATCH /api/orders` without valid admin authentication MUST receive HTTP status `401 Unauthorized`.
- Unauthenticated `GET /api/store` MUST NEVER leak `adminPassword` or customer orders.
- CSV export MUST prepend UTF-8 Byte Order Mark: `\uFEFF` (`0xEF, 0xBB, 0xBF`).

---

## 5. Real-World Application Scenarios (Tier 4)

### Scenario A: Customer Custom Box Order Lifecycle
1. Customer configures 1kg box with 50% Pistachio, 30% Cashew, and 20% Hazelnut.
2. System computes 772 EGP box price, verifies 100% capacity, and adds to cart.
3. Customer navigates to checkout, inputs valid Egyptian phone `01012345678`, selects Cairo delivery (50 EGP), and applies coupon `NUTS10` (10% discount).
4. Order submission verifies server-side subtotal 772 EGP, discount 77.2 EGP, shipping 50 EGP, and total 744.8 EGP.
5. Order tracking confirms receipt of custom breakdown (`customBreakdown` items with grams and roasts).

### Scenario B: Merchant Admin Fulfillment & Accounting
1. Admin logs into dashboard with password `admin`.
2. Admin reviews pending order with custom box breakdown.
3. Admin updates order status to `shipped` via authenticated `PATCH /api/orders`.
4. Admin renders Arabic printable invoice confirming complete customer, items, and tax breakdown.
5. Admin triggers CSV order export and verifies UTF-8 BOM encoding.

### Scenario C: Customer Discovery & Live Rating Feedback Loop
1. Customer views product page for `/products/jumbo-pistachio-usa`.
2. Inspects nutritional values (562 kcal, 20g protein per 100g).
3. Submits 5-star customer review.
4. Database persists review and updates product's average rating and reviewsCount immediately.

---

## 6. Coverage Thresholds & Exit Conditions

| Metric | Target Requirement | Status |
|---|---|---|
| **Build Status** | Zero errors, exit code 0 | Mandatory |
| **Tier 1 Coverage** | $\ge 5$ tests per feature (R1, R2, R3, R4) | 24 tests total |
| **Tier 2 Boundary** | $\ge 5$ tests per feature (R1, R2, R3, R4) | 22 tests total |
| **Tier 3 Combinations** | Cross-feature pairwise interactions | 7 tests total |
| **Tier 4 Scenarios** | Multi-step end-to-end customer/admin journeys | 5 tests total |
| **Overall Pass Rate** | 100% on fully implemented codebase | Mandatory for M5 |
