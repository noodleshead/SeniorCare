import React, { useState } from "react";
import {
  Heart,
  ShieldCheck,
  UserRound,
  Bell,
  Megaphone,
  WalletCards,
  QrCode,
  UsersRound,
  Building2,
  CircleCheck,
  ArrowRight,
  Phone,
  MapPin,
  Mail,
  Menu,
  X,
  BadgeCheck,
  HeartHandshake,
  FileText,
} from "lucide-react";

/**
 * SENIORCARE — Public Landing Page
 * Colors:
 *  Yale Blue    #16425b  (headings, footer, primary text)
 *  Baltic Blue  #2f6690  (primary actions, nav accents)
 *  Cerulean     #3a7ca5  (secondary accents)
 *  Sky Blue     #81c3d7  (highlights, badges, soft fills)
 *  Alabaster    #d9dcd6  (soft backgrounds, borders)
 */

const COLORS = {
  yale: "#16425b",
  baltic: "#2f6690",
  cerulean: "#3a7ca5",
  sky: "#81c3d7",
  alabaster: "#d9dcd6",
};

function Navbar() {
  const [open, setOpen] = useState(false);
  const links = [
    { label: "Home", href: "#home" },
    { label: "About", href: "#about" },
    { label: "Services", href: "#services" },
    { label: "Announcements", href: "#announcements" },
    { label: "Contact", href: "#help" },
  ];

  return (
    <header
      className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b"
      style={{ borderColor: COLORS.alabaster }}
    >
      <div className="max-w-310 mx-auto px-5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Logo */}
          <a href="#home" className="flex items-center gap-2 shrink-0">
            <span
              className="flex items-center justify-center w-9 h-9 rounded-md"
              style={{ backgroundColor: COLORS.baltic }}
            >
              <Heart
                className="w-5 h-5 text-white"
                strokeWidth={2.25}
                aria-hidden="true"
              />
            </span>
            <span
              className="text-lg sm:text-xl font-bold tracking-tight"
              style={{ color: COLORS.yale }}
            >
              SENIORCARE
            </span>
          </a>

          {/* Desktop nav */}
          <nav
            className="hidden lg:flex items-center gap-8"
            aria-label="Primary"
          >
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-[15px] font-medium text-slate-700 hover:text-[#16425b] focus-visible:outline focus-visible:outline-offset-4 rounded-sm transition-colors"
                style={{ outlineColor: COLORS.baltic }}
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* Desktop auth */}
          <div className="hidden lg:flex items-center gap-3">
            <a
              href="/login"
              className="text-[15px] font-semibold px-4 py-2.5 rounded-md text-slate-700 hover:bg-slate-100 focus-visible:outline  focus-visible:outline-offset-2 transition-colors"
              style={{ outlineColor: COLORS.baltic }}
            >
              Login
            </a>
            <a
              href="/register"
              className="text-[15px] font-semibold px-5 py-2.5 rounded-md text-white shadow-sm hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 transition-opacity"
              style={{
                backgroundColor: COLORS.baltic,
                outlineColor: COLORS.yale,
              }}
            >
              Register
            </a>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-md text-slate-700 hover:bg-slate-100 focus-visible:outline "
            style={{ outlineColor: COLORS.baltic }}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="lg:hidden border-t bg-white"
          style={{ borderColor: COLORS.alabaster }}
        >
          <nav className="px-5 py-3 flex flex-col" aria-label="Mobile">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-3 text-base font-medium text-slate-700 border-b last:border-b-0"
                style={{ borderColor: COLORS.alabaster }}
              >
                {l.label}
              </a>
            ))}
            <div className="flex flex-col gap-3 pt-4 pb-2">
              <a
                href="/login"
                className="text-center text-[15px] font-semibold px-4 py-3 rounded-md border"
                style={{ borderColor: COLORS.baltic, color: COLORS.baltic }}
              >
                Login
              </a>
              <a
                href="/register"
                className="text-center text-[15px] font-semibold px-4 py-3 rounded-md text-white"
                style={{ backgroundColor: COLORS.baltic }}
              >
                Register as Senior Citizen
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function HeroSection() {
  return (
    <section
      id="home"
      className="relative overflow-hidden"
      style={{ backgroundColor: "#f7f9f9" }}
    >
      <div className="max-w-310 mx-auto px-5 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Copy */}
          <div>
            <span
              className="inline-flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-full mb-5"
              style={{ backgroundColor: COLORS.sky + "33", color: COLORS.yale }}
            >
              <Building2 className="w-4 h-4" aria-hidden="true" />A barangay
              senior citizen service platform
            </span>
            <h1
              className="text-[2.1rem] leading-[1.15] sm:text-5xl sm:leading-[1.1] font-extrabold tracking-tight mb-5"
              style={{ color: COLORS.yale }}
            >
              Care, Support, and Services — All Within Reach.
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed max-w-xl mb-8">
              SENIORCARE connects senior citizens with their barangay, making it
              easier to access pension schedules, benefits, assistance programs,
              announcements, and community activities — all in one accessible
              place.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="/register"
                className="inline-flex items-center justify-center gap-2 text-base font-semibold px-7 py-4 rounded-md text-white shadow-sm hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 transition-opacity"
                style={{
                  backgroundColor: COLORS.baltic,
                  outlineColor: COLORS.yale,
                }}
              >
                Register as Senior Citizen
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </a>
              <a
                href="/login"
                className="inline-flex items-center justify-center gap-2 text-base font-semibold px-7 py-4 rounded-md border-2 hover:bg-white focus-visible:outline transition-colors"
                style={{
                  borderColor: COLORS.baltic,
                  color: COLORS.baltic,
                  outlineColor: COLORS.baltic,
                }}
              >
                Login
              </a>
            </div>
          </div>

          {/* Visual placeholder */}
          <div className="relative">
            <div
              className="aspect-4/3 w-full rounded-xl overflow-hidden border flex items-center justify-center"
              style={{
                borderColor: COLORS.alabaster,
                backgroundColor: COLORS.sky + "22",
              }}
            >
              {/* Replace this block with an actual photo: a senior citizen and a barangay
                  staff member or guardian in a warm, community service setting. */}
              <img
                src="https://images.unsplash.com/photo-1584515933487-779824d29309?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                alt="A senior citizen being assisted by a barangay staff member at a community service desk"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.nextSibling.style.display = "flex";
                }}
              />
              <div
                className="hidden w-full h-full items-center justify-center flex-col gap-3 text-center px-6"
                style={{ color: COLORS.yale }}
              >
                <UsersRound className="w-14 h-14" aria-hidden="true" />
                <p className="text-sm font-medium">
                  Photo: senior citizen with barangay staff at a service desk
                </p>
              </div>
            </div>
            <div
              className="absolute -bottom-5 -left-5 hidden sm:flex items-center gap-3 bg-white rounded-lg shadow-md border px-4 py-3"
              style={{ borderColor: COLORS.alabaster }}
            >
              <ShieldCheck
                className="w-8 h-8"
                style={{ color: COLORS.baltic }}
                aria-hidden="true"
              />
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: COLORS.yale }}
                >
                  Verified by your barangay
                </p>
                <p className="text-xs text-slate-500">
                  Secure, authorized access
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustSection() {
  const items = [
    { icon: Building2, text: "Connected to Barangay Services" },
    { icon: UserRound, text: "Designed for Senior Citizens" },
    { icon: HeartHandshake, text: "Accessible to Authorized Guardians" },
    { icon: ShieldCheck, text: "Secure and Verified Records" },
  ];
  return (
    <section
      className="border-y bg-white"
      style={{ borderColor: COLORS.alabaster }}
      aria-label="Why trust SENIORCARE"
    >
      <div className="max-w-310 mx-auto px-5 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <Icon
                className="w-6 h-6 shrink-0"
                style={{ color: COLORS.baltic }}
                aria-hidden="true"
              />
              <span className="text-sm sm:text-[15px] font-medium text-slate-700">
                {text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ServicesSection() {
  const supporting = [
    {
      icon: FileText,
      title: "My Applications",
      desc: "Track applications for assistance and other barangay services from submission to approval.",
    },
    {
      icon: Megaphone,
      title: "Announcements",
      desc: "Stay updated with barangay notices, pension schedules, programs, and important announcements.",
    },
    {
      icon: UsersRound,
      title: "Social Activities",
      desc: "Discover upcoming senior citizen activities, programs, gatherings, and community events.",
    },
    {
      icon: Bell,
      title: "Notifications",
      desc: "Receive updates about applications, schedules, approvals, and other important notices.",
    },
  ];

  return (
    <section id="services" className="bg-white">
      <div className="max-w-310 mx-auto px-5 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-2xl mb-10">
          <h2
            className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4"
            style={{ color: COLORS.yale }}
          >
            Services Made Easier for Senior Citizens
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            SENIORCARE brings important barangay services and information
            together in one accessible place.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Featured service */}
          <div
            className="lg:col-span-2 rounded-xl border p-7 flex flex-col justify-between"
            style={{
              borderColor: COLORS.alabaster,
              backgroundColor: "#f7f9f9",
            }}
          >
            <div>
              <div
                className="w-12 h-12 rounded-md flex items-center justify-center mb-5"
                style={{ backgroundColor: COLORS.baltic }}
              >
                <WalletCards
                  className="w-6 h-6 text-white"
                  aria-hidden="true"
                />
              </div>
              <h3
                className="text-xl font-bold mb-2"
                style={{ color: COLORS.yale }}
              >
                My Pension
              </h3>
              <p className="text-slate-600 leading-relaxed mb-5">
                View pension information, claiming schedules, available claiming
                slots, and a QR claiming pass — ready before you head to the
                barangay.
              </p>
            </div>
            <a
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: COLORS.baltic }}
            >
              Learn more <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
          </div>

          {/* Supporting service rows */}
          <div
            className="lg:col-span-3 flex flex-col divide-y"
            style={{ borderColor: COLORS.alabaster }}
          >
            <div
              className="flex items-start gap-4 pb-5 mb-5 border-b"
              style={{ borderColor: COLORS.alabaster }}
            >
              <div
                className="w-11 h-11 shrink-0 rounded-md flex items-center justify-center"
                style={{ backgroundColor: COLORS.sky + "33" }}
              >
                <BadgeCheck
                  className="w-5 h-5"
                  style={{ color: COLORS.yale }}
                  aria-hidden="true"
                />
              </div>
              <div>
                <h3
                  className="text-base font-bold mb-1"
                  style={{ color: COLORS.yale }}
                >
                  My Benefits
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  See available senior citizen assistance and benefits based on
                  your eligibility and barangay programs.
                </p>
              </div>
            </div>
            {supporting.map(({ icon: Icon, title, desc }, i) => (
              <div
                key={title}
                className={`flex items-start gap-4 ${i < supporting.length - 1 ? "pb-5 mb-5 border-b" : ""}`}
                style={{ borderColor: COLORS.alabaster }}
              >
                <div
                  className="w-11 h-11 shrink-0 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: COLORS.sky + "33" }}
                >
                  <Icon
                    className="w-5 h-5"
                    style={{ color: COLORS.yale }}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h3
                    className="text-base font-bold mb-1"
                    style={{ color: COLORS.yale }}
                  >
                    {title}
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      n: "01",
      title: "Register",
      desc: "The senior citizen provides the required personal and barangay information.",
    },
    {
      n: "02",
      title: "Barangay Verification",
      desc: "Barangay staff reviews and verifies the submitted information and documents.",
    },
    {
      n: "03",
      title: "Account Approval",
      desc: "Once verified, the account is approved and activated.",
    },
    {
      n: "04",
      title: "Access Services",
      desc: "The senior citizen can access services, applications, schedules, benefits, and activities.",
    },
  ];

  return (
    <section
      id="about"
      className="border-t"
      style={{ borderColor: COLORS.alabaster, backgroundColor: "#f7f9f9" }}
    >
      <div className="max-w-310 mx-auto px-5 sm:px-6 lg:px-8 py-16 sm:py-20">
        <h2
          className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-12"
          style={{ color: COLORS.yale }}
        >
          How SENIORCARE Works
        </h2>

        {/* Desktop horizontal */}
        <div className="hidden md:grid md:grid-cols-4 gap-6 relative">
          <div
            className="absolute top-6 left-[12.5%] right-[12.5%] h-0.5"
            style={{ backgroundColor: COLORS.alabaster }}
            aria-hidden="true"
          />
          {steps.map((s) => (
            <div key={s.n} className="relative">
              <div
                className="relative z-10 w-12 h-12 rounded-full flex items-center justify-center font-bold text-white mb-5"
                style={{ backgroundColor: COLORS.baltic }}
              >
                {s.n}
              </div>
              <h3
                className="text-lg font-bold mb-2"
                style={{ color: COLORS.yale }}
              >
                {s.title}
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Mobile vertical timeline */}
        <div className="md:hidden flex flex-col">
          {steps.map((s, i) => (
            <div key={s.n} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0"
                  style={{ backgroundColor: COLORS.baltic }}
                >
                  {s.n}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className="w-0.5 flex-1 my-1"
                    style={{ backgroundColor: COLORS.alabaster }}
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="pb-8">
                <h3
                  className="text-base font-bold mb-1"
                  style={{ color: COLORS.yale }}
                >
                  {s.title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {s.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BenefitsSection() {
  const items = [
    "Octogenarian assistance",
    "Nonagenarian assistance",
    "Centenarian recognition and assistance",
    "Financial assistance programs",
    "Other senior citizen programs offered by your barangay or LGU",
  ];
  return (
    <section className="bg-white">
      <div className="max-w-310 mx-auto px-5 sm:px-6 lg:px-8 py-16 sm:py-20 grid lg:grid-cols-2 gap-10 items-start">
        <div>
          <h2
            className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4"
            style={{ color: COLORS.yale }}
          >
            Know the Benefits Available to You
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed mb-6">
            Depending on eligibility and available programs, senior citizens may
            qualify for assistance such as:
          </p>
          <p className="text-sm text-slate-500 leading-relaxed">
            Not every program applies to every senior citizen. Availability
            depends on age bracket, status, and the specific programs offered by
            your barangay or LGU. SENIORCARE helps you see what may apply to
            you.
          </p>
        </div>
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 rounded-lg border p-4"
              style={{ borderColor: COLORS.alabaster }}
            >
              <CircleCheck
                className="w-5 h-5 shrink-0 mt-0.5"
                style={{ color: COLORS.cerulean }}
                aria-hidden="true"
              />
              <span className="text-slate-700 text-[15px]">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PensionSection() {
  return (
    <section
      className="border-t"
      style={{ borderColor: COLORS.alabaster, backgroundColor: COLORS.yale }}
    >
      <div className="max-w-310 mx-auto px-5 sm:px-6 lg:px-8 py-16 sm:py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div className="order-2 lg:order-1 text-white">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Your Pension Schedule, Made Easier
          </h2>
          <p
            className="text-lg leading-relaxed mb-6"
            style={{ color: COLORS.sky }}
          >
            Check pension information, view claiming schedules, and select an
            available claiming date and time — then generate a QR claiming pass
            to bring to your barangay.
          </p>
          <ul className="flex flex-col gap-3 mb-8">
            {[
              "Check pension information and history",
              "View available claiming dates and time slots",
              "Select your preferred claiming schedule",
              "Generate a QR claiming pass",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <CircleCheck
                  className="w-5 h-5 shrink-0 mt-0.5"
                  style={{ color: COLORS.sky }}
                  aria-hidden="true"
                />
                <span className="text-[15px]">{t}</span>
              </li>
            ))}
          </ul>
          <a
            href="/register"
            className="inline-flex items-center gap-2 text-base font-semibold px-6 py-3.5 rounded-md text-white"
            style={{ backgroundColor: COLORS.baltic }}
          >
            Register to Get Started
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </a>
        </div>

        {/* Phone mockup */}
        <div className="order-1 lg:order-2 flex justify-center">
          <div className="w-70 rounded-4xl bg-white shadow-2xl border-8 border-white p-5">
            <p className="text-xs font-semibold text-slate-400 mb-4 tracking-wide uppercase">
              Pension Claiming
            </p>
            <div
              className="rounded-lg p-4 mb-4"
              style={{ backgroundColor: "#f7f9f9" }}
            >
              <p className="text-xs text-slate-500 mb-1">Next Schedule</p>
              <p className="font-bold text-lg" style={{ color: COLORS.yale }}>
                September 12, 2026
              </p>
              <p className="text-sm text-slate-600">9:00 AM – 11:00 AM</p>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-slate-500">Status</span>
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: COLORS.sky + "33",
                  color: COLORS.yale,
                }}
              >
                Scheduled
              </span>
            </div>
            <div
              className="border rounded-lg p-4 flex flex-col items-center"
              style={{ borderColor: COLORS.alabaster }}
            >
              <p className="text-xs text-slate-500 mb-3">QR Claiming Pass</p>
              <QrCode
                className="w-24 h-24"
                style={{ color: COLORS.yale }}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function GuardianSection() {
  return (
    <section className="bg-white">
      <div className="max-w-310 mx-auto px-5 sm:px-6 lg:px-8 py-16 sm:py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h2
            className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4"
            style={{ color: COLORS.yale }}
          >
            Support a Senior You Care For
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed mb-6">
            An authorized guardian or representative can help manage services
            for a senior citizen once properly authorized by the barangay — not
            unrestricted account access, but coordinated support where it's
            needed.
          </p>
          <ul className="flex flex-col gap-3">
            {[
              "Pension claiming assistance",
              "Document submission",
              "Assistance applications",
              "Application tracking",
              "Service coordination with the barangay",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <CircleCheck
                  className="w-5 h-5 shrink-0 mt-0.5"
                  style={{ color: COLORS.cerulean }}
                  aria-hidden="true"
                />
                <span className="text-slate-700 text-[15px]">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Relationship visual */}
        <div
          className="rounded-xl border p-8 flex flex-col items-center gap-3"
          style={{ borderColor: COLORS.alabaster, backgroundColor: "#f7f9f9" }}
        >
          {[
            { icon: UserRound, label: "Senior Citizen" },
            { icon: HeartHandshake, label: "Authorized Representative" },
            { icon: Building2, label: "Barangay Services" },
          ].map((step, i, arr) => (
            <React.Fragment key={step.label}>
              <div
                className="flex items-center gap-3 bg-white rounded-lg border px-5 py-3 w-full"
                style={{ borderColor: COLORS.alabaster }}
              >
                <step.icon
                  className="w-6 h-6 shrink-0"
                  style={{ color: COLORS.baltic }}
                  aria-hidden="true"
                />
                <span
                  className="font-semibold text-sm"
                  style={{ color: COLORS.yale }}
                >
                  {step.label}
                </span>
              </div>
              {i < arr.length - 1 && (
                <ArrowRight
                  className="w-5 h-5 rotate-90"
                  style={{ color: COLORS.cerulean }}
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

function BarangayConnectionSection() {
  const flow = ["Senior Citizen", "SENIORCARE", "Barangay"];
  const outcomes = [
    "Verification",
    "Applications",
    "Announcements",
    "Pension Schedules",
    "Community Activities",
    "Assistance",
  ];

  return (
    <section
      className="border-t"
      style={{ borderColor: COLORS.alabaster, backgroundColor: "#f7f9f9" }}
    >
      <div className="max-w-310 mx-auto px-5 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
        <h2
          className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4"
          style={{ color: COLORS.yale }}
        >
          SENIORCARE Connects Senior Citizens With Their Barangay
        </h2>
        <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto mb-12">
          From registration and verification to applications, announcements,
          pension schedules, and community activities, SENIORCARE helps bring
          important barangay services closer to senior citizens.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
          {flow.map((label, i) => (
            <React.Fragment key={label}>
              <div
                className="px-6 py-3 rounded-md font-bold text-white"
                style={{
                  backgroundColor: i === 1 ? COLORS.baltic : COLORS.yale,
                }}
              >
                {label}
              </div>
              {i < flow.length - 1 && (
                <ArrowRight
                  className="w-5 h-5 sm:rotate-0 rotate-90"
                  style={{ color: COLORS.cerulean }}
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {outcomes.map((o) => (
            <span
              key={o}
              className="text-sm font-medium px-4 py-2 rounded-full bg-white border"
              style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
            >
              {o}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function AnnouncementsSection() {
  const announcements = [
    {
      category: "Pension",
      date: "Aug 20, 2026",
      title: "Pension Claiming Schedule",
      preview:
        "Updated schedule for the upcoming pension distribution in your barangay.",
      icon: WalletCards,
    },
    {
      category: "Assistance",
      date: "Aug 14, 2026",
      title: "Financial Assistance Program",
      preview:
        "Applications are now being accepted for eligible senior citizens.",
      icon: FileText,
    },
    {
      category: "Notice",
      date: "Aug 5, 2026",
      title: "Barangay Notice",
      preview:
        "Important notice regarding senior citizen verification and documentation.",
      icon: Megaphone,
    },
    {
      category: "Activity",
      date: "Jul 30, 2026",
      title: "Senior Citizen Activity",
      preview: "Join the upcoming community wellness and social activity.",
      icon: UsersRound,
    },
  ];

  return (
    <section id="announcements" className="bg-white">
      <div className="max-w-310 mx-auto px-5 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <h2
            className="text-3xl sm:text-4xl font-extrabold tracking-tight"
            style={{ color: COLORS.yale }}
          >
            Latest Announcements
          </h2>
          <a
            href="/login"
            className="text-sm font-semibold inline-flex items-center gap-1.5"
            style={{ color: COLORS.baltic }}
          >
            View all <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {announcements.map((a) => (
            <a
              key={a.title}
              href="/login"
              className="group flex gap-4 rounded-lg border p-5 hover:shadow-md transition-shadow"
              style={{ borderColor: COLORS.alabaster }}
            >
              <div
                className="w-11 h-11 shrink-0 rounded-md flex items-center justify-center"
                style={{ backgroundColor: COLORS.sky + "33" }}
              >
                <a.icon
                  className="w-5 h-5"
                  style={{ color: COLORS.yale }}
                  aria-hidden="true"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: COLORS.alabaster,
                      color: COLORS.yale,
                    }}
                  >
                    {a.category}
                  </span>
                  <span className="text-xs text-slate-400">{a.date}</span>
                </div>
                <h3
                  className="font-bold mb-1 group-hover:underline"
                  style={{ color: COLORS.yale }}
                >
                  {a.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {a.preview}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function HelpSection() {
  return (
    <section
      id="help"
      className="border-t"
      style={{ borderColor: COLORS.alabaster, backgroundColor: "#f7f9f9" }}
    >
      <div className="max-w-310 mx-auto px-5 sm:px-6 lg:px-8 py-16 sm:py-20 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <h2
            className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4"
            style={{ color: COLORS.yale }}
          >
            Need Help? Your Barangay Can Assist.
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed mb-6">
            For registration, verification, document requirements, applications,
            or other concerns, visit or contact your barangay office for
            assistance.
          </p>
          <a
            href="#help"
            className="inline-flex items-center gap-2 text-base font-semibold px-6 py-3.5 rounded-md text-white"
            style={{ backgroundColor: COLORS.baltic }}
          >
            Contact Your Barangay
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </a>
        </div>

        <div
          className="rounded-xl border bg-white p-6 flex flex-col gap-5"
          style={{ borderColor: COLORS.alabaster }}
        >
          {[
            {
              icon: Building2,
              label: "Barangay Office",
              value: "Your local barangay hall",
            },
            { icon: Phone, label: "Phone", value: "(0XX) XXX-XXXX" },
            { icon: Mail, label: "Email", value: "office@yourbarangay.gov.ph" },
            {
              icon: MapPin,
              label: "Location",
              value: "Barangay Hall, [Address placeholder]",
            },
          ].map((c) => (
            <div key={c.label} className="flex items-center gap-4">
              <div
                className="w-11 h-11 shrink-0 rounded-md flex items-center justify-center"
                style={{ backgroundColor: COLORS.sky + "33" }}
              >
                <c.icon
                  className="w-5 h-5"
                  style={{ color: COLORS.yale }}
                  aria-hidden="true"
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {c.label}
                </p>
                <p className="text-[15px] font-medium text-slate-700">
                  {c.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ backgroundColor: COLORS.yale }} className="text-white">
      <div className="max-w-310 mx-auto px-5 sm:px-6 lg:px-8 py-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span
              className="flex items-center justify-center w-8 h-8 rounded-md"
              style={{ backgroundColor: COLORS.baltic }}
            >
              <Heart className="w-4 h-4 text-white" aria-hidden="true" />
            </span>
            <span className="text-lg font-bold">SENIORCARE</span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: COLORS.sky }}>
            Connecting senior citizens with their barangay's services, benefits,
            and community programs.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide mb-4">
            Quick Links
          </h3>
          <ul
            className="flex flex-col gap-2.5 text-sm"
            style={{ color: COLORS.sky }}
          >
            <li>
              <a href="#home" className="hover:text-white">
                Home
              </a>
            </li>
            <li>
              <a href="#about" className="hover:text-white">
                About
              </a>
            </li>
            <li>
              <a href="#services" className="hover:text-white">
                Services
              </a>
            </li>
            <li>
              <a href="#announcements" className="hover:text-white">
                Announcements
              </a>
            </li>
            <li>
              <a href="#help" className="hover:text-white">
                Contact
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide mb-4">
            Account
          </h3>
          <ul
            className="flex flex-col gap-2.5 text-sm"
            style={{ color: COLORS.sky }}
          >
            <li>
              <a href="/login" className="hover:text-white">
                Login
              </a>
            </li>
            <li>
              <a href="/register" className="hover:text-white">
                Register
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide mb-4">
            Legal
          </h3>
          <ul
            className="flex flex-col gap-2.5 text-sm"
            style={{ color: COLORS.sky }}
          >
            <li>
              <a href="/privacy" className="hover:text-white">
                Privacy Policy
              </a>
            </li>
            <li>
              <a href="/terms" className="hover:text-white">
                Terms of Use
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t" style={{ borderColor: "#2f6690" }}>
        <div
          className="max-w-310 mx-auto px-5 sm:px-6 lg:px-8 py-5 text-xs text-center"
          style={{ color: COLORS.sky }}
        >
          © 2026 SENIORCARE. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export default function SeniorCareLandingPage() {
  return (
    <div
      className="min-h-screen bg-white antialiased"
      style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}
    >
      <Navbar />
      <main>
        <HeroSection />
        <TrustSection />
        <ServicesSection />
        <HowItWorksSection />
        <BenefitsSection />
        <PensionSection />
        <GuardianSection />
        <BarangayConnectionSection />
        <AnnouncementsSection />
        <HelpSection />
      </main>
      <Footer />
    </div>
  );
}
