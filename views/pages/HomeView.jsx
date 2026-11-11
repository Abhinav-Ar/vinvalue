"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowDown, ArrowRight, ArrowUpRight, BarChart3, CarFront, Check, ChevronDown, Fingerprint, ScanLine, Search, ShieldCheck } from "lucide-react";
import SiteHeader from "@/views/components/SiteHeader";
import GarageIllustration from "@/views/components/GarageIllustration";
import Reveal from "@/views/components/Reveal";
import VehiclePhoto from "@/views/components/VehiclePhoto";
import { Button } from "@/views/components/ui/button";
import { Input } from "@/views/components/ui/input";

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function Dashboard() {
  const [garage, setGarage] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all(["/api/garage", "/api/history"].map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Could not load your workspace. Please try again.");
      return response.json();
    }))
      .then(([garageData, historyData]) => { setGarage(garageData.cars || []); setActivity(historyData.searches || []); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const portfolio = garage.reduce((sum, car) => sum + Number(car.trade_in || 0), 0);
  return (
    <main id="main-content" className="workspace mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="page-heading flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><p className="eyebrow">The owner’s workspace / Overview</p><h1 className="editorial-title mt-3">A little garage.<br />A lot of perspective.</h1></div>
        <Button asChild className="h-11 rounded-xl"><Link href="/appraise">New appraisal <ArrowRight /></Link></Button>
      </div>
      {error && <p role="alert" className="mt-6 text-sm text-destructive">{error}</p>}
      <div className="dashboard-stats mt-9 grid sm:grid-cols-3">
        {[
          ["Garage value", loading ? "—" : money(portfolio), "Estimated instant-sale total"],
          ["Vehicles", loading ? "—" : garage.length, "Saved and ready to revisit"],
          ["Recent appraisals", loading ? "—" : activity.length, "Latest report per VIN"],
        ].map(([label, value, note], index) => <Reveal delay={index * 100} key={label}><div className="p-6"><p className="data-label">{label}</p><p className="stat-value mt-3">{error ? "—" : value}</p><p className="mt-2 text-xs text-muted-foreground">{note}</p></div></Reveal>)}
      </div>

      <section className="mt-12">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-semibold">Garage</h2><p className="mt-1 text-sm text-muted-foreground">The latest value for each saved vehicle.</p></div><Link href="/garage" className="text-sm font-medium">View all</Link></div>
        {loading ? <div className="grid gap-4 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-64 animate-pulse rounded-lg bg-muted" aria-hidden="true" />)}</div> : error ? <p className="text-sm text-muted-foreground">Your collection will be here when your workspace reconnects.</p> : garage.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/50 p-10 text-center"><CarFront className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-4 font-medium">No vehicles saved yet</p><p className="mt-1 text-sm text-muted-foreground">Your first appraisal can be saved here.</p><Button asChild className="mt-5"><Link href="/appraise">Appraise your first vehicle <ArrowRight /></Link></Button></div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">{garage.slice(0, 3).map((car, index) => (
            <Reveal key={car.id} delay={index * 80}><Link href="/garage" className="group block overflow-hidden rounded-lg border border-border bg-card transition hover:-translate-y-1 hover:border-primary/40">
              <VehiclePhoto car={car} interactive={false} className="vehicle-photo-curated" />
              <div className="p-5"><p className="font-semibold">{car.year} {car.make} {car.model}</p><p className="mt-1 text-xs text-muted-foreground">{Number(car.mileage).toLocaleString()} mi · {car.condition}</p><div className="mt-5 flex items-end justify-between"><div><p className="data-label">Instant-sale estimate</p><p className="mt-1 text-2xl font-medium text-primary">{money(car.trade_in)}</p></div><ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:-translate-y-1 group-hover:translate-x-1" /></div></div>
            </Link></Reveal>
          ))}</div>
        )}
      </section>
    </main>
  );
}

