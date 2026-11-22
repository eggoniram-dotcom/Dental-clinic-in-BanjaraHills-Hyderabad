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
  registrationFallback: string;
  philosophy: string;
  focusAreas: string[];
  defaultTreatmentName: string;
}

export const DOCTOR_PROFILE_MAP: Record<string, DoctorProfileEnrichment> = {
  'doc-ananya': {
    portrait: CLINIC_IMAGES.docAnanya,
    experienceLabel: 'Conservative Dentistry & Micro-Endodontics',
    registrationFallback: 'TSDC Reg. No. A-14829 · Telangana State Dental Council',
    philosophy:
      'Preserve natural tooth structure wherever clinically feasible through magnification-guided root canals, clear pre-treatment X-rays, and calm chairside guidance.',
    focusAreas: [
      'Single & Multi-Sitting Root Canal (RCT)',
      'Micro-Endodontic Re-Treatment',
      'Post & Core Restorations',
      'Digital RVG Diagnostics',
    ],
    defaultTreatmentName: 'Root Canal Treatment (RCT)',
  },
  'doc-vikram': {
    portrait: CLINIC_IMAGES.docVikram,
    experienceLabel: 'Oral Surgery & Titanium Implantology',
    registrationFallback: 'TSDC Reg. No. A-13264 · Telangana State Dental Council',
    philosophy:
      'Plan every surgical and implant case digitally before touching a tooth, prioritising atraumatic extraction, sterile Class-B protocols, and comfortable recovery.',
    focusAreas: [
      'Titanium Dental Implants',
      'Surgical Wisdom Tooth Removal',
      'Atraumatic Tooth Extractions',
      'Minor Oral & Jaw Surgery',
    ],
    defaultTreatmentName: 'Titanium Dental Implant (Fixture)',
  },
  'doc-meera': {
    portrait: CLINIC_IMAGES.docMeera,
    experienceLabel: 'Preventive & Aesthetic General Care',
    registrationFallback: 'TSDC Reg. No. A-18940 · Telangana State Dental Council',
    philosophy:
      'Build long-term oral health through gentle ultrasonic cleanings, shade-matched tooth-coloured restorations, and transparent preventive check-ups for the whole family.',
    focusAreas: [
      'Ultrasonic Dental Cleaning & Polishing',
      'Tooth-Coloured Composite Fillings',
      'In-Office Teeth Whitening',
      'Preventive Family Oral Check-Ups',
    ],
    defaultTreatmentName: 'Scaling & Polishing (Teeth Cleaning)',
  },
  'doc-karthik': {
    portrait: CLINIC_IMAGES.docKarthik,
    experienceLabel: 'Orthodontics & 3D Clear Aligner Planning',
    registrationFallback: 'TSDC Reg. No. A-16105 · Telangana State Dental Council',
    philosophy:
      'Combine facial harmony with healthy bite function using 3D intraoral scanning and predictable orthodontic timelines for teens and working adults.',
    focusAreas: [
      '3D Clear Aligners',
      'Metal & Ceramic Braces',
      'Bite Alignment & Jaw Orthopaedics',
      'Retention & Post-Braces Care',
    ],
    defaultTreatmentName: 'Clear Aligners',
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
    registrationFallback: 'Registered Dental Practitioner · TSDC / DCI',
    philosophy:
      'Committed to gentle, evidence-based dental care with published clinic tariffs and clear pre-treatment explanations.',
    focusAreas: doc.expertise && doc.expertise.length > 0 ? doc.expertise : [doc.specialty],
    defaultTreatmentName: 'Consultation & Oral Check-up',
  };
}

export interface DoctorSlotDay {
  isoDate: string;
  dayLabel: string;
  shortDayName: string;
  times: string[];
}

/**
 * Computes the next 3 upcoming consultation days & times strictly matched to
 * the dentist's published clinic schedule (respecting 1:30 PM – 2:30 PM lunch break).
 */
