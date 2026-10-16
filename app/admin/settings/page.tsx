import { requireAdmin } from "@/lib/admin";
import { SETTINGS, getSettings } from "@/lib/app-settings";
import { saveSettings } from "../actions";
import { Card, Notice, PageHeader, btnPrimary, input } from "../_components/ui";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  const { saved } = await searchParams;
  const { role } = await requireAdmin("settings");
  const values = await getSettings();
  // "New version" on: the old version's settings are hidden; their stored
  // values are sent back unchanged (below), so saving never turns them off
  const nv = values.feature_new_version === true;
  const kept = SETTINGS.filter((s) => (nv ? s.oldOnly : s.newOnly));
  // (general settings first, then each group under its heading, in order)
  const groups: [string, typeof SETTINGS][] = [];
  for (const s of SETTINGS) {
    if (nv ? s.oldOnly : s.newOnly) continue;
    const g = s.group ?? "";
    const at = groups.find(([k]) => k === g);
    if (at) at[1].push(s);
    else groups.push([g, [s]]);
  }

  return (
    <>
      <PageHeader title="Settings" sub="Controls for the whole app. Changes apply immediately and are written to the audit log." />
      {typeof saved === "string" && <Notice>{saved === "0" ? "Nothing changed." : `Saved ${saved} setting${saved === "1" ? "" : "s"}.`}</Notice>}
      {nv && <Notice>New version is on: {kept.length} settings of the old version are hidden and have no effect on new videos. They come back, as they were, when New version is turned off.</Notice>}
      <form action={saveSettings} className="flex flex-col gap-4">
        {kept.map((s) => (s.type === "bool" ? values[s.key] === true && <input key={s.key} type="hidden" name={s.key} value="on" /> : <input key={s.key} type="hidden" name={s.key} value={String(values[s.key])} />))}
        {groups.map(([group, list]) => (
          <Card key={group || "general"}>
            {group && <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">{group}</p>}
            <div className="divide-y divide-white/[0.05]">
              {list.map((s) => (
              <div key={s.key} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between">
                <div className="max-w-xl">
                  <p className="font-medium text-white">{s.label}{s.superAdmin && <span className="ml-2 text-xs font-normal text-zinc-500">super admin only</span>}</p>
                  <p className="mt-0.5 text-sm text-zinc-500">{s.help}</p>
                </div>
                <div className="md:w-80">
                  {s.type === "bool" ? (
                    <label className="flex cursor-pointer items-center gap-3 md:justify-end">
                      <input type="checkbox" name={s.key} defaultChecked={values[s.key] === true} disabled={s.superAdmin && role !== "super_admin"} className="peer sr-only" />
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
        ))}
        <div className="flex justify-end">
          <button className={btnPrimary}>Save settings</button>
        </div>
      </form>
    </>
  );
}