function Landing() {
  const router = useRouter();
  const [vin, setVin] = useState("");
  const [vinError, setVinError] = useState("");
  function go(event) {
    event.preventDefault();
    if (vin.length !== 17) {
      setVinError("Enter all 17 characters to identify your vehicle.");
      return;
    }
    router.push(`/appraise?vin=${vin}`);
  }
  return (
    <main id="main-content" className="landing">
      <div className="reading-progress" aria-hidden="true" />
      <section className="hero section-shell">
        <div className="hero-topline"><span><span className="status-light" /> INDEPENDENT VEHICLE INTELLIGENCE</span><span>FOR THE ROAD AHEAD ↗</span></div>
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow hero-enter">Your car. Your advantage.</p>
            <h1 className="hero-title hero-enter">Know the number.<br /><em>Own the conversation.</em></h1>
            <p className="hero-description hero-enter">Not a guess. Not a sales pitch. A clearer picture of what your car is worth, backed by the market around you.</p>
            <div className="hero-enter hero-form-wrap">
              <label className="data-label" htmlFor="landing-vin">It starts with your VIN</label>
              <form className="vin-form" onSubmit={go}>
                <ScanLine aria-hidden="true" />
                <Input id="landing-vin" value={vin} onChange={(event) => { setVin(event.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17)); setVinError(""); }} placeholder="Your 17-character VIN" autoComplete="off" spellCheck={false} maxLength={17} aria-invalid={Boolean(vinError)} aria-describedby={vinError ? "vin-error" : "vin-help"} className="vin-input" />
                <Button type="submit" className="vin-submit">Find my value <ArrowUpRight /></Button>
              </form>
              {vinError && <p id="vin-error" role="alert" className="mt-3 text-sm text-destructive">{vinError}</p>}
              <div id="vin-help" className="vin-help"><span><Check size={13} /> No account needed</span><Link href="/appraise">Where’s my VIN? <ArrowUpRight size={12} /></Link></div>
            </div>
          </div>
          <div className="hero-visual hero-enter">
            <div className="visual-coordinate">AUTOIQ / VEHICLE STUDY 001</div>
            <span className="visual-word" aria-hidden="true">DRIVE.</span>
            <GarageIllustration />
            <div className="vehicle-caption"><span>EVERY VEHICLE HAS A STORY.</span><span>LET THE DATA TELL IT.</span></div>
            <div className="example-slip">
              <div className="slip-heading"><span className="data-label">An appraisal, not a hunch.</span><span className="sample-tag">ILLUSTRATIVE EXAMPLE</span></div>
              <div className="slip-values"><div><span>Instant sale</span><strong>$23,100</strong></div><div className="featured-value"><span>Private sale <ArrowUpRight size={12} /></span><strong>$27,450</strong></div><div><span>Dealer retail</span><strong>$31,900</strong></div></div>
              <div className="slip-foot"><ShieldCheck size={13} /><span>One vehicle. Three ways to understand its value.</span></div>
            </div>
          </div>
        </div>
        <div className="hero-bottom"><span>REAL EVIDENCE. A BETTER STARTING POINT.</span><a href="#how-it-works">Take a look under the hood <ArrowDown size={14} /></a><span className="hero-edition">THE OWNER’S EDITION — 01</span></div>
      </section>
      <div className="evidence-strip"><div className="section-shell"><span className="data-label">A little less mystery. A lot more clarity.</span><span><Fingerprint /> VIN-specific details</span><span><Search /> Comparable listings</span><span><BarChart3 /> Transparent adjustments</span></div></div>
      <section id="how-it-works" className="method-section section-shell">
        <div className="method-intro"><Reveal><p className="eyebrow">01 / Under the hood</p><h2 className="editorial-title">Good decisions<br />start with <em>good evidence.</em></h2><p>You know your car. We help you understand its place in the market. No black box required.</p><a className="text-link" href="#the-report">Explore the report <ArrowDown size={15} /></a></Reveal></div>
        <div className="method-steps">
          {[
            ["01", ScanLine, "First, the right car.", "Your VIN identifies the vehicle. You add the mileage, location, and condition that make it yours.", "VEHICLE / IDENTIFIED"],
            ["02", Search, "Then, the real market.", "Comparable listings are filtered for pricing outliers and weighted by mileage proximity. Context over guesswork.", "MARKET / COMPARED"],
            ["03", ShieldCheck, "Finally, the full picture.", "See instant-sale, private-sale, and dealer-retail estimates, with ranges and the adjustments behind them.", "VALUE / EXPLAINED"],
          ].map(([number, Icon, title, copy, caption]) => <Reveal key={number}><article className="method-step"><span className="step-number">{number}</span><div><Icon className="step-icon" size={22} /><h3>{title}</h3><p>{copy}</p><span className="step-caption">{caption}<Check size={12} /></span></div></article></Reveal>)}
        </div>
      </section>
      <section id="the-report" className="report-section">
        <div className="section-shell report-grid">
          <Reveal className="report-preview"><div className="report-preview-top"><span className="brand">Auto<span className="brand-iq">IQ</span></span><span className="sample-tag">SAMPLE REPORT</span></div><div className="report-preview-body"><p className="data-label">Private-sale estimate / illustrative</p><p className="report-price">$27,450<span>USD</span></p><div className="range-track"><span /></div><div className="range-labels"><span>$25,400</span><span>Estimated range</span><span>$29,600</span></div><div className="report-evidence">{[["Vehicle details", "VIN decoded"], ["Market evidence", "Comparable listings"], ["Condition", "Your inputs"], ["Methodology", "Visible adjustments"]].map(([label, value]) => <div key={label}><span>{label}</span><span><Check size={12} />{value}</span></div>)}</div><p className="report-disclaimer">Example only. Your estimate depends on your vehicle and available market evidence.</p></div><div className="report-preview-footer"><ShieldCheck size={15} /> The reasoning comes with the number.</div></Reveal>
          <Reveal className="report-copy" delay={100}><p className="eyebrow">02 / Nothing hidden</p><h2 className="editorial-title">A number is useful.<br /><em>The why is powerful.</em></h2><p>Walk into your next conversation with more than a screenshot. Your report puts the estimates, comparable listings, and condition adjustments in one place.</p><ul>{["Three sale scenarios. Different routes, clearly explained.", "Honest ranges. Because a market isn’t a fixed number.", "A report to revisit, share, and negotiate with."].map((text) => <li key={text}><Check size={16} />{text}</li>)}</ul><Button asChild className="h-12 px-6"><Link href="/appraise">Put your car in perspective <ArrowUpRight /></Link></Button></Reveal>
        </div>
      </section>
      <section className="garage-section section-shell">
        <Reveal><div className="garage-callout"><div><p className="eyebrow">03 / Your personal garage</p><h2 className="editorial-title">Keep the keys.<br /><em>And the bigger picture.</em></h2><p>Save your vehicles. Revisit your reports. Refresh an appraisal when the miles—or your plans—change.</p><Link href="/garage" className="text-link">Step into your garage <ArrowUpRight size={17} /></Link></div><div className="garage-index" aria-hidden="true"><span className="garage-index-label">THE OWNER’S COLLECTION</span><CarFront strokeWidth={.7} /><span className="garage-index-number">01—∞</span><span className="garage-index-label">ALL YOUR VEHICLES. ONE PLACE.</span></div></div></Reveal>
      </section>
      <section className="faq-section section-shell"><Reveal><div className="section-heading"><p className="eyebrow">A few things worth knowing</p><h2 className="editorial-title">Before you <em>hit the road.</em></h2></div></Reveal><div className="faq-list">{[
        ["Where can I find my VIN?", "Look on the driver’s side dashboard, visible through the windshield, or on the driver’s door jamb. Your registration and insurance documents usually include it too. It is 17 characters long and never includes I, O, or Q."],
        ["Is this a guaranteed offer?", "No. AutoIQ provides estimated value ranges based on market evidence and the details you provide. Actual offers can vary with local demand, vehicle inspection, and a buyer’s requirements."],
        ["Why are there three different values?", "Selling to a dealer, selling privately, and buying at retail involve different costs and expectations. We separate instant-sale, private-sale, and dealer-retail estimates so you can compare the routes."],
        ["Do I need an account?", "You can run an appraisal without an account. Sign in with Google when you want to save vehicles to your garage and revisit your appraisal history."],
      ].map(([question, answer], index) => <Reveal key={question} delay={index * 40}><details className="faq-item"><summary><span className="faq-number">0{index + 1}</span><span>{question}</span><ChevronDown size={18} /></summary><p>{answer}</p></details></Reveal>)}</div></section>
      <section className="final-cta section-shell"><Reveal><p className="eyebrow">A clearer view starts here</p><h2>Less wondering.<br /><em>More knowing.</em></h2><Button asChild className="h-13 px-7"><Link href="/appraise">Find out what it’s worth <ArrowUpRight /></Link></Button><a href="#main-content" className="back-top">Back to the top ↑</a></Reveal></section>
    </main>
  );
}

export default function HomePage() {
  const { status } = useSession();
  return <div className="min-h-screen"><SiteHeader />{status === "loading" ? <main id="main-content" className="session-loading" aria-busy="true"><span className="status-light" /><p className="data-label">Opening the garage</p></main> : status === "authenticated" ? <Dashboard /> : <Landing />}<footer className="site-footer section-shell"><Link href="/" className="brand">Auto<span className="brand-iq">IQ</span><sup>®</sup></Link><span>Independent intelligence. Confident decisions.</span><span>VIN data: NHTSA · Market evidence: MarketCheck</span></footer></div>;
}
