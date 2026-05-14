/* ============================================================
   skipQs – Sector Configuration  (v3)
   Central lookup for category labels, icons, unit names, presets,
   and behaviour flags used across signup, dashboard, and detail pages.

   noServiceStep: true  →  provider-signup hides the Services step
                            (categories where customers just take a token,
                             or where availability not services is tracked)
   isAvailabilityOnly:  →  dashboard shows "autos available" not queue timer
   ============================================================ */

window.SECTOR_CONFIG = {

  /* ── HEALTHCARE ────────────────────────────────────────── */
  Hospital: {
    label: 'Hospital', plural: 'Hospitals', icon: '🏥',
    unitSingular: 'Department', unitPlural: 'Departments',
    listPage: 'hospitals.html',
    tagline: 'Live wait times for every department.',
    noServiceStep: false,
    presets: [
      ['🚑','Emergency (A&E)',60,4],
      ['❤️','Cardiology',30,2],
      ['🦴','Orthopaedics',30,2],
      ['👶','Paediatrics',25,2],
      ['🩻','Radiology',20,3],
      ['🧪','Pathology / Lab',15,3],
      ['🦷','Dental',30,2],
      ['👁️','Ophthalmology',25,2],
      ['🤰','Gynaecology',30,2],
      ['🧠','Neurology',40,2],
      ['🩺','General OPD',20,4],
      ['🫁','Pulmonology',30,2],
      ['🫀','Vascular',35,2],
      ['💊','Pharmacy Counter',10,3]
    ]
  },
  Clinic: {
    label: 'Clinic', plural: 'Clinics', icon: '🩺',
    unitSingular: 'Service', unitPlural: 'Services',
    listPage: 'clinics.html',
    tagline: 'See live wait times before you walk in.',
    noServiceStep: false,
    presets: [
      ['🩺','General Consultation',20,2],
      ['💉','Vaccination',10,2],
      ['🧪','Blood Test',15,2],
      ['👶','Child Health Check',15,1],
      ['🩹','Minor Injury / Dressing',25,2],
      ['💊','Prescription',10,2]
    ]
  },
  Pharmacy: {
    label: 'Pharmacy', plural: 'Pharmacies', icon: '💊',
    unitSingular: 'Counter', unitPlural: 'Counters',
    listPage: 'pharmacies.html',
    tagline: 'Pick up prescriptions without standing in line.',
    noServiceStep: false,
    presets: [
      ['💊','Prescription Pickup',10,2],
      ['🩺','Pharmacist Consultation',15,1],
      ['💉','Vaccination',10,1],
      ['🧪','Blood Pressure / Sugar Check',5,1]
    ]
  },

  /* ── BEAUTY & GROOMING ─────────────────────────────────── */
  Salon: {
    label: 'Salon', plural: 'Salons', icon: '💇‍♀️',
    unitSingular: 'Station', unitPlural: 'Stations',
    listPage: 'salons.html',
    tagline: 'Get a live ETA for your stylist.',
    noServiceStep: false,
    presets: [
      ['💇‍♀️','Haircut (Ladies)',45,2],
      ['💇','Haircut (Gents)',25,3],
      ['🎨','Hair Colour & Highlights',90,2],
      ['💅','Manicure',30,2],
      ['🦶','Pedicure',45,1],
      ['👁️','Facial / Cleanup',45,1],
      ['🪒','Beard Trim',15,2],
      ['💆','Head Massage',20,2],
      ['🧖','Waxing',30,2]
    ]
  },
  Barber: {
    label: 'Barber', plural: 'Barbers', icon: '💈',
    unitSingular: 'Service', unitPlural: 'Services',
    listPage: 'salons.html',
    tagline: 'Walk in when your chair is ready.',
    noServiceStep: false,
    presets: [
      ['💈','Haircut',25,2],
      ['🪒','Wet Shave',20,1],
      ['🧔','Beard Trim & Shape',15,2],
      ['💇','Hair & Beard Combo',35,2],
      ['👦','Kids Cut',20,2]
    ]
  },

  /* ── FINANCE ───────────────────────────────────────────── */
  Bank: {
    label: 'Bank', plural: 'Banks', icon: '🏦',
    unitSingular: 'Counter', unitPlural: 'Counters',
    listPage: 'banks.html',
    tagline: 'Live counter waits — bank without queuing.',
    noServiceStep: false,
    presets: [
      ['💵','Cash Deposit / Withdrawal',10,3],
      ['📑','Account Services',15,2],
      ['💳','Loans & Credit',30,1],
      ['💱','Forex / Remittance',20,1],
      ['🧾','Cheque Clearing',15,1],
      ['🔐','Locker Services',20,1]
    ]
  },
  Government: {
    label: 'Government Office', plural: 'Government Offices', icon: '🏛️',
    unitSingular: 'Counter', unitPlural: 'Counters',
    listPage: 'government.html',
    tagline: 'Live counter waits at public offices.',
    noServiceStep: false,
    presets: [
      ['📘','Passport Services',45,2],
      ['🚗','Driver Licence',60,2],
      ['🧾','Tax / Revenue',30,2],
      ['🗂️','Birth / Death Records',30,1],
      ['🏠','Property / Land Registry',45,1],
      ['🪪','ID / Aadhaar Services',20,2],
      ['🎓','Education Certificates',30,1]
    ]
  },

  /* ── FOOD & DINING ─────────────────────────────────────── */
  Restaurant: {
    label: 'Restaurant', plural: 'Restaurants', icon: '🍽️',
    unitSingular: 'Section', unitPlural: 'Sections',
    listPage: 'restaurants.html',
    tagline: 'Skip the wait list — table ETAs in real time.',
    noServiceStep: false,
    presets: [
      ['🍽️','Dine-In (2 covers)',25,4],
      ['👨‍👩‍👧‍👦','Family Table (4+)',30,3],
      ['🥡','Takeaway Counter',10,2],
      ['🍹','Bar / Drinks',15,4],
      ['🌳','Outdoor / Garden',30,3]
    ]
  },
  Bakery: {
    label: 'Bakery', plural: 'Bakeries', icon: '🍞',
    unitSingular: 'Counter', unitPlural: 'Counters',
    listPage: 'nearby.html',
    tagline: 'Fresh daily — know when to come for hot stock.',
    noServiceStep: false,
    presets: [
      ['🍞','Bread & Loaves',5,1],
      ['🎂','Cakes & Pastries',10,1],
      ['🥐','Snacks & Biscuits',5,1],
      ['🎁','Custom / Pre-order Cakes',20,1]
    ]
  },
  SweetShop: {
    label: 'Sweet Shop', plural: 'Sweet Shops', icon: '🍬',
    unitSingular: 'Counter', unitPlural: 'Counters',
    listPage: 'nearby.html',
    tagline: 'Skip the festival rush at your favourite mithai shop.',
    noServiceStep: false,
    presets: [
      ['🍬','Mithai / Sweets Counter',10,2],
      ['🧁','Namkeen & Savoury',5,1],
      ['🎁','Gift Boxes (Pre-order)',15,1],
      ['🍦','Ice Cream & Desserts',5,2]
    ]
  },

  /* ── FITNESS ───────────────────────────────────────────── */
  Gym: {
    label: 'Gym', plural: 'Gyms', icon: '🏋️',
    unitSingular: 'Zone', unitPlural: 'Zones',
    listPage: 'gyms.html',
    tagline: 'See which zone has free machines right now.',
    noServiceStep: false,
    presets: [
      ['🏃','Cardio Zone',5,8],
      ['🏋️','Free Weights',10,6],
      ['🧘','Studio / Classes',0,15],
      ['🏊','Swimming Pool',5,10],
      ['🥊','Boxing / CrossFit',20,8]
    ]
  },

  /* ── AUTOMOTIVE ────────────────────────────────────────── */
  CarWash: {
    label: 'Car Wash', plural: 'Car Washes', icon: '🧼',
    unitSingular: 'Bay', unitPlural: 'Bays',
    listPage: 'car-wash.html',
    tagline: 'Drive in only when your bay is open.',
    noServiceStep: false,
    presets: [
      ['🚗','Basic Exterior Wash',15,2],
      ['✨','Premium Wash & Wax',30,1],
      ['🪣','Hand Wash',45,1],
      ['💎','Full Detailing',90,1]
    ]
  },

  /* ── REPAIRS & SERVICES ────────────────────────────────── */
  Repair: {
    label: 'Repair Shop', plural: 'Repair Shops', icon: '🛠️',
    unitSingular: 'Service', unitPlural: 'Services',
    listPage: 'repairs.html',
    tagline: 'Drop-off ETAs without the back-and-forth.',
    noServiceStep: false,
    presets: [
      ['📱','Phone Screen Repair',30,2],
      ['💻','Laptop / PC Repair',60,2],
      ['🔌','Appliance Repair',45,1],
      ['👟','Shoe / Leather Repair',20,1],
      ['⌚','Watch / Jewellery Repair',20,1]
    ]
  },

  /* ── LOCAL RETAIL ──────────────────────────────────────── */

  /**
   * KIRANA STORE
   * Rich grocery preset library modelled on BigBasket / Zepto / Blinkit
   * category taxonomy. Providers can pick-and-choose counters.
   * noServiceStep: false — we keep services so they can list their
   * counters (Dairy, Grains, etc.) and customers know what they're
   * queuing for. The "duration" here means average counter time, not
   * a service charge.
   */
  Kirana: {
    label: 'Kirana Store', plural: 'Kirana Stores', icon: '🛒',
    unitSingular: 'Counter', unitPlural: 'Counters',
    listPage: 'nearby.html',
    tagline: 'Check if your local store is busy before you walk over.',
    noServiceStep: false,
    // Grouped presets matching BigBasket / Zepto / Blinkit categories
    presets: [
      // Staples & Essentials
      ['🛒','General / Billing Counter',10,1],
      ['🌾','Atta, Rice & Grains',5,1],
      ['🫘','Dal & Pulses',5,1],
      ['🧂','Spices & Masalas',5,1],
      ['🫙','Oils & Ghee',5,1],
      ['🍚','Dry Fruits & Nuts',5,1],
      // Fresh Produce
      ['🥬','Fresh Vegetables',5,1],
      ['🍎','Fresh Fruits',5,1],
      ['🌿','Herbs & Green Chilli',3,1],
      // Dairy & Eggs
      ['🥛','Milk & Dairy Products',5,1],
      ['🧀','Paneer & Curd',5,1],
      ['🥚','Eggs',3,1],
      ['🧈','Butter & Cheese',4,1],
      // Beverages
      ['☕','Tea & Coffee',5,1],
      ['🧃','Juices & Cold Drinks',4,1],
      ['💧','Water & Energy Drinks',3,1],
      // Snacks & Packaged
      ['🍜','Noodles & Pasta',4,1],
      ['🍪','Biscuits & Cookies',4,1],
      ['🥜','Namkeen & Chips',4,1],
      ['🍫','Chocolates & Sweets',4,1],
      // Personal Care
      ['🧴','Shampoo & Soap',4,1],
      ['🪥','Toothpaste & Oral Care',4,1],
      ['🧻','Tissue & Paper Products',3,1],
      // Household
      ['🧹','Cleaning Products',4,1],
      ['💡','Batteries & Small Electronics',5,1],
      ['🐾','Pet Food & Accessories',5,1],
      // Baby
      ['👶','Baby Food & Diapers',5,1],
    ]
  },

  LocalShop: {
    label: 'Local Shop', plural: 'Local Shops', icon: '🏪',
    unitSingular: 'Service', unitPlural: 'Services',
    listPage: 'nearby.html',
    tagline: 'Any small shop — list your services, skip the crowd.',
    noServiceStep: false,
    presets: [
      ['🏪','General Service / Billing',10,1],
      ['📦','Order Pickup',5,1],
      ['💰','Payment / Recharge',3,1]
    ]
  },

  /**
   * AUTO STAND
   * noServiceStep: true — Auto stands don't offer "services" in the
   * traditional sense. They track vehicle availability. The signup
   * will skip Step 3 (services) entirely and go straight to Step 4
   * (availability preset selection).
   * Presets represent vehicle type slots, not timed services.
   */
  AutoStand: {
    label: 'Auto Stand', plural: 'Auto Stands', icon: '🛺',
    unitSingular: 'Vehicle Type', unitPlural: 'Vehicle Types',
    listPage: 'nearby.html',
    tagline: 'See live availability at your nearest auto stand.',
    noServiceStep: true,   // ← hides the Services step in signup
    isAvailabilityOnly: true, // ← dashboard shows available count not timer
    presets: [
      ['🛺','Auto Rickshaw',0,5],
      ['🚕','Taxi / Cab',0,3],
      ['🚌','Shared Auto (Route)',0,8],
      ['🚲','E-Rickshaw',0,4],
      ['🛵','2-Wheeler / Bike Taxi',0,4]
    ]
  },

  /* ── CATCH-ALL ──────────────────────────────────────────── */
  Other: {
    label: 'Other', plural: 'Others', icon: '🏷️',
    unitSingular: 'Counter', unitPlural: 'Counters',
    listPage: 'nearby.html',
    tagline: 'Skip the queue — join from anywhere.',
    noServiceStep: false,
    presets: [['🏷️','General Counter',10,1]]
  }
};

// ── Order shown in category picker ──────────────────────────
window.SECTOR_ORDER = [
  'Hospital','Clinic','Pharmacy',
  'Salon','Barber',
  'Bank','Government',
  'Restaurant','Bakery','SweetShop',
  'Gym','CarWash','Repair',
  'Kirana','LocalShop','AutoStand',
  'Other'
];

// ── Helper: get config for a category label (falls back gracefully) ──
window.getSectorConfig = function (category) {
  // Look up by key first, then by label
  if (window.SECTOR_CONFIG[category]) return window.SECTOR_CONFIG[category];
  const byLabel = Object.values(window.SECTOR_CONFIG).find(c => c.label === category);
  if (byLabel) return byLabel;
  return {
    label: category || 'Business',
    plural: (category || 'Business') + 'es',
    icon: '🏪',
    unitSingular: 'Service',
    unitPlural: 'Services',
    listPage: 'nearby.html',
    tagline: 'Skip the queue — join from anywhere.',
    noServiceStep: false,
    isAvailabilityOnly: false,
    presets: []
  };
};
