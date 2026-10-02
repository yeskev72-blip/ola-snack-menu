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
      if (!result.overloaded || result.error === "timeout" || result.error.startsWith("HTTP 429")) break;
    }
  }
  return failure();
}

// supabase/functions/_shared/gateway.ts
var RODIUM_API_BASE = "https://api.rodiumai.io/v1";
var emptyUsage2 = {
  promptTokens: null,
  outputTokens: null,
  thoughtsTokens: null,
  totalTokens: null
};
function readUsage2(body) {
  const u = body?.usage;
  if (!u) return emptyUsage2;
  const n = (v) => typeof v === "number" ? v : null;
  return {
    promptTokens: n(u.prompt_tokens),
    outputTokens: n(u.completion_tokens),
    thoughtsTokens: null,
    totalTokens: n(u.total_tokens)
  };
}
function errorMessage2(body) {
  return body?.error?.message ?? null;
}
function buildGatewayBody(config, req) {
  return {
    model: config.model,
    messages: [
      {
        role: "system",
        content: req.systemPrompt
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: req.userText
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${req.imageBase64}`
            }
          }
        ]
      }
    ],
    response_format: {
      type: "json_object"
    },
    max_tokens: config.maxOutputTokens
  };
}
async function callGateway(config, req, fetchImpl = fetch) {
  const started = Date.now();
  const elapsed = () => Date.now() - started;
  let response;
  try {
    response = await fetchImpl(`${config.apiBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        // Identifie l'app dans le tableau de bord des passerelles qui le lisent ; ignoré par les autres.
        "HTTP-Referer": "https://github.com/yeskev72-blip/ola-snack-menu",
        "X-Title": "Calbasse"
      },
      body: JSON.stringify(buildGatewayBody(config, req)),
      signal: AbortSignal.timeout(config.timeoutMs)
    });
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return {
      ok: false,
      error: timeout ? "timeout" : `r\xE9seau : ${String(e)}`,
      retryable: true,
      overloaded: true,
      usage: emptyUsage2,
      latencyMs: elapsed(),
      model: config.model
    };
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
  }
  const usage = readUsage2(body);
  if (!response.ok) {
    const message = errorMessage2(body) ?? response.statusText;
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
  const choice = body?.choices?.[0];
  const text = choice?.message?.content;
  if (!text) {
    return {
      ok: false,
      error: `r\xE9ponse vide (${choice?.finish_reason ?? "inconnu"})`,
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
var defaultSleep2 = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function callGatewayResilient(configs, req, options) {
  const sleep = options.sleep ?? defaultSleep2;
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
      const timeoutMs = Math.min(config.timeoutMs, Math.max(remaining(), MIN_CALL_MS));
      const result = await callGateway({
        ...config,
        timeoutMs
      }, req, options.fetchImpl);
      if (result.ok) return {
        ...result,
        earlierFailures: failures
      };
      last = result;
      failures.push(result);
      if (result.overloaded) anyOverloaded = true;
      options.onFailure?.(result);
      if (!result.overloaded || result.error === "timeout" || result.error.startsWith("HTTP 429")) break;
    }
  }
  return failure();
}

// supabase/functions/_shared/aspects.ts
var FOOD_ASPECTS = {
  foutou: {
    aspect: "P\xE2te de banane plantain et de manioc pil\xE9s ensemble, beige \xE0 gris-jaune, lisse et \xE9lastique, servie en boule. Teinte plus jaune que les p\xE2tes de c\xE9r\xE9ales.",
    confusions: [
      "igname_pilee \u2014 l'igname pil\xE9e est blanche ; le foutou tire sur le beige jaune.",
      "pate_mais \u2014 la p\xE2te de ma\xEFs est blanche et mate ; le foutou est plus jaune et plus \xE9lastique.",
      "foufou_manioc \u2014 manioc seul, blanc ; le foutou contient de la banane plantain et tire sur le jaune.",
      "telibo \u2014 le t\xE9libo est brun fonc\xE9 \xE0 noir ; le foutou est clair."
    ]
  },
  telibo: {
    aspect: "P\xE2te brun fonc\xE9 \xE0 presque noire, lisse et \xE9lastique, servie en boule ou en portion fa\xE7onn\xE9e \xE0 la main. La couleur sombre vient de la farine de cossettes d'igname s\xE9ch\xE9e.",
    confusions: [
      "pate_mais \u2014 la p\xE2te de ma\xEFs est blanche ou cr\xE8me ; le t\xE9libo est brun fonc\xE9 \xE0 noir.",
      "igname_pilee \u2014 l'igname pil\xE9e fra\xEEche est blanche et brillante ; le t\xE9libo est sombre et plus mat.",
      "amiwo \u2014 l'amiwo est rouge-orang\xE9 (huile, tomate) ; le t\xE9libo tire sur le brun-noir.",
      "eba \u2014 l'eba est cr\xE8me \xE0 jaune et granuleuse ; le t\xE9libo est sombre et lisse."
    ]
  },
  bissap: {
    aspect: "Liquide rouge profond \xE0 rubis, translucide, servi froid en verre, bouteille ou carafe. Pas de gaz visible.",
    confusions: []
  },
  jus_gingembre: {
    aspect: "Liquide jaune p\xE2le \xE0 beige, souvent trouble, servi froid. Description non v\xE9rifi\xE9e sur photo.",
    confusions: []
  },
  soda: {
    aspect: "Bouteille ou canette de marque, liquide color\xE9 (brun, orange, rouge) avec gaz ou mousse. Le contenant de marque est l'indice principal.",
    confusions: []
  },
  riz_blanc: {
    aspect: "Grains longs, blancs, d\xE9tach\xE9s ou l\xE9g\xE8rement coll\xE9s, sans coloration. Servi en tas dans l'assiette.",
    confusions: [
      "attieke \u2014 grains beaucoup plus petits, agglom\xE9r\xE9s, l\xE9g\xE8rement translucides.",
      "riz_jollof \u2014 le riz jollof est color\xE9 rouge-orang\xE9 sur tous les grains ; le riz blanc n'a aucune teinte.",
      "atassi \u2014 l'atassi est m\xEAl\xE9 de haricots visibles et teint\xE9 brun-jaune ou gris.",
      "**accompagnement** : sauces (tomate, arachide, feuilles) pos\xE9es \xE0 c\xF4t\xE9 ou dessus",
      "**noms r\xE9gionaux** : riz nature",
      "**certitude** : basse",
      "**sources** : aucune source"
    ]
  },
  riz_jollof: {
    aspect: "Grains de riz uniform\xE9ment rouge-orang\xE9, cuits dans une sauce tomate \xE0 l'huile, d\xE9tach\xE9s les uns des autres. Les morceaux de viande et de l\xE9gumes (carotte, poivron, haricots verts) sont souvent pos\xE9s dessus.",
    confusions: [
      "thieboudienne \u2014 m\xEAme riz rouge-orang\xE9 ; le thieboudienne porte du poisson (entier ou en gros tron\xE7ons) et de gros morceaux de l\xE9gumes pos\xE9s dessus.",
      "atassi \u2014 riz plus brun, jaune ou gris, avec des haricots entiers visibles, sans teinte tomate.",
      "amiwo \u2014 l'amiwo est une masse compacte de p\xE2te sans grains de riz distincts.",
      "spaghetti \u2014 p\xE2tes longues, pas des grains.",
      "**accompagnement** : poulet, b\u0153uf ou poisson frit ; salade ; dodo (plantain frit)",
      "**noms r\xE9gionaux** : riogla beninwa (B\xE9nin), riz-o-gras (Burkina Faso), zaam\xE8 (Mali), benachin (Gambie), riz wolof, b\xE8nn tchin (S\xE9n\xE9gal), ceebu j\xEBn",
      "**certitude** : moyenne",
      "**sources** : https://fr.wikipedia.org/wiki/Riz_wolof https://www.recettesafricaines.com/recettes/278 https://www.196flavors.com/fr/riz-wolof/ https://en.wikipedia.org/wiki/Jollof_rice"
    ]
  },
  atassi: {
    aspect: "Riz et petits haricots blancs \xE0 \u0153il noir cuits ensemble ; les grains de riz sont teint\xE9s de brun, jaune ou gris, parfois rouge-brun (feuilles de sorgho). Les haricots entiers sont visibles dans les grains.",
    confusions: [
      "riz_jollof \u2014 le jollof est rouge-orang\xE9 uniforme, sans haricots visibles.",
      "riz_blanc \u2014 le riz blanc n'a ni haricots ni teinte.",
      "haricots_niebe \u2014 les haricots seuls n'ont pas de riz m\xEAl\xE9.",
      "**accompagnement** : sauce tomate (dja), \u0153ufs durs, wagashi, poisson ou poulet frit, piment",
      "**noms r\xE9gionaux** : watch\xE9, wak\xE9 (Nord B\xE9nin), ayimolou, ayimonlou, watch\xE9 (Togo), waakye (Ghana), ir\xE8si ati ewa (Nigeria)",
      "**certitude** : moyenne",
      "**sources** : https://kelianfood.com/waakye-rice-ayimolou-atassi/ https://www.miammiambenin.fr/benin-delices/atassi-riz-aux-haricots/ https://visiter-le-benin.com/plat-typique-du-benin-l-atassi/ https://cuisinebeninoiseetdailleurs.com/atassi-watche-le-riz-aux-haricots-blancs-du-nord-benin/"
    ]
  },
  attieke: {
    aspect: "Semoule de manioc en tr\xE8s petits grains, blanc cr\xE8me \xE0 ivoire, l\xE9g\xE8rement translucides, agglom\xE9r\xE9s et un peu collants. Servi en monticule.",
    confusions: [
      "gari \u2014 le gari est sec, grains plus gros, croquants, blancs ou jaunes (huile de palme) ; l'atti\xE9k\xE9 est humide, fin, vapeur.",
      "couscous_mil \u2014 le couscous de mil a des grains roul\xE9s plus ronds, teinte moins claire (non v\xE9rifi\xE9 sur photo).",
      "riz_blanc \u2014 grains de riz plus gros, longs et d\xE9tach\xE9s.",
      "**accompagnement** : poisson brais\xE9, alloco, sauce piment-oignon",
      "**noms r\xE9gionaux** : attoukpou (C\xF4te d'Ivoire, grains accol\xE9s), garba (atti\xE9k\xE9 avec thon frit, C\xF4te d'Ivoire)",
      "**certitude** : moyenne",
      "**sources** : https://fr.wikipedia.org/wiki/Atti%C3%A9k%C3%A9 https://www.ajol.info/index.php/jab/article/view/159072 https://rayons-d-afrique.fr/foufou-plat-africain/"
    ]
  },
  pate_mais: {
    aspect: "P\xE2te blanche \xE0 cr\xE8me, ferme, servie en boule ou en p\xE2ton, sans emballage. Cuite \xE0 l'eau sans huile ni sel, donc sans coloration.",
    confusions: [
      "igname_pilee \u2014 l'igname pil\xE9e est plus lisse et nettement plus \xE9lastique ; la p\xE2te de ma\xEFs est plus mate et ferme.",
      "eba \u2014 l'eba est granuleuse en surface, parfois jaune ; la p\xE2te de ma\xEFs est lisse.",
      "akassa \u2014 l'akassa est un gel lisse, vendu en p\xE2tons envelopp\xE9s de feuilles, l\xE9g\xE8rement acide.",
      "amiwo \u2014 l'amiwo est rouge ou orang\xE9 (huile, tomate) ; la p\xE2te de ma\xEFs est blanche.",
      "foufou_manioc \u2014 tr\xE8s proche \xE0 la photo ; seul le contexte (sauce, r\xE9gion) aide.",
      "**accompagnement** : sauce tomate, sauce arachide, sauces gluantes (gombo, crincrin), sauce feuilles",
      "**noms r\xE9gionaux** : w\u0254\u030C (fon, B\xE9nin), p\xE2te blanche (B\xE9nin), akoum\xE9 (Togo), owo (B\xE9nin), t\xF4 (Burkina Faso, Mali, Niger), ugali (Afrique de l'Est)",
      "**certitude** : moyenne",
      "**sources** : https://fr.wikibooks.org/wiki/Livre_de_cuisine/W%C9%94%CC%8C_(p%C3%A2te_de_ma%C3%AFs) https://atlasculinaire.com/recettes/akassa--18c20828-c519-41ee-8c75-32ebb48a649b https://www.196flavors.com/togo-gboma-dessi-and-akoume/"
    ]
  },
  amiwo: {
    aspect: "P\xE2te de ma\xEFs rouge \xE0 orang\xE9e, cuite dans l'huile avec tomate ou huile de palme ; masse compacte et grasse, servie en boule ou en tas. La teinte rouge est le signe distinctif.",
    confusions: [
      "pate_mais \u2014 la p\xE2te blanche n'a ni huile ni couleur.",
      "riz_jollof \u2014 le jollof montre des grains de riz s\xE9par\xE9s ; l'amiwo est une masse continue.",
      "eba \u2014 l'eba rouge (au palme) est granuleuse ; l'amiwo est plus lisse et gras.",
      "**accompagnement** : viande (poulet, b\u0153uf), parfois poisson fum\xE9, crevettes s\xE9ch\xE9es",
      "**noms r\xE9gionaux** : dj\xE8w\xF4, dj\xE8w\u0254\u030C (fon, B\xE9nin), p\xE2te rouge (B\xE9nin)",
      "**certitude** : haute",
      "**sources** : https://fr.wikipedia.org/wiki/Amiw%C3%B4 https://benin360.com/cuisine-beninoise/ https://visiter-le-benin.com/12-plats-typiques-du-benin/"
    ]
  },
  akassa: {
    aspect: "Gel de ma\xEFs blanc \xE0 beige, ferme et lisse quand il est froid, souvent vendu en p\xE2tons envelopp\xE9s de feuilles (teck, bananier). Peut aussi \xEAtre servi sans emballage, en boule ou en bol.",
    confusions: [
      "pate_mais \u2014 le w\u0254 est cuit sans fermentation, plus ferme ; sans feuille d'emballage.",
      "bouillie_mais \u2014 la bouillie est la m\xEAme base d\xE9lay\xE9e, liquide ; l'akassa est moul\xE9, ferme.",
      "foufou_manioc \u2014 texture \xE9lastique et collante ; l'akassa est un gel net, l\xE9g\xE8rement acide.",
      "**accompagnement** : sauce tomate, sauce poisson ou viande, fromage de soja, bouille de ma\xEFs ; beignets de haricot (akara) en Nigeria",
      "**noms r\xE9gionaux** : gui (fon), kannan (goun), \xE8k\xF2, eko (yoruba, Nigeria), agidi, aguidi (Nigeria), komu (haoussa), kafa (Ghana), akasan (B\xE9nin), akpan (Togo ; au B\xE9nin d\xE9signe plut\xF4t la version bue), makum\xE8 (terme scientifique), lio (variante plus rigide, Abomey et Bohicon)",
      "**certitude** : haute",
      "**sources** : https://fr.wikipedia.org/wiki/Akassa_(p%C3%A2te) https://atlasculinaire.com/recettes/akpan-akassa--f9e8e5e5-0a89-4fed-bb5a-bed75aedd725 https://miniminamiam.com/akassa/ https://www.allnigerianrecipes.com/breakfast-recipes/agidi-eko/ https://en.wikipedia.org/wiki/Agidi"
    ]
  },
  igname_pilee: {
    aspect: "P\xE2te blanche \xE0 cr\xE8me, tr\xE8s lisse, compacte et \xE9lastique, fa\xE7onn\xE9e \xE0 la main en boule ou ovale. La surface est brillante et sans grain visible.",
    confusions: [
      "pate_mais \u2014 plus mate, plus ferme, moins \xE9lastique que l'igname pil\xE9e.",
      "foufou_manioc \u2014 presque indiscernable \xE0 la photo (p\xE2te lisse et \xE9lastique) ; le contexte (r\xE9gion, sauce) est le seul indice.",
      "eba \u2014 l'eba a un grain visible en surface ; l'igname pil\xE9e est parfaitement lisse.",
      "akassa \u2014 gel plus net, souvent envelopp\xE9 de feuilles.",
      "**accompagnement** : sauce arachide, sauce tomate, sauces feuilles, viande, wagashi",
      "**noms r\xE9gionaux** : agoun (centre B\xE9nin), tchokourou (Nord B\xE9nin), foutou (C\xF4te d'Ivoire), iyan (yoruba, Nigeria), pounded yam (Nigeria, Ghana)",
      "**certitude** : moyenne",
      "**sources** : https://eatafrika.com/2023/03/09/agoun-fufu-igname-pilee-au-mortier/ https://aupetitcreuxpace.fr/plats-africains/pounded-yam-cuisine-africaine/ https://eventeliteagency.com/evenementiel/nourriture-et-vin/ https://oukoikan.com/2023/03/14/agoun-accompagne-de-la-sauce-arachide/"
    ]
  },
  foufou_manioc: {
    aspect: "P\xE2te de manioc lisse et \xE9lastique, fa\xE7onn\xE9e en boule ; le placali (manioc ferment\xE9) est de texture g\xE9latineuse et plus fondante. La couleur n'est pas document\xE9e avec certitude (blanc cass\xE9 \xE0 gris).",
    confusions: [
      "igname_pilee \u2014 presque indiscernable ; l'igname pil\xE9e est blanche, tr\xE8s \xE9lastique ; le placali est plus fondant et plus acide.",
      "eba \u2014 l'eba est granuleuse en surface ; le foufou de manioc est lisse.",
      "akassa \u2014 gel de ma\xEFs plus net, souvent emball\xE9 de feuilles.",
      "pate_mais \u2014 plus mate, plus ferme que le foufou de manioc.",
      "**accompagnement** : sauce graine, sauce gombo, sauce arachide",
      "**noms r\xE9gionaux** : placali (C\xF4te d'Ivoire), kokonte (Ghana, p\xE2te de farine de cossettes de manioc), foutou (C\xF4te d'Ivoire)",
      "**certitude** : basse",
      "**sources** : https://www.nkosiagro.com/pages/guide-manioc-attieke-foufou-gari https://www.nkosiagro.com/en/blogs/culture-africaine/placali-pate-manioc-ivoirienne https://kelianfood.com/le-fufu-cest-quoi-origine-les-differents-types-de-fufu-en-afrique/ https://www.ajol.info/index.php/jab/article/view/159072"
    ]
  },
  gari: {
    aspect: "Granules secs de manioc torr\xE9fi\xE9, blanc cr\xE8me, ou jaunes quand de l'huile de palme est ajout\xE9e. Grains irr\xE9guliers, petits, secs et non agglom\xE9r\xE9s.",
    confusions: [
      "attieke \u2014 l'atti\xE9k\xE9 est humide, tr\xE8s fin, cuit \xE0 la vapeur, l\xE9g\xE8rement translucide ; le gari est sec et croquant.",
      "eba \u2014 l'eba est le gari d\xE9j\xE0 m\xE9lang\xE9 \xE0 l'eau chaude, en p\xE2te ; le gari sec reste en grains.",
      "couscous_mil \u2014 grains roul\xE9s plus ronds et plus r\xE9guliers.",
      "**accompagnement** : souvent mang\xE9 avec de l'eau, du sucre, de l'arachide ou du poisson frit ; saupoudr\xE9 sur des sauces",
      "**noms r\xE9gionaux** : garri (Nigeria), gali (B\xE9nin), couac (Guyane, pr\xE9paration voisine)",
      "**certitude** : moyenne",
      "**sources** : https://fr.wikipedia.org/wiki/Gari_(farine) https://rtbfoods.cirad.fr/fr/les-produits/manioc/gari-eba/fiche-d-identite-produit https://lamaisondubenin.com/a-la-decouverte-du-eba-ou-piron/"
    ]
  },
  eba: {
    aspect: "P\xE2te \xE9paisse de gari \xE9bouillant\xE9, cr\xE8me \xE0 jaune (jaune avec gari \xE0 l'huile de palme ou curcuma), l\xE9g\xE8rement granuleuse en surface, fa\xE7onn\xE9e en boule. Elle se d\xE9tache \xE0 la main.",
    confusions: [
      "pate_mais \u2014 p\xE2te de ma\xEFs blanche et lisse ; l'eba est granuleuse et cr\xE8me \xE0 jaune.",
      "igname_pilee \u2014 lisse et brillante ; l'eba a un grain visible.",
      "foufou_manioc \u2014 lisse et \xE9lastique ; l'eba est plus rugueuse.",
      "amiwo \u2014 l'eba rouge au palme est granuleuse ; l'amiwo est une p\xE2te lisse, grasse et rouge.",
      "**accompagnement** : sauce egusi, sauce gombo, sauce tomate, sauce de sang de mouton ou de porc (kp\xE8t\xE8)",
      "**noms r\xE9gionaux** : piron, pinon, pilon, ba (B\xE9nin), eba (Nigeria), piron jaune ou rouge (B\xE9nin)",
      "**certitude** : moyenne",
      "**sources** : https://rtbfoods.cirad.fr/fr/les-produits/manioc/gari-eba/fiche-d-identite-produit https://www.recettes.ci/eba-pate-gari-farine-manioc-torrefiee-nigeria/ https://cuisinebeninoiseetdailleurs.com/piron-jaune-ou-eba-la-recette-express-a-base-de-gari/ https://cheflolaskitchen.com/how-to-make-eba/ https://lamaisondubenin.com/a-la-decouverte-du-eba-ou-piron/"
    ]
  },
  haricots_niebe: {
    aspect: "Petits haricots blancs \xE0 cr\xE8me avec une tache noire (\u0153il), cuits entiers, tendres. Servis en tas, parfois napp\xE9s de sauce tomate ou d'huile.",
    confusions: [
      "atassi \u2014 l'atassi m\xEAle les haricots \xE0 du riz teint\xE9.",
      "beignets_haricot \u2014 les beignets sont frits et form\xE9s ; les haricots cuits restent entiers.",
      "**accompagnement** : sauce tomate (dja), huile de palme, alloco, piment",
      "**noms r\xE9gionaux** : abodo (B\xE9nin), ayikoun (B\xE9nin), cornille, haricot \xE0 \u0153il noir",
      "**certitude** : moyenne",
      "**sources** : https://www.okedjenou.com/recette/le-benga-national-atassi-recette-des-haricots-au-riz/ https://www.elviadelices.fr/products/friture-de-tomates-dja"
    ]
  },
  alloco: {
    aspect: "Rondelles ou tranches de plantain m\xFBr frit, dor\xE9es \xE0 brun fonc\xE9 avec des bords caram\xE9lis\xE9s, fondantes \xE0 l'int\xE9rieur. Surface luisante d'huile.",
    confusions: [
      "plantain_bouilli \u2014 le plantain bouilli est jaune p\xE2le, sans cro\xFBte dor\xE9e ni brillance huileuse.",
      "chips_plantain \u2014 chips fines, s\xE8ches, croustillantes, servies en sachet ; l'alloco est \xE9pais et moelleux.",
      "igname_frite \u2014 l'igname frite est plus claire (chair blanche), moins sucr\xE9e et moins fonc\xE9e.",
      "**accompagnement** : poisson brais\xE9 ou frit, poulet brais\xE9, sauce piment-oignon, haricots",
      "**noms r\xE9gionaux** : dodo (B\xE9nin, Nigeria), amanda (Togo), missol\xE8, misol\xE9 (Cameroun), makemba (RDC), kelewele (Ghana, version \xE9pic\xE9e), loco (S\xE9n\xE9gal), claclo (C\xF4te d'Ivoire, beignet de plantain \xE9cras\xE9)",
      "**certitude** : haute",
      "**sources** : https://fr.wikipedia.org/wiki/Alloco https://fr.wikipedia.org/wiki/Banane_plantain_frite https://aistoucuisine.com/publications/banane-plantain-frite-alloco-dodo-makemba-missole https://www.aux-fourneaux.fr/alokos-alloco-bananes-plantain-frites-55173/"
    ]
  },
  plantain_bouilli: {
    aspect: "Tron\xE7ons de plantain avec ou sans peau, chair jaune p\xE2le, cuite \xE0 l'eau, sans cro\xFBte ni dorure. Description g\xE9n\xE9rale non v\xE9rifi\xE9e sur photo.",
    confusions: [
      "alloco \u2014 l'alloco est dor\xE9, caram\xE9lis\xE9, luisant ; le plantain bouilli est p\xE2le et mat.",
      "igname_bouillie \u2014 la chair de l'igname est blanche \xE0 cr\xE8me et plus dense ; celle du plantain est plus jaune.",
      "manioc_bouilli \u2014 chair de manioc blanche et fibreuse au centre.",
      "banane_douce \u2014 la banane douce est mang\xE9e crue et pel\xE9e, plus petite.",
      "**accompagnement** : sauce tomate, sauce piment, poisson",
      "**noms r\xE9gionaux** : agb\xF4kin (B\xE9nin), plantain cuit",
      "**certitude** : basse",
      "**sources** : https://www.aux-fourneaux.fr/alokos-alloco-bananes-plantain-frites-55173/"
    ]
  },
  igname_bouillie: {
    aspect: "Tron\xE7ons ou rondelles d'igname \xE0 chair blanche \xE0 cr\xE8me (vari\xE9t\xE9 blanche) ou jaune, cuits \xE0 l'eau, tenant leur forme. Peau retir\xE9e.",
    confusions: [
      "plantain_bouilli \u2014 le plantain est plus jaune ; l'igname est plus blanche et farineuse.",
      "manioc_bouilli \u2014 le manioc est plus fibreux, avec une fibre centrale.",
      "igname_pilee \u2014 l'igname pil\xE9e est une p\xE2te lisse ; l'igname bouillie reste en morceaux.",
      "igname_frite \u2014 l'igname frite est dor\xE9e, croustillante.",
      "**accompagnement** : sauce tomate piment\xE9e, huile de palme, sauce piment",
      "**noms r\xE9gionaux** : igname cuite",
      "**certitude** : moyenne",
      "**sources** : https://www.nkosiagro.com/pages/guide-igname-varietes-bienfaits-cuisson https://www.didiermathus.com/igname/"
    ]
  },
  igname_frite: {
    aspect: "Fines tranches ou b\xE2tonnets d'igname frits, dor\xE9s et croustillants \xE0 l'ext\xE9rieur. Chair claire \xE0 l'int\xE9rieur.",
    confusions: [
      "alloco \u2014 l'alloco est plus fonc\xE9, caram\xE9lis\xE9 et plus sucr\xE9 ; l'igname frite est plus claire.",
      "igname_bouillie \u2014 l'igname bouillie n'est ni dor\xE9e ni croustillante.",
      "chips_plantain \u2014 les chips de plantain sont beaucoup plus fines, en sachet.",
      "**accompagnement** : piment, sel, sauce l\xE9g\xE8re",
      "**noms r\xE9gionaux** : dundun (Nigeria), frites d'igname",
      "**certitude** : moyenne",
      "**sources** : https://paulinhassika.over-blog.com/2026/07/igname-un-aliment-qui-porte-la-memoire-les-gestes-et-l-identite-du-benin.html"
    ]
  },
  manioc_bouilli: {
    aspect: "Tron\xE7ons de racine de manioc cuits \xE0 l'eau, chair blanche et fibreuse. Les sources distinguent aussi le b\xE2ton de manioc (bobolo, chikwangue), p\xE2te ferment\xE9e cuite \xE0 la vapeur envelopp\xE9e dans une feuille ; l'aspect n'en est pas v\xE9rifi\xE9 sur photo.",
    confusions: [
      "igname_bouillie \u2014 chair plus farineuse et sans fibre centrale.",
      "plantain_bouilli \u2014 chair plus jaune.",
      "foufou_manioc \u2014 le foufou est une p\xE2te lisse ; le manioc bouilli reste en tron\xE7ons.",
      "**accompagnement** : sauce tomate, sauce arachide, poisson fum\xE9 ; le b\xE2ton de manioc se mange avec le ndol\xE9",
      "**noms r\xE9gionaux** : chikwangue (RDC), bobolo (Cameroun), miondo (Cameroun), kwanga",
      "**certitude** : basse",
      "**sources** : https://fr.wikipedia.org/wiki/Atti%C3%A9k%C3%A9 https://www.recettesafricaine.com/ndole.html"
    ]
  },
  pain: {
    aspect: "Baguette dor\xE9e \xE0 cro\xFBte craquante, int\xE9rieur blanc et a\xE9r\xE9. Servie enti\xE8re, coup\xE9e ou en sandwich.",
    confusions: [
      "**accompagnement** : omelette, bouillie, beignets, haricots",
      "**noms r\xE9gionaux** : pain, baguette",
      "**certitude** : basse",
      "**sources** : aucune source"
    ]
  },
  spaghetti: {
    aspect: "P\xE2tes longues et fines, jaune p\xE2le (nature) ou rouge-orang\xE9 et brillantes quand elles sont saut\xE9es \xE0 la tomate ou \xE0 l'huile. Servies en tas.",
    confusions: [
      "riz_jollof \u2014 grains de riz rouge-orang\xE9, pas de p\xE2tes longues.",
      "riz_blanc \u2014 grains courts, pas de fils.",
      "**accompagnement** : \u0153uf, sauce tomate, poulet frit",
      "**noms r\xE9gionaux** : spaghetti saut\xE9s (Cameroun, C\xF4te d'Ivoire), macaroni",
      "**certitude** : basse",
      "**sources** : https://www.maggi.cm/en/"
    ]
  },
  couscous_mil: {
    aspect: "Petits grains roul\xE9s de farine de mil, cuits \xE0 la vapeur ; thi\xE9r\xE9 est fin, thiakry (grain moyen) est plus gros. La couleur est claire \xE0 gris\xE2tre, non v\xE9rifi\xE9e sur photo.",
    confusions: [
      "attieke \u2014 grains d'atti\xE9k\xE9 plus fins, collants, plus clairs et translucides.",
      "gari \u2014 le gari est sec et irr\xE9gulier.",
      "degue \u2014 le d\xE8gu\xE8 m\xEAle ce couscous \xE0 du lait caill\xE9 blanc, servi froid en bol.",
      "**accompagnement** : sauce arachide (base), viande, poisson, l\xE9gumes, lait caill\xE9 et sucre",
      "**noms r\xE9gionaux** : saay, saac, futo, lacciri, basi (S\xE9n\xE9gal, Gambie, Mauritanie), thiakry (grain moyen)",
      "**certitude** : basse",
      "**sources** : https://en.wikipedia.org/wiki/Thiere https://www.fruits-tropicaux.com/fr/cereales/107-thiakry-degue-de-mil-500g.html https://www.terramillet.com/cuisiner-les-millets/recettes-%C3%A0-partir-de-mil/"
    ]
  },
  bouillie_mil: {
    aspect: "Bouillie \xE9paisse et lisse de farine de mil, souvent \xE9pic\xE9e (gingembre, clou de girofle) donc teint\xE9e. Servie chaude en bol, souvent avec lait concentr\xE9 ou sucre.",
    confusions: [
      "bouillie_mais \u2014 quasi indiscernable \xE0 la photo ; la bouillie de mil est plus \xE9pic\xE9e et plus fonc\xE9e, celle de ma\xEFs plus claire. Le contexte (hausa koko, \xE9pices) est l'indice.",
      "degue \u2014 le d\xE8gu\xE8 est froid, avec du lait caill\xE9 blanc et des grains de mil visibles.",
      "akassa \u2014 l'akassa est un gel ferme.",
      "**accompagnement** : beignets de haricot (akara, koose), beignets de farine, pain, lait, cacahu\xE8tes grill\xE9es",
      "**noms r\xE9gionaux** : hausa koko (Ghana), coco baka (C\xF4te d'Ivoire), fond\xE9 (S\xE9n\xE9gal), moni (Mali), koko goudaji (Niger)",
      "**certitude** : basse",
      "**sources** : https://www.myafroweek.com/la-bouillie-la-base-du-petit-dejeuner-africain/ https://kelianfood.com/5-idees-de-recette-a-base-de-mil/ https://blackinbourg.com/produit/blue-bay-hausa-koko-flour-1kg/ https://www.goldfoodafrica.com/produit/hausa-koko-600gr/"
    ]
  },
  bouillie_mais: {
    aspect: "Bouillie lisse, cr\xE8me \xE0 blanche, devenant brillante en cuisant. Servie ti\xE8de en bol, parfois parfum\xE9e au gingembre.",
    confusions: [
      "bouillie_mil \u2014 quasi indiscernable ; celle de mil est plus \xE9pic\xE9e et plus fonc\xE9e.",
      "akassa \u2014 l'akassa est le m\xEAme ma\xEFs en gel ferme ; la bouillie est liquide.",
      "degue \u2014 le d\xE8gu\xE8 contient des grains de mil et du lait caill\xE9.",
      "**accompagnement** : beignets de haricot (akara), beignets de farine, pain, moin-moin (Nigeria)",
      "**noms r\xE9gionaux** : akamu (Nigeria, igbo), ogi (Nigeria, yoruba), pap (Nigeria, Ghana), koko (Ghana)",
      "**certitude** : moyenne",
      "**sources** : https://kjsfood.com/recipe/akassa-koko-corn-porridge https://en.wikipedia.org/wiki/Ogi_(food) https://www.myafroweek.com/la-bouillie-la-base-du-petit-dejeuner-africain/"
    ]
  },
  avocat: {
    aspect: "Fruit \xE0 peau verte \xE0 brun-noir, chair vert p\xE2le \xE0 jaune, gros noyau rond central. Pr\xE9sent\xE9 entier, en moiti\xE9s ou en tranches.",
    confusions: []
  },
  banane_douce: {
    aspect: "Petite banane jaune, pel\xE9e ou en tron\xE7ons, chair cr\xE8me et molle. Mang\xE9e crue.",
    confusions: []
  },
  mangue: {
    aspect: "Fruit \xE0 peau verte, jaune ou rouge ; chair jaune-orang\xE9, juteuse, noyau plat central. Pr\xE9sent\xE9e en tranches ou en cubes.",
    confusions: []
  },
  ananas: {
    aspect: "Chair jaune vif, fibreuse, servie en tranches ou en rondelles, souvent avec le c\u0153ur. Peau \xE9cailleuse brune et couronne de feuilles si entier.",
    confusions: []
  },
  orange: {
    aspect: "Fruit rond \xE0 peau orange, pel\xE9 ou en quartiers ou en demi-lune, chair orange segment\xE9e et juteuse. Parfois coup\xE9e en spirale, vendue dans la rue.",
    confusions: []
  },
  papaye: {
    aspect: "Fruit allong\xE9 \xE0 peau jaune-vert, chair orange-rose tendre, cavit\xE9 centrale remplie de petites graines noires rondes. Servie en tranches ou en cubes.",
    confusions: []
  },
  crudites: {
    aspect: "Salade verte, rondelles de tomate rouge, oignon blanc ou rouge \xE9minc\xE9, parfois concombre, servis frais sans sauce visible. \xC9l\xE9ments crus et nets, sans huile brillante.",
    confusions: []
  },
  huile_palme: {
    aspect: "Huile rouge \xE0 orange fonc\xE9, \xE9paisse, semi-solide \xE0 temp\xE9rature ambiante, opaque. Elle forme des taches ou une nappe rouge en surface des sauces.",
    confusions: []
  },
  huile_vegetale: {
    aspect: "Liquide jaune p\xE2le \xE0 dor\xE9, limpide et translucide, en bouteille ou bidon. Brille sur les aliments frits.",
    confusions: []
  },
  mayonnaise: {
    aspect: "Cr\xE8me \xE9paisse, opaque, jaune tr\xE8s p\xE2le \xE0 blanc cass\xE9, d\xE9pos\xE9e en cuiller\xE9e ou en filet. Mate \xE0 l\xE9g\xE8rement brillante.",
    confusions: []
  },
  thieboudienne: {
    aspect: "Riz rouge-orang\xE9 cuit dans une sauce tomate, avec poisson (entier ou en gros tron\xE7ons) et gros morceaux de l\xE9gumes (carotte, chou, aubergine, manioc) pos\xE9s dessus. Servi en grand plat commun.",
    confusions: [
      "riz_jollof \u2014 m\xEAme riz rouge-orang\xE9 ; le jollof n'a pas de poisson ni de gros l\xE9gumes en surface.",
      "poulet_dg \u2014 le poulet DG n'a pas de riz et montre du plantain frit.",
      "atassi \u2014 le riz atassi est brun et m\xEAl\xE9 de haricots.",
      "**accompagnement** : citron, piment, tamarin",
      "**noms r\xE9gionaux** : thieb, tieb, thiep (S\xE9n\xE9gal), ceebu j\xEBn (wolof), thiebou guinar (version poulet), thiebou wekh (version blanche)",
      "**certitude** : moyenne",
      "**sources** : https://fr.wikipedia.org/wiki/Riz_wolof https://www.196flavors.com/fr/riz-wolof/ https://aistoucuisine.com/collections/ramadan/diner https://www.food.com/recipe/poulet-yassa-chicken-yassa-from-africa-14936"
    ]
  },
  poulet_dg: {
    aspect: "Poulet frit en morceaux m\xEAl\xE9 \xE0 des rondelles de plantain frit, carottes, poivrons verts et rouges, haricots verts en morceaux, dans une sauce tomate l\xE9g\xE8re. Plat color\xE9 et sans riz.",
    confusions: [
      "poulet_frit \u2014 le poulet frit seul n'a ni plantain ni l\xE9gumes m\xEAl\xE9s.",
      "yassa_poulet \u2014 le yassa est enrob\xE9 d'oignons caram\xE9lis\xE9s brun-jaune, sans plantain.",
      "thieboudienne \u2014 plat de riz rouge avec poisson.",
      "**accompagnement** : souvent servi seul ou avec du riz ou du plantain",
      "**noms r\xE9gionaux** : poulet directeur g\xE9n\xE9ral, PDG (Cameroun)",
      "**certitude** : haute",
      "**sources** : https://www.ambacamvat.com/poulet-dg/ https://cuisinedumboa.com/poulet-dg/ https://www.196flavors.com/fr/cameroun-poulet-dg/ https://www.tabouencuisine.com/2016/04/poulet-dg-cameroun.html"
    ]
  },
  yassa_poulet: {
    aspect: "Morceaux de poulet napp\xE9s d'une masse d'oignons fondus brun-dor\xE9 \xE0 jaune, dans une sauce citronn\xE9e liquide. Pas de riz dans la cl\xE9 ; il est servi \xE0 c\xF4t\xE9, blanc.",
    confusions: [
      "poulet_braise \u2014 le poulet brais\xE9 est sec et noirci par la braise, sans masse d'oignons.",
      "poulet_dg \u2014 le DG montre du plantain et des l\xE9gumes color\xE9s, pas d'oignons fondus.",
      "viande_chevre \u2014 viande avec os, en sauce brune.",
      "**accompagnement** : riz blanc (servi \xE0 part)",
      "**noms r\xE9gionaux** : yassa (S\xE9n\xE9gal, Casamance), yassa au poisson ou au b\u0153uf",
      "**certitude** : moyenne",
      "**sources** : https://fr.wikipedia.org/wiki/Yassa_(plat) https://www.food.com/recipe/poulet-yassa-chicken-yassa-from-africa-14936 https://lecontinentalrestaurant.fr/recettes-africaines/poulet-yassa-ou-yassa-au-boeuf/"
    ]
  },
  degue: {
    aspect: "Cr\xE8me blanche \xE9paisse de lait caill\xE9 ou yaourt sucr\xE9, avec de petits grains de mil visibles ; ressemble \xE0 un riz au lait. Servi froid en bol.",
    confusions: [
      "bouillie_mil \u2014 la bouillie est chaude, lisse, sans lait caill\xE9 blanc ni grains visibles.",
      "couscous_mil \u2014 le couscous de mil sec n'est pas m\xEAl\xE9 \xE0 une cr\xE8me.",
      "bouillie_mais \u2014 bouillie lisse sans grains.",
      "**accompagnement** : sans indice (consomm\xE9 en go\xFBter, pas en fin de repas)",
      "**noms r\xE9gionaux** : d\xE9gu\xEA (C\xF4te d'Ivoire, Mali, Guin\xE9e), thiakry (S\xE9n\xE9gal), d\xE9gu\xE9 (B\xE9nin)",
      "**certitude** : haute",
      "**sources** : https://fr.wikipedia.org/wiki/D%C3%A8gu%C3%A9 https://www.couleurafrique.com/app/2020/04/14/made-in-benin-le-degue/ https://www.cahierderecettes.com/mil-au-lait-thiakry-degue/"
    ]
  },
  poulet_braise: {
    aspect: "Poulet entier ou en morceaux, peau brune \xE0 noircie par la braise, sec en surface. D\xE9duit du mode de cuisson, non v\xE9rifi\xE9 sur photo.",
    confusions: []
  },
  poulet_frit: {
    aspect: "Morceaux de poulet \xE0 cro\xFBte dor\xE9e \xE0 brune, uniforme, brillante d'huile. Sans marques de braise.",
    confusions: []
  },
  poisson_braise: {
    aspect: "Poisson entier (tilapia, carpe, capitaine, bar) \xE0 peau marqu\xE9e par la braise, souvent incis\xE9 et recouvert d'une sauce tomate-piment ou d'oignons. Servi entier sur plat.",
    confusions: []
  },
  poisson_frit: {
    aspect: "Poisson entier ou en tron\xE7ons \xE0 peau dor\xE9e \xE0 brune, croustillante, luisante d'huile ; petits poissons entiers fr\xE9quents au bord des routes. Parfois arros\xE9 de citron.",
    confusions: []
  },
  poisson_fume: {
    aspect: "Poisson sec, brun fonc\xE9 \xE0 noir, raidi, souvent en morceaux ou entier recroquevill\xE9 ; la fum\xE9e donne cet aspect. Utilis\xE9 aussi \xE9miett\xE9 dans les sauces.",
    confusions: []
  },
  crevettes_sechees: {
    aspect: "Petites crevettes enti\xE8res s\xE9ch\xE9es et fum\xE9es, rigides, orange-brun, ou r\xE9duites en poudre fine. Vendues en tas ou en sachet.",
    confusions: []
  },
  viande_boeuf: {
    aspect: "Morceaux de b\u0153uf cuits, bruns, en cubes ou en tranches, souvent dans une sauce ou une marinade. Non v\xE9rifi\xE9 sur photo.",
    confusions: []
  },
  viande_chevre: {
    aspect: "Morceaux de ch\xE8vre ou de mouton cuits, avec os, bruns, irr\xE9guliers, souvent en sauce ou grill\xE9s. Non v\xE9rifi\xE9 sur photo.",
    confusions: []
  },
  suya: {
    aspect: "Lamelles fines de viande sur pique en bois, enrob\xE9es de poudre brun-orang\xE9 (yaji : arachide, piment, paprika), grill\xE9es \xE0 la braise. Servies avec oignons crus et tomates.",
    confusions: []
  },
  oeuf_dur: {
    aspect: "\u0152uf ovale \xE0 blanc lisse, coup\xE9 en deux montrant le jaune, ou entier \xE9cal\xE9. Parfois plong\xE9 dans une sauce tomate.",
    confusions: []
  },
  omelette: {
    aspect: "\u0152uf battu cuit \xE0 plat, jaune \xE0 dor\xE9, pli\xE9 ou en galette, souvent avec oignons et tomates visibles. Souvent gliss\xE9e dans un pain.",
    confusions: []
  },
  wagashi: {
    aspect: "Fromage ferme en bloc ou cubes, blanc ou rouge-orang\xE9 (color\xE9 par feuille ou d\xE9coction de sorgho), ne fond pas. Texture compacte avec trous \xE9ventuels de moulage.",
    confusions: []
  },
  wagashi_frit: {
    aspect: "Cubes, tranches ou b\xE2tonnets de fromage peul \xE0 cro\xFBte dor\xE9e \xE0 brune, croustillante \xE0 l'ext\xE9rieur, fondante \xE0 l'int\xE9rieur. Luisant d'huile.",
    confusions: []
  },
  fromage_soja: {
    aspect: "Fromage de soja coup\xE9 en losanges, jaune \xE0 dor\xE9 (frit) ou blanc-ivoire (non frit), ferme, parfois color\xE9 par une d\xE9coction de sorgho. Vendu en sachet ou \xE0 l'unit\xE9 dans la rue.",
    confusions: []
  },
  beignets_haricot: {
    aspect: "Boules ou galettes frites de p\xE2te de haricots ni\xE9b\xE9 battue, brun dor\xE9 \xE0 l'ext\xE9rieur. Taille d'une petite balle, vendus avec la bouillie.",
    confusions: []
  },
  sauce_graine: {
    aspect: "Sauce \xE9paisse et nappante de pulpe de noix de palme, orange \xE0 rouge-orang\xE9, avec une fine couche d'huile rouge en surface. Morceaux de viande et de poisson fum\xE9 dedans, sans morceaux de tomate.",
    confusions: [
      "sauce_tomate \u2014 la sauce tomate est rouge fonc\xE9, concentr\xE9e et grasse ; la sauce graine est orange.",
      "sauce_arachide \u2014 l'arachide est cuivr\xE9e \xE0 brun-orang\xE9, onctueuse ; la graine est plus orange vif. Distinction d\xE9licate \xE0 la photo.",
      "huile_palme \u2014 l'huile seule est un liquide gras rouge, sans corps de sauce.",
      "**accompagnement** : p\xE2te de ma\xEFs, t\xE9libo, riz, igname pil\xE9e, foutou, atti\xE9k\xE9",
      "**noms r\xE9gionaux** : d\xE9koun (B\xE9nin), banga (Nigeria), abenkwan (Ghana), sauce palmiste",
      "**certitude** : haute",
      "**sources** : https://lamaisondubenin.com/la-sauce-dekoun-ou-sauce-graine/ https://www.fournil-des-rois.fr/sauce-graine/ https://ramentafaim.fr/sauce-graine/ https://kjsfood.com/recipe/seed-sauce-palm-nuts"
    ]
  },
  sauce_arachide: {
    aspect: "Sauce \xE9paisse et onctueuse brun-cuivr\xE9 \xE0 brun-orang\xE9, avec une couche d'huile ambr\xE9e en surface. Contient viande, poulet ou poisson ; la version b\xE9ninoise peut \xEAtre plus rouge (tomate, huile rouge).",
    confusions: [
      "sauce_graine \u2014 la graine est plus orange vif ; l'arachide est plus brune et cr\xE9meuse.",
      "sauce_tomate \u2014 la tomate est rouge fonc\xE9, sans onctuosit\xE9 cr\xE9meuse.",
      "ndole \u2014 le ndol\xE9 contient des feuilles vertes am\xE8res visibles dans une base d'arachide.",
      "sauce_pistache \u2014 la pistache est plus grumeleuse, souvent avec feuilles vertes.",
      "**accompagnement** : igname pil\xE9e, p\xE2te blanche, riz, poulet fum\xE9, wagashi",
      "**noms r\xE9gionaux** : maf\xE9, maafe, tigad\xE8gu\xE8nan (Mali), groundnut soup (Ghana, Nigeria), azindessi (B\xE9nin)",
      "**certitude** : moyenne",
      "**sources** : https://www.nkosiagro.com/pages/guide-pate-arachide-mafe https://atlasculinaire.com/recettes/sauce-darachide-guineenne-mafe-conakry--ebd23dba-d99c-4485-8729-38438e298c4f https://beninchezmoi.com/blogs/infos/recette-de-la-sauce-arachide-beninoise-cremeuse-et-reconfortante https://oukoikan.com/2023/03/14/agoun-accompagne-de-la-sauce-arachide/"
    ]
  },
  sauce_tomate: {
    aspect: "P\xE2te de tomate longuement frite \xE0 l'huile, rouge fonc\xE9, \xE9paisse, grasse, avec l'huile qui remonte en surface. Servie en petite portion \xE0 c\xF4t\xE9 ou napp\xE9e, parfois avec \u0153ufs durs entiers.",
    confusions: [
      "sauce_graine \u2014 la graine est orange et plus fluide ; la sauce tomate est rouge fonc\xE9 et dense.",
      "sauce_arachide \u2014 l'arachide est cuivr\xE9e et cr\xE9meuse.",
      "sauce_claire \u2014 la sauce claire est un bouillon l\xE9ger rouge-orang\xE9 avec poisson ; la sauce tomate est une p\xE2te \xE9paisse.",
      "huile_palme \u2014 l'huile de palme est un liquide gras sans morceaux ni p\xE2te.",
      "sauce_pistache \u2014 la pistache est plus grumeleuse, avec feuilles ou graines moulues.",
      "**accompagnement** : atassi, riz, haricots, igname, p\xE2tes, poisson frit",
      "**noms r\xE9gionaux** : dja, friture de tomate, jus (B\xE9nin, Togo), tomato stew (Nigeria, Ghana), m'gbagba, nougbagba, amiv\xF4v\xF4 dja (version \xE0 l'huile de palme, B\xE9nin)",
      "**certitude** : haute",
      "**sources** : https://www.papillesetpupilles.fr/2019/10/dja-la-sauce-tomate-du-benin.html/ https://lesgourmandisesdekarelle.com/recettes-lgdk/recettes-africaines/faire-dja-petite-sauce-tomate-beninoise/ https://lanouvelletribune.info/2020/10/la-sauce-tomate-et-quelques-varietes-dans-la-gastronomie-africaine/ http://wezonblog.blogspot.com/2013/10/attassi-la-friture-de-tomate.html"
    ]
  },
  sauce_feuilles: {
    aspect: "Sauce vert fonc\xE9 \xE0 brun-vert, \xE9pinards ou gboma cuits puis hach\xE9s grossi\xE8rement, m\xEAl\xE9s \xE0 de l'huile (rouge ou v\xE9g\xE9tale), avec morceaux de viande, poisson fum\xE9 ou crevettes. Texture onctueuse, non filante.",
    confusions: [
      "sauce_crincrin \u2014 le crincrin est filant, vert profond lustr\xE9 avec yeux d'huile rouge, feuilles minuscules battues ; les feuilles hach\xE9es de la sauce feuilles ne filent pas.",
      "sauce_feuille_manioc \u2014 feuilles de manioc finement pil\xE9es, plus uniformes ; la sauce feuilles montre des morceaux d'\xE9pinard plus visibles.",
      "ndole \u2014 ndol\xE9 vert fonc\xE9 dans une base d'arachide cr\xE9meuse.",
      "sauce_pistache \u2014 la pistache est \xE9paisse, grumeleuse avec les graines moulues, parfois avec \xE9pinards.",
      "**accompagnement** : p\xE2te de ma\xEFs, akassa, ablo, riz, t\xE9libo",
      "**noms r\xE9gionaux** : gboma dessi (Togo), mantindjan (B\xE9nin), shoko (Ghana), efo riro (Nigeria), gboman, fonman, tchiayo, amanviv\xE8 (B\xE9nin, leafy sauces)",
      "**certitude** : moyenne",
      "**sources** : https://www.196flavors.com/togo-gboma-dessi-and-akoume/ https://saveurstogo.com/gboma-dessi-sauce-togolaise/ https://www.lesdelicesdejessy.com/sauce-epinards-gboma-mantindjan https://www.elviadelices.fr/products/telibo"
    ]
  },
  sauce_gombo: {
    aspect: "Sauce gluante et filante \xE0 base de gombos coup\xE9s en rondelles ou en cubes, avec poisson fum\xE9, crevettes, crabe ou viande. Couleur non document\xE9e avec certitude (varie selon l'huile rouge ajout\xE9e).",
    confusions: [
      "sauce_crincrin \u2014 le crincrin est vert profond et battu, sans rondelles de gombo ; le gombo montre des morceaux et des graines.",
      "sauce_feuilles \u2014 la sauce feuilles n'est pas filante.",
      "**accompagnement** : p\xE2te de ma\xEFs, p\xE2te de manioc, riz, eba, placali, t\xE9libo",
      "**noms r\xE9gionaux** : f\xE9vi, fevi, ab\xE9mon (B\xE9nin), fetri dessi (Togo), kop\xE9 (C\xF4te d'Ivoire), okro stew (Ghana), gan-nah (Mali), soupoukandja (S\xE9n\xE9gal), okra",
      "**certitude** : moyenne",
      "**sources** : https://fr.wikipedia.org/wiki/Sauce_gombo https://eatafrika.com/2024/09/11/recette-de-la-sauce-gombo-beninoise-inratable-et-delicieuse/ https://lanouvelletribune.info/2020/07/7-sauces-aux-feuilles-legumes-africaines-a-connaitre-absolument/"
    ]
  },
  sauce_crincrin: {
    aspect: "Sauce vert fonc\xE9 et lustr\xE9e, tr\xE8s filante (fil \xE9tirable entre la cuill\xE8re et le bol), avec yeux d'huile rouge en surface. Contient poisson fum\xE9, crabe, crevettes ; feuilles de cor\xE8te battues, non visibles en morceaux.",
    confusions: [
      "sauce_gombo \u2014 le gombo montre des morceaux de gombo et des graines.",
      "sauce_feuilles \u2014 la sauce feuilles est non filante, avec feuilles hach\xE9es visibles.",
      "sauce_feuille_manioc \u2014 sauce de feuilles de manioc non filante, plus p\xE2teuse.",
      "**accompagnement** : p\xE2te de ma\xEFs (akoum\xE9), t\xE9libo, ajout\xE9e dans les sauces tomate ou arachide",
      "**noms r\xE9gionaux** : ninnouwi, crincrin, craincrain (B\xE9nin), ad\xE9m\xE8 (Togo), ewedu (Nigeria), kplala (C\xF4te d'Ivoire), fakouhoy (Mali), mouloukhia",
      "**certitude** : moyenne",
      "**sources** : https://atlasculinaire.com/recettes/akoume-sauce-ademe--54f4045f-0aa2-4c63-86c9-520989ecba20 https://beninwebtv.bj/cuisine-recette-facile-de-sauce-crincrin-a-la-togolaise-ademe/ https://lamaisondubenin.com/la-sauce-crincrin-ou-ninnouwi/"
    ]
  },
  sauce_pistache: {
    aspect: "Rago\xFBt \xE9pais, grumeleux, \xE0 base de graines de melon moulues, avec huile de palme rouge, souvent des feuilles vertes (\xE9pinards) et des morceaux de viande et de poisson. Les graines absorbent l'humidit\xE9 et forment des amas.",
    confusions: [
      "sauce_arachide \u2014 l'arachide est lisse, cr\xE9meuse et cuivr\xE9e ; la pistache est grumeleuse.",
      "sauce_feuilles \u2014 la sauce feuilles est vert fonc\xE9, non grumeleuse, sans graines moulues.",
      "sauce_graine \u2014 la graine est lisse, orange ; la pistache est grumeleuse, plus jaune-verte.",
      "**accompagnement** : igname pil\xE9e, eba, riz, akassa",
      "**noms r\xE9gionaux** : egusi, egousi (Nigeria), egoussi dessi (Togo), agoussi (B\xE9nin), pistache africaine, met de pistache (Cameroun)",
      "**certitude** : moyenne",
      "**sources** : https://www.196flavors.com/fr/nigeria-soupe-degousi-sauce-pistache/ https://saveurstogo.com/egoussi-dessi-sauce-togolaise/ https://www.peko-peko.fr/recettes/egusi-soup/ https://en.wikipedia.org/wiki/Egusi_sauce"
    ]
  },
  sauce_claire: {
    aspect: "Bouillon l\xE9ger et fluide, l\xE9g\xE8rement color\xE9 (rouge-orang\xE9 tomate), avec tron\xE7ons de poisson frais et peu de mati\xE8re \xE9paisse. Se mange comme une soupe.",
    confusions: [
      "sauce_tomate \u2014 la sauce tomate est une p\xE2te \xE9paisse ; la sauce claire est un liquide \xE0 tron\xE7ons de poisson.",
      "sauce_arachide \u2014 onctueuse et opaque.",
      "**accompagnement** : atti\xE9k\xE9, foufou, igname, riz",
      "**noms r\xE9gionaux** : pepper soup (Nigeria), light soup (Ghana), omi \xF4b\xE8 (yoruba), n'sounou ssin (fon), bouillon de machoiron",
      "**certitude** : moyenne",
      "**sources** : https://www.cuisinedecheznous.net/blog/2022/10/29/une-delicieuce-sauce-claire-au-poisson-frais-pour-le-plaisir/ https://lanouvelletribune.info/2020/10/la-sauce-tomate-et-quelques-varietes-dans-la-gastronomie-africaine/ https://glance-magazine.com/2024/08/18/bouillon-de-machoiron-ou-pepper-soup/"
    ]
  },
  ndole: {
    aspect: "Feuilles am\xE8res vert fonc\xE9, bouillies et hach\xE9es, m\xEAl\xE9es \xE0 une p\xE2te d'arachide cr\xE9meuse, avec crevettes, poisson fum\xE9 ou viande. Plat vert fonc\xE9 \xE0 brun-vert.",
    confusions: [
      "sauce_feuilles \u2014 la sauce feuilles est sans base d'arachide cr\xE9meuse.",
      "sauce_feuille_manioc \u2014 feuilles de manioc finement pil\xE9es dans huile de palme, sans cr\xE8me d'arachide.",
      "sauce_arachide \u2014 l'arachide est cuivr\xE9e, sans feuilles vertes.",
      "**accompagnement** : b\xE2ton de manioc (miondo, bobolo), plantain frit, riz",
      "**noms r\xE9gionaux** : ndol\xE8 (Cameroun)",
      "**certitude** : moyenne",
      "**sources** : https://recettesdafrique.com/recette/le-ndole/ https://www.recettesafricaine.com/ndole.html https://gastronomieivoirienne.wordpress.com/2017/04/13/recettes-du-cameroun-le-ndole/"
    ]
  },
  sauce_feuille_manioc: {
    aspect: "Feuilles de manioc finement pil\xE9es, mijot\xE9es longuement dans l'huile de palme, avec poisson fum\xE9 ou viande. Sauce vert fonc\xE9, dense, d'aspect uniforme.",
    confusions: [
      "sauce_feuilles \u2014 \xE9pinards plus grossi\xE8rement hach\xE9s, plus de morceaux visibles.",
      "ndole \u2014 ndol\xE9 cr\xE9meux \xE0 l'arachide.",
      "sauce_crincrin \u2014 le crincrin est filant, non p\xE2teux.",
      "**accompagnement** : manioc, riz, pain, plantain frit, igname",
      "**noms r\xE9gionaux** : saka-saka (Congo-Brazzaville, Angola), pondu, mpondu (RDC), madaba, sauce feuilles de manioc",
      "**certitude** : moyenne",
      "**sources** : https://www.nkosiagro.com/blogs/culture-africaine/pondu-saka-saka https://mddolce.com/fran/pondu-saga-saga https://enviesdafrique.fr/produit/saka-saka-ou-pondu-congele-du-cameroun-500-grammes/"
    ]
  },
  arachides_grillees: {
    aspect: "Cacahu\xE8tes d\xE9cortiqu\xE9es ou en coque, brun clair \xE0 dor\xE9, grill\xE9es, s\xE8ches, servies en tas ou en sachet. Non v\xE9rifi\xE9 sur photo.",
    confusions: []
  },
  beignet_farine: {
    aspect: "Boule ronde de p\xE2te de farine lev\xE9e frite, caramel \xE0 brun dor\xE9, brillante et gonfl\xE9e. Parfois roul\xE9e dans du sucre.",
    confusions: []
  },
  chips_plantain: {
    aspect: "Tranches tr\xE8s fines de plantain frites, s\xE8ches et croustillantes, jaune dor\xE9, en sachet ou en tas. Plates et translucides.",
    confusions: []
  },
  lait_concentre: {
    aspect: "Liquide \xE9pais, cr\xE8me \xE0 beige, visqueux, vers\xE9 en filet ou vu en bo\xEEte de conserve ou en tube de marque. Non v\xE9rifi\xE9 sur photo.",
    confusions: []
  },
  sucre: {
    aspect: "Grains blancs fins en poudre ou morceaux (cubes), cristallins, secs. En tas, en sachet ou en cuill\xE8re.",
    confusions: []
  }
};

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
  maxGrams: 2e3,
  /** Portions nommées proposées par le modèle pour un aliment hors table. */
  maxPortions: 4,
  maxPortionLabelLength: 40
};
var LANGS = [
  "fr",
  "en"
];
var DEFAULT_LANG = "fr";
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
  const lang = LANGS.find((l) => l === body.lang) ?? DEFAULT_LANG;
  return {
    ok: true,
    value: {
      imageBase64: image,
      hint,
      scanId,
      answers,
      lang
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
  const tete = `- ${f.food_key} : ${f.label_fr}${aliases}${reperes ? ` [${reperes}]` : ""}`;
  const vu = FOOD_ASPECTS[f.food_key];
  if (!vu) return tete;
  const conf = vu.confusions.length ? `
  \xC0 ne pas confondre : ${vu.confusions.join(" ; ")}` : "";
  return `${tete}
  Aspect : ${vu.aspect}${conf}`;
}
var OUTPUT_LANGUAGE = {
  fr: "en fran\xE7ais simple",
  en: "en anglais simple (l'utilisateur lit l'application en anglais)"
};
function buildSystemPrompt(foods, lang = DEFAULT_LANG) {
  return `Tu es un assistant nutritionniste. Tu reconnais les aliments et les plats du monde entier \u2014 cuisine africaine, europ\xE9enne, asiatique, am\xE9ricaine, produits industriels, fruits et l\xE9gumes de toutes origines \u2014 et tu connais particuli\xE8rement bien la cuisine d'Afrique de l'Ouest (B\xE9nin, Togo, C\xF4te d'Ivoire, S\xE9n\xE9gal, Nigeria, Ghana). Tu analyses la photo d'un repas pour identifier chaque \xE9l\xE9ment et estimer sa quantit\xE9 en grammes.

R\xC8GLES

1. Identifie d'abord, classe ensuite. Chaque plat de la liste est d\xE9crit par son aspect, et parfois par ce qui le distingue de ses sosies : compare ce que montre la photo \xE0 ces descriptions avant de choisir une cl\xE9. Couleur, texture et grain priment sur le nom : une p\xE2te brun fonc\xE9 n'est pas une p\xE2te blanche, m\xEAme si les deux s'appellent \xAB p\xE2te \xBB. Nomme ce que tu vois r\xE9ellement, quel que soit le pays d'origine de l'aliment. Ensuite seulement, regarde la liste ci-dessous : c'est la liste des aliments dont l'application conna\xEEt d\xE9j\xE0 les valeurs nutritionnelles (cl\xE9 : libell\xE9, autres noms, [rep\xE8res de portion]).
   - Si l'aliment que tu as identifi\xE9 EST un aliment de la liste, donne son food_key, et estimate_100g vaut null : l'application calcule les calories avec sa propre table.
   - Sinon, donne food_key = \xAB ${OTHER_FOOD_KEY} \xBB, un libell\xE9 pr\xE9cis, et ta propre estimation pour 100 g dans estimate_100g.
   La liste n'est pas une contrainte : elle ne couvre qu'une petite partie des aliments existants. Tu dois pouvoir traiter n'importe quel aliment, m\xEAme absent de la liste.

   INTERDIT : remplacer un aliment par un autre sous pr\xE9texte qu'il lui ressemble ou qu'il est dans la liste. Une pomme reste une pomme m\xEAme si la liste ne contient que des mangues et des ananas : dans ce cas, c'est \xAB ${OTHER_FOOD_KEY} \xBB avec le libell\xE9 \xAB pomme \xBB. Un faux aliment est une erreur bien plus grave qu'un aliment hors liste.

2. Indice de l'utilisateur. S'il d\xE9crit le plat, consid\xE8re-le comme fiable en cas de doute visuel (par exemple une sauce brune qu'il appelle \xAB sauce arachide \xBB). S'il contredit clairement la photo, suis la photo et baisse la confiance.

3. Sauces et huile, souvent invisibles. Compte chaque sauce comme un \xE9l\xE9ment s\xE9par\xE9 du f\xE9culent qu'elle accompagne, m\xEAme si elle est en partie cach\xE9e dessous. Compte l'huile de cuisson (huile_palme ou huile_vegetale) comme un \xE9l\xE9ment s\xE9par\xE9 quand elle se voit en exc\xE8s : flaque, couche d'huile en surface, aliments luisants. Les plats frits et les sauces de la liste incluent d\xE9j\xE0 leur huile de cuisson normale : n'ajoute de l'huile que pour l'exc\xE8s visible, pour ne pas la compter deux fois.

4. Portions. Ne devine pas un poids d'un coup : proc\xE8de en trois temps.

   a) Trouve l'\xE9chelle. Cherche dans l'image un objet dont la taille est connue : assiette plate \u2248 24 \xE0 26 cm de diam\xE8tre, assiette creuse \u2248 22 cm, bol \u2248 15 cm, cuill\xE8re \xE0 soupe \u2248 8 cm de long, fourchette \u2248 19 cm, canette \u2248 12 cm de haut, main d'adulte \u2248 18 cm, pouce \u2248 6 cm. Si rien ne donne l'\xE9chelle, suppose une assiette plate courante et baisse nettement la confiance de l'\xE9l\xE9ment : la photo seule ne dit pas si un aliment est petit et proche ou gros et loin.

   b) Juge le volume, pas la surface. Deux assiettes peuvent \xEAtre couvertes pareil pour des poids tr\xE8s diff\xE9rents : ce qui compte est l'\xE9paisseur du tas. Une couche fine et un monticule ne p\xE8sent pas la m\xEAme chose.

   c) Convertis le volume en grammes. Ordres de grandeur : sauces et liquides \u2248 1 g pour 1 ml ; f\xE9culents cuits tass\xE9s (riz, p\xE2te, couscous) \u2248 0,8 g/ml ; viande et poisson \u2248 1 g/ml ; salade et feuilles crues \u2248 0,2 g/ml ; aliments frits et a\xE9r\xE9s \u2248 0,5 g/ml.

   d) Pour un aliment rond et entier (fruit, tubercule, boule de p\xE2te), mesure son diam\xE8tre avec le rep\xE8re d'\xE9chelle, puis lis ce tableau \u2014 il vaut pour une pomme, une orange, une tomate, tout ce qui est \xE0 peu pr\xE8s sph\xE9rique : 6 cm \u2248 100 g ; 7 cm \u2248 150 g ; 8 cm \u2248 220 g ; 9 cm \u2248 300 g ; 10 cm \u2248 400 g. Le poids suit le cube du diam\xE8tre : un fruit \xE0 peine plus large est beaucoup plus lourd, et un fruit \xE0 peine plus petit est beaucoup plus l\xE9ger.

   Poids courants pour les aliments absents de la liste. Ce sont des rep\xE8res pour un sp\xE9cimen MOYEN, pas des r\xE9ponses \xE0 recopier : un m\xEAme fruit va du simple au triple selon sa taille, alors descends ou monte franchement d\xE8s que la photo montre un aliment petit ou gros. Pomme, orange : petite 100 g, moyenne 150 g, grosse 220 g. Mangue : petite 150 g, moyenne 250 g, grosse 400 g. Banane \xE9pluch\xE9e : petite 80 g, moyenne 120 g, grosse 170 g. \u0152uf \u2248 55 g ; tranche de pain \u2248 30 g ; part de pizza \u2248 125 g ; pot de yaourt \u2248 125 g ; verre \u2248 250 ml ; bouteille individuelle \u2248 500 ml.

   e) Propose des portions nomm\xE9es. Pour tout aliment absent de la liste, remplis \xAB portions \xBB avec 2 \xE0 4 fa\xE7ons naturelles de compter CET aliment, de la plus petite \xE0 la plus grosse, chacune avec son poids en grammes : un fruit entier donne \xAB petite pomme \xBB 100, \xAB pomme moyenne \xBB 150, \xAB grosse pomme \xBB 220 ; du pain donne \xAB 1 tranche \xBB 30, \xAB 2 tranches \xBB 60 ; une boisson donne \xAB 1 verre \xBB 250, \xAB 1 bouteille \xBB 500 ; un plat en sauce donne \xAB 1 louche \xBB 120, \xAB 2 louches \xBB 240. Ce sont les choix que l'utilisateur touchera pour corriger ton estimation, donc ils doivent \xEAtre parlants et adapt\xE9s \xE0 cet aliment pr\xE9cis. Pour un aliment de la liste, renvoie une liste vide : l'application a d\xE9j\xE0 ses rep\xE8res.

   Ne r\xE9ponds jamais le poids moyen par r\xE9flexe. Le poids moyen est la r\xE9ponse uniquement quand l'aliment para\xEEt vraiment moyen \xE0 c\xF4t\xE9 de ton rep\xE8re d'\xE9chelle ; sinon c'est une erreur, et elle est syst\xE9matique.

   Quand l'aliment figure dans la liste, ses rep\xE8res de portion priment sur tout ce qui pr\xE9c\xE8de. Une portion d\xE9passe rarement ${LIMITS.maxGrams} g.

5. N'invente pas. Si un \xE9l\xE9ment important est incertain (aliment cach\xE9, sauce ambigu\xEB, quantit\xE9 impossible \xE0 juger), baisse sa confidence et pose au plus ${LIMITS.maxQuestions} questions courtes, chacune avec 2 \xE0 4 r\xE9ponses possibles, uniquement si la r\xE9ponse change nettement les calories. Exemple : \xAB Sauce \xE0 l'huile de palme ou \xE0 la tomate ? \xBB. Si tout est clair, ne pose aucune question.

6. Confiance. confidence (0 \xE0 1) par \xE9l\xE9ment ; confidence_globale (0 \xE0 1) refl\xE8te l'incertitude sur le total de calories du repas.

7. Si la photo ne montre pas de nourriture, renvoie not_food = true, sans \xE9l\xE9ments ni questions.

8. R\xE9ponds uniquement avec un objet JSON de cette forme exacte, sans texte autour. Les libell\xE9s, les portions nomm\xE9es et les questions sont \xE9crits ${OUTPUT_LANGUAGE[lang]} : c'est le seul texte que l'utilisateur lit. Les noms de plats locaux (atti\xE9k\xE9, amiwo, gari, alloco) ne se traduisent pas, quelle que soit la langue.
{"not_food": false, "items": [{"food_key": "<cl\xE9 de la liste ou ${OTHER_FOOD_KEY}>", "label": "<libell\xE9>", "grams": <nombre>, "confidence": <0 \xE0 1>, "estimate_100g": null ou {"kcal": <nombre>, "proteines": <nombre>, "glucides": <nombre>, "lipides": <nombre>}}], "questions": [{"id": "<identifiant court>", "text": "<question>", "options": ["<r\xE9ponse>", "<r\xE9ponse>"]}], "confidence_globale": <0 \xE0 1>}
Au plus ${LIMITS.maxItems} \xE9l\xE9ments.

LISTE DE R\xC9F\xC9RENCE \u2014 aliments dont l'application conna\xEEt d\xE9j\xE0 les valeurs
${foods.map(foodLine).join("\n")}

RAPPEL FINAL, le plus important. Cette liste est courte et tr\xE8s incompl\xE8te : elle couvre surtout des plats d'Afrique de l'Ouest et presque aucun aliment courant d'ailleurs \u2014 ni pomme, ni poire, ni raisin, ni fraise, ni pizza, ni yaourt, ni fromage, ni p\xE2tes, ni c\xE9r\xE9ales, ni sandwich. C'est normal et attendu.
Avant de r\xE9pondre, relis chacun de tes \xE9l\xE9ments : si le libell\xE9 que tu as \xE9crit ne d\xE9crit pas exactement ce que montre la photo, alors le food_key est faux. Remplace-le par \xAB ${OTHER_FOOD_KEY} \xBB et renseigne estimate_100g.
Une pomme n'est pas un ananas. Un aliment hors liste correctement nomm\xE9 avec \xAB ${OTHER_FOOD_KEY} \xBB vaut toujours mieux qu'un food_key de la liste pos\xE9 sur le mauvais aliment.`;
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
            estimate_100g: estimate,
            portions: {
              type: "ARRAY",
              maxItems: LIMITS.maxPortions,
              items: {
                type: "OBJECT",
                properties: {
                  label: {
                    type: "STRING"
                  },
                  grams: {
                    type: "NUMBER"
                  }
                },
                required: [
                  "label",
                  "grams"
                ],
                propertyOrdering: [
                  "label",
                  "grams"
                ]
              }
            }
          },
          required: [
            "food_key",
            "label",
            "grams",
            "confidence",
            "estimate_100g",
            "portions"
          ],
          propertyOrdering: [
            "food_key",
            "label",
            "grams",
            "confidence",
            "estimate_100g",
            "portions"
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
function parsePortions(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = /* @__PURE__ */ new Set();
  const portions = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const { label, grams } = entry;
    if (typeof label !== "string" || !label.trim()) continue;
    if (!isFiniteNumber(grams) || grams <= 0) continue;
    const clean = label.trim().slice(0, LIMITS.maxPortionLabelLength);
    const weight = round1(clamp(grams, LIMITS.minGrams, LIMITS.maxGrams));
    const dedupe = `${clean.toLowerCase()}|${weight}`;
    if (seen.has(dedupe) || seen.has(String(weight))) continue;
    seen.add(dedupe);
    seen.add(String(weight));
    portions.push({
      label: clean,
      grams: weight
    });
    if (portions.length === LIMITS.maxPortions) break;
  }
  return portions.sort((a, b) => a.grams - b.grams);
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
      estimate_100g: estimate,
      // Les plats de la table ont leurs propres repères de portion : ceux du modèle sont ignorés.
      portions: food_key === OTHER_FOOD_KEY ? parsePortions(it.portions) : []
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
var PREMIUM_DAILY_SCANS = 30;
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
          const message = user.isAnonymous ? "Tu as utilis\xE9 ton scan gratuit du jour. Cr\xE9e un compte pour en avoir 2 par jour." : quota.quota < PREMIUM_DAILY_SCANS ? `Tu as utilis\xE9 tes ${quota.quota} scans d'aujourd'hui. Passe Premium pour en avoir ${PREMIUM_DAILY_SCANS} par jour, ou reviens demain !` : `Tu as utilis\xE9 tes ${quota.quota} scans d'aujourd'hui. Reviens demain !`;
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
        systemPrompt: buildSystemPrompt(foods, request.lang),
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
var AI_PROVIDERS = [
  "gemini",
  "gateway"
];
var aiProvider = env("AI_PROVIDER", "gemini");
if (!AI_PROVIDERS.includes(aiProvider)) throw new Error("AI_PROVIDER invalide");
var THINKING_LEVELS = [
  "minimal",
  "low",
  "medium",
  "high"
];
var thinkingLevel = env("GEMINI_THINKING_LEVEL", "low");
if (!THINKING_LEVELS.includes(thinkingLevel)) throw new Error("GEMINI_THINKING_LEVEL invalide");
var geminiConfig = {
  // Clé nécessaire seulement pour ce fournisseur ; en mode openrouter, le secret peut rester absent.
  apiKey: aiProvider === "gemini" ? env("GEMINI_API_KEY") : "",
  apiBase: env("GEMINI_API_BASE", GEMINI_API_BASE),
  model: env("GEMINI_MODEL", "gemini-flash-lite-latest"),
  temperature: parseTemperature(env("GEMINI_TEMPERATURE", "0.3")),
  thinkingLevel,
  maxOutputTokens: 4096,
  timeoutMs: 45e3,
  // Schéma, température et réflexion : refusés (HTTP 400) par les modèles actuels, d'où la requête
  // simplifiée par défaut. La forme JSON est décrite dans le prompt ; la validation reste stricte.
  simple: env("GEMINI_STRUCTURED", "false") !== "true"
};
var fallbackConfigs = env("GEMINI_FALLBACK_MODELS", "gemini-flash-lite-latest,gemini-flash-latest").split(",").map((m) => m.trim()).filter((m) => m !== "" && m !== "none" && m !== geminiConfig.model).map((model) => ({
  ...geminiConfig,
  model,
  thinkingLevel: null
}));
var modelChain = [
  geminiConfig,
  ...fallbackConfigs
];
var gatewayConfig = {
  apiKey: aiProvider === "gateway" ? env("GATEWAY_API_KEY") : "",
  // Sans barre finale : l'appel ajoute « /chat/completions ».
  apiBase: env("GATEWAY_API_BASE", RODIUM_API_BASE).replace(/\/+$/, ""),
  model: env("GATEWAY_MODEL", "google/gemini-2.5-flash-lite"),
  maxOutputTokens: 4096,
  timeoutMs: 45e3
};
var gatewayFallbacks = env("GATEWAY_FALLBACK_MODELS", "none").split(",").map((m) => m.trim()).filter((m) => m !== "" && m !== "none" && m !== gatewayConfig.model).map((model) => ({
  ...gatewayConfig,
  model
}));
var gatewayChain = [
  gatewayConfig,
  ...gatewayFallbacks
];
var activeModel = aiProvider === "gateway" ? gatewayConfig.model : geminiConfig.model;
var callAi = (req) => aiProvider === "gateway" ? callGatewayResilient(gatewayChain, req, {
  retryDelaysMs: [
    2e3
  ],
  budgetMs: 5e4,
  onFailure: (r) => !r.ok && console.error(JSON.stringify({
    message: "essai passerelle en \xE9chec",
    model: r.model,
    error: r.error
  }))
}) : callGeminiResilient(modelChain, req, {
  retryDelaysMs: [
    2e3
  ],
  budgetMs: 5e4,
  onFailure: (r) => !r.ok && console.error(JSON.stringify({
    message: "essai Gemini en \xE9chec",
    model: r.model,
    error: r.error
  }))
});
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
  model: activeModel,
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
  // Modèle saturé (503) : un second essai 2 s plus tard, puis les modèles de secours ; réponse en moins de 50 s
  // pour rester sous le délai de l'app (60 s). Fournisseur choisi par AI_PROVIDER (Gemini direct ou passerelle).
  gemini: (req) => callAi(req),
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
