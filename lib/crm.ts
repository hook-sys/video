export const CONTACT_STATUSES = ["lead", "customer", "inactive"] as const;

export type Contact = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: (typeof CONTACT_STATUSES)[number];
};

// Returns validated contact fields, or an error message.
export function parseContact(formData: FormData) {
  const get = (key: string, max: number) =>
    String(formData.get(key) ?? "").trim().slice(0, max) || null;
  const name = get("name", 200);
  const email = get("email", 320);
  const status = CONTACT_STATUSES.find((s) => s === formData.get("status"));

  if (!name) return { error: "Name is required." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Email is not valid." };
  if (!status) return { error: "Choose a valid status." };

  return {
    data: {
      name,
      company: get("company", 200),
      email,
      phone: get("phone", 50),
      notes: get("notes", 5000),
      status,
    },
  };
}
