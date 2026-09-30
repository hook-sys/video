// No pictures of people or animals, ever (the owner's rule): figures, faces,
// hands and animals resolve to a neutral stand-in wherever they are asked for
// (the Director, card templates, search).
const PERSON = /^(user|users|person|contact|circle-user|square-user|book-user|file-user|shield-user|baby|accessibility|pregnant|standing)(-|$)/;
const FACE = /^(face|smile|frown|laugh|meh|angry|annoyed|skull|ghost|venetian-mask|scan-face)(-|$)/;
const BODY = /^(hand|handshake|helping-hand|grab|biceps|footprints|ear)(-|$)/;
const ANIMAL = /^(bird|cat|dog|fish|panda|rabbit|rat|snail|squirrel|turtle|worm|bug|shrimp|shell|paw-print|feather|dove|owl|duck|bee|butterfly|dragon|unicorn|ant|spider|squid|octopus|pig|cow|horse)(-|$)/;
export const livingStandIn = (name: string): string | null =>
  PERSON.test(name) ? "id-card" : FACE.test(name) ? "sparkles" : BODY.test(name) ? (name.includes("coins") ? "coins" : name === "handshake" ? "link" : "badge-check") : ANIMAL.test(name) ? "shapes" : null;
