"""Compare the browser engine (run in Node) with analysis/reference_stats.py.

    python tests/compare_engines.py            # default state + 6 tab B filter combinations
Numbers must agree to 3 decimals (p-values, coefficients, shares) and to the nearest unit for
money and hours; strings and lists must be identical.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DUMP = ROOT / "tests" / "_data.json"


def ym(y, m):
    return y * 12 + m - 1


CASES = [
    ("default (all sources, full period)", {}),
    ("original only", {"source": "original", "bOnly": True}),
    ("2023-01 .. 2026-09", {"from": ym(2023, 1), "to": ym(2026, 9), "bOnly": True}),
    ("2020-01 .. 2025-12", {"from": ym(2020, 1), "to": ym(2025, 12), "bOnly": True}),
    ("2018-01 .. 2022-12", {"from": ym(2018, 1), "to": ym(2022, 12), "bOnly": True}),
    ("original only, 2024-01 .. 2026-09", {"from": ym(2024, 1), "to": ym(2026, 9), "source": "original", "bOnly": True}),
    ("2021-07 .. 2024-06", {"from": ym(2021, 7), "to": ym(2024, 6), "bOnly": True}),
]


def run(opts):
    js = json.loads(subprocess.check_output(["node", str(ROOT / "tests" / "engine_summary.js"), str(DUMP), json.dumps(opts)]))
    py = json.loads(subprocess.check_output([sys.executable, str(ROOT / "analysis" / "reference_stats.py"), "--opts", json.dumps(opts)]))
    return js, py


def close(a, b, path):
    if a is None or b is None:
        return a == b or (a is None and b != b) or (b is None and a != a)
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        if a != a and b != b:
            return True
        big = abs(a) >= 1000
        return abs(a - b) <= (0.5 if big else 5e-4) or abs(a - b) <= 1e-9 * max(abs(a), abs(b))
    return a == b


def diff(js, py, path=""):
    out, n = [], 0
    if isinstance(py, dict):
        for k, v in py.items():
            if k not in js:
                out.append(f"{path}.{k}: missing in browser engine")
                continue
            o, c = diff(js[k], v, f"{path}.{k}")
            out += o
            n += c
        return out, n
    if isinstance(py, list) and not (len(py) and isinstance(py[0], dict) and "type" in py[0]):
        if len(js) != len(py):
            return [f"{path}: length {len(js)} vs {len(py)}"], 1
        for i, (a, b) in enumerate(zip(js, py)):
            o, c = diff(a, b, f"{path}[{i}]")
            out += o
            n += c
        return out, n
    if isinstance(py, list):
        for a, b in zip(js, py):
            o, c = diff(a, b, f"{path}[T{b['type']}]")
            out += o
            n += c
        return out, n
    return ([] if close(js, py, path) else [f"{path}: browser {js} vs reference {py}"]), 1


if __name__ == "__main__":
    subprocess.check_call([sys.executable, str(ROOT / "build.py"), "--dump-json", str(DUMP)], stdout=subprocess.DEVNULL)
    bad = 0
    for name, opts in CASES:
        js, py = run(opts)
        problems, n = diff(js, py)
        bad += len(problems)
        print(f"{'OK ' if not problems else 'DIFF'} {name}: {n} values compared, {len(problems)} differences")
        for p in problems:
            print("     ", p)
    sys.exit(1 if bad else 0)
