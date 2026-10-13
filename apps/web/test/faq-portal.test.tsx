import * as React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HighlightText, escapeRegex } from "../components/faq/faq-highlight";
import { FaqSearchBar } from "../components/faq/faq-search-bar";
import { FaqNotFoundPrompt } from "../components/faq/faq-not-found-prompt";
import { FaqAccordionItem } from "../components/faq/faq-accordion-item";
import { FaqPortal, extractTextFromRichText } from "../components/faq/faq-portal";
import type { PublicFaqCategory, RichTextDoc } from "@userhq/types";

describe("FAQ Portal Components & Client Logic", () => {
  const sampleAnswer: RichTextDoc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "To reset your password, visit the settings page and click security.",
          },
        ],
      },
    ],
  };

  const sampleCategories: PublicFaqCategory[] = [
    {
      id: "cat-1",
      name: "Account & Billing",
      questions: [
        {
          id: "q-1",
          question: "How do I reset my password?",
          answer: sampleAnswer,
        },
        {
          id: "q-2",
          question: "Where can I download invoices?",
          answer: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "Invoices are available in your billing receipt history tab.",
                  },
                ],
              },
            ],
          },
        },
      ],
    },
    {
      id: "cat-2",
      name: "Integrations",
      questions: [
        {
          id: "q-3",
          question: "Can I connect GitHub issues?",
          answer: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "Yes, GitHub two-way synchronization is supported out of the box.",
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  ];

  describe("HighlightText & Regex Escaping (T-05-13)", () => {
    it("safely escapes regex characters and wraps matched terms in <mark>", () => {
      const escaped = escapeRegex("foo(bar)+[baz]?*");
      expect(escaped).toBe("foo\\(bar\\)\\+\\[baz\\]\\?\\*");

      const html = renderToStaticMarkup(
        <HighlightText text="How do I reset my password securely?" query="password" />
      );

      expect(html).toContain(
        '<mark class="bg-primary/20 text-primary font-medium px-0.5 rounded">password</mark>'
      );
      expect(html).toContain("How do I reset my ");
      expect(html).toContain(" securely?");
    });

    it("performs case-insensitive keyword matching", () => {
      const html = renderToStaticMarkup(
        <HighlightText text="Where are my Invoices?" query="invoices" />
      );

      expect(html).toContain(
        '<mark class="bg-primary/20 text-primary font-medium px-0.5 rounded">Invoices</mark>'
      );
    });

    it("renders plain text unmodified when query is empty or whitespace", () => {
      const html = renderToStaticMarkup(
        <HighlightText text="No highlights here" query="   " />
      );

      expect(html).not.toContain("<mark");
      expect(html).toBe("No highlights here");
    });
  });

  describe("FaqNotFoundPrompt & Feedback Board Redirect URL (D-12, FAQ-07)", () => {
    it("formats redirect URL with query parameter when query is provided", () => {
      const html = renderToStaticMarkup(
        <FaqNotFoundPrompt
          ws="acme-ws"
          product="core-prod"
          query="sso saml support"
        />
      );

      expect(html).toContain("Didn&#x27;t find what you were looking for?");
      expect(html).toContain("Post to feedback board");
      expect(html).toContain(
        'href="/acme-ws/core-prod?new=true&amp;title=sso%20saml%20support"'
      );
    });

    it("formats redirect URL without title parameter when query is empty", () => {
      const html = renderToStaticMarkup(
        <FaqNotFoundPrompt ws="acme-ws" product="core-prod" query="" />
      );

      expect(html).toContain('href="/acme-ws/core-prod?new=true"');
      expect(html).not.toContain("title=");
    });
  });

  describe("FaqSearchBar", () => {
    it("renders search input and match count readout", () => {
      const html = renderToStaticMarkup(
        <FaqSearchBar
          value="billing"
          onChange={() => {}}
          matchCount={2}
        />
      );

      expect(html).toContain('placeholder="Search frequently asked questions..."');
      expect(html).toContain("Found 2 matching answers");
      expect(html).toContain('aria-label="Clear search"');
    });

    it("renders singular answer readout and empty state readout", () => {
      const singleHtml = renderToStaticMarkup(
        <FaqSearchBar value="single" onChange={() => {}} matchCount={1} />
      );
      expect(singleHtml).toContain("Found 1 matching answer");

      const noneHtml = renderToStaticMarkup(
        <FaqSearchBar value="unknown" onChange={() => {}} matchCount={0} />
      );
      expect(noneHtml).toContain("No matching questions found");
    });
  });

  describe("FaqAccordionItem (D-10, FAQ-06)", () => {
    it("renders accordion item with permalink copy button and collapsed answer", () => {
      const html = renderToStaticMarkup(
        <FaqAccordionItem
          question={sampleCategories[0].questions[0]}
          searchQuery=""
          isOpen={false}
          onToggle={() => {}}
        />
      );

      expect(html).toContain('id="q-q-1"');
      expect(html).toContain("How do I reset my password?");
      expect(html).toContain('title="Copy question link"');
      expect(html).toContain("grid-rows-[0fr]");
    });

    it("renders open answer prose and pulse highlight when isHighlighted is true", () => {
      const html = renderToStaticMarkup(
        <FaqAccordionItem
          question={sampleCategories[0].questions[0]}
          searchQuery=""
          isOpen={true}
          onToggle={() => {}}
          isHighlighted={true}
        />
      );

      expect(html).toContain("grid-rows-[1fr]");
      expect(html).toContain("ring-2 ring-primary/40 bg-primary/5");
      expect(html).toContain("To reset your password, visit the settings page");
    });
  });

  describe("FaqPortal & extractTextFromRichText", () => {
    it("extracts text recursively from ProseMirror JSON AST", () => {
      const text = extractTextFromRichText(sampleAnswer);
      expect(text).toBe(
        "To reset your password, visit the settings page and click security."
      );
    });

    it("renders empty state when there are 0 categories or questions", () => {
      const html = renderToStaticMarkup(
        <FaqPortal ws="acme-ws" product="core" categories={[]} />
      );

      expect(html).toContain("No frequently asked questions yet");
      expect(html).toContain("Self-serve help articles and common questions will appear here soon.");
      expect(html).toContain("Explore feedback");
      expect(html).toContain('href="/acme-ws/core"');
    });

    it("renders full portal layout with categories and questions", () => {
      const html = renderToStaticMarkup(
        <FaqPortal
          ws="acme-ws"
          product="core"
          categories={sampleCategories}
        />
      );

      expect(html).toContain("Account &amp; Billing");
      expect(html).toContain("Integrations");
      expect(html).toContain("How do I reset my password?");
      expect(html).toContain("Where can I download invoices?");
      expect(html).toContain("Can I connect GitHub issues?");
      expect(html).toContain("Didn&#x27;t find what you were looking for?");
    });
  });
});
