# python3 fit.py widths.json — per Bangla face: each character's own width and the corrections for
# conjuncts and joined vowel signs (ridge least squares, fitted on every word), checked on Bangla words
# left out of a first fit; writes widths-chars.json (copy into components/video/simple/bn-widths.json).
# Needs numpy. Regenerate after adding a face: node measure.mjs words.txt widths.json && python3 fit.py widths.json
import sys, json, random
import numpy as np
W = json.load(open(sys.argv[1]))
H = "্"
def feats(t):
    f = {}
    add = lambda k, v=1: f.__setitem__(k, f.get(k, 0) + v)
    chars = list(t)
    for i, ch in enumerate(chars):
        nxt = chars[i + 1] if i + 1 < len(chars) else ""
        prv = chars[i - 1] if i else ""
        if ch == H:
            add("ya" if nxt == "য" else "ra" if nxt == "র" else "reph" if prv == "র" else "conj")
            # (this conjunct's own shape: a correction on its parts)
            if nxt and prv: add("+" + prv + H + nxt)
        else:
            add(ch)
            # (a vowel sign that joins its letter into a wider or narrower shape)
            if ch in "ুূৃ" and prv: add("+" + (prv if prv != "র" or (i > 1 and chars[i - 2] != H) else "্র") + ch)
    return f
out = {}
for face, r in W.items():
    items = sorted(r["words"].items())
    random.Random(7).shuffle(items)
    bn = lambda t: any("\u0980" <= ch <= "\u09FF" for ch in t)
    held = [kv for kv in items if bn(kv[0])][: len(items) // 6]
    test, train = held, [kv for kv in items if kv not in held]
    keys = sorted({k for t, _ in items for k in feats(t)})
    idx = {k: i for i, k in enumerate(keys)}
    def mat(rows):
        X = np.zeros((len(rows), len(keys)))
        for n, (t, _) in enumerate(rows):
            for k, v in feats(t).items(): X[n, idx[k]] = v
        return X, np.array([w for _, w in rows])
    X, y = mat(train)
    lam = 0.02
    prior = np.array([0.0 if k.startswith("+") else 0.55 for k in keys])
    A = X.T @ X + lam * np.eye(len(keys)); b = X.T @ y + lam * prior
    coef = np.linalg.solve(A, b)
    Xt, yt = mat(test)
    err = np.abs(Xt @ coef - yt) / yt
    Xa, ya = mat(items)
    erra = np.abs(Xa @ coef - ya) / ya
    # (the table kept: fitted on every word)
    X, y = mat(items)
    coef = np.linalg.solve(X.T @ X + lam * np.eye(len(keys)), X.T @ y + lam * prior)
    out[face] = {"chars": {k: round(float(coef[idx[k]]), 4) for k in keys}, "space": round(r["space"], 4)}
    worst_held = sorted(zip([t for t, _ in test], list(Xt @ coef), list(yt)), key=lambda z: -abs(z[1] - z[2]) / z[2])[:3]
    print("   held-out worst:", ", ".join(f"{t} true {w:.2f} est {e:.2f}" for t, e, w in worst_held))
    print(f"{face:20s} held-out mean {err.mean()*100:4.1f}% max {err.max()*100:4.1f}%   all max {erra.max()*100:4.1f}%")
json.dump(out, open(sys.argv[1].replace(".json", "-chars.json"), "w"), ensure_ascii=False)

# the worst words, and whole lines of 2–5 words (what fitting a line needs)
for face in ["anek-bangla", "hind-siliguri", "mina"]:
    c = out[face]["chars"]; r = W[face]
    pred = lambda t: sum(c.get(k, 0.0 if k.startswith("+") else 0.55) * v for k, v in feats(t).items())
    worst = sorted(r["words"].items(), key=lambda kv: -abs(pred(kv[0]) - kv[1]) / kv[1])[:4]
    print(face, "worst:", ", ".join(f"{t} {w:.2f}/{pred(t):.2f}" for t, w in worst))
    ws = list(r["words"].items()); rnd = random.Random(3); errs = []
    for _ in range(400):
        n = rnd.randint(2, 5); line = [ws[rnd.randrange(len(ws))] for _ in range(n)]
        true = sum(w for _, w in line) + (n - 1) * r["space"]; est = sum(pred(t) for t, _ in line) + (n - 1) * out[face]["space"]
        errs.append(abs(est - true) / true)
    print(f"   lines: mean {np.mean(errs)*100:.1f}% max {np.max(errs)*100:.1f}%")
