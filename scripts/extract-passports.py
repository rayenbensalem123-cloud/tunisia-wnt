"""
Extract player identity from passport scans.

The machine-readable zone is the only source used. It is a fixed 2x44 layout
where every date, the document number and the nationality each carry a check
digit, so a line whose check digits all agree is provably a real MRZ line with
provably correct contents. Printed labels are deliberately NOT scraped: at the
resolution of a phone photo they come back as fragments ("Gwen narnes",
"Date of ivaue"), and a parser that trusts them invents fields.

Each image is OCR'd several ways - whole page and the MRZ band at the bottom,
at different scales and page-segmentation modes - and the reading that yields
the most validated check digits wins. Scans in this intake are a mix of flat
scans, A4 pages with the passport inside, 9:16 phone photos and French
passports, so the MRZ is not always in the same place.

Every image is also tried for a French/EU-style MRZ, so a non-Tunisian
passport is read rather than discarded.

Nothing is inferred that the document does not state. A century is the only
thing added, and only as a clearly flagged one.

Usage:  python scripts/extract-passports.py <folder>
"""
from __future__ import annotations

import io
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

TESSERACT = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# OCR routinely confuses these in numeric fields. Applied only inside the
# numeric slots of a candidate line, never to the whole line, because the name
# field is letters and mapping letters to digits would destroy it.
DIGIT_FIX = str.maketrans({"O": "0", "Q": "0", "D": "0", "I": "1", "L": "1",
                           "S": "5", "B": "8", "Z": "2", "G": "6", "|": "1"})


# ── check digits ────────────────────────────────────────────────────────────
def value_of(c: str) -> int:
    if c == "<":
        return 0
    if c.isdigit():
        return int(c)
    return ord(c) - 55 if "A" <= c <= "Z" else -1


def check_ok(group: str) -> bool:
    """
    ICAO 9303 check digit for one group: the last character is the check digit
    for the data characters before it, weighted 7-3-1 and repeating.

    Group lengths differ by field, so this is not fixed at ten: the document
    number group is 9 data characters + 1 check, while the date of birth and
    date of expiry groups are 6 + 1.
    """
    if len(group) < 2 or not group[-1].isdigit():
        return False
    vals = [value_of(c) for c in group[:-1]]
    if -1 in vals:
        return False
    total = sum(v * (7, 3, 1)[i % 3] for i, v in enumerate(vals))
    return total % 10 == int(group[-1])


def six(raw: str, is_birth: bool = False) -> str:
    """
    A YYMMDD field as YYYY-MM-DD, or '' if it is not a date.

    The MRZ carries only a two-digit year, so the century has to be supplied.
    For a date of birth the split at 30 is the right assumption for a
    professional squad. A date of expiry is never ambiguous in the same way: a
    passport cannot have expired in 1932, so it is always read as this century
    or the next.
    """
    s = raw.translate(DIGIT_FIX)
    if len(s) != 6 or not s.isdigit() or s[2:4] == "00" or s[4:6] == "00":
        return ""
    month, day = int(s[2:4]), int(s[4:6])
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return ""
    yy = int(s[:2])
    century = ("20" if yy <= 30 else "19") if is_birth else ("20" if yy <= 99 else "19")
    return f"{century}{s[:2]}-{s[2:4]}-{s[4:6]}"


# ── MRZ ─────────────────────────────────────────────────────────────────────
def candidates(text: str):
    """
    Every plausible MRZ line pair in a blob of OCR text.

    Lines are 44 characters, but OCR routinely drops the '<' filler that pads
    the name field, so a recovered line can come back much shorter than 44. A
    run is therefore padded back out with the filler it lost, and the start of
    the second line is searched over a range of offsets rather than assumed -
    the length of the first line's filler is exactly what is in doubt.

    A window is only a candidate. The check digits decide whether it is real.
    """
    flat = re.sub(r"[^A-Za-z0-9<]", "", text.upper())
    for m in re.finditer(r"P<[A-Z]{3}", flat):
        i = m.start()
        line1 = flat[i:i + 44].ljust(44, "<")
        for off in range(-16, 17):
            j = i + 44 + off
            if j < 0:
                continue
            line2 = flat[j:j + 44].ljust(44, "<")
            if line2[10:13].isalpha() and six(line2[13:19]):
                yield line1, line2


