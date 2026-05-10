/* ============================================================
   skipQs – Sector Configuration
   Central lookup for category-specific labels, emojis, and
   "department" presets used by signup, dashboard, and detail pages.
   ============================================================ */

window.SECTOR_CONFIG = {
  Hospital: {
    label: 'Hospital',
    plural: 'Hospitals',
    icon: '🏥',
    unitSingular: 'Department',
    unitPlural:   'Departments',
    listPage: 'hospitals.html',
    tagline:  'Live wait times for every department.',
    presets: [
      ['🚑','Emergency (ER)',60,4],
      ['❤️','Cardiology',30,2],
      ['🦴','Orthopedics',30,2],
      ['👶','Pediatrics',25,2],
      ['🩻','Radiology',20,3],
      ['🧪','Pathology',15,3],
      ['🦷','Dental',30,2],
      ['👁️','Ophthalmology',25,2],
      ['🤰','Gynecology',30,2],
      ['🧠','Neurology',40,2]
    ]
  },
  Clinic: {
    label: 'Clinic',
    plural: 'Clinics',
    icon: '🩺',
    unitSingular: 'Service',
    unitPlural:   'Services',
    listPage: 'clinics.html',
    tagline:  'See live wait times before you walk in.',
    presets: [
      ['🩺','General Consultation',20,2],
      ['💉','Vaccinations',10,2],
      ['🧪','Blood Test',15,2],
      ['👶','Child Health',15,1],
      ['🩹','Minor Injury',25,2]
    ]
  },
  Salon: {
    label: 'Salon',
    plural: 'Salons',
    icon: '💇‍♀️',
    unitSingular: 'Station',
    unitPlural:   'Stations',
    listPage: 'salons.html',
    tagline:  'Get a live ETA for your stylist.',
    presets: [
      ['💇‍♀️','Hair Cutting',30,2],
      ['🎨','Hair Coloring',60,2],
      ['💅','Manicure',30,2],
      ['🦶','Pedicure',45,1],
      ['👁️','Facial',45,1],
      ['🪒','Beard Trim',15,2]
    ]
  },
  Barber: {
    label: 'Barber',
    plural: 'Barbers',
    icon: '💈',
    unitSingular: 'Service',
    unitPlural:   'Services',
    listPage: 'salons.html',
    tagline:  'Walk in when your chair is ready.',
    presets: [
      ['💈','Haircut',25,2],
      ['🪒','Shave',20,1],
      ['🧔','Beard Trim',15,2]
    ]
  },
  Bank: {
    label: 'Bank',
    plural: 'Banks',
    icon: '🏦',
    unitSingular: 'Counter',
    unitPlural:   'Counters',
    listPage: 'banks.html',
    tagline:  'Live counter waits — bank without queues.',
    presets: [
      ['💵','Cash Deposit / Withdrawal',10,2],
      ['📑','Account Services',15,2],
      ['💳','Loans',30,1],
      ['💱','Forex',20,1],
      ['🧾','Cheque Clearing',15,1]
    ]
  },
  Restaurant: {
    label: 'Restaurant',
    plural: 'Restaurants',
    icon: '🍽️',
    unitSingular: 'Section',
    unitPlural:   'Sections',
    listPage: 'restaurants.html',
    tagline:  'Skip the wait list — table ETAs in real time.',
    presets: [
      ['🍽️','Dine-In',25,4],
      ['🥡','Takeaway',15,2],
      ['🍹','Bar Seating',20,3],
      ['🌳','Outdoor / Patio',30,3]
    ]
  },
  Gym: {
    label: 'Gym',
    plural: 'Gyms',
    icon: '🏋️',
    unitSingular: 'Zone',
    unitPlural:   'Zones',
    listPage: 'gyms.html',
    tagline:  'See which zone has free machines right now.',
    presets: [
      ['🏃','Cardio',5,8],
      ['🏋️','Weights',10,6],
      ['🧘','Studio (classes)',0,12],
      ['🏊','Pool',5,10]
    ]
  },
  CarWash: {
    label: 'Car Wash',
    plural: 'Car Washes',
    icon: '🧼',
    unitSingular: 'Bay',
    unitPlural:   'Bays',
    listPage: 'car-wash.html',
    tagline:  'Drive in only when your bay is open.',
    presets: [
      ['🚗','Basic Wash',15,2],
      ['✨','Premium Wash',30,1],
      ['🪣','Hand Wash',45,1],
      ['💎','Detailing',90,1]
    ]
  },
  Government: {
    label: 'Government Office',
    plural: 'Government Offices',
    icon: '🏛️',
    unitSingular: 'Counter',
    unitPlural:   'Counters',
    listPage: 'government.html',
    tagline:  'Live counter waits at public offices.',
    presets: [
      ['📘','Passport Services',45,2],
      ['🚗','Driver License',60,2],
      ['🧾','Tax / Revenue',30,2],
      ['🗂️','Birth / Death Records',30,1],
      ['🏠','Property / Land',45,1]
    ]
  },
  Repair: {
    label: 'Repair Shop',
    plural: 'Repair Shops',
    icon: '🛠️',
    unitSingular: 'Service',
    unitPlural:   'Services',
    listPage: 'repairs.html',
    tagline:  'Drop-off ETAs without the back-and-forth.',
    presets: [
      ['📱','Phone Repair',30,2],
      ['💻','Laptop Repair',60,2],
      ['🔌','Appliance Repair',45,1],
      ['👟','Shoe / Leather',20,1]
    ]
  },
  Pharmacy: {
    label: 'Pharmacy',
    plural: 'Pharmacies',
    icon: '💊',
    unitSingular: 'Counter',
    unitPlural:   'Counters',
    listPage: 'pharmacies.html',
    tagline:  'Pick up prescriptions without standing in line.',
    presets: [
      ['💊','Prescription Pickup',10,2],
      ['🩺','Consultation',15,1],
      ['💉','Vaccination',10,1]
    ]
  }
};

// Order categories appear in the homepage / picker
window.SECTOR_ORDER = [
  'Hospital','Clinic','Pharmacy',
  'Salon','Barber',
  'Bank','Government',
  'Restaurant',
  'Gym','CarWash','Repair'
];

window.getSectorConfig = function (category) {
  return window.SECTOR_CONFIG[category] || {
    label: category || 'Business',
    plural: (category || 'Businesses') + 's',
    icon: '🏪',
    unitSingular: 'Service',
    unitPlural: 'Services',
    listPage: 'nearby.html',
    tagline: 'Skip the queue — join from anywhere.',
    presets: []
  };
};
