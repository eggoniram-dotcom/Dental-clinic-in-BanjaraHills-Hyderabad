import type { ClinicData, DoctorInfo, ServicePrice } from '../types.ts';

export const CLINIC_IMAGES = {
  heroSuite: '/src/assets/images/clinic_suite_hero_1795327111989.jpg',
  reception: '/src/assets/images/dental_clinic_reception_1794933076108.jpg',
  diagnosticsBay: '/src/assets/images/dental_sterilisation_tech_1795328275055.jpg',
  docAnanya: '/src/assets/images/lead_dentist_portrait_1795327113425.jpg',
  docVikram: '/src/assets/images/dentist_surgeon_portrait_1795328273298.jpg',
  docMeera: '/src/assets/images/dentist_general_portrait_1795328274140.jpg',
  docKarthik: '/src/assets/images/dentist_ortho_portrait_1795328276496.jpg',
} as const;

export interface DoctorProfileEnrichment {
  portrait: string;
  experienceLabel: string;
  philosophy: string;
  focusAreas: string[];
}

export const DOCTOR_PROFILE_MAP: Record<string, DoctorProfileEnrichment> = {
  'doc-ananya': {
    portrait: CLINIC_IMAGES.docAnanya,
    experienceLabel: 'Conservative Dentistry & Micro-Endodontics',
    philosophy:
      'Preserve natural tooth structure wherever clinically feasible through magnification-guided root canals, clear pre-treatment X-rays, and calm chairside guidance.',
    focusAreas: ['Single & Multi-Sitting Root Canal', 'Re-Treatment Endodontics', 'Post & Core Restoration'],
  },
  'doc-vikram': {
    portrait: CLINIC_IMAGES.docVikram,
    experienceLabel: 'Oral Surgery & Titanium Implantology',
    philosophy:
      'Plan every surgical and implant case digitally before touching a tooth, prioritising atraumatic extraction, sterile Class-B protocols, and comfortable recovery.',
    focusAreas: ['Titanium Dental Implants', 'Impacted Wisdom Tooth Removal', 'Bone Grafting & Minor Oral Surgery'],
  },
  'doc-meera': {
    portrait: CLINIC_IMAGES.docMeera,
    experienceLabel: 'Preventive & Aesthetic General Care',
    philosophy:
      'Build long-term oral health through gentle ultrasonic cleanings, shade-matched tooth-coloured restorations, and transparent preventive check-ups for the whole family.',
    focusAreas: ['Scaling & Polishing', 'Composite Fillings', 'In-Office Teeth Whitening'],
  },
  'doc-karthik': {
    portrait: CLINIC_IMAGES.docKarthik,
    experienceLabel: 'Orthodontics & 3D Clear Aligner Planning',
    philosophy:
      'Combine facial harmony with healthy bite function using 3D intraoral scanning and predictable orthodontic timelines for teens and working adults.',
    focusAreas: ['Clear Aligners', 'Metal & Ceramic Braces', 'Bite Alignment & Retainers'],
  },
};

export function getDoctorEnrichment(doc: DoctorInfo, index: number): DoctorProfileEnrichment {
  const mapped = DOCTOR_PROFILE_MAP[doc.id];
  if (mapped) return mapped;
  const fallbackPortraits = [
    CLINIC_IMAGES.docAnanya,
    CLINIC_IMAGES.docVikram,
    CLINIC_IMAGES.docMeera,
    CLINIC_IMAGES.docKarthik,
  ];
  return {
    portrait: fallbackPortraits[index % fallbackPortraits.length],
    experienceLabel: doc.specialty,
    philosophy:
      'Committed to gentle, evidence-based dental care with published clinic tariffs and clear pre-treatment explanations.',
    focusAreas: [doc.specialty],
  };
}

export interface TreatmentPageSpec {
  slug: string;
  title: string;
  shortTitle: string;
  seoKeyword: string;
  serviceMatchKeywords: string[];
  defaultServiceName: string;
  leadDoctorId: string;
  image: string;
  summary: string;
  whenToConsult: string[];
  visitSteps: { step: string; title: string; detail: string }[];
  faqs: { q: string; a: string }[];
}