export function getNearestDoctorSlots(doc: DoctorInfo): DoctorSlotDay[] {
  const sched = (doc.schedule || '').toLowerCase();

  // Determine active weekdays (0=Sun, 1=Mon, ..., 6=Sat)
  const activeDays = new Set<number>();
  if (/mon\s*[–-]\s*sat/.test(sched)) {
    [1, 2, 3, 4, 5, 6].forEach((d) => activeDays.add(d));
  } else if (/mon\s*[–-]\s*fri/.test(sched)) {
    [1, 2, 3, 4, 5].forEach((d) => activeDays.add(d));
  } else {
    if (/\bmon\b/.test(sched)) activeDays.add(1);
    if (/\btue\b/.test(sched)) activeDays.add(2);
    if (/\bwed\b/.test(sched)) activeDays.add(3);
    if (/\bthu\b/.test(sched)) activeDays.add(4);
    if (/\bfri\b/.test(sched)) activeDays.add(5);
    if (/\bsat\b/.test(sched)) activeDays.add(6);
  }
  if (/\bsun\b/.test(sched)) activeDays.add(0);
  if (activeDays.size === 0) {
    [1, 2, 3, 4, 5, 6].forEach((d) => activeDays.add(d));
  }

  // Pick realistic time slots aligned to the dentist's schedule
  const weekdayTimes = (() => {
    if (sched.includes('2:00 pm') && sched.includes('8:00 pm')) {
      return ['2:30 PM', '4:00 PM', '5:30 PM', '7:00 PM'];
    }
    if (sched.includes('11:00 am') && sched.includes('7:00 pm')) {
      return ['11:00 AM', '12:30 PM', '3:00 PM', '5:00 PM', '6:15 PM'];
    }
    if (sched.includes('9:00 am') && sched.includes('5:00 pm')) {
      return ['9:30 AM', '11:00 AM', '12:30 PM', '3:00 PM', '4:15 PM'];
    }
    return ['10:00 AM', '11:30 AM', '3:00 PM', '4:30 PM', '5:15 PM'];
  })();
  const sundayTimes = ['10:00 AM', '11:00 AM', '12:15 PM', '1:00 PM'];

  const results: DoctorSlotDay[] = [];
  const base = new Date();
  for (let offset = 1; offset <= 10 && results.length < 3; offset += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + offset);
    const dow = d.getDay();
    if (!activeDays.has(dow)) continue;

    const shortDayName = d.toLocaleDateString('en-IN', { weekday: 'long' });
    const monthDay = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    const dayLabel =
      offset === 1 ? `Tomorrow, ${monthDay}` : `${shortDayName.slice(0, 3)}, ${monthDay}`;

    results.push({
      isoDate: d.toISOString().slice(0, 10),
      dayLabel,
      shortDayName,
      times: dow === 0 ? sundayTimes : weekdayTimes,
    });
  }

  return results;
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
  imagePosition?: string;
  featuredOnHome: boolean;
  expectedVisits: string;
  sessionDuration: string;
  recoveryNote: string;
  summary: string;
  detailedExplanation: string;
  whenToConsult: string[];
  visitSteps: { step: string; title: string; detail: string }[];
  faqs: { q: string; a: string }[];
}

