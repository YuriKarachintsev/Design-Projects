"""Tab A check: browser engine vs analysis/reference_stats.py for 3 filter combinations
(hours by designer x type, cumulative revenue/cost/margin by type, YTD by designer, both rate views)."""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DUMP = ROOT / "tests" / "_data.json"
ym = lambda y, m: y * 12 + m - 1
ALL_R = ["North", "East", "South", "West"]
CASES = [
    ("all data, start month", dict(**{"from": ym(2017, 6), "to": ym(2026, 9)}, types=[1, 2, 3, 4], regions=ALL_R, attribution="start")),
    ("Types 1-2, North+East, 2023-01..2026-09, spread", dict(**{"from": ym(2023, 1), "to": ym(2026, 9)}, types=[1, 2], regions=["North", "East"], attribution="spread")),
    ("Types 2-4, all regions, 2019-07..2021-06, start", dict(**{"from": ym(2019, 7), "to": ym(2021, 6)}, types=[2, 3, 4], regions=ALL_R, attribution="start")),
]


def flat(d, p=""):
    out = {}
    for k, v in d.items():
        if isinstance(v, dict):
            out.update(flat(v, f"{p}{k}."))
        else:
            out[p + k] = v
    return out


if __name__ == "__main__":
    subprocess.check_call([sys.executable, str(ROOT / "build.py"), "--dump-json", str(DUMP)], stdout=subprocess.DEVNULL)
    bad = 0
    for name, f in CASES:
        js = flat(json.loads(subprocess.check_output(["node", str(ROOT / "tests" / "tab_a.js"), str(DUMP), json.dumps(f)])))
        py = flat(json.loads(subprocess.check_output([sys.executable, str(ROOT / "analysis" / "reference_stats.py"), "--tab-a", json.dumps(f)])))
        js = {k: v for k, v in js.items() if not (k.startswith("a1.") and abs(v) < 1e-12 and k not in py)}
        keys = set(js) | set(py)
        diffs = [k for k in keys if k not in js or k not in py or abs(js[k] - py[k]) > 1e-6 * max(1, abs(py[k]))]
        bad += len(diffs)
        print(f"{'OK ' if not diffs else 'DIFF'} {name}: {len(keys)} values, {len(diffs)} differences (largest abs diff {max((abs(js[k] - py[k]) for k in keys if k in js and k in py), default=0):.2e})")
        for k in sorted(diffs)[:10]:
            print("    ", k, js.get(k), py.get(k))
    sys.exit(1 if bad else 0)
