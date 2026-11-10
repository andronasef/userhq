"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import {
  CreateStatusInputSchema,
  StatusSchema,
  STATUS_TYPES,
  type CreateStatusInput,
  type Status,
  type StatusType,
} from "@userhq/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Field } from "../ui/field";
import { Input } from "../ui/input";
import { NativeSelect } from "../ui/native-select";
import { ColorField } from "../color-field";
import { Button } from "../ui/button";
import { Alert } from "../ui/alert";
import { apiFetch, ApiClientError } from "../../lib/api-client";
import { errorCopy, FIELD_FOR_CODE } from "../../lib/api-errors";
import { QueryProvider } from "../../lib/query-client";
import { useI18n } from "../../lib/i18n/context";

export interface StatusDialogProps {
  mode: "add" | "edit";
  status?: Status | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (status: Status) => void;
  ws: string;
  product: string;
}

function StatusDialogInner({
  mode,
  status,
  open,
  onOpenChange,
  onSaved,
  ws,
  product,
}: StatusDialogProps): React.JSX.Element {
  const { t } = useI18n();
  const [alertError, setAlertError] = React.useState<string | null>(null);

  const typeLabels: Record<StatusType, string> = {
    review: t("statuses.typeReview"),
    planned: t("statuses.typePlanned"),
    active: t("statuses.typeActive"),
    completed: t("statuses.typeCompleted"),
    closed: t("statuses.typeClosed"),
  };

  const defaultValues: CreateStatusInput = {
    name: status?.name ?? "",
    type: status?.type ?? "review",
    color: status?.color ?? "#6B7280",
    isPublicRoadmap: status?.isPublicRoadmap ?? false,
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    reset,
    formState: { errors },
  } = useForm<CreateStatusInput>({
    resolver: zodResolver(CreateStatusInputSchema),
    mode: "onTouched",
    defaultValues,
  });

  React.useEffect(() => {
    if (open) {
      setAlertError(null);
      reset({
        name: status?.name ?? "",
        type: status?.type ?? "review",
        color: status?.color ?? "#6B7280",
        isPublicRoadmap: status?.isPublicRoadmap ?? false,
      });
    }
  }, [open, status, reset]);

  const colorValue = watch("color") || "#6B7280";

  const mutation = useMutation({
    mutationFn: async (data: CreateStatusInput) => {
      if (mode === "add") {
        return apiFetch(
          `/api/v1/workspaces/${ws}/products/${product}/statuses`,
          {
            method: "POST",
            body: data,
            schema: StatusSchema,
          }
        );
      } else {
        return apiFetch(
          `/api/v1/workspaces/${ws}/products/${product}/statuses/${status!.id}`,
          {
            method: "PATCH",
            body: data,
            schema: StatusSchema,
          }
        );
      }
    },
    onSuccess: (saved) => {
      toast.success(mode === "add" ? t("statuses.statusAdded") : t("statuses.statusUpdated"));
      onSaved(saved);
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError && err.code) {
        if (err.code === "status_name_taken") {
          setError("name", {
            message: "This product already has a status with that name.",
          });
          return;
        }
        const field = FIELD_FOR_CODE[err.code];
        if (field && ["name", "color", "type"].includes(field)) {
          setError(field as any, { message: errorCopy(err) });
          return;
        }
      }
      setAlertError(errorCopy(err as any));
    },
  });

  const onSubmit = (data: CreateStatusInput) => {
    setAlertError(null);
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? t("statuses.addStatus") : t("statuses.editStatus")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <fieldset disabled={mutation.isPending} className="space-y-4">
            <Field
              id="status-name"
              label={t("statuses.nameLabel")}
              error={errors.name?.message}
            >
              <Input
                placeholder={t("statuses.namePlaceholder")}
                {...register("name")}
              />
            </Field>

            <Field
              id="status-type"
              label={t("statuses.typeLabel")}
              helper={t("statuses.typeHelper")}
              error={errors.type?.message}
            >
              <NativeSelect {...register("type")}>
                {STATUS_TYPES.map((st) => (
                  <option key={st} value={st}>
                    {typeLabels[st]}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <ColorField
              label={t("statuses.colorLabel")}
              value={colorValue}
              onChange={(hex) =>
                setValue("color", hex, { shouldValidate: true })
              }
              error={errors.color?.message}
            />


            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                id="status-is-public-roadmap"
                {...register("isPublicRoadmap")}
                className="size-4 rounded border-border text-primary focus:ring-ring mt-0.5"
              />
              <div className="flex flex-col">
                <label
                  htmlFor="status-is-public-roadmap"
                  className="text-sm font-medium text-foreground cursor-pointer"
                >
                  {t("statuses.showOnRoadmap")}
                </label>
                <p className="text-xs text-muted-foreground">
                  {t("statuses.showOnPublicRoadmapHelp")}
                </p>
              </div>
            </div>

            {alertError && (
              <Alert variant="destructive">
                {alertError}
              </Alert>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                {t("categories.discardChanges")}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    <span>{t("common.saving")}</span>
                  </>
                ) : mode === "add" ? (
                  t("statuses.addStatus")
                ) : (
                  t("statuses.editStatus")
                )}
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StatusDialog(props: StatusDialogProps): React.JSX.Element {
  return (
    <QueryProvider>
      <StatusDialogInner {...props} />
    </QueryProvider>
  );
}
