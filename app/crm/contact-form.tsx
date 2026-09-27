import { CONTACT_STATUSES, type Contact } from "@/lib/crm";

const field = "rounded-md border border-foreground/20 bg-transparent px-3 py-2";

export function ContactForm({
  action,
  contact,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  contact?: Contact;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input name="name" required maxLength={200} placeholder="Name" defaultValue={contact?.name} className={field} />
      <input name="company" maxLength={200} placeholder="Company" defaultValue={contact?.company ?? ""} className={field} />
      <input name="email" type="email" maxLength={320} placeholder="Email" defaultValue={contact?.email ?? ""} className={field} />
      <input name="phone" maxLength={50} placeholder="Phone" defaultValue={contact?.phone ?? ""} className={field} />
      <select name="status" defaultValue={contact?.status ?? "lead"} className={field}>
        {CONTACT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <textarea
        name="notes"
        rows={3}
        maxLength={5000}
        placeholder="Notes"
        defaultValue={contact?.notes ?? ""}
        className={`${field} sm:col-span-2`}
      />
      <button className="self-start rounded-md bg-foreground px-4 py-2 font-medium text-background">
        {submitLabel}
      </button>
    </form>
  );
}
