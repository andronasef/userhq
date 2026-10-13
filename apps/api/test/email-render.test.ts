import { describe, it, expect } from "vitest";
import { snippet, escapeHtml, renderCommentEmail } from "../src/email/render.js";
import { signToken, verifyToken } from "../src/email/tokens.js";

describe("Email Render and Tokens (Plan 03-10 Task 3)", () => {
  describe("snippet", () => {
    it("returns short text unchanged", () => {
      expect(snippet("short")).toBe("short");
    });

    it("cuts a 300-character sentence to <=201 characters ending at a word boundary with …", () => {
      const sentence =
        "The quick brown fox jumps over the lazy dog repeatedly until the sentence becomes very long and easily exceeds three hundred characters in total length so that we can verify that snippet cuts cleanly at a natural word boundary rather than chopping right through the middle of an arbitrary word in the middle of text.";
      expect(sentence.length).toBeGreaterThan(300);

      const snip = snippet(sentence, 200);
      expect(snip.length).toBeLessThanOrEqual(201);
      expect(snip.endsWith("…")).toBe(true);

      // Verify that it ended at a word boundary (no partial trailing word before …)
      const withoutEllipsis = snip.slice(0, -1);
      expect(sentence.startsWith(withoutEllipsis)).toBe(true);
      const nextChar = sentence[withoutEllipsis.length];
      expect(nextChar === " " || nextChar === undefined).toBe(true);
    });

    it("cuts a single 250-character word to its first 200 characters + …", () => {
      const longWord = "a".repeat(250);
      const snip = snippet(longWord, 200);
      expect(snip).toBe("a".repeat(200) + "…");
      expect(snip.length).toBe(201);
    });

    it("collapses whitespace to single spaces and trims", () => {
      expect(snippet("a\n\n  b")).toBe("a b");
      expect(snippet("   leading and    trailing   ")).toBe("leading and trailing");
      expect(snippet("line1\r\n\tline2\n\nline3")).toBe("line1 line2 line3");
    });
  });

  describe("escapeHtml", () => {
    it("escapes &, <, >, \", and '", () => {
      expect(escapeHtml('<b>& "x" \'y\'')).toBe(
        "&lt;b&gt;&amp; &quot;x&quot; &#39;y&#39;"
      );
    });
  });

  describe("tokens: signToken and verifyToken", () => {
    const secret = "a".repeat(32);

    it("round-trips for 'all' scope", () => {
      const userId = "user-123";
      const token = signToken(secret, userId, "all");
      const verified = verifyToken(secret, token);

      expect(verified).not.toBeNull();
      expect(verified?.u).toBe(userId);
      expect(verified?.s).toBe("all");
    });

    it("round-trips for 'p:<postId>' scope", () => {
      const userId = "user-456";
      const postId = "123e4567-e89b-12d3-a456-426614174000";
      const token = signToken(secret, userId, `p:${postId}`);
      const verified = verifyToken(secret, token);

      expect(verified).not.toBeNull();
      expect(verified?.u).toBe(userId);
      expect(verified?.s).toBe(`p:${postId}`);
    });

    it("rejects token with one changed character (tamper detection)", () => {
      const token = signToken(secret, "user-123", "all");
      const parts = token.split(".");
      const alteredMac =
        parts[1].slice(0, -1) + (parts[1].slice(-1) === "a" ? "b" : "a");
      const tampered = `${parts[0]}.${alteredMac}`;

      expect(verifyToken(secret, tampered)).toBeNull();
    });

    it("rejects truncated token and empty string", () => {
      const token = signToken(secret, "user-123", "all");
      expect(verifyToken(secret, token.slice(0, 10))).toBeNull();
      expect(verifyToken(secret, "")).toBeNull();
      expect(verifyToken(secret, "invalid.format.extra")).toBeNull();
    });

    it("rejects token with wrong secret", () => {
      const token = signToken(secret, "user-123", "all");
      const otherSecret = "b".repeat(32);
      expect(verifyToken(otherSecret, token)).toBeNull();
    });

    it("rejects every one-char change to the MAC, including padding-bit-only changes", () => {
      // The final base64url char carries 2 ignored bits: "…a" and "…b" decode alike.
      for (let i = 0; i < 300; i++) {
        const token = signToken(secret, `user-${i}`, "all");
        const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
        expect(verifyToken(secret, tampered)).toBeNull();
      }
    });
  });

  describe("renderCommentEmail", () => {
    it("renders single post subject with title cut to 60 chars with …", () => {
      const longTitle =
        "This is an exceptionally long feature request title that goes way past sixty characters in total";
      const { subject } = renderCommentEmail({
        workspaceName: "Acme Corp",
        sections: [
          {
            productName: "Billing",
            postTitle: longTitle,
            postUrl: "https://app.userhq.test/acme/billing/p/1",
            muteUrl: "https://app.userhq.test/unsubscribe/token-mute",
            comments: [
              {
                authorName: "Alice",
                isAdmin: false,
                body: "Comment body",
              },
            ],
            moreCount: 0,
          },
        ],
        unsubscribeUrl: "https://app.userhq.test/unsubscribe/token-all",
      });

      expect(subject).toMatch(/^New comments on ".*…"$/);
      const quoted = subject.match(/^New comments on "(.*)"$/)?.[1];
      expect(quoted).toBeDefined();
      expect(quoted!.length).toBeLessThanOrEqual(61);
    });

    it("renders multi-post subject with count and workspace name", () => {
      const { subject } = renderCommentEmail({
        workspaceName: "Acme Corp",
        sections: [
          {
            productName: "P1",
            postTitle: "Title 1",
            postUrl: "https://app.userhq.test/p1",
            muteUrl: "https://app.userhq.test/mute1",
            comments: [{ authorName: "Alice", isAdmin: false, body: "C1" }],
            moreCount: 0,
          },
          {
            productName: "P2",
            postTitle: "Title 2",
            postUrl: "https://app.userhq.test/p2",
            muteUrl: "https://app.userhq.test/mute2",
            comments: [{ authorName: "Bob", isAdmin: false, body: "C2" }],
            moreCount: 0,
          },
        ],
        unsubscribeUrl: "https://app.userhq.test/unsubscribe/all",
      });

      expect(subject).toBe("New comments on 2 posts at Acme Corp");
    });

    it("renders +1 more comment and +2 more comments correctly", () => {
      const rendered1 = renderCommentEmail({
        workspaceName: "Acme",
        sections: [
          {
            productName: "App",
            postTitle: "Post",
            postUrl: "https://app.userhq.test/post",
            muteUrl: "https://app.userhq.test/mute",
            comments: [{ authorName: "Alice", isAdmin: false, body: "C1" }],
            moreCount: 1,
          },
        ],
        unsubscribeUrl: "https://app.userhq.test/unsub",
      });
      expect(rendered1.text).toContain("+1 more comment");
      expect(rendered1.html).toContain("+1 more comment");

      const rendered2 = renderCommentEmail({
        workspaceName: "Acme",
        sections: [
          {
            productName: "App",
            postTitle: "Post",
            postUrl: "https://app.userhq.test/post",
            muteUrl: "https://app.userhq.test/mute",
            comments: [{ authorName: "Alice", isAdmin: false, body: "C1" }],
            moreCount: 2,
          },
        ],
        unsubscribeUrl: "https://app.userhq.test/unsub",
      });
      expect(rendered2.text).toContain("+2 more comments");
      expect(rendered2.html).toContain("+2 more comments");
    });

    it("renders admin badge ' · Admin' and handles Deleted user", () => {
      const rendered = renderCommentEmail({
        workspaceName: "Acme",
        sections: [
          {
            productName: "App",
            postTitle: "Feature Request",
            postUrl: "https://app.userhq.test/post",
            muteUrl: "https://app.userhq.test/mute",
            comments: [
              { authorName: "Admin Andy", isAdmin: true, body: "We are on it" },
              { authorName: "Deleted user", isAdmin: false, body: "Earlier note" },
            ],
            moreCount: 0,
          },
        ],
        unsubscribeUrl: "https://app.userhq.test/unsub",
      });

      // Plain text check
      expect(rendered.text).toContain("Admin Andy · Admin:");
      expect(rendered.text).toContain("Deleted user:");
      expect(rendered.text).toContain("View post: https://app.userhq.test/post");
      expect(rendered.text).toContain("Mute this post: https://app.userhq.test/mute");
      expect(rendered.text).toContain("Turn off comment emails: https://app.userhq.test/unsub");

      // HTML check
      expect(rendered.html).toContain("Admin Andy");
      expect(rendered.html).toContain(" · Admin");
      expect(rendered.html).toContain("Deleted user");
      expect(rendered.html).toContain("View post");
      expect(rendered.html).toContain("Mute this post");
      expect(rendered.html).toContain("Turn off comment emails");
    });

    it("escapes user-provided content in HTML part", () => {
      const rendered = renderCommentEmail({
        workspaceName: "Workspace <script>",
        sections: [
          {
            productName: "Product & Co",
            postTitle: 'Title "quoted" & <bold>',
            postUrl: "https://app.userhq.test/p/1?a=1&b=2",
            muteUrl: "https://app.userhq.test/mute?x=1&y=2",
            comments: [
              {
                authorName: "Attacker <img src=x>",
                isAdmin: false,
                body: "Body with <b>& and 'quotes'",
              },
            ],
            moreCount: 0,
          },
        ],
        unsubscribeUrl: "https://app.userhq.test/unsub?all=1&safe=2",
      });

      expect(rendered.html).not.toContain("<script>");
      expect(rendered.html).toContain("Workspace &lt;script&gt;");
      expect(rendered.html).toContain("Product &amp; Co");
      expect(rendered.html).toContain("&lt;bold&gt;");
      expect(rendered.html).toContain("&quot;quoted&quot;");
      expect(rendered.html).toContain("Attacker &lt;img src=x&gt;");
      expect(rendered.html).toContain("&lt;b&gt;&amp; and &#39;quotes&#39;");
    });
  });
});
