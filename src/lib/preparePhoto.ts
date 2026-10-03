import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { PHOTO } from '@/config';
import { t } from '@/i18n';
import { PhotoError } from '@/lib/photoError';

export type PreparedPhoto = { uri: string; base64: string };

/**
 * Réduit la photo (côté long ~1024 px) et la compresse en JPEG avant envoi.
 *
 * Version native. Le web a la sienne dans preparePhoto.web.ts : le navigateur n'a pas les mêmes
 * limites de mémoire ni les mêmes formats décodables qu'Android.
 */
export async function preparePhoto(uri: string, width: number, height: number): Promise<PreparedPhoto> {
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > PHOTO.maxSide) {
    context.resize(width >= height ? { width: PHOTO.maxSide } : { height: PHOTO.maxSide });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ base64: true, compress: PHOTO.jpegQuality, format: SaveFormat.JPEG });
  if (!result.base64) throw new PhotoError(t('photoErrors.encode'));
  return { uri: result.uri, base64: result.base64 };
}
