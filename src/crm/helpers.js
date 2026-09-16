export function eligibleOwners(env) {
  if (env.user.role === "sales_user")
    return env.members.filter((m) => m.id === env.user.id);
  if (env.user.role === "sales_manager") {
    const team = env.members.find((m) => m.id === env.user.id)?.team_id;
    return env.members.filter(
      (m) => m.id === env.user.id || (team && m.team_id === team),
    );
  }
  return env.members;
}
export function safeDocumentUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
export function customerValues(account, contact) {
  return {
    "Company name": account.name || "",
    "Contact name": [contact?.first_name, contact?.last_name]
      .filter(Boolean)
      .join(" "),
    Email: contact?.email || account.email || "",
    Phone: contact?.phone || account.phone || "",
    "Billing address": account.billing_address || "",
    "Shipping address": account.shipping_address || "",
    City: account.city || "",
    State: account.state || "",
    Country: account.country || "",
    Pincode: account.pincode || "",
    GSTIN: account.gstin || "",
    PAN: account.pan || "",
  };
}
export function periodBounds(period, from, to, now = new Date()) {
  const year = now.getUTCFullYear(),
    month = now.getUTCMonth();
  let start, end;
  if (period === "This month") {
    start = new Date(Date.UTC(year, month, 1));
    end = new Date(Date.UTC(year, month + 1, 1));
  }
  if (period === "Last month") {
    start = new Date(Date.UTC(year, month - 1, 1));
    end = new Date(Date.UTC(year, month, 1));
  }
  if (period === "This quarter") {
    const quarter = Math.floor(month / 3) * 3;
    start = new Date(Date.UTC(year, quarter, 1));
    end = new Date(Date.UTC(year, quarter + 3, 1));
  }
  if (period === "This year") {
    start = new Date(Date.UTC(year, 0, 1));
    end = new Date(Date.UTC(year + 1, 0, 1));
  }
  if (period === "Custom range") {
    start = from ? new Date(from + "T00:00:00Z") : null;
    end = to
      ? new Date(new Date(to + "T00:00:00Z").getTime() + 86400000)
      : null;
  }
  return {
    p_from: start?.toISOString() || null,
    p_to: end?.toISOString() || null,
  };
}
