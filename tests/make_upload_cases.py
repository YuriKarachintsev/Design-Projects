"""Write the tab D test files: the built-in data as CSV (must pass) and 12 broken variants (must fail).

    python tests/make_upload_cases.py <outdir>
"""
import csv
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HEADER = ["Prj ID", "Project Name", "Project type", "Region", "Designer", "Years of experience", "Education",
          "Start date", "Start month", "Start year", "Actual", "Planned", "Hourly rate", "Source"]


def canonical_rows():
    out = subprocess.check_output([sys.executable, str(ROOT / "build.py"), "--dump-json", "/dev/stdout"])
    text = out.decode()
    return json.loads(text[: text.rindex("}") + 1])["rows"]


def to_table(rows):
    return [HEADER] + [[r["id"], r["name"], r["type"], r["region"], r["designer"], r["yrs"], r["edu"], r["date"], r["month"],
                        r["year"], repr(r["actual"]) if r["actual"] != int(r["actual"]) else int(r["actual"]),
                        repr(r["planned"]) if r["planned"] != int(r["planned"]) else int(r["planned"]), r["rate"], r["source"]] for r in rows]


def write(path, table):
    with open(path, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows(table)


def main(outdir):
    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    base = to_table(canonical_rows())
    write(out / "builtin.csv", base)
    i = {h: k for k, h in enumerate(HEADER)}

    def variant(name, fn):
        t = [row[:] for row in base]
        fn(t)
        write(out / f"bad_{name}.csv", t)

    variant("missing_column", lambda t: [r.pop(i["Planned"]) for r in t])
    variant("misspelled_header", lambda t: t[0].__setitem__(i["Planned"], "Planed"))
    variant("empty_cell", lambda t: t[5].__setitem__(i["Designer"], ""))
    variant("duplicate_id", lambda t: t[6].__setitem__(i["Prj ID"], t[5][i["Prj ID"]]))
    variant("system_type_5", lambda t: t[7].__setitem__(i["Project type"], "System type 5"))
    variant("text_in_planned", lambda t: t[8].__setitem__(i["Planned"], "twelve thousand"))
    variant("planned_zero", lambda t: t[9].__setitem__(i["Planned"], 0))
    variant("bad_date", lambda t: t[10].__setitem__(i["Start date"], "2026-13-45 10:00"))
    variant("mismatched_month", lambda t: t[11].__setitem__(i["Start month"], (int(t[11][i["Start month"]]) % 12) + 1))
    variant("unknown_rate", lambda t: t[12].__setitem__(i["Hourly rate"], 70))

    def two_rates(t):
        d = t[13][i["Designer"]]
        other = next(r for r in [62, 68, 74, 86] if r != int(t[13][i["Hourly rate"]]))
        t[13][i["Hourly rate"]] = other
        assert sum(1 for r in t[1:] if r[i["Designer"]] == d) > 1
    variant("designer_two_rates", two_rates)
    (out / "bad_text_file.txt").write_text((out / "builtin.csv").read_text(encoding="utf-8"), encoding="utf-8")
    print("\n".join(sorted(p.name for p in out.iterdir())))


if __name__ == "__main__":
    main(sys.argv[1])
