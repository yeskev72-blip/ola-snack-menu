// Edge Function analyze-meal : version en un seul fichier pour l'éditeur du tableau de bord Supabase.
// GÉNÉRÉ par scripts/build-dashboard-files.sh depuis supabase/functions/analyze-meal. Ne pas modifier à la main.
// Réglage requis : « Verify JWT » désactivé (le jeton est vérifié dans le code).
// supabase/functions/analyze-meal/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

// supabase/functions/_shared/gemini.ts
var GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
var emptyUsage = {
  promptTokens: null,
  outputTokens: null,
  thoughtsTokens: null,
  totalTokens: null
};
function readUsage(body) {
  const u = body?.usageMetadata;
  if (!u) return emptyUsage;
  const n = (v) => typeof v === "number" ? v : null;
  return {
    promptTokens: n(u.promptTokenCount),
    outputTokens: n(u.candidatesTokenCount),
    thoughtsTokens: n(u.thoughtsTokenCount),
    totalTokens: n(u.totalTokenCount)
  };
}
function errorMessage(body) {
  const error = body?.error;
  if (!error?.message) return null;
  const violations = (error.details ?? []).flatMap((d) => d.fieldViolations ?? []).map((v) => [
    v.field,
    v.description
  ].filter(Boolean).join(" : ")).filter((v) => v !== "");
  return violations.length ? `${error.message} (${violations.join(" ; ")})` : error.message;
}
function buildGeminiBody(config, req) {
  return {
    systemInstruction: {
      parts: [
        {
          text: req.systemPrompt
        }
      ]
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: req.imageBase64
            }
          },
          {
            text: req.userText
          }
        ]
      }
    ],
    generationConfig: config.simple ? {
      responseMimeType: "application/json",
      maxOutputTokens: config.maxOutputTokens
    } : {
      responseMimeType: "application/json",
      responseSchema: req.responseSchema,
      ...config.temperature === null ? {} : {
        temperature: config.temperature
      },
      maxOutputTokens: config.maxOutputTokens,
      ...config.thinkingLevel === null ? {} : {
        thinkingConfig: {
          thinkingLevel: config.thinkingLevel
        }
      }
    }
  };
}
async function callGemini(config, req, fetchImpl = fetch) {
  const started = Date.now();
  const elapsed = () => Date.now() - started;
  let response;
  try {
    response = await fetchImpl(`${config.apiBase}/${encodeURIComponent(config.model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.apiKey
      },
      body: JSON.stringify(buildGeminiBody(config, req)),
      signal: AbortSignal.timeout(config.timeoutMs)
    });
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return {
      ok: false,
      error: timeout ? "timeout" : `r\xE9seau : ${String(e)}`,
      retryable: true,
      overloaded: true,
      usage: emptyUsage,
      latencyMs: elapsed(),
      model: config.model
    };
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
  }
  const usage = readUsage(body);
  if (!response.ok) {
    const message = errorMessage(body) ?? response.statusText;
    return {
      ok: false,
      error: `HTTP ${response.status} : ${message}`.slice(0, 500),
      retryable: response.status === 429 || response.status >= 500,
      overloaded: response.status === 429 || response.status >= 500,
      usage,
      latencyMs: elapsed(),
      model: config.model
    };
  }
  const candidate = body?.candidates?.[0];
  const text = candidate?.content?.parts?.filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text).join("");
  if (!text) {
    const reason = candidate?.finishReason ?? body?.promptFeedback?.blockReason;
    return {
      ok: false,
      error: `r\xE9ponse vide (${reason ?? "inconnu"})`,
      retryable: true,
      usage,
      latencyMs: elapsed(),
      model: config.model
    };
  }
  return {
    ok: true,
    text,
    usage,
    latencyMs: elapsed(),
    model: config.model
  };
}
var defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function callGeminiResilient(configs, req, options) {
  const sleep = options.sleep ?? defaultSleep;
  const started = Date.now();
  const remaining = () => options.budgetMs - (Date.now() - started);
  const MIN_CALL_MS = 5e3;
  let last = null;
  let anyOverloaded = false;
  const failures = [];
  const failure = () => {
    const final = failures.pop();
    return {
      ...final,
      ...anyOverloaded ? {
        overloaded: true
      } : {},
      earlierFailures: failures
    };
  };
  for (const config of configs) {
    for (let attempt = 0; attempt <= options.retryDelaysMs.length; attempt++) {
      if (attempt > 0) {
        const delay = options.retryDelaysMs[attempt - 1];
        if (remaining() - delay < MIN_CALL_MS) break;
        await sleep(delay);
      }
      if (last && remaining() < MIN_CALL_MS) return failure();
      const timeoutMs = () => Math.min(config.timeoutMs, Math.max(remaining(), MIN_CALL_MS));
      let result = await callGemini({
        ...config,
        timeoutMs: timeoutMs()
      }, req, options.fetchImpl);
      if (!result.ok && !config.simple && result.error.startsWith("HTTP 400") && remaining() >= MIN_CALL_MS) {
        failures.push(result);
        options.onFailure?.(result);
        result = await callGemini({
          ...config,
          simple: true,
          timeoutMs: timeoutMs()
        }, req, options.fetchImpl);
      }
      if (result.ok) return {
        ...result,
        earlierFailures: failures
      };
      last = result;
      failures.push(result);
      if (result.overloaded) anyOverloaded = true;
      options.onFailure?.(result);
      if (!result.overloaded || result.error === "timeout") break;
    }
  }
  return failure();
}

// supabase/functions/_shared/analysis.ts
var OTHER_FOOD_KEY = "autre";
var LIMITS = {
  /** ~1,5 Mo de JPEG une fois décodé (la photo est compressée à 1024 px côté app). */
  maxImageBase64Length: 2e6,
  maxHintLength: 300,
  maxAnswers: 2,
  maxAnswerLength: 200,
  maxItems: 12,
  maxQuestions: 2,
  minGrams: 1,
  maxGrams: 2e3
};
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);
function parseRequest(body) {
  if (!isRecord(body)) return {
    ok: false,
    error: "Corps JSON attendu."
  };
  const image = body.image_base64;
  if (typeof image !== "string" || image.length === 0) return {
    ok: false,
    error: "image_base64 manquant."
  };
  if (image.length > LIMITS.maxImageBase64Length) return {
    ok: false,
    error: "Image trop lourde."
  };
  if (!image.startsWith("/9j/")) return {
    ok: false,
    error: "Image JPEG attendue (base64 sans pr\xE9fixe data:)."
  };
  let hint = null;
  if (body.hint !== void 0 && body.hint !== null) {
    if (typeof body.hint !== "string") return {
      ok: false,
      error: "hint doit \xEAtre un texte."
    };
    hint = body.hint.trim().slice(0, LIMITS.maxHintLength) || null;
  }
  let scanId = null;
  const answers = [];
  if (body.scan_id !== void 0 && body.scan_id !== null) {
    if (typeof body.scan_id !== "string" || !UUID_RE.test(body.scan_id)) return {
      ok: false,
      error: "scan_id invalide."
    };
    scanId = body.scan_id;
    if (!Array.isArray(body.answers) || body.answers.length === 0 || body.answers.length > LIMITS.maxAnswers) {
      return {
        ok: false,
        error: `La relance demande 1 \xE0 ${LIMITS.maxAnswers} r\xE9ponses.`
      };
    }
    for (const a of body.answers) {
      if (!isRecord(a) || typeof a.question !== "string" || typeof a.answer !== "string" || !a.answer.trim()) {
        return {
          ok: false,
          error: "R\xE9ponse invalide."
        };
      }
      answers.push({
        question: a.question.trim().slice(0, LIMITS.maxAnswerLength),
        answer: a.answer.trim().slice(0, LIMITS.maxAnswerLength)
      });
    }
  } else if (body.answers !== void 0) {
    return {
      ok: false,
      error: "answers exige scan_id."
    };
  }
  return {
    ok: true,
    value: {
      imageBase64: image,
      hint,
      scanId,
      answers
    }
  };
}
async function imageFingerprint(imageBase64) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(imageBase64));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
function foodLine(f) {
  const aliases = f.aliases.length ? ` (aussi : ${f.aliases.join(", ")})` : "";
  const reperes = Object.entries(f.portion_reperes).map(([name, grams]) => `${name} \u2248 ${grams} g`).join(", ");
  return `- ${f.food_key} : ${f.label_fr}${aliases}${reperes ? ` [${reperes}]` : ""}`;
}
function buildSystemPrompt(foods) {
  return `Tu es un assistant nutritionniste sp\xE9cialis\xE9 dans la cuisine d'Afrique de l'Ouest (B\xE9nin, Togo, C\xF4te d'Ivoire, S\xE9n\xE9gal, Nigeria, Ghana). Tu analyses la photo d'un repas pour identifier chaque \xE9l\xE9ment et estimer sa quantit\xE9 en grammes. Tu ne calcules pas les calories des aliments de la liste : l'application les calcule avec sa propre table.

R\xC8GLES

1. Liste de r\xE9f\xE9rence. Pour chaque \xE9l\xE9ment, choisis en priorit\xE9 un food_key de la liste ci-dessous (cl\xE9 : libell\xE9, autres noms, [rep\xE8res de portion]). Utilise \xAB ${OTHER_FOOD_KEY} \xBB seulement si aucun \xE9l\xE9ment de la liste ne correspond raisonnablement ; donne alors un libell\xE9 pr\xE9cis et une estimation pour 100 g dans estimate_100g. Pour un \xE9l\xE9ment de la liste, estimate_100g vaut null.

2. Indice de l'utilisateur. S'il d\xE9crit le plat, consid\xE8re-le comme fiable en cas de doute visuel (par exemple une sauce brune qu'il appelle \xAB sauce arachide \xBB). S'il contredit clairement la photo, suis la photo et baisse la confiance.

3. Sauces et huile, souvent invisibles. Compte chaque sauce comme un \xE9l\xE9ment s\xE9par\xE9 du f\xE9culent qu'elle accompagne, m\xEAme si elle est en partie cach\xE9e dessous. Compte l'huile de cuisson (huile_palme ou huile_vegetale) comme un \xE9l\xE9ment s\xE9par\xE9 quand elle se voit en exc\xE8s : flaque, couche d'huile en surface, aliments luisants. Les plats frits et les sauces de la liste incluent d\xE9j\xE0 leur huile de cuisson normale : n'ajoute de l'huile que pour l'exc\xE8s visible, pour ne pas la compter deux fois.

4. Portions. Estime les grammes \xE0 partir de rep\xE8res visibles : taille de l'assiette (assiette plate courante \u2248 24 \xE0 26 cm, bol \u2248 15 cm), couverts, main, emballage. Appuie-toi sur les rep\xE8res de portion de la liste. Une portion est rarement au-dessus de ${LIMITS.maxGrams} g.

5. N'invente pas. Si un \xE9l\xE9ment important est incertain (aliment cach\xE9, sauce ambigu\xEB, quantit\xE9 impossible \xE0 juger), baisse sa confidence et pose au plus ${LIMITS.maxQuestions} questions courtes, chacune avec 2 \xE0 4 r\xE9ponses possibles, uniquement si la r\xE9ponse change nettement les calories. Exemple : \xAB Sauce \xE0 l'huile de palme ou \xE0 la tomate ? \xBB. Si tout est clair, ne pose aucune question.

6. Confiance. confidence (0 \xE0 1) par \xE9l\xE9ment ; confidence_globale (0 \xE0 1) refl\xE8te l'incertitude sur le total de calories du repas.

7. Si la photo ne montre pas de nourriture, renvoie not_food = true, sans \xE9l\xE9ments ni questions.

8. R\xE9ponds uniquement avec un objet JSON de cette forme exacte, sans texte autour. Libell\xE9s et questions en fran\xE7ais simple.
{"not_food": false, "items": [{"food_key": "<cl\xE9 de la liste ou ${OTHER_FOOD_KEY}>", "label": "<libell\xE9>", "grams": <nombre>, "confidence": <0 \xE0 1>, "estimate_100g": null ou {"kcal": <nombre>, "proteines": <nombre>, "glucides": <nombre>, "lipides": <nombre>}}], "questions": [{"id": "<identifiant court>", "text": "<question>", "options": ["<r\xE9ponse>", "<r\xE9ponse>"]}], "confidence_globale": <0 \xE0 1>}
Au plus ${LIMITS.maxItems} \xE9l\xE9ments.

LISTE DE R\xC9F\xC9RENCE
${foods.map(foodLine).join("\n")}`;
}
function buildUserText(req) {
  const lines = [
    "Analyse ce repas."
  ];
  lines.push(req.hint ? `Indice de l'utilisateur : \xAB ${req.hint} \xBB` : "L'utilisateur n'a pas donn\xE9 d'indice.");
  if (req.answers.length) {
    lines.push("R\xE9ponses de l'utilisateur \xE0 tes questions pr\xE9c\xE9dentes :");
    for (const a of req.answers) lines.push(`- ${a.question} \u2192 ${a.answer}`);
    lines.push("Refais l\u2019analyse compl\xE8te en tenant compte de ces r\xE9ponses. Ne pose plus de question.");
  }
  return lines.join("\n");
}
function buildResponseSchema(foodKeys) {
  const estimate = {
    type: "OBJECT",
    nullable: true,
    properties: {
      kcal: {
        type: "NUMBER"
      },
      proteines: {
        type: "NUMBER"
      },
      glucides: {
        type: "NUMBER"
      },
      lipides: {
        type: "NUMBER"
      }
    },
    required: [
      "kcal",
      "proteines",
      "glucides",
      "lipides"
    ]
  };
  return {
    type: "OBJECT",
    properties: {
      not_food: {
        type: "BOOLEAN"
      },
      items: {
        type: "ARRAY",
        maxItems: LIMITS.maxItems,
        items: {
          type: "OBJECT",
          properties: {
            food_key: {
              type: "STRING",
              enum: [
                ...foodKeys,
                OTHER_FOOD_KEY
              ]
            },
            label: {
              type: "STRING"
            },
            grams: {
              type: "NUMBER"
            },
            confidence: {
              type: "NUMBER"
            },
            estimate_100g: estimate
          },
          required: [
            "food_key",
            "label",
            "grams",
            "confidence",
            "estimate_100g"
          ],
          propertyOrdering: [
            "food_key",
            "label",
            "grams",
            "confidence",
            "estimate_100g"
          ]
        }
      },
      questions: {
        type: "ARRAY",
        maxItems: LIMITS.maxQuestions,
        items: {
          type: "OBJECT",
          properties: {
            id: {
              type: "STRING"
            },
            text: {
              type: "STRING"
            },
            options: {
              type: "ARRAY",
              minItems: 2,
              maxItems: 4,
              items: {
                type: "STRING"
              }
            }
          },
          required: [
            "id",
            "text",
            "options"
          ]
        }
      },
      confidence_globale: {
        type: "NUMBER"
      }
    },
    required: [
      "not_food",
      "items",
      "questions",
      "confidence_globale"
    ],
    propertyOrdering: [
      "not_food",
      "items",
      "questions",
      "confidence_globale"
    ]
  };
}
var clamp = (v, min, max) => Math.min(max, Math.max(min, v));
var round1 = (v) => Math.round(v * 10) / 10;
var round2 = (v) => Math.round(v * 100) / 100;
function parseEstimate(v) {
  if (!isRecord(v)) return null;
  const { kcal, proteines, glucides, lipides } = v;
  if (![
    kcal,
    proteines,
    glucides,
    lipides
  ].every((n) => isFiniteNumber(n) && n >= 0)) return null;
  const e = {
    kcal,
    proteines,
    glucides,
    lipides
  };
  if (e.kcal > 900 || e.proteines + e.glucides + e.lipides > 100.5) return null;
  return {
    kcal: round1(e.kcal),
    proteines: round1(e.proteines),
    glucides: round1(e.glucides),
    lipides: round1(e.lipides)
  };
}
function validateModelOutput(text, knownKeys, opts) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: "JSON illisible"
    };
  }
  if (!isRecord(raw)) return {
    ok: false,
    error: "objet attendu"
  };
  if (typeof raw.not_food !== "boolean") return {
    ok: false,
    error: "not_food manquant"
  };
  if (!Array.isArray(raw.items)) return {
    ok: false,
    error: "items manquant"
  };
  if (!Array.isArray(raw.questions)) return {
    ok: false,
    error: "questions manquant"
  };
  if (!isFiniteNumber(raw.confidence_globale)) return {
    ok: false,
    error: "confidence_globale manquant"
  };
  if (raw.not_food) {
    return {
      ok: true,
      value: {
        not_food: true,
        items: [],
        questions: [],
        confidence_globale: 0
      }
    };
  }
  if (raw.items.length === 0) return {
    ok: false,
    error: "aucun \xE9l\xE9ment pour un repas"
  };
  if (raw.items.length > LIMITS.maxItems) return {
    ok: false,
    error: "trop d\u2019\xE9l\xE9ments"
  };
  const items = [];
  for (const [i, it] of raw.items.entries()) {
    if (!isRecord(it)) return {
      ok: false,
      error: `\xE9l\xE9ment ${i} invalide`
    };
    const { food_key, label, grams, confidence } = it;
    if (typeof food_key !== "string" || food_key !== OTHER_FOOD_KEY && !knownKeys.has(food_key)) {
      return {
        ok: false,
        error: `\xE9l\xE9ment ${i} : food_key inconnu`
      };
    }
    if (typeof label !== "string" || !label.trim()) return {
      ok: false,
      error: `\xE9l\xE9ment ${i} : label vide`
    };
    if (!isFiniteNumber(grams) || grams <= 0) return {
      ok: false,
      error: `\xE9l\xE9ment ${i} : grams invalide`
    };
    if (!isFiniteNumber(confidence)) return {
      ok: false,
      error: `\xE9l\xE9ment ${i} : confidence invalide`
    };
    let estimate = null;
    if (food_key === OTHER_FOOD_KEY) {
      estimate = parseEstimate(it.estimate_100g);
      if (!estimate) return {
        ok: false,
        error: `\xE9l\xE9ment ${i} : estimate_100g requis pour \xAB autre \xBB`
      };
    }
    items.push({
      food_key,
      label: label.trim().slice(0, 120),
      grams: round1(clamp(grams, LIMITS.minGrams, LIMITS.maxGrams)),
      confidence: round2(clamp(confidence, 0, 1)),
      estimate_100g: estimate
    });
  }
  const questions = [];
  if (opts.allowQuestions) {
    for (const [i, q] of raw.questions.slice(0, LIMITS.maxQuestions).entries()) {
      if (!isRecord(q) || typeof q.text !== "string" || !q.text.trim() || !Array.isArray(q.options)) {
        return {
          ok: false,
          error: `question ${i} invalide`
        };
      }
      const options = q.options.filter((o) => typeof o === "string" && o.trim() !== "").map((o) => o.trim());
      if (options.length < 2) return {
        ok: false,
        error: `question ${i} : au moins 2 options`
      };
      questions.push({
        id: typeof q.id === "string" && q.id.trim() ? q.id.trim().slice(0, 40) : `q${i + 1}`,
        text: q.text.trim().slice(0, 200),
        options: options.slice(0, 4).map((o) => o.slice(0, 80))
      });
    }
  }
  return {
    ok: true,
    value: {
      not_food: false,
      items,
      questions,
      confidence_globale: round2(clamp(raw.confidence_globale, 0, 1))
    }
  };
}

// supabase/functions/analyze-meal/handler.ts
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS
    }
  });
}
function fail(status, error, message, extra = {}) {
  return json(status, {
    error,
    message,
    ...extra
  });
}
function createHandler(deps) {
  return async function handle(req) {
    if (req.method === "OPTIONS") return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
    if (req.method !== "POST") return fail(405, "method_not_allowed", "Utilise POST.");
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
    const user = token ? await deps.getUser(token).catch(() => null) : null;
    if (!user) return fail(401, "unauthorized", "Connexion requise.");
    let body;
    try {
      body = await req.json();
    } catch {
      return fail(400, "bad_request", "Corps JSON invalide.");
    }
    const parsed = parseRequest(body);
    if (!parsed.ok) return fail(400, "bad_request", parsed.error);
    const request = parsed.value;
    const isFollowUp = request.scanId !== null;
    let scanId = request.scanId ?? "";
    let quota = null;
    let charged = false;
    const refund = async () => {
      if (!charged) return;
      try {
        if (isFollowUp) await deps.releaseFollowUp(scanId);
        else await deps.releaseScan(user.id);
      } catch (e) {
        deps.log("remboursement impossible", {
          scanId,
          error: String(e)
        });
      }
    };
    try {
      const fingerprint = await imageFingerprint(request.imageBase64);
      if (isFollowUp) {
        if (!await deps.claimFollowUp(scanId, user.id, fingerprint)) {
          return fail(409, "follow_up_not_allowed", "Cette analyse a d\xE9j\xE0 \xE9t\xE9 relanc\xE9e ou a expir\xE9. Refais un scan.");
        }
        charged = true;
      } else {
        quota = await deps.consumeScan(user.id);
        if (!quota.allowed) {
          const message = user.isAnonymous ? "Tu as utilis\xE9 ton scan gratuit du jour. Cr\xE9e un compte pour en avoir 3 par jour." : `Tu as utilis\xE9 tes ${quota.quota} scans d'aujourd'hui. Reviens demain !`;
          return fail(429, "quota_exceeded", message, {
            quota: {
              used: quota.used,
              quota: quota.quota,
              remaining: 0
            }
          });
        }
        charged = true;
        scanId = await deps.createScan(user.id, fingerprint);
      }
    } catch (e) {
      deps.log("erreur quota", {
        error: String(e)
      });
      await refund();
      return fail(500, "internal_error", "Erreur du serveur. Ton scan n'a pas \xE9t\xE9 d\xE9compt\xE9, r\xE9essaie.");
    }
    try {
      const foods = await deps.loadFoods();
      const knownKeys = new Set(foods.map((f) => f.food_key));
      const geminiRequest = {
        systemPrompt: buildSystemPrompt(foods),
        userText: buildUserText(request),
        imageBase64: request.imageBase64,
        responseSchema: buildResponseSchema([
          ...knownKeys
        ])
      };
      let analysis = null;
      let overloaded = false;
      for (let attempt = 1; attempt <= deps.maxAttempts && !analysis; attempt++) {
        const result = await deps.gemini(geminiRequest);
        overloaded = !result.ok && result.overloaded === true;
        let error = null;
        let retryable = false;
        if (result.ok) {
          const validated = validateModelOutput(result.text, knownKeys, {
            allowQuestions: !isFollowUp
          });
          if (validated.ok) analysis = validated.value;
          else {
            error = `r\xE9ponse invalide : ${validated.error}`;
            retryable = true;
          }
        } else {
          error = result.error;
          retryable = result.retryable;
        }
        const kind = isFollowUp ? "follow_up" : "initial";
        const logs = (result.earlierFailures ?? []).map((f) => ({
          scanId,
          userId: user.id,
          kind,
          attempt,
          model: f.model ?? deps.model,
          result: f,
          error: f.ok ? null : f.error
        }));
        logs.push({
          scanId,
          userId: user.id,
          kind,
          attempt,
          model: result.model ?? deps.model,
          result,
          error
        });
        for (const log of logs) {
          await deps.logCall(log).catch((e) => deps.log("journalisation des tokens impossible", {
            error: String(e)
          }));
        }
        if (error) deps.log("\xE9chec Gemini", {
          scanId,
          attempt,
          error
        });
        if (!analysis && (!retryable || overloaded)) break;
      }
      if (!analysis) {
        await refund();
        if (overloaded) {
          return fail(503, "ai_busy", "Le service d'analyse est satur\xE9 en ce moment. Ton scan n'a pas \xE9t\xE9 d\xE9compt\xE9 : r\xE9essaie dans une minute.");
        }
        return fail(502, "analysis_failed", "L'analyse n'a pas abouti. Ton scan n'a pas \xE9t\xE9 d\xE9compt\xE9, r\xE9essaie.");
      }
      const photoPath = isFollowUp ? null : await deps.storePhoto(user, scanId, request.imageBase64).catch(() => null);
      const response = {
        ...analysis,
        scan_id: scanId,
        follow_up_allowed: !isFollowUp && analysis.questions.length > 0,
        quota: quota ? {
          used: quota.used,
          quota: quota.quota,
          remaining: Math.max(quota.quota - quota.used, 0)
        } : null,
        photo_path: photoPath
      };
      return json(200, response);
    } catch (e) {
      deps.log("erreur inattendue", {
        scanId,
        error: String(e)
      });
      await refund();
      return fail(500, "internal_error", "Erreur du serveur. Ton scan n'a pas \xE9t\xE9 d\xE9compt\xE9, r\xE9essaie.");
    }
  };
}

