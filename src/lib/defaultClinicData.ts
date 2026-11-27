import type { ClinicData } from '../types.ts';

export const DEFAULT_CLINIC_DATA: ClinicData = {
  clinicName: 'Dentistae Dental Care',
  tagline: 'Banjara Hills Specialty Dental Clinic',
  address: 'Plot 42, Road No. 12, Banjara Hills, Hyderabad, Telangana 500034',
  landmark: 'Next to Green Leaf (Opposite Virinchi Hospital Lane, 400m from KBR National Park)',
  phone: '+91 40 2335 8899',
  emergencyPhone: '+91 98490 11223',
  email: 'frontdesk@dentistaehyd.in',
  timings: {
    weekdays: 'Monday to Saturday: 9:00 AM – 8:00 PM',
    sunday: 'Sunday: 10:00 AM – 2:00 PM (by prior appointment)',
    lunchBreak: 'Lunch Break (Mon–Sat): 1:30 PM – 2:30 PM',
  },
  doctors: [
    {
      id: 'doc-ananya',
      name: 'Dr. Ananya Reddy',
      qualification: 'BDS, MDS (Conservative Dentistry & Endodontics)',
      registrationNumber: 'TSDC Reg. No. A-14829 · Telangana State Dental Council',
      specialty: 'Root Canal Treatment & Micro-Endodontics',
      expertise: [
        'Single & Multi-Sitting Root Canal (RCT)',
        'Micro-Endodontic Re-Treatment',
        'Post & Core Restorations',
        'Digital RVG Diagnostics',
      ],
      schedule: 'Monday to Saturday (Mon–Sat), 10:00 AM – 6:00 PM',
    },
    {
      id: 'doc-vikram',
      name: 'Dr. Vikramaditya Rao',
      qualification: 'BDS, MDS (Oral & Maxillofacial Surgery)',
      registrationNumber: 'TSDC Reg. No. A-13264 · Telangana State Dental Council',
      specialty: 'Dental Implants & Wisdom Tooth Surgery',
      expertise: [
        'Titanium Dental Implants',
        'Surgical Wisdom Tooth Removal',
        'Atraumatic Tooth Extractions',
        'Minor Oral & Jaw Surgery',
      ],
      schedule: 'Monday, Wednesday, Friday & Saturday, 11:00 AM – 7:00 PM',
    },
    {
      id: 'doc-meera',
      name: 'Dr. Meera Deshmukh',
      qualification: 'BDS (General & Preventive Dentistry)',
      registrationNumber: 'TSDC Reg. No. A-18940 · Telangana State Dental Council',
      specialty: 'General Dentistry, Scaling & Cosmetic Fillings',
      expertise: [
        'Ultrasonic Dental Cleaning & Polishing',
        'Tooth-Coloured Composite Fillings',
        'In-Office Teeth Whitening',
        'Preventive Family & Pediatric Check-Ups',
      ],
      schedule: 'Monday to Saturday, 9:00 AM – 5:00 PM; Sunday, 10:00 AM – 2:00 PM',
    },
    {
      id: 'doc-karthik',
      name: 'Dr. Karthikeya Sharma',
      qualification: 'BDS, MDS (Orthodontics & Dentofacial Orthopaedics)',
      registrationNumber: 'TSDC Reg. No. A-16105 · Telangana State Dental Council',
      specialty: 'Braces, Orthodontics & Clear Aligners',
      expertise: [
        'Metal & Ceramic Braces',
        '3D Clear Aligners',
        'Bite Alignment & Jaw Orthopaedics',
        'Retention & Post-Braces Care',
      ],
      schedule: 'Tuesday, Thursday & Saturday, 2:00 PM – 8:00 PM',
    },
  ],
  services: [
    {
      id: 'srv-consult',
      name: 'Consultation & Oral Check-up',
      price: '₹500',
      notes: 'Includes initial oral examination and treatment plan.',
    },
    {
      id: 'srv-xray',
      name: 'Digital Dental X-Ray (RVG)',
      price: '₹300',
      notes:
        'Single tooth digital radiograph. Valid for 3 months (recent X-rays taken within the last 3 months are accepted; repeat check X-ray within 3 months covered as advised).',
    },
    {
      id: 'srv-scaling',
      name: 'Scaling & Polishing (Teeth Cleaning)',
      price: '₹1,200',
      notes: 'Takes about 45 minutes. Ultrasonic scaling, plaque and stain removal, and polishing.',
    },
    {
      id: 'srv-filling',
      name: 'Tooth-Coloured Composite Filling',
      price: '₹1,500 – ₹2,500',
      notes: 'Price varies by cavity depth and surfaces.',
    },
    {
      id: 'srv-rct',
      name: 'Root Canal Treatment (RCT)',
      price: '₹4,500 – ₹6,500',
      notes:
        'Anterior ₹4,500; Molar/re-treatment up to ₹6,500. Dental Crown (Zirconia / Ceramic) billed separately: ₹8,000 – ₹14,000.',
    },
    {
      id: 'srv-crown',
      name: 'Zirconia / Ceramic Dental Crown',
      price: '₹8,000 – ₹14,000',
      notes: 'Includes digital scan and cementation.',
    },
    {
      id: 'srv-extract',
      name: 'Simple Tooth Extraction',
      price: '₹1,500',
      notes: 'Local anaesthesia included.',
    },
    {
      id: 'srv-wisdom',
      name: 'Surgical Wisdom Tooth Removal',
      price: '₹4,500 – ₹7,500',
      notes: 'Depends on impaction complexity.',
    },
    {
      id: 'srv-implant',
      name: 'Titanium Dental Implant (Fixture)',
      price: '₹28,000',
      notes: 'Implant fixture only; prosthetic crown priced separately (₹8,000 – ₹14,000).',
    },
    {
      id: 'srv-whitening',
      name: 'In-Office Teeth Whitening',
      price: '₹9,000',
      notes: '45-minute desensitising whitening session.',
    },
    {
      id: 'srv-braces',
      name: 'Metal Braces (Full Arch)',
      price: '₹32,000',
      notes:
        'Handled by Dr. Karthikeya Sharma (Tuesday, Thursday & Saturday, 2:00 PM – 8:00 PM). Includes monthly orthodontic adjustments.',
    },
    {
      id: 'srv-ceramic-braces',
      name: 'Ceramic Braces (Full Arch)',
      price: '₹45,000',
      notes:
        'Tooth-coloured ceramic brackets by Dr. Karthikeya Sharma (Tuesday, Thursday & Saturday, 2:00 PM – 8:00 PM). Includes monthly adjustments.',
    },
    {
      id: 'srv-aligners',
      name: 'Clear Aligners',
      price: 'Starting ₹75,000',
      notes:
        'Handled by Dr. Karthikeya Sharma (Tuesday, Thursday & Saturday, 2:00 PM – 8:00 PM). Final quote after 3D intraoral scan.',
    },
    {
      id: 'srv-veneers',
      name: 'Porcelain Dental Veneers (Per Tooth)',
      price: '₹12,000 – ₹16,000',
      notes: 'Custom ceramic smile-design veneer per tooth.',
    },
    {
      id: 'srv-bridge',
      name: 'Dental Bridge (3-Unit Ceramic / Zirconia)',
      price: '₹24,000 – ₹36,000',
      notes: 'Fixed prosthetic replacement for a missing tooth.',
    },
    {
      id: 'srv-pediatric',
      name: 'Pediatric / Kids Dental Check-up & Fluoride',
      price: '₹800',
      notes: 'Gentle oral check-up and preventive fluoride application for children.',
    },
  ],
  policies: [
    'Appointments are recommended; walk-ins are accommodated for urgent pain.',
    'Please inform the front desk at least 24 hours in advance for rescheduling or cancellations. Missed or late-cancelled surgical slots incur a ₹300 fee.',
    'Standard clinic tariffs apply to all patients. The front desk cannot offer or promise discounts.',
    'Senior citizens (age 65+) receive a complimentary Digital X-Ray (RVG) with a paid consultation.',
    'Accepted payment methods: UPI (GPay, PhonePe, Paytm), Credit/Debit cards, and Cash.',
    'All instruments follow Class-B autoclave sterilisation protocols.',
  ],
  insurance: {
    summary:
      'Direct cashless insurance is not available at the clinic counter. We provide an itemised GST bill, clinical summary, and pre/post-treatment X-rays so you can submit a reimbursement claim with your insurer.',
    partners: [
      'Star Health Corporate Dental Rider',
      'HDFC ERGO Optima OPD',
      'ICICI Lombard Corporate OPD',
      'Bajaj Allianz Health Guard OPD',
    ],
  },
  parkingAndAccess:
    'Basement parking available for cars and two-wheelers — two hours (2 hours) free with clinic validation; complimentary valet at the Road No. 12 entrance. Ground-floor clinic with step-free wheelchair access.',
  updatedAt: new Date().toISOString(),
};
