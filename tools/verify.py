#!/usr/bin/env python3
"""Vérifie que data/menu.json correspond au menu source (source/OlaSnack_Menu.pdf).

Contrôle, pour chaque article : le nom, la description et chaque prix
apparaissent bien dans le texte du PDF. Contrôle aussi que le nombre de prix
saisis est égal au nombre de prix présents dans le PDF (aucun oubli).

Usage :  python3 tools/verify.py        (nécessite : pip install pypdf)
Sortie :  code 0 si tout concorde, 1 sinon.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PDF = ROOT / "source" / "OlaSnack_Menu.pdf"
JSON = ROOT / "data" / "menu.json"


def price_forms(value):
    """Le menu écrit indifféremment « 2000F » et « 10 000F »."""
    return {f"{value}F", f"{value:,}F".replace(",", " ")}


def main():
    from pypdf import PdfReader

    text = "\n".join(p.extract_text() for p in PdfReader(str(PDF)).pages)
    flat = re.sub(r"\s+", " ", text)
    data = json.loads(JSON.read_text(encoding="utf-8"))

    problems = []
    items = prices = 0

    for cat in data["categories"]:
        if cat["name"] not in flat:
            problems.append(f"catégorie absente du PDF : {cat['name']}")
        for item in cat["items"]:
            items += 1
            if item["name"] not in flat:
                problems.append(f"nom absent du PDF : {item['name']}")
            desc = item.get("description")
            if desc and desc not in flat:
                problems.append(f"description absente du PDF : {item['name']}")

            values = (list(item["prices"].values()) if item.get("prices")
                      else [v for v in (item.get("price"), item.get("priceAlt")) if v])
            for value in values:
                prices += 1
                if not (price_forms(value) & set(re.findall(r"\d[\d ]*F", flat))):
                    problems.append(f"prix {value} introuvable pour {item['name']}")

            image = item.get("image")
            if image and not (ROOT / image).exists():
                problems.append(f"image manquante : {image}")

    in_pdf = len(re.findall(r"\d[\d ]*F\b", flat))
    if in_pdf != prices:
        problems.append(f"{prices} prix saisis, mais {in_pdf} prix dans le PDF")

    print(f"{items} articles / {prices} prix vérifiés")
    if problems:
        print("\n".join("  ✗ " + p for p in problems))
        return 1
    print("✓ noms, descriptions, prix et images concordent avec le menu source")
    return 0


if __name__ == "__main__":
    sys.exit(main())
