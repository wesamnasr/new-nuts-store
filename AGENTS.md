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
     - **Accountant (`accountant`):** `/accountant`
     - **Cashier (`cashier`):** `/pos`
     - **Supplier (`supplier`):** `/supplier`
   - If an already-authenticated non-admin user navigates to a route outside their specialization (e.g., `/admin`), automatically redirect them to their permitted portal.
