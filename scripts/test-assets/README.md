# Test assets

Fictional SaaS brands used to test the video pipeline on Preview (form
uploads) and locally (renders, rulebook detectors). Not deployed.

| Brand | Industry | Files |
|---|---|---|
| nimbus | developer tool | logo + 5 screenshots |
| careflow | clinic / health | logo + 5 screenshots |
| leadly | sales CRM | logo + 5 screenshots |
| plateful | restaurant | logo + 5 screenshots |
| payroo | HR / payroll | logo + 5 screenshots |

`scenes/`: real Director output from Preview runs, with the narration, the
voice's word timings and the duration:
- `plateful.json`: the "bad" video (crowded, tiny screens, panel-wipe,
  decorative beats) the rulebook in `lib/video-rules.ts` was built from.
- `payroo.json`: the first video made with the rulebook (no violations).
