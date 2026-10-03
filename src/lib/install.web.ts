import { useSyncExternalStore } from 'react';

/**
 * Proposition d'installer la PWA.
 *
 * Chrome n'offre « Installer l'application » que dans son menu, derrière trois points que
 * personne n'ouvre. Il prévient pourtant la page quand l'installation devient possible, par
 * l'événement beforeinstallprompt : on le retient pour pouvoir proposer l'installation au bon
 * moment, dans l'app, avec nos propres mots.
 *
 * Safari ne connaît pas cet événement. Sur iPhone, l'ajout à l'écran d'accueil passe
 * obligatoirement par le menu Partager, et aucun code ne peut le déclencher : on se contente
 * alors d'expliquer le geste.
 */

type Prompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/** 'prompt' : un clic suffit. 'ios' : expliquer le geste. null : rien à proposer. */
export type InstallOffer = 'prompt' | 'ios' | null;

let saved: Prompt | null = null;
const listeners = new Set<() => void>();

/** Déjà ouverte depuis l'écran d'accueil : il n'y a plus rien à installer. */
function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches;
  // Safari iOS n'implémente pas display-mode et expose navigator.standalone à la place.
  const ios = (window.navigator as { standalone?: boolean }).standalone === true;
  return Boolean(standalone || ios);
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS se présente comme un Mac : le tactile le distingue d'un vrai ordinateur.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function current(): InstallOffer {
  if (isInstalled()) return null;
  if (saved) return 'prompt';
  return isIOS() ? 'ios' : null;
}

function publish(): void {
  for (const listener of listeners) listener();
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Sans ceci, Chrome affiche sa propre barre d'installation en bas de l'écran, en plus de
    // la nôtre et dans sa langue à lui.
    event.preventDefault();
    saved = event as Prompt;
    publish();
  });
  // L'installation faite par le menu du navigateur doit aussi faire disparaître notre bandeau.
  window.addEventListener('appinstalled', () => {
    saved = null;
    publish();
  });
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/**
 * useSyncExternalStore plutôt qu'un état local : l'événement du navigateur peut arriver entre
 * le premier rendu et l'abonnement, et React relit alors la valeur de lui-même.
 */
export function useInstallOffer(): InstallOffer {
  // Le rendu statique de la construction web n'a ni navigateur ni installation possible.
  return useSyncExternalStore(subscribe, current, () => null);
}

/**
 * Ouvre la fenêtre d'installation du navigateur. Le navigateur n'accepte qu'un seul appel par
 * événement reçu : la proposition disparaît ensuite, quelle que soit la réponse.
 */
export async function promptInstall(): Promise<void> {
  const prompt = saved;
  if (!prompt) return;
  saved = null;
  try {
    await prompt.prompt();
    await prompt.userChoice;
  } catch {
    // Refus du navigateur (appel hors d'un geste de l'utilisateur, invite déjà consommée) :
    // sans conséquence, l'installation reste possible depuis son menu.
  }
  publish();
}