// supabase/functions/analyze-meal/index.ts
function env(name, fallback) {
  const value = Deno.env.get(name) ?? fallback;
  if (value === void 0 || value === "") throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}
function parseTemperature(raw) {
  if (raw === "default") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 2) throw new Error("GEMINI_TEMPERATURE invalide");
  return value;
}
var THINKING_LEVELS = [
  "minimal",
  "low",
  "medium",
  "high"
];
var thinkingLevel = env("GEMINI_THINKING_LEVEL", "low");
if (!THINKING_LEVELS.includes(thinkingLevel)) throw new Error("GEMINI_THINKING_LEVEL invalide");
var geminiConfig = {
  apiKey: env("GEMINI_API_KEY"),
  apiBase: env("GEMINI_API_BASE", GEMINI_API_BASE),
  model: env("GEMINI_MODEL", "gemini-flash-lite-latest"),
  temperature: parseTemperature(env("GEMINI_TEMPERATURE", "0.3")),
  thinkingLevel,
  maxOutputTokens: 4096,
  timeoutMs: 45e3
};
var fallbackConfigs = env("GEMINI_FALLBACK_MODELS", "gemini-flash-latest").split(",").map((m) => m.trim()).filter((m) => m !== "" && m !== "none" && m !== geminiConfig.model).map((model) => ({
  ...geminiConfig,
  model,
  thinkingLevel: null
}));
var modelChain = [
  geminiConfig,
  ...fallbackConfigs
];
var storePhotos = env("STORE_PHOTOS", "false") === "true";
var admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
function decodeBase64(data) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
var handler = createHandler({
  model: geminiConfig.model,
  maxAttempts: 2,
  async getUser(token) {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return null;
    return {
      id: data.user.id,
      isAnonymous: data.user.is_anonymous ?? false
    };
  },
  async consumeScan(userId) {
    const { data, error } = await admin.rpc("consume_scan", {
      p_user_id: userId
    }).single();
    if (error) throw error;
    return data;
  },
  async releaseScan(userId) {
    const { error } = await admin.rpc("release_scan", {
      p_user_id: userId
    });
    if (error) throw error;
  },
  async createScan(userId, imageSha256) {
    const { data, error } = await admin.from("scans").insert({
      user_id: userId,
      image_sha256: imageSha256
    }).select("id").single();
    if (error) throw error;
    return data.id;
  },
  async claimFollowUp(scanId, userId, imageSha256) {
    const { data, error } = await admin.rpc("claim_follow_up", {
      p_scan_id: scanId,
      p_user_id: userId,
      p_image_sha256: imageSha256
    });
    if (error) throw error;
    return data === true;
  },
  async releaseFollowUp(scanId) {
    const { error } = await admin.rpc("release_follow_up", {
      p_scan_id: scanId
    });
    if (error) throw error;
  },
  async loadFoods() {
    const { data, error } = await admin.from("foods").select("food_key, label_fr, aliases, portion_reperes").order("food_key");
    if (error) throw error;
    return data;
  },
  // Modèle saturé : 3 essais espacés (1 s puis 3 s), puis les modèles de secours ; réponse en moins de 50 s
  // pour rester sous le délai de l'app (60 s).
  gemini: (req) => callGeminiResilient(modelChain, req, {
    retryDelaysMs: [
      1e3,
      3e3
    ],
    budgetMs: 5e4,
    onFailure: (r) => !r.ok && console.error(JSON.stringify({
      message: "essai Gemini en \xE9chec",
      model: r.model,
      error: r.error
    }))
  }),
  async logCall({ scanId, userId, kind, attempt, model, result, error }) {
    const { error: dbError } = await admin.from("scan_calls").insert({
      scan_id: scanId,
      user_id: userId,
      kind,
      attempt,
      model,
      ok: error === null,
      error,
      prompt_tokens: result.usage.promptTokens,
      output_tokens: result.usage.outputTokens,
      thoughts_tokens: result.usage.thoughtsTokens,
      total_tokens: result.usage.totalTokens,
      latency_ms: result.latencyMs
    });
    if (dbError) throw dbError;
    console.log(JSON.stringify({
      event: "gemini_call",
      scanId,
      userId,
      kind,
      attempt,
      ok: error === null,
      ...result.usage,
      latencyMs: result.latencyMs
    }));
  },
  async storePhoto(user, scanId, imageBase64) {
    if (!storePhotos || user.isAnonymous) return null;
    const { data: profile } = await admin.from("profiles").select("partage_photos").eq("id", user.id).single();
    if (!profile?.partage_photos) return null;
    const path = `${user.id}/${scanId}.jpg`;
    const { error } = await admin.storage.from("meal-photos").upload(path, decodeBase64(imageBase64), {
      contentType: "image/jpeg",
      upsert: true
    });
    if (error) throw error;
    await admin.from("scans").update({
      photo_path: path
    }).eq("id", scanId);
    return path;
  },
  log: (message, extra) => console.error(JSON.stringify({
    message,
    ...extra
  }))
});
Deno.serve(handler);
