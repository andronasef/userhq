"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { LoaderCircle, Copy, Check } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import { Alert } from "../../../components/ui/alert.js";
import {
  UploadResponseSchema,
  type UploadResponse,
} from "@userhq/types";
import {
  uploadErrorCopy,
  formatFileSize,
  type UploadErrorCopy,
} from "../../../lib/upload-errors.js";

interface MutationError {
  status?: number;
  code?: string;
  message?: string;
}

export function UploadForm(): React.JSX.Element {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [successResult, setSuccessResult] =
    React.useState<UploadResponse | null>(null);
  const [errorDetails, setErrorDetails] = React.useState<MutationError | null>(
    null
  );
  const [copied, setCopied] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const mutation = useMutation<UploadResponse, MutationError, File>({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/v1/uploads", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw {
          status: res.status,
          code: json?.code,
          message: json?.message,
        };
      }

      const parsed = UploadResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw {
          status: res.status,
          message: "Invalid upload response format.",
        };
      }

      return parsed.data;
    },
    onMutate: () => {
      setSuccessResult(null);
      setErrorDetails(null);
    },
    onSuccess: (data) => {
      setSuccessResult(data);
      setErrorDetails(null);
    },
    onError: (err) => {
      setErrorDetails(err);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || mutation.isPending) return;
    mutation.mutate(selectedFile);
  };

  const handleCopyUrl = async () => {
    if (!successResult) return;
    try {
      const fullUrl = window.location.origin + successResult.url;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback or ignore clipboard errors
    }
  };

  const errorCopy: UploadErrorCopy | null = errorDetails
    ? uploadErrorCopy(errorDetails)
    : null;

  return (
    <div className="flex flex-col gap-6 w-full">
      <form onSubmit={handleUpload} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="upload-file"
            className="text-sm font-semibold text-foreground"
          >
            Image file
          </label>
          <input
            ref={fileInputRef}
            type="file"
            id="upload-file"
            name="file"
            disabled={mutation.isPending}
            onChange={handleFileChange}
            className="file:mr-4 file:h-9 file:px-4 file:rounded-md file:border file:border-input file:bg-background file:text-sm file:font-semibold hover:file:bg-muted text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
          {selectedFile ? (
            <p
              className="text-sm text-muted-foreground truncate"
              title={selectedFile.name}
            >
              <span>{selectedFile.name}</span> ·{" "}
              <span>{formatFileSize(selectedFile.size)}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              PNG, JPEG, WebP, or GIF, up to 2 MB.
            </p>
          )}
        </div>

        <div>
          <Button
            type="submit"
            variant="default"
            disabled={!selectedFile || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <LoaderCircle
                  className="size-4 animate-spin shrink-0"
                  aria-hidden="true"
                />
                <span>Uploading…</span>
              </>
            ) : (
              <span>Upload image</span>
            )}
          </Button>
        </div>
      </form>

      {errorCopy && (
        <Alert variant="destructive" title={errorCopy.title}>
          <div>{errorCopy.body}</div>
          {errorCopy.signInAgain && (
            <div className="mt-2">
              <Link
                href="/login?next=%2Fdev%2Fupload"
                className="text-foreground underline font-semibold inline-block"
              >
                Sign in again
              </Link>
            </div>
          )}
        </Alert>
      )}

      {successResult ? (
        <div className="bg-muted rounded-lg p-4 flex flex-col gap-4">
          <Alert variant="success" title="Upload complete">
            <span className="sr-only">Upload succeeded</span>
          </Alert>

          <div className="bg-background border border-border rounded-md p-2 flex items-center justify-center">
            <img
              src={successResult.url}
              alt="Uploaded image preview"
              className="max-h-80 object-contain rounded"
            />
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="font-semibold text-muted-foreground">Format</dt>
            <dd className="text-foreground">WebP</dd>

            <dt className="font-semibold text-muted-foreground">Dimensions</dt>
            <dd className="text-foreground">
              {successResult.width} × {successResult.height} px
            </dd>

            <dt className="font-semibold text-muted-foreground">Size</dt>
            <dd className="text-foreground">
              {formatFileSize(successResult.bytes)}
            </dd>

            <dt className="font-semibold text-muted-foreground">URL</dt>
            <dd>
              <a
                href={successResult.url}
                target="_blank"
                rel="noopener"
                className="font-mono text-sm break-all text-foreground underline"
              >
                {successResult.url}
              </a>
            </dd>
          </dl>

          <Button
            type="button"
            variant="ghost"
            onClick={handleCopyUrl}
            className="self-start"
          >
            {copied ? (
              <>
                <Check className="size-4 shrink-0" aria-hidden="true" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-4 shrink-0" aria-hidden="true" />
                <span>Copy URL</span>
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-lg p-8 text-center flex flex-col items-center justify-center gap-2">
          <h2 className="text-base font-semibold text-foreground">
            No image uploaded yet
          </h2>
          <p className="text-sm text-muted-foreground">
            Choose an image and select Upload image. The converted WebP will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
