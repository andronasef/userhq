"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import {
  CategoryInputSchema,
  CategorySchema,
  type Category,
  type CategoryInput,
} from "@userhq/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Field } from "../ui/field";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Alert } from "../ui/alert";
import { apiFetch, ApiClientError } from "../../lib/api-client";
import { errorCopy, FIELD_FOR_CODE } from "../../lib/api-errors";
import { QueryProvider } from "../../lib/query-client";

export interface CategoryDialogProps {
  mode: "add" | "rename";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  ws: string;
  product: string;
  initialCategory?: Category | null;
}

function CategoryDialogInner({
  mode,
  open,
  onOpenChange,
  onSaved,
  ws,
  product,
  initialCategory,
}: CategoryDialogProps): React.JSX.Element {
  const [alertError, setAlertError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CategoryInput>({
    resolver: zodResolver(CategoryInputSchema),
    mode: "onTouched",
    defaultValues: {
      name: initialCategory?.name ?? "",
    },
  });

  React.useEffect(() => {
    if (open) {
      setAlertError(null);
      reset({
        name: initialCategory?.name ?? "",
      });
    }
  }, [open, initialCategory, reset]);

  const mutation = useMutation<Category, unknown, CategoryInput>({
    mutationFn: async (data: CategoryInput) => {
      const url =
        mode === "add"
          ? `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/categories`
          : `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/categories/${encodeURIComponent(initialCategory!.id)}`;

      return apiFetch(url, {
        method: mode === "add" ? "POST" : "PATCH",
        body: data,
        schema: CategorySchema,
      });
    },
    onSuccess: () => {
      onOpenChange(false);
      toast.success(
        mode === "add" ? "Category added" : "Category renamed"
      );
      onSaved?.();
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError && err.code) {
        const field = FIELD_FOR_CODE[err.code];
        if (field === "name") {
          setError("name", { message: errorCopy(err) });
          return;
        }
      }
      setAlertError(errorCopy(err as any));
    },
  });

  const onSubmit = (data: CategoryInput) => {
    setAlertError(null);
    mutation.mutate(data);
  };

  const isPending = mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Add category" : "Rename category"}
          </DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "Group feedback by topic so customers can find and file related ideas."
              : "Rename this category. Existing posts will keep their assignment."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <fieldset disabled={isPending} className="space-y-4">
            <Field id="category-name" label="Name" error={errors.name?.message}>
              <Input
                placeholder="Integrations"
                autoFocus
                {...register("name")}
              />
            </Field>

            {alertError && <Alert variant="destructive">{alertError}</Alert>}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Discard changes
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    <span>Saving…</span>
                  </>
                ) : mode === "add" ? (
                  "Add category"
                ) : (
                  "Save category"
                )}
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CategoryDialog(props: CategoryDialogProps): React.JSX.Element {
  return (
    <QueryProvider>
      <CategoryDialogInner {...props} />
    </QueryProvider>
  );
}
