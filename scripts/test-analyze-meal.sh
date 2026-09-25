#!/usr/bin/env bash
# Teste l'Edge Function analyze-meal avec curl.
#
# Usage :
#   scripts/test-analyze-meal.sh photo.jpg ["indice facultatif"]
#
# Variables (lues aussi depuis .env à la racine) :
#   EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY   obligatoires
#   TEST_EMAIL, TEST_PASSWORD   compte de test ; sans eux, un invité est créé (1 scan/jour)
#   REPEAT=3                    envoie N scans d'affilée (vérifie le refus du 3e scan gratuit)
#   SCAN_ID=… ANSWER="…"        relance d'un scan en répondant à sa première question
#   QUESTION="…"                texte de la question (facultatif, pour le contexte)
#
# Prérequis : bash, curl, base64. L'image doit être un JPEG (idéalement ≤ 1024 px).

set -euo pipefail

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

URL="${EXPO_PUBLIC_SUPABASE_URL:?Renseigne EXPO_PUBLIC_SUPABASE_URL (fichier .env)}"
ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:?Renseigne EXPO_PUBLIC_SUPABASE_ANON_KEY (fichier .env)}"
IMAGE="${1:?Usage : $0 photo.jpg [\"indice\"]}"
HINT="${2:-}"
REPEAT="${REPEAT:-1}"

[[ -f "$IMAGE" ]] || { echo "Image introuvable : $IMAGE" >&2; exit 1; }

# Échappe une chaîne pour l'insérer dans du JSON.
json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/ }"
  printf '%s' "$s"
}

# Extrait un champ texte simple d'une réponse JSON (sans jq).
json_field() {
  sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p" | head -n 1
}

# 1. Jeton utilisateur : compte de test ou nouvel invité.
if [[ -n "${TEST_EMAIL:-}" && -n "${TEST_PASSWORD:-}" ]]; then
  echo "→ Connexion avec $TEST_EMAIL"
  AUTH=$(curl -sS "$URL/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
    -d "{\"email\":\"$(json_escape "$TEST_EMAIL")\",\"password\":\"$(json_escape "$TEST_PASSWORD")\"}")
else
  echo "→ Création d'un utilisateur invité (quota : 1 scan par jour)"
  AUTH=$(curl -sS "$URL/auth/v1/signup" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d '{}')
fi
TOKEN=$(printf '%s' "$AUTH" | json_field access_token)
if [[ -z "$TOKEN" ]]; then
  echo "Échec de l'authentification : $AUTH" >&2
  exit 1
fi

# 2. Corps de la requête, écrit dans un fichier (l'image est trop grosse pour la ligne de commande).
BODY=$(mktemp)
trap 'rm -f "$BODY"' EXIT
IMAGE_B64=$(base64 < "$IMAGE" | tr -d '\n\r')
if [[ "$IMAGE_B64" != /9j/* ]]; then
  echo "L'image doit être un JPEG." >&2
  exit 1
fi
{
  printf '{"image_base64":"%s"' "$IMAGE_B64"
  [[ -n "$HINT" ]] && printf ',"hint":"%s"' "$(json_escape "$HINT")"
  if [[ -n "${SCAN_ID:-}" ]]; then
    printf ',"scan_id":"%s","answers":[{"question":"%s","answer":"%s"}]' \
      "$(json_escape "$SCAN_ID")" "$(json_escape "${QUESTION:-Question}")" "$(json_escape "${ANSWER:?ANSWER requis avec SCAN_ID}")"
  fi
  printf '}'
} > "$BODY"
echo "→ Image : $(wc -c < "$IMAGE" | tr -d ' ') octets"

# 3. Appel(s) de la fonction.
for ((i = 1; i <= REPEAT; i++)); do
  echo
  echo "=== Scan $i / $REPEAT ==="
  RESPONSE=$(curl -sS -w '\n%{http_code} %{time_total}s' "$URL/functions/v1/analyze-meal" \
    -H "Authorization: Bearer $TOKEN" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
    --data-binary @"$BODY")
  STATUS_LINE=$(printf '%s' "$RESPONSE" | tail -n 1)
  echo "HTTP $STATUS_LINE"
  printf '%s' "$RESPONSE" | sed '$d' | { command -v node >/dev/null && node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.stringify(JSON.parse(s),null,2))}catch{console.log(s)}})' || cat; }
done
