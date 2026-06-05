import { TutorialExplorer } from "./components/TutorialExplorer";
import { getTutorials } from "@/lib/tutorials";

export default function Home() {
  const tutorials = getTutorials();
  const totalWords = tutorials.reduce((sum, tutorial) => sum + tutorial.wordCount, 0);
  const totalMinutes = tutorials.reduce((sum, tutorial) => sum + tutorial.readingMinutes, 0);

  return (
    <main>
      <section className="hero">
        <div className="heroBadge">RK Learning Library</div>
        <h1>Practical tutorials for building, shipping, and understanding AI-powered systems.</h1>
        <p>
          A searchable, interactive blog generated from the tutorials in the local writes directory. Browse deep-dive guides,
          implementation notes, and architecture walkthroughs from one polished GitHub Pages site.
        </p>
        <div className="heroActions">
          <a className="primaryButton" href="#tutorials">Explore tutorials</a>
          <a className="secondaryButton" href="https://github.com/rkali090/blog">View source</a>
        </div>
        <div className="stats" aria-label="Blog statistics">
          <div><strong>{tutorials.length}</strong><span>Tutorials</span></div>
          <div><strong>{totalWords.toLocaleString()}</strong><span>Words</span></div>
          <div><strong>{totalMinutes}</strong><span>Reading minutes</span></div>
        </div>
      </section>
      <TutorialExplorer tutorials={tutorials} />
    </main>
  );
}
