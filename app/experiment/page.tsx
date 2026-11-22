import Link from 'next/link';
import './presentation.css';

export const metadata = {title:'The Body Experiment · TOP1.Fit',description:'One body. Many measurements. A transparent personal benchmarking experiment.'};

export default function Experiment(){
 return <main className="experiment">
  <nav aria-label="Experiment navigation"><Link href="/">TOP1<span>.FIT</span></Link><a href="#protocol">The protocol ↗</a></nav>
  <header className="experiment-hero"><p className="experiment-label">THE BODY EXPERIMENT / EPISODE 001</p><h1>How much can<br/>a body <em>do?</em></h1><div className="experiment-intro"><p>I built a dashboard to explore my strength, fitness and recovery. The goal: understand my starting point, then measure what changes.</p><a className="experiment-button" href="#protocol">Explore the experiment ↓</a></div><div className="experiment-stamp">ONE BODY.<br/>MANY DIMENSIONS.<br/><span>NO UNIVERSAL SCORE.</span></div></header>
  <section id="protocol" className="experiment-section"><div className="experiment-heading"><p className="experiment-label">01 / MEASURE</p><h2>A body is more<br/>than one number.</h2><p>Start with tests you can repeat. Add only measurements you actually have.</p></div><div className="experiment-pillars">{[
   ['01','Strength & fitness','What can I do?','Lifts, repetitions, running and power. Use the same technique and conditions each time.'],
   ['02','Body markers','What can I observe?','Body measurements and recorded biomarkers. Interpretation depends on method and personal context.'],
   ['03','Recovery','How am I recovering?','Track sleep and resting signals over time. A single reading cannot tell the whole story.'],
  ].map(([n,title,question,body])=><article key={n}><span>{n}</span><h3>{title}</h3><h4>{question}</h4><p>{body}</p></article>)}</div></section>
  <section className="experiment-section experiment-compare"><p className="experiment-label">02 / UNDERSTAND</p><h2>A benchmark needs<br/>a reference.</h2><div className="experiment-rules"><article><h3>Your measurement</h3><p>A recorded result, with its date and test method. Missing data stays missing.</p></article><article><h3>The comparison</h3><p>Published test references apply only to the populations and protocols they describe. Other estimates are illustrative.</p></article><article><h3>The boundary</h3><p>The experimental game index is not a measured world rank, a diagnosis or a rating of your worth.</p></article></div></section>
  <section className="experiment-section experiment-finish"><p className="experiment-label">03 / REPEAT</p><h2>My next benchmark?<br/><em>My previous self.</em></h2><p>Record a baseline. Choose a repeatable test. Come back and see what actually changed.</p><Link className="experiment-button" href="/?view=overview">Open my dashboard ↗</Link><Link className="experiment-method" href="/?view=methodology">Explore methods & evidence</Link></section>
  <footer>TOP1.FIT <span>A personal experiment. Transparent about its limits.</span></footer>
 </main>;
}
