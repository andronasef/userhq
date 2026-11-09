"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import {
  CreateInviteInputSchema,
  InviteCreatedSchema,
  type InviteCreated,
} from "@userhq/types";
import { Field } from "../ui/field";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Alert } from "../ui/alert";
import { CopyField } from "../copy-field";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { errorCopy, FIELD_FOR_CODE } from "@/lib/api-errors";
import { formatDate } from "@/lib/format";

export interface InviteCreatorProps {
  kind: "platform" | "workspace";
  endpoint: string;
}

export function InviteCreator({ kind: _kind, endpoint }: InviteCreatorProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [fieldError, setFieldError] = React.useState<string | undefined>();
  const [alertError, setAlertError] = React.useState<string | undefined>();
  const [isPending, setIsPending] = React.useState(false);
  const [createdInvite, setCreatedInvite] =
    React.useState<InviteCreated | null>(null);

  const validateEmail = (): boolean => {
    const parse = CreateInviteInputSchema.safeParse({ email });
    if (!parse.success) {
      const code = parse.error.issues[0]?.message ?? "invalid_email";
      setFieldError(errorCopy({ code }, { email }));
      return false;
    }
    setFieldError(undefined);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertError(undefined);

    if (!validateEmail()) {
      return;
    }

    setIsPending(true);
    const submittedEmail = email.trim().toLowerCase();

    try {
      const res = await apiFetch<InviteCreated>(endpoint, {
        method: "POST",
        body: { email: submittedEmail },
        schema: InviteCreatedSchema,
      });

      setCreatedInvite(res);
      setEmail("");
      setFieldError(undefined);
      setAlertError(undefined);
      router.refresh();
    } catch (err: any) {
      if (err instanceof ApiClientError || (err && err.code)) {
        if (FIELD_FOR_CODE[err.code] === "email") {
          setFieldError(errorCopy(err, { email: submittedEmail }));
        } else {
          setAlertError(errorCopy(err, { email: submittedEmail }));
        }
      } else {
        setAlertError(
          "Something went wrong on our end. Try again in a moment.",
        );
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {alertError && <Alert variant="destructive">{alertError}</Alert>}

        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex-1">
            <Field
              id="invite-email"
              label={t("team.emailLabel")}
              helper={t("team.emailHelper")}
              error={fieldError}
            >
              <Input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldError) setFieldError(undefined);
                }}
                onBlur={() => {
                  if (email.trim()) validateEmail();
                }}
                placeholder="colleague@example.com"
                disabled={isPending}
              />
            </Field>
          </div>

          <div className="sm:pt-7">
            <Button
              type="submit"
              disabled={isPending}
              className="w-full sm:w-auto"
            >
              {isPending ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  <span>{t("team.creatingLink")}</span>
                </>
              ) : (
                <span>{t("team.createInviteLink")}</span>
              )}
            </Button>
          </div>
        </div>
      </form>

      {createdInvite && (
        <div className="bg-muted rounded-lg p-4 flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {t("team.inviteCreatedTitle")}
          </h3>
          <CopyField value={createdInvite.link} />
          <p className="text-sm text-muted-foreground">
            Only {createdInvite.email} can use this link. It works once and
            expires on {formatDate(createdInvite.expiresAt)}.{" "}
            {t("team.inviteCreatedHelp")}
          </p>
        </div>
      )}
    </div>
  );
}
