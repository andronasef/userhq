"use client";

import * as React from "react";
import { Upload, LoaderCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { UploadResponseSchema, type UploadResponse } from "@userhq/types";
import { EntityLogo } from "./entity-logo";
import { Button } from "./ui/button";
import { Alert } from "./ui/alert";
import { uploadErrorCopy } from "@/lib/upload-errors";

export interface LogoValue {
  id: string;
  url: string;
}

export interface LogoFieldProps {
  value: LogoValue | null;
  onChange: (v: LogoValue | null) => void;
  onPendingChange?: (pending: boolean) => void;
  name: string;
  accent?: string;
}

interface MutationError {
  status?: number;
  code?: string;
  message?: string;
}

export function LogoField({
  value,
  onChange,
  onPendingChange,
  name,
  accent,
}: LogoFieldProps) {
  const [errorDetails, setErrorDetails] = React.useState<MutationError | null>(null);
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
          message: "Malformed upload response",
        };
      }

      return parsed.data;
    },
    onMutate: () => {
      setErrorDetails(null);
      onPendingChange?.(true);
    },
    onSuccess: (data) => {
      onChange({ id: data.id, url: data.url });
      setErrorDetails(null);
      onPendingChange?.(false);
    },
    onError: (err) => {
      setErrorDetails(err);
      onPendingChange?.(false);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      mutation.mutate(file);
    }
    // Reset file input so re-uploading same file triggers change
    e.target.value = "";
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveClick = () => {
    onChange(null);
    setErrorDetails(null);
  };

  const errorCopy = errorDetails ? uploadErrorCopy(errorDetails) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <EntityLogo
          size={64}
          src={value?.url}
          name={name}
          className={accent ? `style-accent` : undefined}
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={mutation.isPending}
              onClick={handleUploadClick}
            >
              {mutation.isPending ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  <span>Uploading…</span>
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  <span>Upload logo</span>
                </>
              )}
            </Button>

            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={mutation.isPending}
                onClick={handleRemoveClick}
              >
                Remove logo
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            PNG, JPEG, WebP, or GIF, up to 2 MB. Square images look best.
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFileChange}
      />

      {errorCopy && (
        <Alert variant="destructive">
          <div className="flex flex-col gap-1">
            <span className="font-semibold">{errorCopy.title}</span>
            <span>{errorCopy.body}</span>
          </div>
        </Alert>
      )}
    </div>
  );
}
