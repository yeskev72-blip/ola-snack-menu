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
  const bitmap = await decode(blob, width, height);
  try {
    // Le décodage a déjà pu réduire l'image ; ce second calcul la borne quand il ne l'a pas
    // fait, faute de connaître ses dimensions d'avance.
    const { width: w, height: h } = fitWithin(bitmap.width, bitmap.height, PHOTO.maxSide);
    if (w <= 0 || h <= 0) throw new PhotoError(t('photoErrors.size'));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext('2d');
    if (!context) throw new PhotoError(t('photoErrors.canvas'));
    context.drawImage(bitmap, 0, 0, w, h);
    const jpeg = await encode(canvas);
    return { uri: URL.createObjectURL(jpeg), base64: await toBase64(jpeg) };
  } finally {
    // La mémoire du décodage est rendue tout de suite, sans attendre le ramasse-miettes.
    bitmap.close();
  }
}

async function toBlob(uri: string): Promise<Blob> {
  try {
    return await (await fetch(uri)).blob();
  } catch {
    throw new PhotoError(t('photoErrors.read'));
  }
}

/**
 * Décodage à taille réduite quand le navigateur le permet. Les options de redimensionnement sont
 * ignorées par les navigateurs qui ne les connaissent pas : le repli garde alors l'image entière,
 * ce qui reste correct, seulement plus coûteux.
 */
async function decode(blob: Blob, width: number, height: number): Promise<ImageBitmap> {
  try {
    // Une seule dimension est demandée, jamais les deux : voir resizeOptions.
    return await createImageBitmap(blob, resizeOptions(width, height, PHOTO.maxSide));
  } catch {
    try {
      return await createImageBitmap(blob);
    } catch {
      // HEIC des iPhone et de certains Samsung, fichier abîmé, format exotique : le navigateur
      // ne sait pas le lire, et aucune nouvelle tentative n'y changera rien.
      throw new PhotoError(t('photoErrors.format'));
    }
  }
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