# The three check-digit groups in a TD3 line 2. Each is 9 data characters
# followed by its own check digit: document number, date of birth, date of
# expiry. Both the French and the Tunisian layout use the same positions.
CHECK_GROUPS = (slice(0, 10), slice(13, 20), slice(21, 28))
CHECK_NAMES = ("passport_number", "birthdate", "expiry")


def score(b: str) -> int:
    return sum(check_ok(b[g].translate(DIGIT_FIX)) for g in CHECK_GROUPS)


def best_line(text: str) -> dict | None:
    best = None
    best_key = None
    for a, b in candidates(text):
        dob = six(b[13:19], is_birth=True)
        if not dob:
            continue
        # Rank by validated check digits first. Ties are broken on the
        # issuing state matching the nationality: on a national passport the
        # two are the same code (TUN/TUN, FRA/FRA), and a misaligned window
        # almost never preserves that pairing. This is what stops a garbled
        # candidate that happens to score the same from winning.
        key = (score(b), 1 if a[2:5] == b[10:13] else 0)
        if best_key is not None and key <= best_key:
            continue
        names = a[5:].split("<<")
        best_key = key
        best = {
            "key": key,
            "score": key[0],
            "surname": names[0].replace("<", " ").strip().title(),
            "given": (names[1].replace("<", " ").strip().title() if len(names) > 1 else ""),
            "issuing_state": a[2:5],
            "nationality": b[10:13],
            "passport_number": b[:9].replace("<", "").strip(),
            "birthdate": dob,
            "expiry": six(b[21:27]),
            "sex": b[20] if b[20] in "MFX<" else "",
            "checks": [check_ok(b[g].translate(DIGIT_FIX)) for g in CHECK_GROUPS],
        }
    if best:
        best["verified"] = best["score"] == 3
    return best


# ── printed-page fallback ───────────────────────────────────────────────────
# Used only when the MRZ is unreadable. The Tunisian and French data pages both
# print the date of birth before the issue and expiry dates, so the first
# complete date on the page is the date of birth. That holds across every scan
# inspected here, and it is corroborated against the MRZ when the MRZ survives.
PRINTED_DATE = re.compile(r"\b(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{4})\b")

DOC_MARKERS = re.compile(
    r"pas+port|republic|r[ée]publique|tunisia|identity|expiry|naissance", re.I
)


def looks_like_document(text: str) -> bool:
    hits = len(re.findall(r"pas+port|republic|r[ée]publique|tunisia|tunisien|fran[çc]ais",
                          text, re.I))
    dates = PRINTED_DATE.findall(text)
    return hits >= 2 and len(dates) >= 2


def printed_birthdate(text: str) -> str:
    m = PRINTED_DATE.search(text)
    if not m:
        return ""
    d, mo, y = m.groups()
    if not (1 <= int(mo) <= 12 and 1 <= int(d) <= 31):
        return ""
    return f"{y}-{int(mo):02d}-{int(d):02d}"


def name_from_filename(path: Path) -> str:
    """
    Fall back to the name the file was saved under, in the intake convention
    of given-name then surname. Only used when the document itself could not be
    read, and always flagged, because a filename is not evidence.
    """
    stem = re.sub(r"\.[a-z]+$", "", path.name, flags=re.I).strip()
    return " ".join(w.capitalize() for w in stem.split() if w)


# The name printed on the data page is set in large capitals on its own line,
# which makes it the most reliably OCR'd text on the whole document - far more
# so than the MRZ, where the same name sits in a run of 44 tightly packed
# characters and the trailing filler is easily read as letters.
CAPS_LINE = re.compile(r"^[A-Z][A-Z'\-]{2,20}$")

# Words that are page furniture, not names.
NOT_A_NAME = {
    "PASSPORT", "REPUBLIC", "TUNISIA", "TUNISIAN", "NATIONALITY", "SURNAME",
    "GIVEN", "NAMES", "SEX", "MALE", "FEMALE", "IDENTITY", "CODE", "TYPE",
    "PLACE", "BIRTH", "DATE", "ISSUING", "STATE", "EXPIRY", "ISSUE", "AUTHORITY",
    "SIGNATURE", "HOLDER", "PAGE", "RESERVED", "AUTHORITIES", "REPUBLIQUE",
    "FRANCAISE", "FRANCAIS", "PASSEPORT", "PRENOM", "PRENOMS", "NOM", "SEXE",
    "LIEU", "NAISSANCE", "EXPIRATION", "ETATS", "UNIS", "AMERIQUE", "HAYE",
    "PARIS", "TUNIS", "SOUSSE", "MEDENINE", "LYON", "FRANCE", "MAROC",
}


