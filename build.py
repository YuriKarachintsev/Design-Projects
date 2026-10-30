"""Build the Design Department Performance & Forecast Dashboard.

    python build.py --input data/Report2_extended_adjusted.xlsx

Reads the Excel file, validates it with the same rules as tab D, embeds the rows as JSON
and inlines src/ (template, styles, app, tabs, charts), the libraries in vendor/ and the
fonts into one self-contained file: dist/dashboard.html.

Libraries (ECharts 5.5.1, jStat 1.9.6, SheetJS 0.18.5) and fonts (IBM Plex Sans/Mono,
Barlow Condensed) are downloaded once from the npm registry into vendor/ if missing.
"""
import argparse
import base64
import io
import json
import re
import sys
import tarfile
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import config as C  # noqa: E402

CORRUPT = "The data is corrupt: the file does not match the required format. Nothing was changed."
REQUIRED = ["Prj ID", "Project Name", "Project type", "Region", "Designer", "Years of experience", "Education",
            "Start date", "Start month", "Start year", "Actual", "Planned", "Hourly rate"]
TYPES = {f"System type {i}" for i in range(1, 5)}
REGIONS = {"North", "East", "South", "West"}
EDUS = {"High school", "Bachelor degree", "Master degree"}

VENDOR = {
    "echarts.min.js": ("echarts", "5.5.1", "package/dist/echarts.min.js"),
    "jstat.min.js": ("jstat", "1.9.6", "package/dist/jstat.min.js"),
    "xlsx.full.min.js": ("xlsx", "0.18.5", "package/dist/xlsx.full.min.js"),
}
FONTS = {
    "ibm-plex-sans-latin-400-normal.woff2": ("@fontsource/ibm-plex-sans", "5.3.0"),
    "ibm-plex-sans-latin-500-normal.woff2": ("@fontsource/ibm-plex-sans", "5.3.0"),
    "ibm-plex-sans-latin-600-normal.woff2": ("@fontsource/ibm-plex-sans", "5.3.0"),
    "ibm-plex-mono-latin-400-normal.woff2": ("@fontsource/ibm-plex-mono", "5.3.0"),
    "ibm-plex-mono-latin-500-normal.woff2": ("@fontsource/ibm-plex-mono", "5.3.0"),
    "barlow-condensed-latin-500-normal.woff2": ("@fontsource/barlow-condensed", "5.3.0"),
    "barlow-condensed-latin-600-normal.woff2": ("@fontsource/barlow-condensed", "5.3.0"),
}


class Corrupt(Exception):
    pass


def config_dict():
    out = {}
    for k in dir(C):
        if k.isupper():
            v = getattr(C, k)
            out[k] = {str(a): b for a, b in v.items()} if isinstance(v, dict) else v
    return out


# ---------------------------------------------------------------------------- reading + validation
def _norm(h):
    return str(h).strip().lower()


def read_table(path):
    """Read .xlsx/.xls (Sheet1 if present, else the first sheet) or .csv into a DataFrame of raw values."""
    import pandas as pd
    p = Path(path)
    ext = p.suffix.lower()
    if p.stat().st_size > C.MAX_UPLOAD_MB * 1024 * 1024:
        raise Corrupt()
    if ext in (".xlsx", ".xls"):
        xl = pd.ExcelFile(p)
        sheet = next((s for s in xl.sheet_names if s.strip().lower() == "sheet1"), xl.sheet_names[0])
        df = pd.read_excel(xl, sheet_name=sheet, dtype=object)
        notes = None
        ns = next((s for s in xl.sheet_names if s.strip().lower() == "notes"), None)
        if ns:
            nd = pd.read_excel(xl, sheet_name=ns, header=None, dtype=str)
            notes = [str(v) for v in nd.iloc[:, 0].tolist() if isinstance(v, str) and v.strip() and v != "nan"]
        return df, notes
    if ext == ".csv":
        df = pd.read_csv(p, dtype=str, keep_default_na=False, encoding="utf-8")
        return df, None
    raise Corrupt()


def _num(v):
    if v is None:
        raise Corrupt()
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        if v != v:
            raise Corrupt()
        return float(v)
    s = str(v).strip()
    if not re.fullmatch(r"-?\d+(\.\d+)?([eE][-+]?\d+)?", s):
        raise Corrupt()
    return float(s)


def _date(v):
    import pandas as pd
    if isinstance(v, (pd.Timestamp, datetime)):
        return pd.Timestamp(v).to_pydatetime()
    s = str(v).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    raise Corrupt()


