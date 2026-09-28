"""
Recompress oversized passport scans IN PLACE in the private bucket.

Why: a passport is a few hundred KB of document, not a 3 MB photo. The two
largest scans were 2.94 MB and 3.19 MB, so the card sat blank for seconds
while the browser pulled megabytes before the first pixel appeared. Fourteen
of the sixteen were already under 0.7 MB, so only anything over THRESHOLD
is touched -- recompressing a file that is already small would only throw
away detail for no gain.

Each scan is re-uploaded to its EXISTING storage path, so no row in members
changes and no database migration is needed.

Sizing matches the app's own uploader (compressImage -> 1800px, q=0.85), so
a passport added later in the UI looks the same as these do. 1800px on the
long edge is still well above what a passport data page needs, so the MRZ
stays legible.

Reads and writes with a CALLER token, never a service-role key: the same
Postgres/storage policies apply, and this script can only touch what that
account is already entitled to.
"""
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request

from PIL import Image

SB = os.environ["SB"]
AK = os.environ["AK"]
TOK = os.environ["TOK"].strip()

BUCKET = "members"
MAX_EDGE = 1800          # matches compressImage(f, 1800, 0.85) in the app
QUALITY = 85
THRESHOLD = 300 * 1024   # only recompress scans above 300 KB


def call(method, url, body=None, content_type=None, raw=False):
    req = urllib.request.Request(url, method=method)
    req.add_header("apikey", AK)
    req.add_header("Authorization", f"Bearer {TOK}")
    if body is not None:
        if content_type:
            req.add_header("Content-Type", content_type)
        req.data = body
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            payload = r.read()
            return payload if raw else (json.loads(payload) if payload else None)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:200]
        raise RuntimeError(f"{method} {url.rsplit('/', 1)[-1]} -> HTTP {e.code} {detail}") from None


def jpg_size(path):
    with Image.open(path) as im:
        return im.size


def recompress(raw):
    """Return (jpeg_bytes, before_size, after_size, before_dims, after_dims)."""
    before = len(raw)
    im = Image.open(io.BytesIO(raw))
    before_dims = im.size
    im = im.convert("RGB")
    w, h = im.size
    if max(w, h) > MAX_EDGE:
        scale = MAX_EDGE / float(max(w, h))
        im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    out = io.BytesIO()
    im.save(out, format="JPEG", quality=QUALITY, optimize=True, progressive=True)
    return out.getvalue(), before, len(out.getvalue()), before_dims, im.size


def main():
    rows = call(
        "GET",
        f"{SB}/rest/v1/members?select=id,name,passport_image&passport_image=not.is.null&order=id",
    )
    print(f"  {len(rows)} members carry a passport\n")

    total_before = total_after = 0
    changed = skipped = failed = 0

    for r in rows:
        name = r["name"]
        path = r["passport_image"]

        if path.startswith(("data:", "blob:")):
            print(f"  skip  {name:<22} stored inline, not in the bucket")
            skipped += 1
            continue

        try:
            signed = call("POST", f"{SB}/storage/v1/object/sign/{BUCKET}/{path}",
                          body=b'{"expiresIn":600}', content_type="application/json")
            # The raw REST endpoint returns "signedURL" (capital URL) holding a
            # RELATIVE path. supabase-js normalises both into an absolute
            # signedUrl, which is why the node check passes and this does not.
            url = f"{SB}/storage/v1{signed['signedURL']}"
            raw = call("GET", url, raw=True)
        except Exception as e:
            print(f"  FAIL  {name:<22} download: {e}")
            failed += 1
            continue

        total_before += len(raw)
        kb = len(raw) / 1024

        if len(raw) <= THRESHOLD:
            total_after += len(raw)
            print(f"  keep  {name:<22} {kb:7.0f} KB  already small")
            skipped += 1
            continue

        try:
            out, before, after, bdims, adims = recompress(raw)
        except Exception as e:
            print(f"  FAIL  {name:<22} decode: {e}")
            failed += 1
            continue

        # Only overwrite when the result is genuinely smaller. Guard against a
        # pathological re-encode making a file bigger, which would be a
        # silent quality loss for nothing.
        if after >= before:
            total_after += before
            print(f"  keep  {name:<22} {kb:7.0f} KB  recompress was not smaller")
            skipped += 1
            continue

        try:
            call("POST", f"{SB}/storage/v1/object/{BUCKET}/{path}",
                 body=out, content_type="image/jpeg", raw=True)
        except Exception as e:
            print(f"  FAIL  {name:<22} upload: {e}")
            failed += 1
            continue

        total_after += after
        changed += 1
        print(f"  ok    {name:<22} {kb:7.0f} KB -> {after / 1024:6.0f} KB   "
              f"{bdims[0]}x{bdims[1]} -> {adims[0]}x{adims[1]}")
        time.sleep(0.15)

    print("")
    print(f"  recompressed {changed}, kept {skipped}, failed {failed}")
    print(f"  squad passports: {total_before / 1024 / 1024:.1f} MB -> {total_after / 1024 / 1024:.1f} MB")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