def printed_names(text: str) -> list[str]:
    out = []
    for line in text.splitlines():
        t = line.strip()
        if CAPS_LINE.match(t) and t not in NOT_A_NAME and not t.isdigit():
            out.append(t)
    return out


def norm(s: str) -> str:
    return re.sub(r"[^A-Z]", "", s.upper())


def is_subsequence(short: str, long: str) -> bool:
    it = iter(long)
    return all(ch in it for ch in short)


def printed_match(mrz_name: str, caps: list[str]) -> str:
    """
    Find the printed spelling of a name the MRZ read with junk in it.

    OCR renders the MRZ's '<' filler as letters, so a name picks up a spurious
    tail or middle noise: "RANIAS" for Rania, "MARIEMKXK" for Meriem,
    "AYARSEMISEEBEDI" for Ayadi. The name printed on the data page is set in
    large capitals on its own line, which OCR reads far more reliably.

    A replacement is only accepted when it is provably the same name: either
    character-for-character identical, or a subsequence of what the MRZ read -
    which can only ever REMOVE characters, never invent them. When several
    printed tokens qualify the longest wins, so the name is trimmed as little as
    possible. Nothing is ever lengthened, because that is the direction OCR
    noise goes.

    A name that already contains a space is only ever matched exactly. Trimming
    is by deletion, and a middle name is exactly what deletion removes first:
    "BEN KAABIA" would otherwise lose its BEN to a printed "KAABIA".
    """
    mn = norm(mrz_name)
    if not mn:
        return ""
    exact_only = " " in mrz_name.strip()
    best = ""
    for tok in caps:
        tn = norm(tok)
        if len(tn) < 4:
            continue
        if tn == mn:
            return tok
        if exact_only:
            continue
        if len(tn) < len(mn) and is_subsequence(tn, mn) and len(tn) > len(norm(best)):
            best = tok
    return best


def drop_filler_tokens(name: str) -> str:
    """
    Strip stray 1-2 character tokens from the ends of an MRZ name field.

    The name field is padded out with '<' filler, and OCR renders some of that
    padding as letters: "KK AOUINA" for AOUINA, "SANA X" for SANA. A leading or
    trailing token of one or two consonants is that filler, not a name part.
    The vowel test keeps a genuine initial such as "O." from being discarded.
    """
    parts = name.split()
    def is_filler(tok: str) -> bool:
        return len(tok) <= 2 and not set(tok) & set("AEIOUY")
    while len(parts) > 1 and is_filler(parts[0]):
        parts.pop(0)
    while len(parts) > 1 and is_filler(parts[-1]):
        parts.pop()
    return " ".join(parts)


def fix_with_printed(mrz_given: str, mrz_surname: str, caps: list[str]):
    """Correct each name part independently; returns the name and whether it moved."""
    mr = (drop_filler_tokens(mrz_given), drop_filler_tokens(mrz_surname))
    g = printed_match(mr[0], caps) or mr[0]
    s = printed_match(mr[1], caps) or mr[1]
    name = " ".join(x for x in (g, s) if x)
    return " ".join(w.capitalize() for w in name.split()), (g, s) != mr


# ── image handling ──────────────────────────────────────────────────────────
def ocr(img, psm: int) -> str:
    b = io.BytesIO()
    img.save(b, format="PNG")
    r = subprocess.run(
        [TESSERACT, "stdin", "stdout", "-l", "eng", "--psm", str(psm),
         "-c", "preserve_interword_spaces=1"],
        input=b.getvalue(), capture_output=True,
    )
    return r.stdout.decode("utf-8", "replace")


def load(p: Path):
    from PIL import Image

    if p.suffix.lower() == ".pdf":
        import pypdfium2 as pdfium

        doc = pdfium.PdfDocument(str(p))
        return doc[0].render(scale=300 / 72).to_pil().convert("RGB")
    return Image.open(p).convert("RGB")


