export const config = {
  metabolicSyndrome: {
    requiredCriteria: 3,
    waistCm: { male: 102, female: 88 },
    triglyceridesMmolL: 1.7,
    hdlMmolL: { male: 1.0, female: 1.3 },
    bloodPressureMmHg: { systolic: 130, diastolic: 85 },
    fastingGlucoseMmolL: 5.6,
  },
  alcohol: {
    standardDrinkGrams: 14,
    male: { metaldMinimum: 15, aldMinimum: 30 },
    female: { metaldMinimum: 10, aldMinimum: 25 },
  },
  alternateDiagnoses: {
    diliMedications: [
      "Amoxicillin-clavulanate (Augmentin)",
      "Isoniazid",
      "Methotrexate",
      "Statins",
      "Immune checkpoint inhibitors",
      "Herbal and dietary supplements",
    ],
    geneticConditions: [
      "Alpha-1 antitrypsin deficiency",
      "Hereditary hemochromatosis",
      "Wilson's disease",
      "Glycogen storage disease",
      "Cystic fibrosis",
    ],
  },
  aminotransferases: {
    thresholdUL: 200,
  },
  fib4: {
    lowRiskUpperExclusive: 1.3,
    olderAdultAgeLowerInclusive: 65,
    olderAdultLowRiskUpperExclusive: 2,
    indeterminateUpperInclusive: 2.67,
  },
  app: {
    fibroscanUpperInclusive: 5.52,
    repeatYearlyLowerInclusive: 9.27,
  },
  elastography: {
    referralThresholdKpa: 8,
    repeatConsiderationThresholdKpa: 10,
  },
} as const;
