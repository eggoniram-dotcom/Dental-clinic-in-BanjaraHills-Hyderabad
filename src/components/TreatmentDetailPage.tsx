import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  Clock,
  IndianRupee,
  MessageCircle,
  Phone,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import {
  FEATURED_TREATMENT_PAGES,
  TREATMENT_PAGES,
  buildWhatsAppLink,
  getDoctorEnrichment,
  resolveTreatmentService,
  resolveTreatmentServicesAll,
  type TreatmentPageSpec,
} from '../lib/clinicCatalog.ts';
import type { ClinicData } from '../types.ts';
import { AppointmentEnquiryForm } from './AppointmentEnquiryForm.tsx';

interface TreatmentDetailPageProps {
  slug: string;
  clinicData: ClinicData;
  onNavigateHome: (sectionId?: string) => void;
  onSelectTreatment: (slug: string) => void;
}

export function TreatmentDetailPage({
  slug,
  clinicData,
  onNavigateHome,
  onSelectTreatment,
}: TreatmentDetailPageProps) {
  const [heroError, setHeroError] = useState(false);
  const [docError, setDocError] = useState(false);

  const spec: TreatmentPageSpec =
    TREATMENT_PAGES.find((t) => t.slug === slug) ?? TREATMENT_PAGES[0];

  const primaryService = resolveTreatmentService(spec, clinicData);
  const relatedServices = resolveTreatmentServicesAll(spec, clinicData);
  const docIndex = Math.max(
    0,
    clinicData.doctors.findIndex((d) => d.id === spec.leadDoctorId),
  );
  const specialist = clinicData.doctors[docIndex] ?? clinicData.doctors[0];
  const docEnrichment = specialist ? getDoctorEnrichment(specialist, docIndex) : null;

  const waHref = buildWhatsAppLink(
    clinicData,
    `Hello ${clinicData.clinicName}, I would like to enquire about ${spec.title} at your Banjara Hills clinic.`,
  );

  const otherTreatments = FEATURED_TREATMENT_PAGES.filter((t) => t.slug !== spec.slug);

  return (
    <main className="bg-[#f8faf9] text-slate-900">
      {/* Breadcrumb, Hero & Treatment-at-a-Glance Strip */}
      <section className="bg-white border-b border-emerald-950/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-10 sm:pt-8 sm:pb-12">
          <button
            type="button"
            onClick={() => onNavigateHome('treatments')}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-emerald-900 hover:text-emerald-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to All Treatments</span>
          </button>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-center">
              <p className="text-xs sm:text-sm font-medium text-emerald-800">
                {spec.seoKeyword} · {clinicData.clinicName}
              </p>

              <h1
                className="mt-2 font-bold tracking-tight text-emerald-950 leading-[1.08]"
                style={{ fontSize: 'clamp(2rem, 3.8vw, 3.1rem)', textWrap: 'balance' }}
              >
                {spec.title} in Banjara Hills
              </h1>

              <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-[58ch]">
                {spec.summary}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a
                  href="#treatment-booking-form"
                  className="inline-flex items-center justify-center gap-2 min-h-[46px] px-6 py-3 rounded-xl bg-emerald-900 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors whitespace-nowrap"
                >
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                  <span>Book Appointment</span>
                </a>
                <a
                  href={`tel:${clinicData.phone.replace(/\s+/g, '')}`}
                  className="inline-flex items-center justify-center gap-2 min-h-[46px] px-5 py-3 rounded-xl border border-emerald-950/15 bg-white text-emerald-950 text-sm font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  <Phone className="w-4 h-4 text-emerald-800" aria-hidden="true" />
                  <span>Call Clinic</span>
                </a>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 min-h-[46px] px-5 py-3 rounded-xl border border-emerald-900/20 bg-emerald-50/80 text-emerald-950 text-sm font-semibold hover:bg-emerald-100 transition-colors whitespace-nowrap"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                  <span>WhatsApp Enquiry</span>
                </a>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative h-full min-h-[240px] sm:min-h-[300px] rounded-2xl overflow-hidden border border-emerald-950/10 bg-emerald-950/5">
                {!heroError ? (
                  <img
                    src={spec.image}
                    alt={`${spec.title} at ${clinicData.clinicName}, Banjara Hills`}
                    referrerPolicy="no-referrer"
                    onError={() => setHeroError(true)}
                    className={`w-full h-full object-cover ${spec.imagePosition || 'object-center'}`}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-stone-100 text-emerald-900 p-6 text-center">
                    <Stethoscope className="w-10 h-10 mb-2 opacity-75" aria-hidden="true" />
                    <p className="font-semibold text-sm">{spec.title}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* At-a-Glance Summary: Expected Visits, Session Time, Indicative Fee */}
          <div
            aria-label="Treatment timeline and indicative fees"
            className="mt-8 pt-6 border-t border-emerald-950/10 grid grid-cols-1 sm:grid-cols-3 gap-5"
          >
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-xs font-medium text-slate-500">Expected Visits</p>
                <p className="mt-0.5 text-sm sm:text-base font-bold text-emerald-950">
                  {spec.expectedVisits}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-xs font-medium text-slate-500">Typical Chair Time</p>
                <p className="mt-0.5 text-sm sm:text-base font-bold text-emerald-950 tabular-nums">
                  {spec.sessionDuration}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <IndianRupee
                className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-medium text-slate-500">Indicative Clinic Fee</p>
                <p className="mt-0.5 text-sm sm:text-base font-bold text-emerald-900 tabular-nums">
                  {primaryService?.price || 'Confirmed after consultation'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Detailed Explanation, Process, Visits & Indicative Fees */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <div className="lg:col-span-7 space-y-10">
            {/* 1. Treatment Explanation */}
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-emerald-950 tracking-tight">
                About {spec.title}
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-700 leading-relaxed">
                {spec.detailedExplanation}
              </p>

              <div className="mt-5">
                <h3 className="text-sm font-bold text-emerald-950">
                  Common Reasons Patients Consult Us
                </h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {spec.whenToConsult.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check
                        className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 2. Step-by-Step Clinical Process */}
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-emerald-950 tracking-tight">
                Step-by-Step Treatment Process
              </h2>
              <div className="mt-4 border-t border-emerald-950/10 divide-y divide-emerald-950/10">
                {spec.visitSteps.map((st) => (
                  <div key={st.step} className="py-4 flex items-start gap-4">
                    <span className="text-sm font-bold text-emerald-800 font-mono tabular-nums pt-0.5 shrink-0">
                      {st.step}.
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-emerald-950">{st.title}</h3>
                      <p className="mt-1 text-sm text-slate-600 leading-relaxed">{st.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Expected Visits, Recovery & Indicative Fees Table */}
            <div className="rounded-2xl bg-white border border-emerald-950/10 p-5 sm:p-6 space-y-5">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-emerald-950 tracking-tight">
                  Expected Visits &amp; Indicative Fees
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {spec.recoveryNote}
                </p>
              </div>

              {relatedServices.length > 0 && (
                <div className="border-t border-slate-100 divide-y divide-slate-100">
                  {relatedServices.map((srv) => (
                    <div
                      key={srv.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{srv.name}</p>
                        {srv.notes && (
                          <p className="text-xs text-slate-500 mt-0.5">{srv.notes}</p>
                        )}
                      </div>
                      <p className="text-sm sm:text-base font-bold text-emerald-900 tabular-nums shrink-0">
                        {srv.price}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-slate-500 leading-relaxed pt-1 border-t border-slate-100">
                Indicative fees are pulled live from our Banjara Hills clinic file. Final clinical
                plans and exact costs are always confirmed in writing after an in-person dental
                examination (Consultation &amp; Oral Check-up: ₹500).
              </p>
            </div>

            {/* 4. FAQs */}
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-emerald-950 tracking-tight">
                Frequently Asked Questions
              </h2>
              <div className="mt-4 border-t border-emerald-950/10 divide-y divide-emerald-950/10">
                {spec.faqs.map((faq) => (
                  <div key={faq.q} className="py-4">
                    <h3 className="text-sm sm:text-base font-semibold text-emerald-950">
                      {faq.q}
                    </h3>
                    <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Lead Specialist + Direct Enquiry Form */}
          <div className="lg:col-span-5 space-y-6">
            {specialist && docEnrichment && (
              <div className="rounded-2xl bg-white border border-emerald-950/10 overflow-hidden">
                <div className="grid grid-cols-[110px_1fr] sm:grid-cols-[128px_1fr] gap-4 p-5 items-center">
                  <div className="aspect-[3/4] rounded-xl overflow-hidden bg-emerald-950/5">
                    {!docError ? (
                      <img
                        src={docEnrichment.portrait}
                        alt={`${specialist.name}, ${specialist.qualification}`}
                        referrerPolicy="no-referrer"
                        onError={() => setDocError(true)}
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-emerald-900">
                        <Stethoscope className="w-6 h-6 opacity-70" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-emerald-800">Lead Specialist</p>
                    <h3 className="text-base font-bold text-emerald-950 mt-0.5">
                      {specialist.name}
                    </h3>
                    <p className="text-xs font-medium text-slate-700 mt-0.5">
                      {specialist.qualification}
                    </p>
                    <p className="text-[11px] text-emerald-800 mt-1 tabular-nums">
                      {specialist.registrationNumber || docEnrichment.registrationFallback}
                    </p>
                    <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
                      Timings: {specialist.schedule}
                    </p>
                  </div>
                </div>
                <div className="px-5 pb-5 pt-2 border-t border-slate-100 text-xs text-slate-600 leading-relaxed flex items-start gap-2">
                  <ShieldCheck
                    className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{docEnrichment.philosophy}</span>
                </div>
              </div>
            )}

            <div id="treatment-booking-form" className="scroll-mt-20">
              <AppointmentEnquiryForm
                clinicData={clinicData}
                initialTreatment={primaryService?.name || spec.defaultServiceName}
                source="treatment-page"
              />
            </div>

            <div className="rounded-2xl bg-white border border-emerald-950/10 p-5 text-xs text-slate-600 space-y-2">
              <p className="font-semibold text-emerald-950">Need Immediate Assistance?</p>
              <p className="tabular-nums">Front Desk: {clinicData.phone}</p>
              <p className="font-medium text-rose-700 tabular-nums">
                24/7 Emergency Dental Line: {clinicData.emergencyPhone}
              </p>
              <a
                href={`tel:${clinicData.phone.replace(/\s+/g, '')}`}
                className="inline-flex items-center gap-1.5 text-emerald-900 font-semibold hover:underline pt-1"
              >
                <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Call Banjara Hills Reception</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Other Dedicated Treatment Pages */}
      <section className="border-t border-emerald-950/10 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <h2 className="text-lg font-bold text-emerald-950">Explore Other Dental Treatments</h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {otherTreatments.map((item) => (
              <button
                key={item.slug}
                type="button"
                onClick={() => onSelectTreatment(item.slug)}
                className="text-left p-4 rounded-xl border border-emerald-950/10 bg-[#f8faf9] hover:bg-emerald-50/70 hover:border-emerald-900/25 transition-colors flex flex-col justify-between gap-2 cursor-pointer"
              >
                <span className="text-sm font-semibold text-emerald-950">{item.shortTitle}</span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800">
                  <span>Learn more</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
