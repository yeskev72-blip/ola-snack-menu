#!/usr/bin/env bash
# Vérifie qu'aucun secret (clé Gemini, clé service_role) n'est embarqué dans le bundle de l'app.
# Usage : scripts/check-bundle-secrets.sh   (exporte le bundle Android puis le fouille)
set -euo pipefail

OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT
# Sans bytecode Hermes : ses chaînes collées bout à bout fausseraient la recherche.
npx expo export -p android --no-bytecode --output-dir "$OUT" >/dev/null

FOUND=0
# Motifs de vraies clés (préfixe + corps), pas seulement les préfixes que les librairies citent :
# AIza… = clé API Google ; sb_secret_… = clé secrète Supabase ; JWT dont le rôle est service_role.
PATTERNS=(
  'GEMINI_API_KEY'
  'generativelanguage\.googleapis\.com'
  'SUPABASE_SERVICE_ROLE_KEY'
  'AIza[0-9A-Za-z_-]{35}'
  'sb_secret_[0-9A-Za-z_-]{20,}'
  'eyJ[0-9A-Za-z_-]{10,}\.eyJ[0-9A-Za-z_-]*c2VydmljZV9yb2xl'
)
for pattern in "${PATTERNS[@]}"; do
  if grep -raEq "$pattern" "$OUT"; then
    echo "❌ Trouvé dans le bundle : $pattern"
    FOUND=1
  fi
done
if [[ -f .env ]] && grep -q "service_role" .env; then
  echo "❌ .env contient une clé service_role : ne mets que l'URL et la clé anon."
  FOUND=1
fi
[[ $FOUND -eq 0 ]] && echo "✅ Aucun secret dans le bundle de l'app."
exit $FOUND
