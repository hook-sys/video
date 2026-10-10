import { requireAdmin } from "@/lib/admin";
import { SETTINGS, getSettings } from "@/lib/app-settings";
import { saveSettings } from "../actions";
import { Card, Notice, PageHeader, btnPrimary, input } from "../_components/ui";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  const { saved } = await searchParams;
  await requireAdmin("settings");
  const values = await getSettings();

  return (
    <>
      <PageHeader title="Settings" sub="Controls for the whole app. Changes apply immediately and are written to the audit log." />
      {typeof saved === "string" && <Notice>{saved === "0" ? "Nothing changed." : `Saved ${saved} setting${saved === "1" ? "" : "s"}.`}</Notice>}
      <form action={saveSettings} className="flex flex-col gap-4">
        <Card>
          <div className="divide-y divide-white/[0.05]">
            {SETTINGS.map((s) => (
              <div key={s.key} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between">
                <div className="max-w-xl">
                  <p className="font-medium text-white">{s.label}</p>
                  <p className="mt-0.5 text-sm text-zinc-500">{s.help}</p>
                </div>
                <div className="md:w-80">
                  {s.type === "bool" ? (
                    <label className="flex cursor-pointer items-center gap-3 md:justify-end">
                      <input type="checkbox" name={s.key} defaultChecked={values[s.key] === true} className="peer sr-only" />
                      <span className="relative h-6 w-11 rounded-full bg-zinc-700 transition after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:bg-[#0a66d6] peer-checked:after:translate-x-5" />
                    </label>
                  ) : (
                    <input name={s.key} type={s.type === "number" ? "number" : "text"} min={0} defaultValue={String(values[s.key])} className={input} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <div className="flex justify-end">
          <button className={btnPrimary}>Save settings</button>
        </div>
      </form>
    </>
  );
}
