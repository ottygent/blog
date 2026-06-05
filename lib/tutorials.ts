import fs from "node:fs";
import path from "node:path";

const tutorialsDirectory = path.join(process.cwd(), "content", "tutorials");

export type Tutorial = {
  slug: string;
  title: string;
  description: string;
  readingMinutes: number;
  wordCount: number;
  headings: TutorialHeading[];
  html: string;
};

export type TutorialHeading = {
  id: string;
  text: string;
};

export type TutorialSummary = Omit<Tutorial, "html">;

function slugFromFilename(filename: string) {
  return filename.replace(/\.md$/i, "");
}

function titleFromMarkdown(markdown: string, slug: string) {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function descriptionFromMarkdown(markdown: string) {
  const cleaned = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("---"));

  const firstUseful = cleaned.find((line) => !line.startsWith("```")) ?? "Practical technical tutorial.";
  return firstUseful.replace(/^>\s?/, "").replace(/[*_`]/g, "").slice(0, 220);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function inlineMarkdown(value: string) {
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return html;
}

export function headingId(text: string) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function markdownToHtml(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let inCode = false;
  let codeLanguage = "";
  let codeBuffer: string[] = [];
  let inList = false;
  let inOrderedList = false;
  let paragraph: string[] = [];

  const closeParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };

  const closeList = () => {
    if (inList) {
      html.push(inOrderedList ? "</ol>" : "</ul>");
      inList = false;
      inOrderedList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (!inCode) {
        closeParagraph();
        closeList();
        inCode = true;
        codeLanguage = trimmed.replace(/^```/, "").trim();
        codeBuffer = [];
      } else {
        const languageClass = codeLanguage ? ` class="language-${escapeHtml(codeLanguage)}"` : "";
        html.push(`<pre><code${languageClass}>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
        inCode = false;
        codeLanguage = "";
        codeBuffer = [];
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(rawLine);
      continue;
    }

    if (!trimmed) {
      closeParagraph();
      closeList();
      continue;
    }

    if (trimmed === "---") {
      closeParagraph();
      closeList();
      html.push("<hr />");
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closeParagraph();
      closeList();
      const level = Math.min(headingMatch[1].length, 3);
      const text = inlineMarkdown(headingMatch[2]);
      const id = headingId(headingMatch[2]);
      html.push(`<h${level} id="${id}"><a href="#${id}" aria-label="Link to ${escapeHtml(headingMatch[2])}">#</a>${text}</h${level}>`);
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      closeParagraph();
      closeList();
      html.push(`<blockquote>${inlineMarkdown(quoteMatch[1])}</blockquote>`);
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (unorderedMatch || orderedMatch) {
      closeParagraph();
      const ordered = Boolean(orderedMatch);
      if (!inList || inOrderedList !== ordered) {
        closeList();
        html.push(ordered ? "<ol>" : "<ul>");
        inList = true;
        inOrderedList = ordered;
      }
      html.push(`<li>${inlineMarkdown((orderedMatch ?? unorderedMatch)?.[1] ?? "")}</li>`);
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  closeParagraph();
  closeList();
  if (inCode) {
    html.push(`<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
  }
  return html.join("\n");
}

function tutorialFromFile(filename: string): Tutorial {
  const slug = slugFromFilename(filename);
  const markdown = fs.readFileSync(path.join(tutorialsDirectory, filename), "utf8");
  const title = titleFromMarkdown(markdown, slug);
  const wordCount = markdown.split(/\s+/).filter(Boolean).length;
  const headings = Array.from(markdown.matchAll(/^##\s+(.+)$/gm))
    .map((match) => match[1].trim())
    .slice(0, 8)
    .map((text) => ({ id: headingId(text), text }));

  return {
    slug,
    title,
    description: descriptionFromMarkdown(markdown),
    readingMinutes: Math.max(1, Math.round(wordCount / 220)),
    wordCount,
    headings,
    html: markdownToHtml(markdown),
  };
}

export function getTutorials(): TutorialSummary[] {
  return fs
    .readdirSync(tutorialsDirectory)
    .filter((filename) => filename.endsWith(".md"))
    .map(tutorialFromFile)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(({ html: _html, ...summary }) => summary);
}

export function getTutorial(slug: string): Tutorial | undefined {
  const filename = `${slug}.md`;
  if (!fs.existsSync(path.join(tutorialsDirectory, filename))) return undefined;
  return tutorialFromFile(filename);
}

export function getTutorialSlugs() {
  return fs
    .readdirSync(tutorialsDirectory)
    .filter((filename) => filename.endsWith(".md"))
    .map((filename) => ({ slug: slugFromFilename(filename) }));
}
