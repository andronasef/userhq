export interface EmailComment {
  authorName: string;
  isAdmin: boolean;
  body: string;
}

export interface EmailPostSection {
  productName: string;
  postTitle: string;
  postUrl: string;
  muteUrl: string;
  comments: EmailComment[];
  moreCount: number;
}

export interface RenderCommentEmailInput {
  workspaceName: string;
  sections: EmailPostSection[];
  unsubscribeUrl: string;
}

export function snippet(text: string, max = 200): string {
  const s = text.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > 0 ? cut.slice(0, sp) : cut) + "…";
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderCommentEmail(input: RenderCommentEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const { workspaceName, sections, unsubscribeUrl } = input;

  const subject =
    sections.length === 1
      ? `New comments on "${snippet(sections[0].postTitle, 60)}"`
      : `New comments on ${sections.length} posts at ${workspaceName}`;

  const introText = `Here's what's new in conversations you're part of at ${workspaceName}.`;
  const footerReasonText =
    "You're getting this because you posted or commented on these posts.";

  // Plain-text part
  const textSections = sections.map((sec) => {
    const lines: string[] = [];
    lines.push(sec.productName.toUpperCase());
    lines.push(`${sec.postTitle}: ${sec.postUrl}`);
    lines.push("");

    for (const c of sec.comments) {
      const author = c.isAdmin ? `${c.authorName} · Admin` : c.authorName;
      lines.push(`${author}:`);
      lines.push(snippet(c.body, 200));
      lines.push("");
    }

    if (sec.moreCount > 0) {
      lines.push(
        `+${sec.moreCount} more ${sec.moreCount === 1 ? "comment" : "comments"}`
      );
      lines.push("");
    }

    lines.push(`View post: ${sec.postUrl}`);
    lines.push(`Mute this post: ${sec.muteUrl}`);

    return lines.join("\n");
  });

  const text = [
    introText,
    "",
    textSections.join("\n\n---\n\n"),
    "",
    "---",
    "",
    footerReasonText,
    `Turn off comment emails: ${unsubscribeUrl}`,
  ].join("\n");

  // HTML part
  const htmlSections = sections
    .map((sec) => {
      const commentsHtml = sec.comments
        .map((c) => {
          const authorEscaped = escapeHtml(c.authorName);
          const authorBadge = c.isAdmin
            ? `<span style="font-weight:600;color:#0A0A0A;">${authorEscaped}</span><span style="font-weight:400;color:#525252;"> · Admin</span>`
            : `<span style="font-weight:600;color:#0A0A0A;">${authorEscaped}</span>`;
          const bodySnippet = escapeHtml(snippet(c.body, 200));

          return `
            <div style="margin-bottom:16px;">
              <div style="font-size:14px;line-height:20px;">
                ${authorBadge}
              </div>
              <div style="font-size:14px;line-height:20px;color:#0A0A0A;margin:4px 0 0 0;">
                ${bodySnippet}
              </div>
            </div>
          `.trim();
        })
        .join("");

      const moreHtml =
        sec.moreCount > 0
          ? `<div style="font-size:14px;color:#525252;margin-bottom:16px;">+${sec.moreCount} more ${
              sec.moreCount === 1 ? "comment" : "comments"
            }</div>`
          : "";

      return `
        <div style="border-top:1px solid #E5E5E5;padding:24px 0;">
          <div style="font-size:12px;font-weight:600;color:#525252;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">
            ${escapeHtml(sec.productName)}
          </div>
          <div style="font-size:16px;font-weight:600;margin-bottom:16px;">
            <a href="${escapeHtml(sec.postUrl)}" style="color:#0A0A0A;text-decoration:none;">
              ${escapeHtml(sec.postTitle)}
            </a>
          </div>
          ${commentsHtml}
          ${moreHtml}
          <div style="font-size:14px;">
            <a href="${escapeHtml(sec.postUrl)}" style="color:#171717;text-decoration:underline;">View post</a>
            <span style="color:#525252;margin:0 4px;">·</span>
            <a href="${escapeHtml(sec.muteUrl)}" style="color:#171717;text-decoration:underline;">Mute this post</a>
          </div>
        </div>
      `.trim();
    })
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px 0;background-color:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0A0A0A;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;padding:0 24px;">
    <tr>
      <td>
        <div style="font-size:14px;color:#525252;margin-bottom:24px;">
          ${escapeHtml(introText)}
        </div>
        ${htmlSections}
        <div style="border-top:1px solid #E5E5E5;padding-top:24px;margin-top:8px;font-size:12px;color:#525252;line-height:18px;">
          <div>${escapeHtml(footerReasonText)}</div>
          <div style="margin-top:4px;">
            <a href="${escapeHtml(unsubscribeUrl)}" style="color:#525252;text-decoration:underline;">Turn off comment emails</a>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  return { subject, text, html };
}
