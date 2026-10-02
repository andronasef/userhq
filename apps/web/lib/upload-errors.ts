export type UploadErrorCopy = {
  title: string;
  body: string;
  signInAgain: boolean;
};

const KNOWN_UPLOAD_ERRORS: Record<
  string,
  { title: string; body: string; signInAgain: boolean }
> = {
  file_too_large: {
    title: "File too large",
    body: "Images must be 2 MB or smaller. Choose a smaller file and try again.",
    signInAgain: false,
  },
  unsupported_type: {
    title: "Unsupported file type",
    body: "Only PNG, JPEG, WebP, and GIF images can be uploaded. SVGs and other file types are rejected, even if renamed.",
    signInAgain: false,
  },
  image_too_large: {
    title: "Image dimensions too large",
    body: "This image is over 40 megapixels. Resize it and try again.",
    signInAgain: false,
  },
  image_unreadable: {
    title: "Image couldn't be read",
    body: "The file looks like an image but couldn't be processed. It may be damaged. Try a different file.",
    signInAgain: false,
  },
  no_file: {
    title: "No file received",
    body: "Choose a file before selecting Upload image.",
    signInAgain: false,
  },
  unauthorized: {
    title: "Session ended",
    body: "Your session has ended. Sign in again to keep testing uploads.",
    signInAgain: true,
  },
};

export function uploadErrorCopy(err?: {
  status?: number;
  code?: string;
  message?: string;
}): UploadErrorCopy {
  if (err?.code && KNOWN_UPLOAD_ERRORS[err.code]) {
    return KNOWN_UPLOAD_ERRORS[err.code];
  }

  if (err?.status === 401) {
    return KNOWN_UPLOAD_ERRORS.unauthorized;
  }
  if (err?.status === 413) {
    return KNOWN_UPLOAD_ERRORS.file_too_large;
  }
  if (err?.status === 415) {
    return KNOWN_UPLOAD_ERRORS.unsupported_type;
  }

  const genericBody = "Something went wrong on our end. Try again in a moment.";

  if (
    typeof err?.message === "string" &&
    err.message.trim().length > 0 &&
    err.message.length < 200
  ) {
    return {
      title: "Upload failed",
      body: err.message.trim(),
      signInAgain: false,
    };
  }

  return {
    title: "Upload failed",
    body: genericBody,
    signInAgain: false,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    const kb = Math.max(1, Math.round(bytes / 1024));
    return `${kb} KB`;
  }
  const mb = (bytes / (1024 * 1024)).toFixed(1);
  return `${mb} MB`;
}
