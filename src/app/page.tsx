import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookLock,
  Bot,
  BriefcaseBusiness,
  Building2,
  ChevronRight,
  FileLock2,
  Fingerprint,
  HeartHandshake,
  LifeBuoy,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PLAN_DETAILS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const problemCards = [
  {
    title: "No insurance",
    description: "If your AI feature causes a financial loss, a privacy incident, or a customer dispute, you are usually carrying that risk alone.",
    icon: ShieldAlert,
  },
  {
    title: "No continuity",
    description: "Most solo builders have credentials, billing, domains, and deployment access living in one brain and one browser profile.",
    icon: LifeBuoy,
  },
  {
    title: "No compliance",
    description: "Customers now ask about privacy, audit trails, and basic controls long before they ask how clever your prompt chain is.",
    icon: Fingerprint,
  },
] as const;

const verticals = [
  {
    value: "continuity",
    label: "Continuity",
    eyebrow: "Vertical 1",
    title: "Keep the business alive if you disappear for a week.",
    description: "Store critical access, assign infrastructure heirs, and define exactly how your software business keeps running under stress.",
    icon: BookLock,
    bullets: ["Encrypted credential vault", "Infrastructure heir workflows", "Dead-man's switch and legal handoff documents"],
  },
  {
    value: "ledger",
    label: "Ledger",
    eyebrow: "Vertical 2",
    title: "Prove what you built with evidence that can be checked.",
    description: "Register shipped work, sign evidence bundles, and create a cleaner record for employers, clients, and disputes over contribution.",
    icon: BadgeCheck,
    bullets: ["Cryptographic work registration", "Verification status tracking", "Evidence hashes for shipped software history"],
  },
  {
    value: "compliance",
    label: "Compliance",
    eyebrow: "Vertical 3",
    title: "Answer customer compliance questions before they become blockers.",
    description: "Run lightweight AI-assisted reviews against common frameworks and produce plain-English reports a small team can actually act on.",
    icon: ShieldCheck,
    bullets: ["Framework-based codebase scans", "Risk scoring with issues grouped by severity", "Audit trail and report generation"],
  },
  {
    value: "insurance",
    label: "Insurance",
    eyebrow: "Vertical 4",
    title: "Understand how risky your product looks before an underwriter does.",
    description: "Estimate exposure, organize policy records, and get a practical view of the controls that will affect premiums or eligibility.",
    icon: WalletCards,
    bullets: ["Risk assessments for AI software", "Policy quote and status tracking", "Coverage conversations grounded in operational reality"],
  },
  {
    value: "collective",
    label: "Collective",
    eyebrow: "Vertical 5",
    title: "Operate like a small firm instead of a loose chat thread.",
    description: "Manage members, shared projects, and revenue waterfalls for compact AI teams that need structure without heavyweight overhead.",
    icon: HeartHandshake,
    bullets: ["Collective creation and membership control", "Project tracking with revenue waterfalls", "Role-based collaboration for 1-5 person teams"],
  },
] as const;

const pricingFeatures = [
  {
    label: "The Soul legal and business advisor",
    plans: { FREE: true, STARTER: true, GROWTH: true, PROFESSIONAL: true, ENTERPRISE: true },
  },
  {
    label: "Business continuity vault and heirs",
    plans: { FREE: false, STARTER: true, GROWTH: true, PROFESSIONAL: true, ENTERPRISE: true },
  },
  {
    label: "Verified work ledger",
    plans: { FREE: false, STARTER: false, GROWTH: true, PROFESSIONAL: true, ENTERPRISE: true },
  },
  {
    label: "Compliance scans and reports",
    plans: { FREE: false, STARTER: false, GROWTH: true, PROFESSIONAL: true, ENTERPRISE: true },
  },
  {
    label: "Insurance assessment workspace",
    plans: { FREE: false, STARTER: false, GROWTH: false, PROFESSIONAL: true, ENTERPRISE: true },
  },
  {
    label: "Developer collective operations",
    plans: { FREE: false, STARTER: false, GROWTH: false, PROFESSIONAL: true, ENTERPRISE: true },
  },
] as const;

const trustSignals = [
  { value: "1 account", label: "auth, database, and app workspace tied together" },
  { value: "5 verticals", label: "cover continuity, proof of work, compliance, insurance, and collective ops" },
  { value: "1-5 people", label: "the exact team size SolidDark is designed around" },
  { value: "0 in-house counsel", label: "required to start building a real protection stack" },
] as const;

