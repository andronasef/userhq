"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { LoaderCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  CreatePostInputSchema,
  PostCreatedSchema,
  type CreatePostInput,
  type PostCreated,
} from "@userhq/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { errorCopy, FIELD_FOR_CODE } from "@/lib/api-errors";
import { QueryProvider } from "@/lib/query-client";
import { postHref, portalHref } from "@/lib/tenant";

export interface PostFormDialogProps {
  ws: string;
  product: string;
  categories?: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PostFormDialogInner({
  ws,
  product,
  categories = [],
  open,
  onOpenChange,
}: PostFormDialogProps): React.JSX.Element {
  const router = useRouter();
  const [alertError, setAlertError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<z.input<typeof CreatePostInputSchema>, any, CreatePostInput>({
    resolver: zodResolver(CreatePostInputSchema),
    mode: "onTouched",
    defaultValues: {
      title: "",
      description: null,
      categoryId: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      setAlertError(null);
      reset({
        title: "",
        description: null,
        categoryId: "",
      });
    }
  }, [open, reset]);

  const mutation = useMutation<PostCreated, unknown, CreatePostInput>({
    mutationFn: async (data: CreatePostInput) => {
      return apiFetch(
        `/api/v1/portal/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/posts`,
        {
          method: "POST",
          body: data,
          schema: PostCreatedSchema,
        }
      );
    },
    onSuccess: (result) => {
      onOpenChange(false);
      router.push(postHref(ws, product, result.number, result.slug));
      toast.success("Post submitted");
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError && err.code) {
        const field = FIELD_FOR_CODE[err.code];
        if (field && ["title", "description", "categoryId"].includes(field)) {
          setError(field as "title" | "description" | "categoryId", {
            message: errorCopy(err),
          });
          return;
        }
      }
      setAlertError(errorCopy(err as any));
    },
  });

  const onSubmit = (data: CreatePostInput) => {
    setAlertError(null);
    if (categories.length > 0 && (!data.categoryId || data.categoryId === "")) {
      setError("categoryId", { message: "Choose a category." });
      return;
    }
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New post</DialogTitle>
          <DialogDescription>
            Describe the problem or idea. Others can vote on it and join the
            conversation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <fieldset disabled={mutation.isPending} className="space-y-4">
            <Field id="post-title" label="Title" error={errors.title?.message}>
              <Input
                placeholder='A short summary, like "Export to CSV"'
                {...register("title")}
              />
            </Field>

            {categories.length > 0 && (
              <Field
                id="post-category"
                label="Category"
                error={errors.categoryId?.message}
              >
                <NativeSelect
                  id="post-category"
                  defaultValue=""
                  {...register("categoryId")}
                >
                  <option value="" disabled>
                    Choose a category
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}

            <Field
              id="post-details"
              label="Details (optional)"
              error={errors.description?.message}
            >
              <Textarea
                placeholder="What are you trying to do, and what gets in the way?"
                {...register("description")}
              />
            </Field>

            {alertError && <Alert variant="destructive">{alertError}</Alert>}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                Discard post
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    <span>Submitting…</span>
                  </>
                ) : (
                  "Submit post"
                )}
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PostFormDialog(props: PostFormDialogProps): React.JSX.Element {
  return (
    <QueryProvider>
      <PostFormDialogInner {...props} />
    </QueryProvider>
  );
}

export interface NewPostButtonProps {
  ws: string;
  product: string;
  categories?: { id: string; name: string }[];
  signedIn?: boolean;
  defaultOpen?: boolean;
}

export function NewPostButton({
  ws,
  product,
  categories = [],
  signedIn,
  defaultOpen = false,
}: NewPostButtonProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(defaultOpen);

  React.useEffect(() => {
    if (defaultOpen && signedIn) {
      setOpen(true);
    }
  }, [defaultOpen, signedIn]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen && searchParams?.get("new") === "1") {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("new");
      const qs = nextParams.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }
  };

  if (!signedIn) {
    const nextUrl = encodeURIComponent(
      `${portalHref(ws, product)}?new=1`
    );
    return (
      <Button asChild className="shrink-0">
        <Link href={`/login?next=${nextUrl}`}>
          <Plus className="size-4" />
          <span>New post</span>
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="shrink-0">
        <Plus className="size-4" />
        <span>New post</span>
      </Button>
      <PostFormDialog
        ws={ws}
        product={product}
        categories={categories}
        open={open}
        onOpenChange={handleOpenChange}
      />
    </>
  );
}