def validate(df):
    """Apply the tab D rules; return canonical rows or raise Corrupt (pass/fail only)."""
    if len(df) < 1 or len(df) > C.MAX_UPLOAD_ROWS:
        raise Corrupt()
    cols = {_norm(c): c for c in df.columns}
    if any(_norm(r) not in cols for r in REQUIRED):
        raise Corrupt()
    src_col = cols.get("source")
    rates = {int(k) for k in C.LOCATION_BY_RATE}
    rows, ids, prof = [], set(), {}
    for _, rec in df.iterrows():
        g = {r: rec[cols[_norm(r)]] for r in REQUIRED}
        for v in g.values():
            if v is None or (isinstance(v, float) and v != v) or (isinstance(v, str) and not v.strip()):
                raise Corrupt()
        pid = str(g["Prj ID"]).strip()
        if pid in ids:
            raise Corrupt()
        ids.add(pid)
        ptype, region, edu = str(g["Project type"]).strip(), str(g["Region"]).strip(), str(g["Education"]).strip()
        if ptype not in TYPES or region not in REGIONS or edu not in EDUS:
            raise Corrupt()
        d = _date(g["Start date"])
        month, year = _num(g["Start month"]), _num(g["Start year"])
        if month != d.month or year != d.year:
            raise Corrupt()
        yrs = _num(g["Years of experience"])
        if yrs != int(yrs) or not 0 <= yrs <= 60:
            raise Corrupt()
        actual, planned, rate = _num(g["Actual"]), _num(g["Planned"]), _num(g["Hourly rate"])
        if actual < 0 or planned <= 0 or rate not in rates:
            raise Corrupt()
        des = str(g["Designer"]).strip()
        p = (rate, edu, int(yrs))
        if prof.setdefault(des, p) != p:
            raise Corrupt()
        src = str(rec[src_col]).strip() if src_col is not None and str(rec[src_col]).strip() not in ("", "nan", "None") else "Uploaded"
        rows.append({"id": pid, "name": str(g["Project Name"]).strip(), "type": ptype, "region": region, "designer": des,
                     "yrs": int(yrs), "edu": edu, "date": d.strftime("%Y-%m-%d %H:%M"), "month": int(month), "year": int(year),
                     "actual": actual, "planned": planned, "rate": int(rate), "source": src})
    return rows


def load(path):
    df, notes = read_table(path)
    return validate(df), notes


# ---------------------------------------------------------------------------- vendor
def fetch_vendor():
    vd = ROOT / "vendor"
    (vd / "fonts").mkdir(parents=True, exist_ok=True)

    def tarball(pkg, ver):
        name = pkg.split("/")[-1]
        url = f"https://registry.npmjs.org/{pkg}/-/{name}-{ver}.tgz"
        with urllib.request.urlopen(url, timeout=120) as r:
            return tarfile.open(fileobj=io.BytesIO(r.read()), mode="r:gz")

    for fn, (pkg, ver, member) in VENDOR.items():
        if not (vd / fn).exists():
            print(f"  downloading {pkg}@{ver}")
            (vd / fn).write_bytes(tarball(pkg, ver).extractfile(member).read())
    need = {}
    for fn, pv in FONTS.items():
        if not (vd / "fonts" / fn).exists():
            need.setdefault(pv, []).append(fn)
    for (pkg, ver), files in need.items():
        print(f"  downloading {pkg}@{ver}")
        t = tarball(pkg, ver)
        for fn in files:
            (vd / "fonts" / fn).write_bytes(t.extractfile(f"package/files/{fn}").read())


def font_css():
    fam = {"ibm-plex-sans": "IBM Plex Sans", "ibm-plex-mono": "IBM Plex Mono", "barlow-condensed": "Barlow Condensed"}
    out = []
    for fn in FONTS:
        m = re.match(r"(.+)-latin-(\d+)-normal\.woff2", fn)
        b64 = base64.b64encode((ROOT / "vendor" / "fonts" / fn).read_bytes()).decode()
        out.append(f"@font-face{{font-family:'{fam[m.group(1)]}';font-style:normal;font-weight:{m.group(2)};"
                   f"font-display:swap;src:url(data:font/woff2;base64,{b64}) format('woff2');}}")
    return "\n".join(out)


# ---------------------------------------------------------------------------- build
SRC_ORDER = ["stats.js", "analysis.js", "app.js", "validate.js", "charts/*.js", "tabs/tabA.js", "tabs/tabB.js", "tabs/tabC.js", "tabs/tabD.js", "main.js"]


def app_js():
    parts = []
    for pat in SRC_ORDER:
        for f in sorted((ROOT / "src").glob(pat)):
            parts.append(f"/* ---- {f.relative_to(ROOT)} ---- */\n" + f.read_text(encoding="utf-8"))
    return "\n".join(parts)


def build(input_path, out_path):
    rows, notes = load(input_path)
    fetch_vendor()
    payload = {"file": Path(input_path).name, "rows": rows, "notes": notes or [], "built": datetime.now().strftime("%Y-%m-%d %H:%M")}
    tpl = (ROOT / "src" / "template.html").read_text(encoding="utf-8")
    libs = "\n".join((ROOT / "vendor" / f).read_text(encoding="utf-8") for f in VENDOR)
    safe = lambda s: s.replace("</script", "<\\/script")
    html = (tpl.replace("/*__FONTS__*/", font_css())
            .replace("/*__CSS__*/", (ROOT / "src" / "styles.css").read_text(encoding="utf-8"))
            .replace("/*__LIBS__*/", safe(libs))
            .replace("/*__CONFIG__*/", "window.DD_CONFIG = " + json.dumps(config_dict()) + ";")
            .replace("/*__DATA__*/", "window.DD_DATA = " + safe(json.dumps(payload, ensure_ascii=False, separators=(",", ":"))) + ";")
            .replace("/*__APP__*/", safe(app_js())))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding="utf-8")
    print(f"Wrote {out_path} ({out_path.stat().st_size / 1e6:.1f} MB): {len(rows)} projects from {Path(input_path).name}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", default=str(ROOT / "data" / "Report2_extended_adjusted.xlsx"))
    ap.add_argument("--output", default=str(ROOT / "dist" / "dashboard.html"))
    ap.add_argument("--dump-json", help="Only validate and write the canonical rows + config as JSON (for tests)")
    a = ap.parse_args()
    try:
        if a.dump_json:
            rows, notes = load(a.input)
            Path(a.dump_json).write_text(json.dumps({"rows": rows, "notes": notes or [], "config": config_dict()}))
            print(f"Validated {len(rows)} rows -> {a.dump_json}")
        else:
            build(a.input, Path(a.output))
    except Corrupt:
        print(CORRUPT, file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
