// The 3D objects (components/video/flow/objects.tsx) by name; also the
// Director's "object:<name>" assets. No people or animals.
export const OBJECTS = ["question", "exclaim", "check", "rocket", "bulb", "star", "trophy", "shield", "lock", "bell", "gift", "target", "coin", "bolt", "chart"] as const;
export type ObjectName = (typeof OBJECTS)[number];
