import Link from "next/link";
import { notFound } from "next/navigation";
import { getTutorial, getTutorialSlugs } from "@/lib/tutorials";

export function generateStaticParams() {
  return getTutorialSlugs();
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tutorial = getTutorial(slug);
  return {
    title: tutorial ? `${tutorial.title} | RK Tutorials Blog` : "Tutorial | RK Tutorials Blog",
    description: tutorial?.description,
  };
}

export default async function TutorialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tutorial = getTutorial(slug);
  if (!tutorial) notFound();

  return (
    <main className="tutorialShell">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">← All tutorials</Link>
      </nav>
      <article className="tutorialArticle">
        <header>
          <div className="heroBadge">Tutorial</div>
          <h1>{tutorial.title}</h1>
          <p>{tutorial.description}</p>
          <div className="cardMeta large">
            <span>{tutorial.readingMinutes} min read</span>
            <span>{tutorial.wordCount.toLocaleString()} words</span>
          </div>
        </header>
        <div className="articleLayout">
          <aside className="toc" aria-label="Tutorial outline">
            <strong>On this page</strong>
            <ul>
              {tutorial.headings.map((heading) => (
                <li key={heading.id}>
                  <a href={`#${heading.id}`}>{heading.text}</a>
                </li>
              ))}
            </ul>
          </aside>
          <div className="markdownBody" dangerouslySetInnerHTML={{ __html: tutorial.html }} />
        </div>
      </article>
    </main>
  );
}