def readings(img) -> list[str]:
    """Several OCR passes, because no single setting wins across all scans."""
    from PIL import Image, ImageOps

    out = []
    full = ImageOps.autocontrast(img.convert("L"))
    for scale in (1.0, 1.8):
        if scale == 1.0:
            v = full
        else:
            v = full.resize((int(full.width * scale), int(full.height * scale)), Image.LANCZOS)
        for psm in (6, 4):
            out.append(ocr(v, psm))

    # The MRZ sits in the lowest fifth of a data page. Cropping and upscaling
    # that band is what makes the check digits come out right.
    for top in (0.72, 0.80):
        out.extend(band_text(img, top, 3.0))
    return out


def band_text(img, top: float, scale: float) -> list[str]:
    from PIL import Image, ImageOps

    w, h = img.size
    band = img.crop((0, int(h * top), w, h))
    band = ImageOps.autocontrast(
        band.resize((int(band.width * scale), int(band.height * scale)),
                    Image.LANCZOS).convert("L")
    )
    return [ocr(band, psm) for psm in (6, 7)]


def thorough_readings(img) -> list[str]:
    """
    Fallback for scans where the MRZ is not where a data page normally puts it.

    A 9:16 phone photo of a French passport is the hard case: the booklet fills
    only part of the frame, so the band crops all miss the MRZ. Sweeping the
    whole page in overlapping strips at high scale finds it wherever it sits.
    """
    from PIL import Image, ImageOps

    grey = ImageOps.autocontrast(img.convert("L"))
    big = grey.resize((int(grey.width * 2.5), int(grey.height * 2.5)), Image.LANCZOS)
    out = []
    n = 6
    for i in range(n):
        y0 = int(big.height * i / n)
        y1 = int(big.height * (i + 1) / n)
        # overlap so a line on a boundary is not halved
        y1 = min(big.height, y1 + int(big.height * 0.02))
        strip = big.crop((0, y0, big.width, y1))
        for psm in (6, 7, 11):
            out.append(ocr(strip, psm))
    for top in (0.50, 0.58, 0.64, 0.86, 0.92):
        out.extend(band_text(img, top, 3.0))
    return out


def process(p: Path) -> dict:
    img = load(p)
    texts = readings(img)
    best = None
    # Ranked on the full key, not the check-digit count alone. Two readings can
    # score the same while one of them has a misaligned nationality field, and
    # comparing only the score would let whichever pass ran first win.
    for text in texts:
        got = best_line(text)
        if got and (best is None or got["key"] > best["key"]):
            best = got

    # The full sweep is skipped only when every check digit already agrees.
    # A partial score is not a reason to stop: the clean reading of a
    # document often appears in only one crop, while a misaligned window that
    # happens to score as well can be found by any pass at all.
    if best is None or best["score"] < 3:
        for text in thorough_readings(img):
            texts.append(text)
            got = best_line(text)
            if got and (best is None or got["key"] > best["key"]):
                best = got

    page = "\n".join(texts)

    if best:
        given, surname = best["given"], best["surname"]

        # A window can be correctly aligned on the check digits and still have
        # lost the '<<' that separates surname from given name. Rather than
        # create a card with half a name, take the missing part from the
        # filename the scan was saved under - a human's own spelling, and
        # flagged as such.
        missing_from_filename = False
        if not given:
            lead = [w for w in name_from_filename(p).split() if norm(w) != norm(surname)]
            if lead:
                given = lead[0]
                missing_from_filename = True

        name, repaired = fix_with_printed(given, surname, printed_names(page))
        # The repair substitutes the printed spelling, which is in capitals;
        # normalise the whole name so a card does not read "RANIA Aouina".
        name = " ".join(w.capitalize() for w in name.split())
        rec = {
            "file": p.name,
            "kind": "passport",
            "name": name,
            "birthdate": best["birthdate"],
            "nationality": best["nationality"],
            "passport_number": best["passport_number"],
            "expiry": best["expiry"],
            "sex": best["sex"],
            "issuing_state": best["issuing_state"],
            "checks": dict(zip(CHECK_NAMES, best["checks"])),
            "source": "MRZ" + (" + printed page (name)" if repaired else ""),
            "verified": best["verified"] and not repaired and not missing_from_filename,
        }
        flags = [] if best["verified"] else [
            "MRZ check digits %d/3 - confirm by hand" % best["score"]
        ]
        if repaired:
            flags.append("name corrected from the printed page: verify it")
        if missing_from_filename:
            flags.append("given name is from the FILENAME, not the document: confirm it")
            rec["source"] += " + filename (given name)"
        rec["flags"] = flags
        return rec

    # No readable MRZ. Only carry on if the page is still recognisably a
    # passport, otherwise this is a photograph.
    if not looks_like_document(page):
        return {"file": p.name, "kind": "photo", "flags": ["no MRZ - not a passport"]}

    dob = printed_birthdate(page)
    return {
        "file": p.name,
        "kind": "passport",
        "name": name_from_filename(p),
        "birthdate": dob,
        "nationality": "TUN" if re.search(r"tunis", page, re.I) else "",
        "passport_number": "",
        "expiry": "",
        "checks": {},
        "source": "printed page + filename",
        "verified": False,
        "flags": [
            "MRZ unreadable - name is from the FILENAME and date from the printed page, confirm both"
        ] + ([] if dob else ["no date of birth found"]),
    }


