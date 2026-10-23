"""Read-only post-deployment checks, including independent HTTPS validation."""
import concurrent.futures
import json
import urllib.error
import urllib.request

BASE = "https://karmalifedesign.com"
SERVICE = "https://p01--vedic-karma-app--mbb49nqg858d.code.run"


def check(base, path, kind="asset", language=None):
    try:
        request = urllib.request.Request(base + path, headers={"User-Agent": "KarmaLifeDesign-ReleaseCheck/1.0"})
        with urllib.request.urlopen(request, timeout=25) as response:
            data = response.read()
            assert response.status == 200
            if kind == "ready":
                assert json.loads(data).get("ok") is True
            elif kind == "catalog":
                catalog = json.loads(data)
                assert catalog["release"] == "three-directions-v1"
                assert catalog["products"] == {"vedic_basic": 999, "vedic_plus": 1499, "portrait": 999, "daily": 199, "monthly": 499, "tarot": 499}
                assert catalog["interpretationLanguages"] == ["en", "ru", "es", "de"]
            elif kind == "page":
                html = data.decode()
                assert 'lang="' + language + '"' in html
                assert all('id="' + area + '"' in html for area in ["vedic", "western", "tarot"])
                assert "/readings/app.mjs" in html
            elif kind == "pdf":
                assert data.startswith(b"%PDF-")
            elif kind == "payment":
                settings = json.loads(data)
                assert settings["direct"] is True and settings["available"] is True
            assert len(data) > 0
        return {"url": base + path, "ok": True}
    except Exception as error:
        return {"url": base + path, "ok": False, "error": str(error)}


checks = [(BASE, "/ready", "ready"), (BASE, "/api/reading-catalog", "catalog"),
          (BASE, "/api/payment-options", "payment"), ("https://www.karmalifedesign.com", "/ready", "ready"),
          (SERVICE, "/ready", "ready"), (SERVICE, "/api/reading-catalog", "catalog")]
for lang in ["en", "ru", "es", "de"]:
    checks.append((BASE, "/?lang=" + lang, "page", lang))
    for area in ["vedic", "western", "tarot"]:
        checks.append((BASE, f"/readings/samples/{lang}/{area}.pdf", "pdf"))
        for page in range(1, 4):
            checks.append((BASE, f"/readings/samples/{lang}/{area}-{page}.webp"))
for image in ["western-atlas.jpg", "tarot-ritual.jpg", "vedic-temple.jpg"]:
    checks.append((BASE, "/readings/assets/" + image))
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(lambda args: check(*args), checks))
print(json.dumps({"passed": sum(r["ok"] for r in results), "total": len(results), "results": results}, indent=2))
raise SystemExit(0 if all(result["ok"] for result in results) else 1)
