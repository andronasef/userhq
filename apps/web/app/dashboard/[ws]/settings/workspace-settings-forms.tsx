"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { LoaderCircle, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import {
  UpdateWorkspaceInputSchema,
  WorkspaceSchema,
  type Workspace,
  type UpdateWorkspaceInput,
} from "@userhq/types";
import { Field } from "../../../../components/ui/field";
import { Input } from "../../../../components/ui/input";
import { SlugInput } from "../../../../components/slug-input";
import { LogoField, type LogoValue } from "../../../../components/logo-field";
import { Button } from "../../../../components/ui/button";
import { Alert } from "../../../../components/ui/alert";
import { apiFetch, ApiClientError } from "../../../../lib/api-client";
import { errorCopy, FIELD_FOR_CODE } from "../../../../lib/api-errors";
import { QueryProvider } from "../../../../lib/query-client";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { flash } from "../../../../components/ui/toaster";
import { useI18n } from "../../../../lib/i18n/context";

export interface WorkspaceSettingsFormsProps {
  ws: string;
  workspace: Workspace;
  host: string;
}

function WorkspaceGeneralForm({
  ws,
  workspace,
  host,
}: WorkspaceSettingsFormsProps): React.JSX.Element {
  const { t } = useI18n();
  const router = useRouter();
  const [copied, setCopied] = React.useState(false);
  const [alertError, setAlertError] = React.useState<string | null>(null);
  const [logoValue, setLogoValue] = React.useState<LogoValue | null>(
    workspace.logoUrl ? { id: "", url: workspace.logoUrl } : null,
  );
  const [logoUploading, setLogoUploading] = React.useState(false);

  const defaultValues: UpdateWorkspaceInput = {
    name: workspace.name,
    websiteUrl: workspace.websiteUrl ?? "",
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateWorkspaceInput>({
    resolver: zodResolver(UpdateWorkspaceInputSchema),
    mode: "onTouched",
    defaultValues,
  });

  const nameValue = watch("name");

  const mutation = useMutation({
    mutationFn: async (data: UpdateWorkspaceInput) => {
      return apiFetch(`/api/v1/workspaces/${ws}`, {
        method: "PATCH",
        body: data,
        schema: WorkspaceSchema,
      });
    },
    onSuccess: (updated) => {
      toast.success(t("settings.savedToast"));
      reset({
        name: updated.name,
        websiteUrl: updated.websiteUrl ?? "",
      });
      setLogoValue(updated.logoUrl ? { id: "", url: updated.logoUrl } : null);
      router.refresh();
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError && err.code) {
        const field = FIELD_FOR_CODE[err.code];
        if (field && ["name", "websiteUrl"].includes(field)) {
          setError(field as any, { message: errorCopy(err) });
          return;
        }
      }
      const message = errorCopy(err as any);
      setAlertError(message);
    },
  });

  const onSubmit = (data: UpdateWorkspaceInput) => {
    setAlertError(null);
    mutation.mutate(data);
  };

  const fullUrl = `https://${host}/${workspace.slug}`;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-xl">
      {alertError && <Alert variant="destructive">{alertError}</Alert>}

      <Field
        label={t("settings.workspaceNameLabel")}
        id="ws-name"
        error={errors.name?.message}
      >
        <Input
          id="ws-name"
          {...register("name")}
          placeholder="e.g. Acme Corp"
          aria-invalid={!!errors.name}
          maxLength={50}
        />
      </Field>

      <Field label={t("settings.productUrlLabel")} id="ws-slug">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <SlugInput
              id="ws-slug"
              prefix={`${host}/`}
              value={workspace.slug}
              readOnly
              disabled
              aria-readonly="true"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyUrl}
            className="shrink-0 gap-1.5"
            aria-label={t("settings.copyUrl")}
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-success" aria-hidden="true" />
                <span>{t("settings.copied")}</span>
              </>
            ) : (
              <>
                <Copy
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>{t("settings.copyUrl")}</span>
              </>
            )}
          </Button>
        </div>
      </Field>

      <Field label={t("settings.logoLabel")} id="ws-logo">
        <LogoField
          name={nameValue || workspace.name}
          value={logoValue}
          onChange={(v) => {
            setLogoValue(v);
            setValue("logoUploadId", v?.id || null, { shouldDirty: true });
          }}
          onPendingChange={setLogoUploading}
        />
      </Field>

      <Field
        label={t("settings.websiteLabel")}
        id="ws-website"
        error={errors.websiteUrl?.message}
        helper="Your portals link back here, and visitors land here when the product directory is off."
      >
        <Input
          id="ws-website"
          type="url"
          {...register("websiteUrl")}
          placeholder="https://example.com"
          aria-invalid={!!errors.websiteUrl}
        />
      </Field>

      <div>
        <Button
          type="submit"
          disabled={!isDirty || logoUploading || mutation.isPending}
        >
          {mutation.isPending ? (
            <>
              <LoaderCircle
                className="size-4 animate-spin mr-2"
                aria-hidden="true"
              />
              <span>{t("settings.saving")}</span>
            </>
          ) : (
            <span>{t("settings.saveChanges")}</span>
          )}
        </Button>
      </div>
    </form>
  );
}

