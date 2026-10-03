export const PRIMARY_NAV = [
  ["crm_dashboard", "Home"],
  ["customers", "Customers"],
  ["opportunities", "Deals"],
  ["tasks", "Tasks"],
  ["documents", "Documents"],
  ["reports", "Reports"],
];
export const primarySection = (active) =>
  ["leads", "accounts", "contacts", "inbox"].includes(active)
    ? "customers"
    : active === "activities"
      ? "tasks"
      : [
            "database",
            "docview",
            "email",
            "form",
            "preview",
            "quote_wizard",
          ].includes(active)
        ? "documents"
        : ["presets", "editor", "users", "permissions", "workflows"].includes(
              active,
            )
          ? "settings"
          : active;
