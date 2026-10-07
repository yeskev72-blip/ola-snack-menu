import { PHOTO } from '@/config';
import { PhotoError } from '@/lib/photoError';
import { fitWithin, resizeOptions } from '@/lib/photoSize';
import { t } from '@/i18n';

export type PreparedPhoto = { uri: string; base64: string };

/**
 * Réduit la photo et la compresse en JPEG, côté navigateur.
 *
 * Écrite à la main plutôt que confiée à expo-image-manipulator, dont la version web charge
 * l'image dans une balise <img> puis la dessine dans un canvas à sa taille d'origine. Une photo
 * de téléphone fait aujourd'hui 50 à 108 mégapixels : ce canvas réclame plusieurs centaines de
 * mégaoctets, au-delà de ce qu'un navigateur de téléphone accorde, et l'échec ne dit rien.
 *
 * createImageBitmap décode et réduit en une seule étape, sans jamais allouer l'image entière :
 * la mémoire utilisée dépend de la taille d'arrivée, pas de celle du capteur.
 *
 * Chaque étape qui peut échouer le dit avec ses mots. « Réessaie » ne sert à rien face à un
 * format que le navigateur ne sait pas lire : il faut dire que c'est le format.
 */
export async function preparePhoto(uri: string, width: number, height: number): Promise<PreparedPhoto> {
  const blob = await toBlob(uri);
  const image = await decode(blob, width, height);
  try {
    // Le décodage a déjà pu réduire l'image ; ce second calcul la borne quand il ne l'a pas
    // fait, faute de connaître ses dimensions d'avance.
    const { width: w, height: h } = fitWithin(image.width, image.height, PHOTO.maxSide);
    if (w <= 0 || h <= 0) throw new PhotoError(t('photoErrors.size'));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext('2d');
    if (!context) throw new PhotoError(t('photoErrors.canvas'));
    context.drawImage(image.source, 0, 0, w, h);
    const jpeg = await encode(canvas);
    return { uri: URL.createObjectURL(jpeg), base64: await toBase64(jpeg) };
  } finally {
    // La mémoire du décodage est rendue tout de suite, sans attendre le ramasse-miettes.
    image.release();
  }
}

async function toBlob(uri: string): Promise<Blob> {
  try {
    return await (await fetch(uri)).blob();
  } catch {
    throw new PhotoError(t('photoErrors.read'));
  }
}

/** Image décodée, quel que soit le chemin qui y est parvenu. */
type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

/**
 * Décode la photo, du chemin le plus économe au plus permissif.
 *
 * 1. createImageBitmap avec réduction : décode et réduit d'un coup, sans jamais allouer l'image
 *    entière. C'est ce qui permet d'ouvrir une photo de 108 mégapixels sur un téléphone.
 * 2. createImageBitmap sans options : pour les navigateurs qui ignorent la réduction.
 * 3. Une balise <img> : plus coûteuse, mais elle passe par le décodeur d'images du système.
 *    Android sait y lire des formats que createImageBitmap refuse — le HEIC des appareils
 *    récents, notamment. Sans ce recours, ces photos étaient simplement refusées.
 */
async function decode(blob: Blob, width: number, height: number): Promise<Decoded> {
  for (const tentative of [
    () => createImageBitmap(blob, resizeOptions(width, height, PHOTO.maxSide)),
    () => createImageBitmap(blob),
  ]) {
    try {
      const bitmap = await tentative();
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Chemin suivant.
    }
  }
  return decodeViaElement(blob);
}

/** Dernier recours : le décodeur du système, atteint par une balise <img>. */
function decodeViaElement(blob: Blob): Promise<Decoded> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () =>
      resolve({
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        release: () => URL.revokeObjectURL(url),
      });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      // Fichier abîmé, ou format qu'aucun décodeur de cet appareil ne connaît : aucune nouvelle
      // tentative n'y changera rien, et le message doit le dire.
      reject(new PhotoError(t('photoErrors.format')));
    };
    img.src = url;
  });
}

function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new PhotoError(t('photoErrors.encode')))),
      'image/jpeg',
      PHOTO.jpegQuality,
    );
  });
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new PhotoError(t('photoErrors.encode')));
    reader.onloadend = () => {
      const url = String(reader.result);
      const virgule = url.indexOf(',');
      if (virgule < 0) return reject(new PhotoError(t('photoErrors.encode')));
      resolve(url.slice(virgule + 1));
    };
    reader.readAsDataURL(blob);
  });
}
