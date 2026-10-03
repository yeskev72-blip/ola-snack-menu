/**
 * Installation de l'application — version native : il n'y a rien à proposer.
 *
 * L'app Android est déjà installée quand ce code s'exécute. L'implémentation web est dans
 * install.web.ts.
 */
export type InstallOffer = null;

export function useInstallOffer(): InstallOffer {
  return null;
}

export async function promptInstall(): Promise<void> {
  // Rien à faire : l'application est déjà installée.
}
