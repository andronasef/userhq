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

export interface StatusDialogProps {
  mode: "add" | "edit";
  status?: Status | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (status: Status) => void;
  ws: string;
  product: string;
}

const TYPE_LABELS: Record<StatusType, string> = {
  review: "Review",
  planned: "Planned",
  active: "In Progress",
  completed: "Completed",
  closed: "Closed",
};

function StatusDialogInner({
  mode,
  status,
  open,
  onOpenChange,
  onSaved,
  ws,
  product,
}: StatusDialogProps): React.JSX.Element {
  const [alertError, setAlertError] = React.useState<string | null>(null);

  const defaultValues: CreateStatusInput = {
    name: status?.name ?? "",
    type: status?.type ?? "review",
    color: status?.color ?? "#6B7280",
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
      toast.success(mode === "add" ? "Status added" : "Status updated");
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
            {mode === "add" ? "Add status" : "Edit status"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <fieldset disabled={mutation.isPending} className="space-y-4">
            <Field
              id="status-name"
              label="Name"
              error={errors.name?.message}
            >
              <Input
                placeholder="e.g. Under Review"
                {...register("name")}
              />
            </Field>

            <Field
              id="status-type"
              label="Type"
              helper="The type decides how the status behaves, for example which posts count as done."
              error={errors.type?.message}
            >
              <NativeSelect {...register("type")}>
                {STATUS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <ColorField
              label="Color"
              value={colorValue}
              onChange={(hex) =>
                setValue("color", hex, { shouldValidate: true })
              }
              error={errors.color?.message}
            />

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
                Discard changes
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    <span>Saving…</span>
                  </>
                ) : mode === "add" ? (
                  "Add status"
                ) : (
                  "Save status"
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
