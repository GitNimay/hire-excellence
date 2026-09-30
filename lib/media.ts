/** Upload rules shared by the composer (UX) and the server (enforcement). */
export const MEDIA_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 95 * 1024 * 1024; // Workers request bodies cap at 100 MB
export const MAX_IMAGES = 4;
export const MAX_POST_CHARS = 3000;
export const MAX_COMMENT_CHARS = 1250;

export const isVideo = (type: string) => type.startsWith("video/");
export const maxBytes = (type: string) => (isVideo(type) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES);