# ── uploadable copies ───────────────────────────────────────────────────────
# The app shows a passport in an <img> tag, and a browser cannot render a PDF
# in one. A PDF scan is therefore rasterised to JPEG before upload, and the
# same step brings any oversized image under the 5 MB cap that
# app/api/upload/route.ts enforces. Doing it here rather than storing a PDF
# means a card never points at a document the viewer cannot display.
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
DISPLAYABLE = {".jpg", ".jpeg", ".png", ".webp"}
UPLOAD_DIR = "_upload"


def prepare_upload(src: Path, root: Path) -> tuple[str, str]:
    """
    Return (relative_path, note) for the file to upload for this scan.

    An image that already fits is used as-is. A PDF, or anything over the
    cap, is re-encoded: the page is rendered and the JPEG quality and scale
    are stepped down until it fits, because a passport only has to be legible
    on screen, not archival.
    """
    if src.suffix.lower() in DISPLAYABLE and src.stat().st_size <= MAX_UPLOAD_BYTES:
        return src.name, ""

    from PIL import Image

    if src.suffix.lower() == ".pdf":
        import pypdfium2 as pdfium

        img = pdfium.PdfDocument(str(src))[0].render(scale=200 / 72).to_pil().convert("RGB")
        note = "PDF rasterised for the in-app viewer"
    else:
        img = Image.open(src).convert("RGB")
        note = "re-encoded to fit the 5 MB cap"

    out_dir = root / UPLOAD_DIR
    out_dir.mkdir(exist_ok=True)
    dest = out_dir / (src.stem + ".jpg")

    for scale, quality in ((1.0, 85), (0.85, 80), (0.7, 72), (0.55, 65)):
        frame = img if scale == 1.0 else img.resize(
            (max(1, int(img.width * scale)), max(1, int(img.height * scale))),
            Image.LANCZOS,
        )
        frame.save(dest, format="JPEG", quality=quality, optimize=True)
        if dest.stat().st_size <= MAX_UPLOAD_BYTES:
            break
    else:
        return "", f"could not get {src.name} under 5 MB"

    return f"{UPLOAD_DIR}/{dest.name}", note


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    if not root.is_dir():
        print(f"not a folder: {root}")
        return 2
    scans = sorted(q for q in root.iterdir()
                   if q.is_file() and q.suffix.lower() in {".jpg", ".jpeg", ".png", ".pdf"})
    if not scans:
        print(f"no scans in {root}")
        return 1
    out = root / "players.json"
    workers = int(os.environ.get("OCR_WORKERS", "4"))
    results: list[dict] = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = {pool.submit(process, q): q for q in scans}
        for f in as_completed(futs):
            q = futs[f]
            try:
                rec = f.result()
            except Exception as e:
                rec = {"file": q.name, "kind": "error", "flags": [str(e)]}
            if rec["kind"] == "passport":
                rel, note = prepare_upload(q, root)
                rec["upload_file"] = rel
                if note:
                    rec.setdefault("flags", []).append(note)
                    print(f"  {q.name:<26} {note}", flush=True)
            results.append(rec)
            flag = ("OK" if rec.get("verified") else
                    "check" if rec["kind"] == "passport" else rec["kind"])
            print(f"  {q.name:<26} {flag:<7} {rec.get('name') or rec.get('flags', [''])[0]}",
                  flush=True)
            out.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    ok = sum(1 for r in results if r.get("verified"))
    print(f"\n{ok} fully verified, "
          f"{sum(1 for r in results if r['kind'] == 'passport') - ok} partial, "
          f"{sum(1 for r in results if r['kind'] == 'photo')} photos -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
