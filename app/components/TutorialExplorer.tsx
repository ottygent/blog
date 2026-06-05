"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TutorialSummary } from "@/lib/tutorials";

type Props = {
  tutorials: TutorialSummary[];
};

function matchesTutorial(tutorial: TutorialSummary, query: string) {
  const haystack = [tutorial.title, tutorial.description, tutorial.slug, ...tutorial.headings].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function TutorialExplorer({ tutorials }: Props) {
  const [query, setQuery] = useState("");
  const [activeTopic, setActiveTopic] = useState("All");

  const topics = useMemo(() => {
    const inferred = tutorials.map((tutorial) => {
      const title = tutorial.title.toLowerCase();
      if (title.includes("ai") || title.includes("agent") || title.includes("ml")) return "AI systems";
      if (title.includes("scraping") || title.includes("playwright")) return "Automation";
      if (title.includes("linkedin") || title.includes("lead")) return "Growth";
      if (title.includes("hermes")) return "Architecture";
      return "Tutorials";
    });
    return ["All", ...Array.from(new Set(inferred))];
  }, [tutorials]);

  const filtered = tutorials.filter((tutorial) => {
    const topicOk = activeTopic === "All" || topicsFor(tutorial).includes(activeTopic);
    const queryOk = !query.trim() || matchesTutorial(tutorial, query.trim());
    return topicOk && queryOk;
  });

  return (
    <section className="explorer" id="tutorials">
      <div className="toolbar" aria-label="Tutorial filters">
        <label className="searchBox">
          <span>Search tutorials</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try: agent, Playwright, roadmap..."
          />
        </label>
        <div className="chips" aria-label="Topic filters">
          {topics.map((topic) => (
            <button
              className={topic === activeTopic ? "chip active" : "chip"}
              key={topic}
              onClick={() => setActiveTopic(topic)}
              type="button"
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      <div className="resultCount">
        Showing <strong>{filtered.length}</strong> of <strong>{tutorials.length}</strong> tutorials
      </div>

      <div className="cardGrid">
        {filtered.map((tutorial) => (
          <article className="tutorialCard" key={tutorial.slug}>
            <div className="cardMeta">
              <span>{tutorial.readingMinutes} min read</span>
              <span>{tutorial.wordCount.toLocaleString()} words</span>
            </div>
            <h3>{tutorial.title}</h3>
            <p>{tutorial.description}</p>
            {tutorial.headings.length > 0 && (
              <ul className="miniToc">
                {tutorial.headings.slice(0, 3).map((heading) => (
                  <li key={heading}>{heading}</li>
                ))}
              </ul>
            )}
            <Link className="readLink" href={`/tutorials/${tutorial.slug}`}>
              Read tutorial <span aria-hidden="true">→</span>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function topicsFor(tutorial: TutorialSummary) {
  const title = tutorial.title.toLowerCase();
  const topics = ["Tutorials"];
  if (title.includes("ai") || title.includes("agent") || title.includes("ml")) topics.push("AI systems");
  if (title.includes("scraping") || title.includes("playwright")) topics.push("Automation");
  if (title.includes("linkedin") || title.includes("lead")) topics.push("Growth");
  if (title.includes("hermes")) topics.push("Architecture");
  return topics;
}