export const TREATMENT_PAGES: TreatmentPageSpec[] = [
  {
    slug: 'dental-implants',
    title: 'Dental Implants',
    shortTitle: 'Dental Implants',
    seoKeyword: 'Dental implants in Banjara Hills',
    serviceMatchKeywords: ['implant'],
    defaultServiceName: 'Titanium Dental Implant (Fixture)',
    leadDoctorId: 'doc-vikram',
    image: CLINIC_IMAGES.diagnosticsBay,
    featuredOnHome: true,
    expectedVisits: '2 clinical phases (3–4 visits total)',
    sessionDuration: '45–60 mins for fixture placement',
    recoveryNote: 'Osseointegration healing typically spans 8–12 weeks before final crown fitting.',
    summary:
      'Biocompatible titanium dental implants placed by our Oral & Maxillofacial Surgeon in Banjara Hills to restore missing teeth with natural stability.',
    detailedExplanation:
      'A dental implant replaces the natural root of a missing tooth using a medical-grade titanium fixture placed comfortably into the jawbone. Once the bone integrates around the fixture, a custom shade-matched Zirconia or ceramic crown is fitted on top—restoring chewing efficiency without grinding down neighbouring healthy teeth.',
    whenToConsult: [
      'Single or multiple missing teeth affecting chewing balance',
      'Desire for a fixed, long-term alternative to removable partial dentures',
      'Preserving jawbone volume and facial contour after a tooth extraction',
    ],
    visitSteps: [
      {
        step: '01',
        title: 'Surgical Consultation & Diagnostic Imaging',
        detail:
          'Our oral surgeon reviews your medical history, gum health, and diagnostic scans to verify bone density and share an itemised treatment plan with published fees.',
      },
      {
        step: '02',
        title: 'Precision Titanium Fixture Placement',
        detail:
          'Under local anaesthesia and hospital-grade Class-B sterilisation, the titanium implant fixture is placed gently into the planned site.',
      },
      {
        step: '03',
        title: 'Healing & Osseointegration Review',
        detail:
          'A short follow-up checks soft-tissue comfort while the implant integrates naturally with the surrounding jawbone.',
      },
      {
        step: '04',
        title: 'Digital Scan & Custom Prosthetic Crown',
        detail:
          'Once stable, a digital intraoral scan is taken to fabricate and fit your custom ceramic or Zirconia crown (billed separately from the fixture).',
      },
    ],
    faqs: [
      {
        q: 'What does the published Titanium Dental Implant price include?',
        a: 'Our clinic tariff covers the Titanium Dental Implant fixture. The final prosthetic Zirconia or Ceramic crown is priced separately once healing is confirmed.',
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
    slug: 'root-canal',
    title: 'Root Canal Treatment',
    shortTitle: 'Root Canal Treatment',
    seoKeyword: 'Root canal treatment Hyderabad',
    serviceMatchKeywords: ['root canal', 'rct'],
    defaultServiceName: 'Root Canal Treatment (RCT)',
    leadDoctorId: 'doc-ananya',
    image: CLINIC_IMAGES.heroSuite,
    featuredOnHome: true,
    expectedVisits: '1–2 visits (case-dependent)',
    sessionDuration: '45–60 mins per sitting',
    recoveryNote: 'Most patients resume normal work the same day; avoid hard biting on the tooth until the final restoration is placed.',
    summary:
      'Magnification-assisted endodontic care in Banjara Hills designed to clear deep decay or pulp infection while saving your natural tooth.',
    detailedExplanation:
      'When deep decay, a crack, or trauma reaches the inner pulp nerve of a tooth, root canal treatment gently removes the infected tissue, disinfects the root canals, and seals the tooth from within. Saving your natural tooth prevents shifting of adjacent teeth and avoids the need for extraction.',
    whenToConsult: [
      'Lingering sensitivity to hot or cold food and beverages',
      'Discomfort while biting or chewing on one side',
      'Deep decay or a fractured tooth confirmed on a digital RVG X-ray',
    ],
    visitSteps: [
      {
        step: '01',
        title: 'Digital RVG X-Ray & Endodontic Assessment',
        detail:
          'Your endodontist examines the tooth and takes a low-radiation digital X-ray to evaluate root canal anatomy and confirm the exact published fee before starting.',
      },
      {
        step: '02',
        title: 'Local Anaesthesia & Rotary Canal Cleaning',
        detail:
          'Once thoroughly numb, infected pulp tissue is gently cleared and irrigated using precision rotary instruments under Class-B sterilisation.',
      },
      {
        step: '03',
        title: 'Biocompatible Canal Sealing',
        detail:
          'Cleaned canals are sealed hermetically with biocompatible filling material to prevent re-infection.',
      },
      {
        step: '04',
        title: 'Protective Restoration or Crown Review',
        detail:
          'A tooth-coloured core build-up is placed, and if structural reinforcement is advised (especially on molars), a Zirconia or ceramic crown is planned separately.',
      },
    ],
    faqs: [
      {
        q: 'Is root canal treatment painful?',
        a: 'Root canal procedures are performed under local anaesthesia so the tooth stays numb during treatment. A dentist must examine your tooth first to confirm the right clinical plan.',
      },
      {
        q: 'How many visits does a root canal take?',
        a: 'Depending on canal anatomy and whether active infection is present, treatment is completed in 1 or 2 scheduled sittings after clinical assessment.',
      },
      {
        q: 'Is the dental crown included in the RCT fee?',
        a: 'In our published clinic file, the Root Canal Treatment fee covers the endodontic procedure (Anterior ₹4,500; Molar/re-treatment up to ₹6,500); crowns are billed separately if recommended.',
      },
    ],
  },
  {
    slug: 'teeth-whitening',
    title: 'Teeth Whitening',
    shortTitle: 'Teeth Whitening',
    seoKeyword: 'Teeth whitening Hyderabad',
    serviceMatchKeywords: ['whitening', 'whiten'],
    defaultServiceName: 'In-Office Teeth Whitening',
    leadDoctorId: 'doc-meera',
    image: CLINIC_IMAGES.reception,
    featuredOnHome: true,
    expectedVisits: '1 clinic visit',
    sessionDuration: '45 mins desensitising session',
    recoveryNote: 'Follow a 48-hour low-stain diet (avoiding dark tea, coffee, or turmeric) to lock in shade brightness.',
    summary:
      'Dentist-supervised 45-minute desensitising whitening in Banjara Hills tailored to lift stubborn stains safely without harming enamel.',
    detailedExplanation:
      'In-office professional teeth whitening uses clinically controlled brightening gels paired with a protective gum barrier and desensitising agents. Unlike abrasive over-the-counter strips or powders, dentist-monitored whitening brightens natural enamel evenly in a single controlled visit.',
    whenToConsult: [
      'Tea, coffee, or everyday dietary staining dulling your natural enamel',
      'Preparing for a wedding, milestone celebration, or professional appearance',
      'Seeking dentist-monitored brightening with gum protection and sensitivity care',
    ],
    visitSteps: [
      {
        step: '01',
        title: 'Enamel & Shade Evaluation',
        detail:
          'Your dentist checks enamel health, existing fillings, and gums first—ensuring whitening is only performed on healthy teeth.',
      },
      {
        step: '02',
        title: 'Protective Gingival Barrier',
        detail:
          'Soft gum tissues and lips are carefully isolated so the clinical brightening gel contacts only your tooth surfaces.',
      },
      {
        step: '03',
        title: '45-Minute Desensitising Whitening Cycles',
        detail:
          'Controlled whitening gel cycles gently break down deep extrinsic stains while minimising post-visit sensitivity.',
      },
      {
        step: '04',
        title: 'Shade Comparison & Aftercare Guidance',
        detail:
          'Review your brightened shade immediately and receive clear 48-hour dietary guidance to maintain long-lasting results.',
      },
    ],
    faqs: [
      {
        q: 'How long does an in-office whitening session take?',
        a: 'Our in-office desensitising whitening session takes approximately 45 minutes following a brief oral check.',
      },
      {
        q: 'Should I schedule dental cleaning before whitening?',
        a: 'If plaque or tartar deposits are present, your dentist may recommend Ultrasonic Scaling & Polishing beforehand so the whitening gel reaches enamel evenly.',
      },
      {
        q: 'Will whitening change the colour of existing crowns or fillings?',
        a: 'Whitening agents brighten natural tooth enamel only; existing crowns and fillings retain their original shade, which your dentist reviews during consultation.',
      },
    ],
  },
  {
    slug: 'braces-aligners',
    title: 'Braces and Aligners',
    shortTitle: 'Braces & Aligners',
    seoKeyword: 'Braces and clear aligners Banjara Hills',
    serviceMatchKeywords: ['aligner', 'brace'],
    defaultServiceName: 'Clear Aligners',
    leadDoctorId: 'doc-karthik',
    image: CLINIC_IMAGES.docKarthik,
    imagePosition: 'object-top',
    featuredOnHome: true,
    expectedVisits: 'Initial scan + monthly / 6-week reviews',
    sessionDuration: '30–45 mins per review visit',
    recoveryNote: 'Typical orthodontic journeys span 8–18 months depending on crowding or bite complexity, followed by retainers.',
    summary:
      'Orthodontic care led by our MDS Orthodontist in Banjara Hills, offering both full-arch metal braces and 3D-scanned clear aligners.',
    detailedExplanation:
      'Orthodontic treatment gently aligns crowded, spaced, or rotated teeth and balances your bite for easier cleaning and long-term jaw comfort. At Dentistae, our MDS Orthodontist offers both classic Full-Arch Metal Braces and discreet, removable Clear Aligners planned with a 3D intraoral scan.',
    whenToConsult: [
      'Crowded, overlapping, or spaced teeth affecting confidence or flossing',
      'Overbite, underbite, or crossbite alignment concerns in teens or adults',
      'Wanting discreet, removable clear aligner trays tailored to busy schedules',
    ],
    visitSteps: [
      {
        step: '01',
        title: 'Orthodontic Evaluation & 3D Intraoral Scan',
        detail:
          'Our orthodontist examines bite mechanics and captures a digital 3D scan (for aligner plans) to outline expected duration and transparent pricing.',
      },
      {
        step: '02',
        title: 'Custom Appliance Fitting',
        detail:
          'Begin with precision-bonded full-arch braces or your first sets of custom-trimmed clear aligner trays.',
      },
      {
        step: '03',
        title: 'Scheduled Progress Reviews',
        detail:
          'Monthly adjustments for metal braces (included in the clinic tariff) or periodic 6-week aligner progress check-ins keep movement predictable.',
      },
      {
        step: '04',
        title: 'Retention Phase',
        detail:
          'Custom retainers help keep your newly aligned smile stable once active orthodontic movement finishes.',
      },
    ],
    faqs: [
      {
        q: 'What are the indicative fees for braces vs clear aligners?',
        a: 'Per our clinic file, Full Arch Metal Braces are ₹32,000 (including monthly orthodontic adjustments), and Clear Aligners start at ₹75,000 with a final quote confirmed after a 3D intraoral scan.',
      },
      {
        q: 'When is the Orthodontist available in Banjara Hills?',
        a: 'Dr. Karthikeya Sharma (MDS Orthodontics) consults on scheduled afternoon and evening clinic days—check his live schedule on the Doctors section or ask our Front Desk Chat.',
      },
      {
        q: 'Can working adults start braces or aligners?',
        a: 'Yes. Healthy teeth and gums can be aligned at any adult age after an in-person orthodontic evaluation.',
      },
    ],
  },
  {
    slug: 'cosmetic-dentistry',
    title: 'Cosmetic Dentistry',
    shortTitle: 'Cosmetic Dentistry',
    seoKeyword: 'Cosmetic dentist Hyderabad',
    serviceMatchKeywords: ['crown', 'filling'],
    defaultServiceName: 'Zirconia / Ceramic Dental Crown',
    leadDoctorId: 'doc-meera',
    image: CLINIC_IMAGES.docAnanya,
    imagePosition: 'object-top',
    featuredOnHome: true,
    expectedVisits: '1 visit (fillings) · 2 visits (crowns)',
    sessionDuration: '30–60 mins per appointment',
    recoveryNote: 'Minimal to zero downtime; enjoy normal speech and gentle chewing immediately after cementation or polishing.',
    summary:
      'Natural-looking Zirconia and ceramic crowns and shade-matched composite fillings crafted for balanced, conservative smile aesthetics.',
    detailedExplanation:
      'Cosmetic and restorative dentistry focuses on repairing chipped, worn, discoloured, or weakened teeth so they blend invisibly with your natural enamel. We favour conservative tooth-coloured composite bonding and digitally scanned metal-free Zirconia or ceramic crowns.',
    whenToConsult: [
      'Chipped, worn, or uneven front teeth needing shade-matched composite repair',
      'Replacing old dark metallic fillings with tooth-coloured composite restorations',
      'Strengthening fractured or root-canal-treated teeth with Zirconia or ceramic crowns',
    ],
    visitSteps: [
      {
        step: '01',
        title: 'Smile & Bite Consultation',
        detail:
          'Your dentist examines enamel thickness, bite contacts, and shade preferences before presenting conservative options and published clinic fees.',
      },
      {
        step: '02',
        title: 'Conservative Preparation & Digital Scan',
        detail:
          'Composite restorations are sculpted directly in one sitting; Zirconia or ceramic crowns use a clean digital scan for exact fit and margins.',
      },
      {
        step: '03',
        title: 'Shade Verification & Cementation',
        detail:
          'Every crown or filling is checked under natural clinic light for lifelike translucency and seamless colour match.',
      },
      {
        step: '04',
        title: 'Bite Refinement & Polish',
        detail:
          'Final bite balancing and high-gloss polishing protect both the restoration and opposing teeth.',
      },
    ],
    faqs: [
      {
        q: 'What cosmetic treatments are listed in the clinic tariff file?',
        a: 'Our published file covers Tooth-Coloured Composite Fillings (₹1,500 – ₹2,500), Zirconia / Ceramic Dental Crowns (₹8,000 – ₹14,000 including digital scan and cementation), and In-Office Teeth Whitening (₹9,000).',
      },
      {
        q: 'Are composite fillings matched to my natural tooth shade?',
        a: 'Yes, multi-shade composite resin is layered and polished to blend seamlessly with surrounding enamel.',
      },
      {
        q: 'Do senior citizens receive any diagnostic benefit?',
        a: 'Per clinic policy, senior citizens aged 65+ receive a complimentary Digital X-Ray (RVG) with a paid consultation.',
      },
    ],
  },
  {
    slug: 'dental-cleaning',
    title: 'Dental Cleaning',
    shortTitle: 'Dental Cleaning',
    seoKeyword: 'Dental cleaning scaling polishing Banjara Hills',
    serviceMatchKeywords: ['scaling', 'cleaning', 'polish'],
    defaultServiceName: 'Scaling & Polishing (Teeth Cleaning)',
    leadDoctorId: 'doc-meera',
    image: CLINIC_IMAGES.docMeera,
    imagePosition: 'object-top',
    featuredOnHome: true,
    expectedVisits: '1 single visit (recommended every 6 months)',
    sessionDuration: '30–45 mins',
    recoveryNote: 'Zero downtime—you can return to work immediately; mild cold sensitivity settles within 24 hours.',
    summary:
      'Gentle ultrasonic scaling and stain-removing polishing in Banjara Hills to clear plaque, hardened tartar, and protect long-term gum health.',
    detailedExplanation:
      'Even thorough daily brushing leaves hardened mineralised tartar (calculus) along the gumline and behind lower front teeth. Professional ultrasonic dental cleaning vibrates away plaque and tartar deposits without scraping healthy enamel, followed by smooth polishing to lift tea and coffee surface stains.',
    whenToConsult: [
      'Routine 6-month preventive dental check-up and hygiene maintenance',
      'Visible yellow or brown tartar buildup near the gumline or behind lower teeth',
      'Surface staining from tea, coffee, or noticing gums bleed slightly while brushing',
    ],
    visitSteps: [
      {
        step: '01',
        title: 'Oral & Gum Health Check',
        detail:
          'Your dentist evaluates gum pockets, plaque accumulation, and early signs of decay before starting cleaning.',
      },
      {
        step: '02',
        title: 'Ultrasonic Scaling',
        detail:
          'A gentle water-cooled ultrasonic scaler dislodges plaque and hardened calculus comfortably along and beneath the gumline.',
      },
      {
        step: '03',
        title: 'Surface Polishing & Stain Removal',
        detail:
          'Fine polishing paste buffs away everyday surface stains and smooths enamel so new plaque adheres less easily.',
      },
      {
        step: '04',
        title: 'Personalised Home Hygiene Guidance',
        detail:
          'Receive practical brushing, interdental flossing, and 6-month recall recommendations tailored to your gums.',
      },
    ],
    faqs: [
      {
        q: 'Does dental scaling loosen teeth or damage enamel?',
        a: 'No. Ultrasonic scaling removes hardened tartar and plaque only—it does not grind enamel or loosen healthy teeth; in fact, removing tartar helps keep gums and bone healthy.',
      },
      {
        q: 'How often should I get professional dental cleaning?',
        a: 'Most adults benefit from routine Scaling & Polishing every 6 months, though your dentist will advise the best interval based on your gum health.',
      },
      {
        q: 'What is the indicative fee for dental cleaning?',
        a: 'Our published tariff for Scaling & Polishing (Teeth Cleaning) is ₹1,200 (ultrasonic scaling and stain removal). Consultation & Oral Check-up is ₹500.',
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
    image: CLINIC_IMAGES.docVikram,
    imagePosition: 'object-top',
    featuredOnHome: false,
    expectedVisits: '1 surgical visit + 1 suture check (if needed)',
    sessionDuration: '30–60 mins depending on impaction',
    recoveryNote: 'Soft-diet guidance and gentle recovery over 3–5 days; suture review after 7 days if stitches are placed.',
    summary:
      'Gentle simple extractions and surgical removal of impacted wisdom teeth performed by our Oral & Maxillofacial Surgeon in Banjara Hills.',
    detailedExplanation:
      'Third molars (wisdom teeth) often lack sufficient jaw space to erupt straight, causing impaction, food trapping, or pressure against neighbouring molars. Our Oral & Maxillofacial Surgeon assesses root alignment digitally to perform either a simple extraction or atraumatic surgical removal under local anaesthesia.',
    whenToConsult: [
      'Recurring jaw tightness, cheek biting, or gum soreness behind the last molar',
      'Impacted or angled wisdom teeth pressing against adjacent molars',
      'Food trapping and recurring decay around partially erupted third molars',
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
        a: 'Tariffs depend on whether the tooth is fully erupted (Simple Tooth Extraction ₹1,500) or partially/fully impacted in bone (Surgical Wisdom Tooth Removal ₹4,500 – ₹7,500), confirmed after examination.',
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
];

export const FEATURED_TREATMENT_PAGES = TREATMENT_PAGES.filter((t) => t.featuredOnHome);

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

export const DEFAULT_WHATSAPP_MESSAGE =
  'Hello, I found your dental clinic website. I would like to enquire about an appointment.';

export function buildWhatsAppLink(clinicData: ClinicData, customMessage?: string): string {
  const digits = (clinicData.emergencyPhone || clinicData.phone || '+919849011223').replace(
    /\D/g,
    '',
  );
  const normalized = digits.startsWith('91') ? digits : `91${digits}`;
  const text = customMessage?.trim() || DEFAULT_WHATSAPP_MESSAGE;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

export function buildGoogleMapsDirectionsLink(clinicData: ClinicData): string {
  const query = `${clinicData.clinicName}, ${clinicData.address}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