export const TREATMENT_PAGES: TreatmentPageSpec[] = [
  {
    slug: 'root-canal',
    title: 'Root Canal Treatment (RCT)',
    shortTitle: 'Root Canal',
    seoKeyword: 'Root canal treatment Hyderabad',
    serviceMatchKeywords: ['root canal', 'rct'],
    defaultServiceName: 'Root Canal Treatment (RCT)',
    leadDoctorId: 'doc-ananya',
    image: CLINIC_IMAGES.heroSuite,
    summary:
      'Magnification-assisted endodontic treatment in Banjara Hills designed to clear deep tooth decay or pulp infection while saving your natural tooth.',
    whenToConsult: [
      'Lingering sensitivity to hot or cold food and beverages',
      'Discomfort while biting or chewing on one side',
      'Deep decay or a chipped tooth confirmed on a digital RVG X-ray',
    ],
    visitSteps: [
      {
        step: '01',
        title: 'Digital RVG X-Ray & Evaluation',
        detail:
          'Your endodontist examines the tooth and takes a low-radiation digital X-ray to assess root anatomy before confirming the exact treatment plan and published tariff.',
      },
      {
        step: '02',
        title: 'Comfort-First Cleaning & Shaping',
        detail:
          'Under local anaesthesia, infected tissue is gently cleaned and disinfected using rotary endodontic instruments under strict Class-B sterilisation.',
      },
      {
        step: '03',
        title: 'Biocompatible Seal & Crown Guidance',
        detail:
          'The canals are sealed to prevent re-infection. When structural reinforcement is advised, a custom Zirconia or Ceramic crown is planned separately.',
      },
    ],
    faqs: [
      {
        q: 'Is root canal treatment painful?',
        a: 'Root canal procedures are performed under local anaesthesia so the tooth stays numb during treatment. A dentist must examine your tooth first to plan the right approach.',
      },
      {
        q: 'How many visits does a root canal take?',
        a: 'Depending on canal anatomy and whether there is active infection, treatment is completed in one or two scheduled appointments after clinical assessment.',
      },
      {
        q: 'Is the dental crown included in the RCT fee?',
        a: 'In our published clinic file, the Root Canal Treatment fee covers the endodontic procedure; Zirconia or Ceramic crowns are billed separately if recommended.',
      },
    ],
  },
  {
    slug: 'dental-implants',
    title: 'Dental Implants',
    shortTitle: 'Dental Implants',
    seoKeyword: 'Dental implants in Banjara Hills',
    serviceMatchKeywords: ['implant'],
    defaultServiceName: 'Titanium Dental Implant (Fixture)',
    leadDoctorId: 'doc-vikram',
    image: CLINIC_IMAGES.diagnosticsBay,
    summary:
      'Biocompatible titanium dental implants placed by our Oral & Maxillofacial Surgeon in Banjara Hills to restore missing teeth with natural stability.',
    whenToConsult: [
      'Single or multiple missing teeth affecting chewing balance',
      'Desire for a fixed alternative to removable partial dentures',
      'Long-term jawbone preservation after a tooth extraction',
    ],
    visitSteps: [
      {
        step: '01',
        title: 'Surgical Consultation & Bone Assessment',
        detail:
          'Our oral surgeon reviews your medical history, oral health, and diagnostic imaging to confirm suitability and provide a written fee schedule.',
      },
      {
        step: '02',
        title: 'Precision Titanium Fixture Placement',
        detail:
          'The medical-grade titanium implant fixture is placed comfortably under local anaesthesia following hospital-grade aseptic protocols.',
      },
      {
        step: '03',
        title: 'Healing & Custom Prosthetic Crown',
        detail:
          'Once osseointegration stabilises the fixture, a custom shade-matched Zirconia or Ceramic crown is fitted for natural appearance and function.',
      },
    ],
    faqs: [
      {
        q: 'What does the published Titanium Dental Implant price include?',
        a: 'Our clinic tariff covers the Titanium Dental Implant fixture. The final prosthetic crown is priced separately once healing is confirmed.',
      },
      {
        q: 'Who performs implant surgery at Dentistae?',
        a: 'Implant placement and minor oral surgeries are handled by our MDS Oral & Maxillofacial Surgeon during scheduled consultation hours.',
      },
      {
        q: 'Can I claim OPD insurance reimbursement?',
        a: 'We provide itemised GST invoices, clinical summaries, and pre/post X-rays so you can submit reimbursement claims to eligible corporate OPD insurers.',
      },
    ],
  },
  {
    slug: 'teeth-whitening',
    title: 'In-Office Teeth Whitening',
    shortTitle: 'Teeth Whitening',
    seoKeyword: 'Teeth whitening Hyderabad',
    serviceMatchKeywords: ['whitening', 'whiten'],
    defaultServiceName: 'In-Office Teeth Whitening',
    leadDoctorId: 'doc-meera',
    image: CLINIC_IMAGES.reception,
    summary:
      'Dentist-supervised 45-minute desensitising whitening in Banjara Hills tailored to lift surface stains safely without compromising enamel health.',
    whenToConsult: [
      'Tea, coffee, or dietary discolouration dulling your natural smile',
      'Preparing for an upcoming wedding, milestone, or professional event',
      'Wanting dentist-monitored shade brightening rather than abrasive home kits',
    ],
    visitSteps: [
      {
        step: '01',
        title: 'Shade Check & Gum Assessment',
        detail:
          'Your dentist checks enamel condition, existing fillings, and gum health first—whitening is only performed on healthy teeth.',
      },
      {
        step: '02',
        title: 'Protective Barrier & Desensitising Session',
        detail:
          'A gentle gingival barrier protects your gums while our 45-minute clinical whitening gel works evenly across visible teeth.',
      },
      {
        step: '03',
        title: 'Post-Care Shade Guidance',
        detail:
          'Receive clear 48-hour dietary guidance to maintain your refreshed shade and minimise temporary sensitivity.',
      },
    ],
    faqs: [
      {
        q: 'How long does an in-office whitening session take?',
        a: 'Our in-office desensitising whitening session takes approximately 45 minutes following a brief oral check.',
      },
      {
        q: 'Should I get scaling and polishing before whitening?',
        a: 'If tartar or heavy surface plaque is present, your dentist may recommend Ultrasonic Scaling & Polishing beforehand for even results.',
      },
      {
        q: 'Will whitening lighten existing crowns or composite fillings?',
        a: 'Whitening agents brighten natural tooth enamel only; existing crowns and fillings retain their original shade, which your dentist reviews during consultation.',
      },
    ],
  },
  {
    slug: 'braces-aligners',
    title: 'Braces & Clear Aligners',
    shortTitle: 'Braces & Aligners',
    seoKeyword: 'Braces and clear aligners Banjara Hills',
    serviceMatchKeywords: ['aligner', 'brace'],
    defaultServiceName: 'Clear Aligners',
    leadDoctorId: 'doc-karthik',
    image: CLINIC_IMAGES.diagnosticsBay,
    summary:
      'Orthodontic care led by our MDS Orthodontist in Banjara Hills, offering both full-arch metal braces and 3D-scanned clear aligners.',
    whenToConsult: [
      'Crowded, spaced, or rotated teeth affecting confidence or cleaning',
      'Overbite, underbite, or crossbite concerns in teens or adults',
      'Seeking discreet, removable clear aligners for everyday work and travel',
    ],
    visitSteps: [
      {
        step: '01',
        title: 'Orthodontic Evaluation & 3D Intraoral Scan',
        detail:
          'Our orthodontist examines jaw alignment and performs a digital 3D scan (for aligner plans) to outline duration and transparent pricing.',
      },
      {
        step: '02',
        title: 'Custom Appliance Fitting',
        detail:
          'Begin with precision-bonded braces or custom-trimmed clear aligner trays tailored to move teeth gently in planned stages.',
      },
      {
        step: '03',
        title: 'Scheduled Progress Reviews & Retention',
        detail:
          'Monthly adjustments for braces or periodic aligner check-ins keep movement on track, followed by retainers to protect your result.',
      },
    ],
    faqs: [
      {
        q: 'Do you offer both traditional braces and clear aligners?',
        a: 'Yes. We provide Full Arch Metal Braces (including monthly orthodontic adjustments) as well as Clear Aligners with a final quote provided after a 3D intraoral scan.',
      },
      {
        q: 'When is the Orthodontist available at Banjara Hills?',
        a: 'Check our live doctor schedule above or in the Front Desk Chat—our MDS Orthodontist sees patients on scheduled afternoon/evening clinic days.',
      },
      {
        q: 'Can adults start orthodontic treatment?',
        a: 'Yes, healthy teeth can be aligned at any adult age after an in-person periodontal and orthodontic assessment.',
      },
    ],
  },
  {
    slug: 'wisdom-tooth-removal',
    title: 'Wisdom Tooth Removal',
    shortTitle: 'Wisdom Tooth Removal',
    seoKeyword: 'Wisdom tooth removal Banjara Hills Hyderabad',
    serviceMatchKeywords: ['wisdom', 'extract'],
    defaultServiceName: 'Surgical Wisdom Tooth Removal',
    leadDoctorId: 'doc-vikram',
    image: CLINIC_IMAGES.heroSuite,
    summary:
      'Gentle simple extractions and surgical removal of impacted wisdom teeth performed by our Oral & Maxillofacial Surgeon in Banjara Hills.',
    whenToConsult: [
      'Recurring jaw tightness, cheek biting, or gum soreness behind the last molar',
      'Impacted or angled wisdom teeth pressing against adjacent molars',
      'Food trapping and recurring cavities around partially erupted third molars',
    ],
    visitSteps: [
      {
        step: '01',
        title: 'Clinical Exam & Radiograph Review',
        detail:
          'Your surgeon checks root position and impaction angle to distinguish between a simple extraction and surgical removal, confirming the exact tariff upfront.',
      },
      {
        step: '02',
        title: 'Atraumatic Procedure Under Local Anaesthesia',
        detail:
          'Performed calmly under local anaesthesia using sterile Class-B autoclaved surgical instruments to minimise post-procedure swelling.',
      },
      {
        step: '03',
        title: 'Clear Recovery Instructions & Follow-Up',
        detail:
          'Written post-extraction care guidance and timely suture review ensure smooth healing.',
      },
    ],
    faqs: [
      {
        q: 'Why does wisdom tooth surgery have a fee range?',
        a: 'Tariffs depend on whether the tooth is fully erupted (simple extraction) or partially/fully impacted in bone, which our surgeon confirms after examination.',
      },
      {
        q: 'What is the cancellation policy for surgical slots?',
        a: 'Please inform the front desk at least 24 hours in advance to reschedule; missed or late-cancelled surgical slots incur a ₹300 fee per clinic policy.',
      },
      {
        q: 'What if I have severe swelling or uncontrolled bleeding?',
        a: 'For dental emergencies, please call our 24/7 Emergency Dental Line immediately so our on-call team can assist you.',
      },
    ],
  },
  {
    slug: 'cosmetic-dentistry',
    title: 'Cosmetic Dentistry & Crowns',
    shortTitle: 'Cosmetic Dentistry',
    seoKeyword: 'Cosmetic dentist Hyderabad',
    serviceMatchKeywords: ['crown', 'filling', 'scaling'],
    defaultServiceName: 'Zirconia / Ceramic Dental Crown',
    leadDoctorId: 'doc-meera',
    image: CLINIC_IMAGES.reception,
    summary:
      'Natural-looking Zirconia and ceramic crowns, tooth-coloured composite fillings, and ultrasonic scaling & polishing crafted for balanced smiles.',
    whenToConsult: [
      'Chipped, worn, or discoloured front or back teeth needing shade-matched repair',
      'Replacing dark metallic fillings with tooth-coloured composite restorations',
      'Protecting weakened teeth with digitally scanned Zirconia or ceramic crowns',
    ],
    visitSteps: [
      {
        step: '01',
        title: 'Smile Assessment & Digital Shade Matching',
        detail:
          'Your dentist evaluates tooth structure, bite, and natural enamel shade to recommend conservative restorative options.',
      },
      {
        step: '02',
        title: 'Precision Restoration or Digital Crown Scan',
        detail:
          'Composite fillings are layered and polished in a single visit; Zirconia and ceramic crowns use digital scanning for accurate margins.',
      },
      {
        step: '03',
        title: 'Final Fit, Bite Check & Polish',
        detail:
          'Every restoration is checked for comfortable bite contact and natural translucency before completion.',
      },
    ],
    faqs: [
      {
        q: 'Which cosmetic and restorative services are listed in your clinic file?',
        a: 'Our published tariffs cover Tooth-Coloured Composite Fillings, Zirconia / Ceramic Dental Crowns (including digital scan and cementation), In-Office Teeth Whitening, and Ultrasonic Scaling & Polishing.',
      },
      {
        q: 'Are composite fillings matched to my natural tooth colour?',
        a: 'Yes, shade-matched composite resin is sculpted to blend seamlessly with surrounding enamel.',
      },
      {
        q: 'Do senior citizens get any complimentary diagnostic benefit?',
        a: 'Per clinic policy, senior citizens aged 65+ receive a complimentary Digital X-Ray (RVG) with a paid consultation.',
      },
    ],
  },
];

export function resolveTreatmentService(
  spec: TreatmentPageSpec,
  clinicData: ClinicData,
): ServicePrice | undefined {
  return clinicData.services.find((srv) => {
    const lower = srv.name.toLowerCase();
    return spec.serviceMatchKeywords.some((kw) => lower.includes(kw));
  });
}

export function resolveTreatmentServicesAll(
  spec: TreatmentPageSpec,
  clinicData: ClinicData,
): ServicePrice[] {
  return clinicData.services.filter((srv) => {
    const lower = srv.name.toLowerCase();
    return spec.serviceMatchKeywords.some((kw) => lower.includes(kw));
  });
}

export function buildWhatsAppLink(clinicData: ClinicData, customMessage?: string): string {
  const digits = (clinicData.emergencyPhone || clinicData.phone || '+919849011223').replace(
    /\D/g,
    '',
  );
  const normalized = digits.startsWith('91') ? digits : `91${digits}`;
  const text =
    customMessage ||
    `Hello ${clinicData.clinicName}, I would like to enquire about an appointment at your Banjara Hills clinic.`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

export function buildGoogleMapsDirectionsLink(clinicData: ClinicData): string {
  const query = `${clinicData.clinicName}, ${clinicData.address}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
