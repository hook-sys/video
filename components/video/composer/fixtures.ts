import type { Brand, Word } from "./types";

// Three narrations the checks and the parity test compose videos from: a
// clinic's booking app and a shop's order app (even timings, no recording)
// and a dashboard (a real recorded voice's word times).
export type Fixture = { brand: Brand; words: Word[] };
const decode = (s: string): Word[] => s.split(" ").map((x) => {
  const [text, start, end] = x.split("@");
  return { text, start: Number(start), end: Number(end) };
});

export const BOOKWELL: Fixture = {
  brand: { name: "Bookwell", color: "#2f6fed", tagline: "Your whole clinic in one simple app", cta: "Book a free demo", url: "bookwell.app", icon: null },
  words: decode("Most@0.2@0.48 clinics@0.52@0.8 still@0.84@1.12 run@1.16@1.44 their@1.48@1.76 day@1.8@2.08 on@2.12@2.4 phone@2.44@2.72 calls@2.76@3.04 and@3.08@3.36 paper@3.4@3.68 notes.@3.72@4 Bookings@4.49@4.77 in@4.81@5.09 one@5.13@5.41 diary.@5.45@5.73 Patient@6.22@6.5 files@6.54@6.82 in@6.86@7.14 a@7.18@7.46 cabinet.@7.5@7.78 Reminders@8.27@8.55 on@8.59@8.87 sticky@8.91@9.19 notes.@9.23@9.51 Bookwell@10@10.28 puts@10.32@10.6 your@10.64@10.92 whole@10.96@11.24 clinic@11.28@11.56 in@11.6@11.88 one@11.92@12.2 simple@12.24@12.52 app.@12.56@12.84 When@13.33@13.61 a@13.65@13.93 patient@13.97@14.25 books@14.29@14.57 online,@14.61@14.89 the@15.08@15.36 slot@15.4@15.68 fills@15.72@16 itself.@16.04@16.32 When@16.81@17.09 the@17.13@17.41 day@17.45@17.73 gets@17.77@18.05 busy,@18.09@18.37 your@18.56@18.84 whole@18.88@19.16 team@19.2@19.48 sees@19.52@19.8 who@19.84@20.12 is@20.16@20.44 next.@20.48@20.76 No@21.25@21.53 more@21.57@21.85 double@21.89@22.17 bookings.@22.21@22.49 No@22.98@23.26 more@23.3@23.58 missed@23.62@23.9 appointments.@23.94@24.22 Just@24.71@24.99 one@25.03@25.31 calm@25.35@25.63 screen@25.67@25.95 for@25.99@26.27 your@26.31@26.59 entire@26.63@26.91 clinic.@26.95@27.23"),
};

export const SHOPNEST: Fixture = {
  brand: { name: "Shopnest", color: "#e8590c", tagline: "Your whole store, one screen", cta: "Start free", url: "shopnest.io", icon: null },
  words: decode("Most@0.2@0.48 shops@0.52@0.8 still@0.84@1.12 track@1.16@1.44 orders@1.48@1.76 in@1.8@2.08 messy@2.12@2.4 spreadsheets.@2.44@2.72 Orders@3.21@3.49 in@3.53@3.81 one@3.85@4.13 sheet.@4.17@4.45 Stock@4.94@5.22 in@5.26@5.54 another.@5.58@5.86 Invoices@6.35@6.63 on@6.67@6.95 paper.@6.99@7.27 Shopnest@7.76@8.04 puts@8.08@8.36 your@8.4@8.68 whole@8.72@9 store@9.04@9.32 on@9.36@9.64 one@9.68@9.96 screen.@10@10.28 When@10.77@11.05 an@11.09@11.37 order@11.41@11.69 comes@11.73@12.01 in,@12.05@12.33 stock@12.52@12.8 updates@12.84@13.12 on@13.16@13.44 its@13.48@13.76 own.@13.8@14.08 When@14.57@14.85 sales@14.89@15.17 pick@15.21@15.49 up,@15.53@15.81 your@16@16.28 whole@16.32@16.6 team@16.64@16.92 sees@16.96@17.24 it@17.28@17.56 at@17.6@17.88 a@17.92@18.2 glance.@18.24@18.52 No@19.01@19.29 more@19.33@19.61 copying@19.65@19.93 numbers@19.97@20.25 by@20.29@20.57 hand.@20.61@20.89 No@21.38@21.66 more@21.7@21.98 lost@22.02@22.3 invoices.@22.34@22.62 Just@23.11@23.39 one@23.43@23.71 simple@23.75@24.03 screen@24.07@24.35 for@24.39@24.67 your@24.71@24.99 entire@25.03@25.31 store.@25.35@25.63"),
};

export const FLOWLY: Fixture = {
  brand: { name: "Flowly", color: "#6a5bff", tagline: "Every answer you need", cta: "Try Flowly free", url: "flowly.app", icon: null },
  words: decode("Every@0@0.24 team@0.304@0.56 starts@0.606@0.88 with@0.928@1.12 data@1.168@1.36 scattered@1.416@1.92 across@1.977@2.32 different@2.36@2.72 tools@2.8@3.2 .@3.2@3.36 Sales@3.467@4 in@4.027@4.08 one@4.14@4.32 place@4.4@4.8 .@4.8@5.24 Payments@5.289@5.68 in@5.707@5.76 another.@5.81@6.32 Reports@6.43@7.2 somewhere@7.248@7.68 else.@7.76@8.32 Flowly@8.464@9.12 brings@9.166@9.44 everything@9.484@9.92 into@9.984@10.24 one@10.32@10.56 live@10.656@11.04 dashboard.@11.096@11.84 When@12.204@12.495 a@12.567@12.64 payment@12.68@12.96 arrives,@13.02@13.6 revenue@13.65@14 updates@14.06@14.48 instantly.@14.536@15.28 When@15.36@15.68 sales@15.747@16.08 grow,@16.128@16.56 the@16.58@16.64 entire@16.709@17.12 team@17.184@17.44 sees@17.488@17.68 the@17.72@17.84 change@17.886@18.16 in@18.187@18.24 one@18.28@18.4 view.@18.48@19.04 No@19.44@19.547 more@19.6@19.84 switching@19.888@20.32 between@20.37@20.72 tools.@20.813@21.36 No@21.547@21.92 more@21.968@22.16 waiting@22.2@22.48 for@22.52@22.64 reports.@22.72@23.6 Just@23.68@24 one@24.1@24.4 live@24.464@24.72 dashboard@24.784@25.36 with@25.392@25.52 every@25.6@26 answer@26.057@26.4 you@26.44@26.56 need.@26.64@27.04"),
};

// The video's length for a fixture (its last word and a breath after it).
export const durationOf = (fx: Fixture) => Math.round((fx.words[fx.words.length - 1].end + 1.2) * 30);
