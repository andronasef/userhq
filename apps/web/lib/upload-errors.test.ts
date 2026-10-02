import { describe, expect, it } from "vitest";
import { uploadErrorCopy, formatFileSize } from "./upload-errors.js";

describe("uploadErrorCopy", () => {
  it("maps file_too_large (413)", () => {
    expect(uploadErrorCopy({ status: 413, code: "file_too_large" })).toEqual({
      title: "File too large",
      body: "Images must be 2 MB or smaller. Choose a smaller file and try again.",
      signInAgain: false,
    });
  });

  it("maps unsupported_type", () => {
    expect(uploadErrorCopy({ status: 415, code: "unsupported_type" })).toEqual({
      title: "Unsupported file type",
      body: "Only PNG, JPEG, WebP, and GIF images can be uploaded. SVGs and other file types are rejected, even if renamed.",
      signInAgain: false,
    });
  });

  it("maps image_too_large", () => {
    expect(uploadErrorCopy({ status: 422, code: "image_too_large" })).toEqual({
      title: "Image dimensions too large",
      body: "This image is over 40 megapixels. Resize it and try again.",
      signInAgain: false,
    });
  });

  it("maps image_unreadable", () => {
    expect(uploadErrorCopy({ status: 422, code: "image_unreadable" })).toEqual({
      title: "Image couldn't be read",
      body: "The file looks like an image but couldn't be processed. It may be damaged. Try a different file.",
      signInAgain: false,
    });
  });

  it("maps no_file", () => {
    expect(uploadErrorCopy({ status: 400, code: "no_file" })).toEqual({
      title: "No file received",
      body: "Choose a file before selecting Upload image.",
      signInAgain: false,
    });
  });

  it("maps unauthorized (401)", () => {
    expect(uploadErrorCopy({ status: 401, code: "unauthorized" })).toEqual({
      title: "Session ended",
      body: "Your session has ended. Sign in again to keep testing uploads.",
      signInAgain: true,
    });
  });

  it("maps unknown code with short message", () => {
    expect(
      uploadErrorCopy({ status: 500, code: "custom_code", message: "Quota exceeded" })
    ).toEqual({
      title: "Upload failed",
      body: "Quota exceeded",
      signInAgain: false,
    });
  });

  it("maps unknown code with empty message to generic message", () => {
    expect(uploadErrorCopy({ status: 500, code: "custom_code", message: "" })).toEqual({
      title: "Upload failed",
      body: "Something went wrong on our end. Try again in a moment.",
      signInAgain: false,
    });
  });

  it("maps unknown code with message 200+ chars to generic message", () => {
    const longMessage = "a".repeat(205);
    expect(
      uploadErrorCopy({ status: 500, code: "custom_code", message: longMessage })
    ).toEqual({
      title: "Upload failed",
      body: "Something went wrong on our end. Try again in a moment.",
      signInAgain: false,
    });
  });

  it("maps network failure (no status) and 500/502 to generic message", () => {
    expect(uploadErrorCopy()).toEqual({
      title: "Upload failed",
      body: "Something went wrong on our end. Try again in a moment.",
      signInAgain: false,
    });
    expect(uploadErrorCopy({ status: 500 })).toEqual({
      title: "Upload failed",
      body: "Something went wrong on our end. Try again in a moment.",
      signInAgain: false,
    });
    expect(uploadErrorCopy({ status: 502 })).toEqual({
      title: "Upload failed",
      body: "Something went wrong on our end. Try again in a moment.",
      signInAgain: false,
    });
  });
});

describe("formatFileSize", () => {
  it("formats sub-1MiB bytes to KB with minimum 1 KB", () => {
    expect(formatFileSize(512)).toBe("1 KB");
    expect(formatFileSize(150 * 1024)).toBe("150 KB");
  });

  it("formats >=1MiB bytes to MB with one decimal place", () => {
    expect(formatFileSize(1048576)).toBe("1.0 MB");
    expect(formatFileSize(2 * 1048576)).toBe("2.0 MB");
    expect(formatFileSize(1.5 * 1048576)).toBe("1.5 MB");
  });
});
