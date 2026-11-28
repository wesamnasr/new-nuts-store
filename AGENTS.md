# Authentication & Role-Based Routing Rules

When building or modifying authentication, login forms, or role-based access control (RBAC) in this workspace (or similar multi-role systems):

1. **No Client-Side Role Selection on Login:**
   - NEVER include a role selector (buttons, tabs, or dropdowns) on any login screen. Users must not choose what role they want to log in as.
   - NEVER display or leak staff usernames (e.g., `admin_hafsa`, `supplier_arafat`, `cashier_pos`, `accountant_fin`), default passwords, or auto-fill credential buttons on the login UI.
   - Login forms must strictly contain only **Username** (`اسم المستخدم`) and **Password** (`كلمة المرور`) inputs.

2. **Credential-Driven Role Resolution & Automatic Routing:**
   - The backend authentication endpoint (`/api/admin/login`) must resolve the authenticated user's role strictly from their verified `(username, password)` pair.
   - Upon successful login (or session verification), automatically redirect the user to the portal permitted for their specialization across the 4 staff roles:
     - **Admin (`super_admin` / `admin`):** `/admin`
     - **Accountant (`accountant`):** `/admin` (unified Admin Dashboard showing the accountant's permitted tabs: `overview`, `accounting_portal`, `orders`, `supply_invoices`, `products`, `operations`, `coupons`)
     - **Cashier (`cashier`):** `/pos`
     - **Procurement & Inventory Officer (`supplier` internal role — NO external supplier login):** `/admin` (internal procurement & supply invoices workspace only; external supplier portal logins are disabled per security policy)
   - If an already-authenticated non-admin user navigates to a route outside their specialization (e.g., `/admin`), automatically redirect them to their permitted portal.

# UX Constitution & Engineering Design Standards

All UI, POS, Storefront, Accounting, and Procurement changes MUST strictly follow [`UX_CONSTITUTION.md`](./UX_CONSTITUTION.md), including:
- Royal Gold (`#D4AF37`) buttons MUST ALWAYS use Deep Espresso (`#231710`) text (NEVER `#FFFFFF`).
- POS cash credit-lock (block checkout when paid < total), 150 EGP VIP prompt, 2-step blind shift close with empty cups counter, out-of-stock muscle-memory preservation, and Manager PIN protection for returns/voids/partner withdrawals.
- 18% minimum profit-margin floor on promotions with automatic suggested safe price.
- External suppliers NEVER have login access; all supply invoices are recorded internally by the Procurement Officer with scale weight variance and >5% price-hike alerts.