export default function Home() {
  return (
    <main className="page-fade overflow-hidden">
      <section className="relative isolate border-b border-[var(--border-default)] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pb-24">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(233,69,96,0.20),transparent_28%),radial-gradient(circle_at_70%_20%,rgba(22,194,213,0.16),transparent_24%),linear-gradient(180deg,rgba(18,18,26,0.55),rgba(10,10,15,0.96))]" />
        <div className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-[var(--accent-cyan)]/50 to-transparent" />

        <div className="mx-auto max-w-7xl">
          <header className="flex items-center justify-between gap-4 py-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-hover)] bg-[radial-gradient(circle_at_center,rgba(215,178,102,0.14),rgba(8,10,14,0.95))] shadow-[0_0_40px_rgba(215,178,102,0.16)]">
                <Image src="/soliddark-mark.png" alt="SolidDark mark" width={44} height={44} className="h-11 w-11 object-cover" priority />
              </div>
              <div>
                <p className="font-heading text-lg font-semibold">SolidDark</p>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-tertiary)]">AI infrastructure defense</p>
              </div>
            </Link>

            <nav className="hidden items-center gap-6 text-sm text-[var(--text-secondary)] lg:flex">
              <a href="#problem">Problem</a>
              <a href="#verticals">Verticals</a>
              <a href="#soul">The Soul</a>
              <a href="#pricing">Pricing</a>
            </nav>

            <div className="flex items-center gap-2">
              <Link href="/login" className="hidden text-sm text-[var(--text-secondary)] sm:inline-flex">
                Log in
              </Link>
              <Button asChild className="bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90">
                <Link href="/signup">Get Protected</Link>
              </Button>
            </div>
          </header>

          <div className="grid gap-10 pt-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-end">
            <div className="max-w-3xl">
              <Badge className="border-[var(--accent-cyan)]/30 bg-[var(--accent-cyan)]/10 px-3 py-1 text-[var(--accent-cyan)]">
                Built for AI-powered software businesses that have no legal back office
              </Badge>
              <h1 className="font-heading mt-6 max-w-4xl text-5xl font-bold leading-[0.95] tracking-tight text-[var(--text-primary)] sm:text-6xl lg:text-7xl">
                The AI economy has no safety net. We&apos;re building one.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
                SolidDark gives solo developers and small AI teams one place to handle legal information, continuity planning, compliance prep,
                insurance readiness, and shared operating structure before a failure turns into a business-ending event.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-lg bg-[var(--accent-red)] px-6 text-white hover:bg-[var(--accent-red)]/90">
                  <Link href="/signup">
                    Get Protected
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-lg border-[var(--border-default)] bg-[var(--bg-tertiary)] px-6 text-[var(--text-primary)] hover:bg-[var(--border-hover)]"
                >
                  <Link href="/signup?redirectTo=%2Fdashboard%2Fsoul">
                    Talk to the Soul
                    <Sparkles className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="panel-card rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Who it is for</p>
                  <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">Solo developers, vibe coders, and 1-5 person AI teams</p>
                </div>
                <div className="panel-card rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">What it covers</p>
                  <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">Continuity, proof of work, compliance, insurance, and collective ops</p>
                </div>
                <div className="panel-card rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">What makes it different</p>
                  <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">One dark workspace instead of five disconnected vendor tools</p>
                </div>
              </div>
            </div>

            <div className="panel-card relative overflow-hidden rounded-[1.5rem] border-[var(--border-hover)] bg-[linear-gradient(180deg,rgba(26,26,46,0.96),rgba(12,12,18,0.98))] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-red)]/70 to-transparent" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-tertiary)]">Protection stack</p>
                  <h2 className="font-heading mt-2 text-2xl font-semibold">Everything you forgot to build around the product</h2>
                </div>
                <Bot className="h-6 w-6 text-[var(--accent-cyan)]" />
              </div>
              <div className="mt-6 grid gap-3">
                {[
                  { label: "Legal and business AI advisor", value: "The Soul", accent: "text-[var(--accent-cyan)]" },
                  { label: "Continuity readiness", value: "Vault, heirs, dead-man switch", accent: "text-[var(--accent-red)]" },
                  { label: "Shipping proof", value: "Verified work ledger", accent: "text-[var(--accent-cyan)]" },
                  { label: "Buyer confidence", value: "Compliance scans and reports", accent: "text-[var(--accent-amber)]" },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-[var(--border-default)] bg-[rgba(255,255,255,0.02)] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{item.label}</p>
                    <p className={`mt-2 text-sm font-semibold ${item.accent}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="problem" className="px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--accent-cyan)]">Problem statement</p>
            <h2 className="font-heading mt-4 text-3xl font-semibold sm:text-4xl">AI builders are shipping products with enterprise-sized exposure and hobby-project protection.</h2>
            <p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">
              You can launch an AI product in a weekend. You cannot improvise continuity, compliance, insurance posture, and legal process in the middle
              of a dispute, outage, or customer audit.
            </p>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {problemCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.title} className="panel-card rounded-2xl p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-tertiary)] text-[var(--accent-red)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-heading mt-5 text-2xl font-semibold">{card.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{card.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="verticals" className="border-y border-[var(--border-default)] bg-[rgba(18,18,26,0.5)] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--accent-cyan)]">The five verticals</p>
            <h2 className="font-heading mt-4 text-3xl font-semibold sm:text-4xl">One platform for the five operational gaps most AI teams leave exposed.</h2>
          </div>
          <Tabs defaultValue="continuity" className="mt-10">
            <TabsList className="grid h-auto w-full grid-cols-1 gap-2 rounded-[1.65rem] bg-[linear-gradient(180deg,rgba(19,22,27,0.96),rgba(8,10,14,0.98))] p-2 sm:grid-cols-2 md:grid-cols-5">
              {verticals.map((vertical) => (
                <TabsTrigger
                  key={vertical.value}
                  value={vertical.value}
                  className="h-12 w-full rounded-[1rem] border border-transparent px-4 py-0 text-[0.72rem] font-medium uppercase tracking-[0.28em] text-[var(--text-secondary)] data-[state=active]:border-[var(--accent-red)] data-[state=active]:bg-[linear-gradient(180deg,rgba(215,178,102,0.22),rgba(125,96,48,0.14))] data-[state=active]:text-[var(--text-primary)]"
                >
                  {vertical.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {verticals.map((vertical) => {
              const Icon = vertical.icon;
              return (
                <TabsContent key={vertical.value} value={vertical.value} className="mt-6">
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(320px,1.08fr)]">
                    <div className="panel-card rounded-[1.5rem] p-6">
                      <p className="text-sm uppercase tracking-[0.18em] text-[var(--accent-cyan)]">{vertical.eyebrow}</p>
                      <div className="mt-5 flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-tertiary)] text-[var(--accent-red)]">
                          <Icon className="h-6 w-6" />
                        </div>
                        <h3 className="font-heading text-2xl font-semibold sm:text-3xl">{vertical.title}</h3>
                      </div>
                      <p className="mt-5 max-w-xl text-base leading-7 text-[var(--text-secondary)]">{vertical.description}</p>
                    </div>
                    <div className="panel-card rounded-[1.5rem] p-6">
                      <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-tertiary)]">Key features</p>
                      <div className="mt-5 grid gap-3">
                        {vertical.bullets.map((bullet) => (
                          <div key={bullet} className="flex items-start gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-cyan)]" />
                            <p className="text-sm leading-6 text-[var(--text-primary)]">{bullet}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </section>

      <section id="soul" className="px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.88fr)_minmax(340px,1.12fr)] lg:items-center">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--accent-cyan)]">The Soul</p>
            <h2 className="font-heading mt-4 text-3xl font-semibold sm:text-4xl">A direct AI advisor for the legal and business edges around AI software.</h2>
            <p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">
              The Soul is built to answer hard questions plainly: contract risk, customer notices, compliance posture, insurance exposure, and what to do
              next when your business setup is thinner than your product ambition.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="panel-card rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">How it speaks</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-primary)]">Direct, plain English, no corporate filler, no fake certainty.</p>
              </div>
              <div className="panel-card rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">What it focuses on</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-primary)]">Law, compliance, insurance, liability, continuity, and operating risk.</p>
              </div>
            </div>
          </div>

          <div className="panel-card overflow-hidden rounded-[1.75rem] border-[var(--border-hover)] bg-[linear-gradient(180deg,rgba(15,52,96,0.18),rgba(18,18,26,0.96))] p-5 shadow-[0_35px_100px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-4">
              <div>
                <p className="font-heading text-xl font-semibold">Soul conversation</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Configured for US-FL and US-DE</p>
              </div>
              <Badge className="border-[var(--accent-cyan)]/30 bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]">Claude legal reasoning</Badge>
            </div>
            <div className="space-y-4 py-5">
              <div className="ml-auto max-w-[85%] rounded-3xl rounded-br-lg bg-[var(--accent-blue)] px-4 py-3 text-sm leading-6 text-white">
                I am building an AI SaaS alone. What breaks first if I get sick for two weeks?
              </div>
              <div className="max-w-[92%] rounded-3xl rounded-bl-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-4 text-sm leading-6 text-[var(--text-primary)]">
                <p className="font-medium text-[var(--accent-cyan)]">SolidDark Soul</p>
                <p className="mt-2">
                  First failure point: credential continuity. If billing, hosting, domain control, and database access all sit with you, your product can stay
                  online while the business around it becomes inaccessible.
                </p>
                <p className="mt-3">
                  Next steps:
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-[var(--text-secondary)]">
                  <li>Put critical credentials into an encrypted vault.</li>
                  <li>Assign at least one verified infrastructure heir.</li>
                  <li>Set a dead-man check-in so someone gets notified before revenue systems drift.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="border-y border-[var(--border-default)] bg-[rgba(18,18,26,0.52)] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--accent-cyan)]">Pricing</p>
            <h2 className="font-heading mt-4 text-3xl font-semibold sm:text-4xl">Start with the gap you need to close. Expand when the product becomes real money.</h2>
          </div>

          <div className="mt-10 grid gap-4 xl:grid-cols-5">
            {PLAN_DETAILS.map((plan) => (
              <article
                key={plan.key}
                className={`panel-card rounded-[1.5rem] p-6 ${plan.key === "PROFESSIONAL" ? "border-[var(--accent-red)] shadow-[0_20px_60px_rgba(233,69,96,0.16)]" : ""}`}
              >
                <p className="text-sm uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{plan.name}</p>
                <p className="font-heading mt-4 text-4xl font-semibold">{plan.price}</p>
                <p className="mt-3 min-h-16 text-sm leading-6 text-[var(--text-secondary)]">{plan.description}</p>
                <Button
                  asChild
                  className={`mt-6 w-full ${plan.key === "PROFESSIONAL" ? "bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90" : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border-hover)]"}`}
                >
                  <Link href="/signup">{plan.key === "ENTERPRISE" ? "Talk to us" : "Choose plan"}</Link>
                </Button>
              </article>
            ))}
          </div>

          <div className="mt-8 overflow-hidden rounded-[1.5rem] border border-[var(--border-default)]">
            <div className="overflow-x-auto">
              <table className="min-w-full bg-[var(--bg-secondary)] text-left">
                <thead>
                  <tr className="border-b border-[var(--border-default)] text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    <th className="px-4 py-4 sm:px-6">Feature</th>
                    {PLAN_DETAILS.map((plan) => (
                      <th key={plan.key} className="px-4 py-4 sm:px-6">
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pricingFeatures.map((feature) => (
                    <tr key={feature.label} className="border-b border-[var(--border-default)] last:border-b-0">
                      <td className="px-4 py-4 text-sm text-[var(--text-primary)] sm:px-6">{feature.label}</td>
                      {PLAN_DETAILS.map((plan) => (
                        <td key={plan.key} className="px-4 py-4 text-sm text-[var(--text-secondary)] sm:px-6">
                          {feature.plans[plan.key] ? "Included" : "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)] lg:items-start">
            <div className="max-w-2xl">
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--accent-cyan)]">Built for the AI economy</p>
              <h2 className="font-heading mt-4 text-3xl font-semibold sm:text-4xl">The market gap is not model quality. It is operational protection around the model.</h2>
              <p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">
                Builders can ship faster than ever. What is missing is the legal, continuity, compliance, and insurance infrastructure that makes a small AI
                business durable enough to survive success, failure, and scrutiny.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {trustSignals.map((signal) => (
                <div key={signal.value} className="panel-card rounded-2xl p-5">
                  <p className="font-heading text-3xl font-semibold text-[var(--accent-cyan)]">{signal.value}</p>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{signal.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-10 lg:pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="panel-card overflow-hidden rounded-[2rem] border-[var(--border-hover)] bg-[linear-gradient(135deg,rgba(233,69,96,0.18),rgba(15,52,96,0.18),rgba(18,18,26,0.95))] p-8 sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="max-w-2xl">
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--accent-cyan)]">Final CTA</p>
                <h2 className="font-heading mt-4 text-3xl font-semibold sm:text-4xl">Build fast if you want. Just stop building naked.</h2>
                <p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">
                  Set up the protection stack before the first enterprise customer, the first outage, the first threatening email, or the first week you are
                  unavailable.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Button asChild size="lg" className="h-12 rounded-lg bg-[var(--accent-red)] px-6 text-white hover:bg-[var(--accent-red)]/90">
                  <Link href="/signup">Create your workspace</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-lg border-[var(--border-default)] bg-[var(--bg-tertiary)] px-6 text-[var(--text-primary)] hover:bg-[var(--border-hover)]"
                >
                  <Link href="/signup?redirectTo=%2Fdashboard%2Fsoul">Start with the Soul</Link>
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2">
              <BriefcaseBusiness className="h-3.5 w-3.5 text-[var(--accent-red)]" />
              Built for small AI businesses
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2">
              <FileLock2 className="h-3.5 w-3.5 text-[var(--accent-cyan)]" />
              Legal information, not legal advice
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2">
              <Building2 className="h-3.5 w-3.5 text-[var(--accent-amber)]" />
              Structured for real-world business ops
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