function WorkspaceDirectoryForm({
  ws,
  workspace,
}: WorkspaceSettingsFormsProps): React.JSX.Element {
  const { t } = useI18n();
  const router = useRouter();
  const [alertError, setAlertError] = React.useState<string | null>(null);

  const defaultValues: UpdateWorkspaceInput = {
    directoryEnabled: workspace.directoryEnabled,
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<UpdateWorkspaceInput>({
    resolver: zodResolver(UpdateWorkspaceInputSchema),
    defaultValues,
  });

  const mutation = useMutation({
    mutationFn: async (data: UpdateWorkspaceInput) => {
      return apiFetch(`/api/v1/workspaces/${ws}`, {
        method: "PATCH",
        body: data,
        schema: WorkspaceSchema,
      });
    },
    onSuccess: (updated) => {
      toast.success(t("settings.savedToast"));
      reset({
        directoryEnabled: updated.directoryEnabled,
      });
      router.refresh();
    },
    onError: (err: unknown) => {
      const message = errorCopy(err as any);
      setAlertError(message);
    },
  });

  const onSubmit = (data: UpdateWorkspaceInput) => {
    setAlertError(null);
    mutation.mutate(data);
  };

  return (
    <div className="border-t border-border pt-8 mt-8 max-w-xl">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        {t("settings.directoryHeading")}
      </h2>

      {alertError && (
        <Alert variant="destructive" className="mb-4">
          {alertError}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-start gap-3">
          <input
            id="ws-directory-enabled"
            type="checkbox"
            {...register("directoryEnabled")}
            className="size-4 mt-1 rounded border-border accent-foreground cursor-pointer"
          />
          <div className="flex flex-col gap-1">
            <label
              htmlFor="ws-directory-enabled"
              className="text-sm font-medium text-foreground cursor-pointer"
            >
              {t("settings.directoryLabel").replace("{ws}", ws)}
            </label>
            <p className="text-xs text-muted-foreground">
              {t("settings.directoryHelp").replaceAll("{ws}", ws)}
            </p>
          </div>
        </div>

        <div>
          <Button
            type="submit"
            variant="outline"
            disabled={!isDirty || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <LoaderCircle
                  className="size-4 animate-spin mr-2"
                  aria-hidden="true"
                />
                <span>{t("settings.saving")}</span>
              </>
            ) : (
              <span>{t("settings.saveChanges")}</span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function WorkspaceDangerZone({
  ws,
  workspace,
}: WorkspaceSettingsFormsProps): React.JSX.Element | null {
  const { t } = useI18n();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");

  if (workspace.role !== "owner") {
    return null;
  }

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setConfirmText("");
    }
  };

  const handleDelete = async () => {
    await apiFetch(`/api/v1/workspaces/${ws}`, {
      method: "DELETE",
    });
    flash(`${workspace.name} deleted`);
    window.location.assign("/dashboard");
  };

  const isConfirmed = confirmText.trim() === workspace.name;

  return (
    <div className="border-t border-border pt-8 mt-8 max-w-xl">
      <div className="rounded-lg border border-destructive/30 p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-destructive">
            {t("settings.dangerZoneHeading")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("settings.deleteWorkspaceDesc")}
          </p>
        </div>

        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDialogOpen(true)}
            className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
          >
            {t("settings.deleteWorkspace")}
          </Button>
        </div>

        <ConfirmDialog
          open={dialogOpen}
          onOpenChange={handleOpenChange}
          title={`Delete ${workspace.name}?`}
          description="All products in this workspace will be taken offline immediately, and the workspace URL cannot be used again. This cannot be undone."
          dismissLabel={t("settings.keepWorkspace")}
          confirmLabel={t("settings.deleteWorkspace")}
          pendingLabel={t("settings.deleting")}
          confirmDisabled={!isConfirmed}
          onConfirm={handleDelete}
        >
          <Field
            id="confirm-delete-workspace"
            label={`Type ${workspace.name} to confirm`}
          >
            <Input
              id="confirm-delete-workspace"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={workspace.name}
              autoComplete="off"
            />
          </Field>
        </ConfirmDialog>
      </div>
    </div>
  );
}

export function WorkspaceSettingsForms(
  props: WorkspaceSettingsFormsProps,
): React.JSX.Element {
  return (
    <QueryProvider>
      <div className="space-y-4">
        <WorkspaceGeneralForm {...props} />
        <WorkspaceDirectoryForm {...props} />
        <WorkspaceDangerZone {...props} />
      </div>
    </QueryProvider>
  );
}
