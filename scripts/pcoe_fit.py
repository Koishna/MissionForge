import glob, os, numpy as np, scipy.io as sio


def fade_per_cycle(path, key):
    m = sio.loadmat(path, squeeze_me=True, struct_as_record=False)
    cycles = m[key].cycle
    caps = np.array(
        [c.data.Capacity for c in cycles if c.type == "discharge"], dtype=float
    )
    slope = np.polyfit(np.arange(len(caps)), caps, 1)[0]
    return -slope / caps[0], len(caps)


rates = []
for p in sorted(glob.glob("B00*.mat")):
    key = os.path.basename(p)[:-4]
    r, n = fade_per_cycle(p, key)
    print(key, n, "discharge cycles, fade per cycle =", r)
    rates.append(r)
rates = np.array(rates)
print(
    "mean",
    rates.mean(),
    "sd",
    rates.std(ddof=1),
    "cv",
    rates.std(ddof=1) / rates.mean(),
)
