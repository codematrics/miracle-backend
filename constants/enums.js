const RELATION_TYPES = {
  SON_OF: "S/O",
  WIFE_OF: "W/O",
  DAUGHTER_OF: "D/O",
  OTHER: "Other",
};

const AGE_UNITS = {
  YEAR: "Year",
  MONTH: "Month",
  DAY: "Day",
};

const GENDER_TYPES = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

const MARITAL_STATUS = {
  DIVORCED: "Divorced",
  MARRIED: "Married",
  SEPARATED: "Separated",
  UNMARRIED: "Unmarried",
  WIDOWED: "Widowed",
};

const RELIGIONS = {
  HINDU: "Hindu",
  BUDDHIST: "Buddhist",
  CHRISTIAN: "Christian",
  JAIN: "Jain",
  MUSLIM: "Muslim",
  PARSI: "Parsi",
  SIKH: "Sikh",
  OTHER: "Other",
};

const OCCUPATIONS = {
  SELF_EMPLOYED: "SELF EMPLOYED",
  GOVT_SERVICE: "GOVT. SERVICE",
  PVT_SERVICE: "PVT. SERVICE",
  BUSINESS: "BUSINESS",
  HOUSE_WORK: "HOUSE WORK",
  STUDY: "STUDY",
  UNEMPLOYED: "UN-EMPLOYED",
  OTHER: "OTHER",
};

const ID_TYPES = {
  AADHAR_CARD: "Aadhar Card",
  PAN_CARD: "Pancard",
  DRIVING_LICENSE: "Driving license",
  VOTER_ID: "Voter ID",
  PASSPORT: "Passport",
};

const PATIENT_TYPES = {
  GENERAL: "General",
  VIP: "VIP",
  STAFF: "Staff",
};

const SERVICE_CATEGORIES = {
  CONSULTATION: "consultation",
  DIAGNOSTIC: "diagnostic",
  LABORATORY: "laboratory",
  PATHOLOGY: "pathology",
  RADIOLOGY: "radiology",
  PROCEDURE: "procedure",
  SURGERY: "surgery",
  PHARMACY: "pharmacy",
  EMERGENCY: "emergency",
  OTHER: "other",
};

const SERVICE_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
};

const PAYMENT_MODES = {
  CASH: "cash",
  CARD: "card",
  UPI: "upi",
  INSURANCE: "insurance",
};

const ORDER_STATUS = {
  PENDING: "pending",
  COLLECTED: "collected",
  SAVED: "saved",
  AUTHORIZED: "authorized",
};

const PATHOLOGY_STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  REPORTED: "reported",
  CANCELLED: "cancelled",
};

const PRIORITY = {
  NORMAL: "normal",
  URGENT: "urgent",
  STAT: "stat",
};

const SEX_CODES = {
  MALE: "M",
  FEMALE: "F",
  OTHER: "O",
};

const getEnumValues = (enumObject) => Object.values(enumObject);

const getEnumKeys = (enumObject) => Object.keys(enumObject);

const PATIENT_ENUMS = {
  RELATION_TYPES,
  AGE_UNITS,
  GENDER_TYPES,
  MARITAL_STATUS,
  RELIGIONS,
  OCCUPATIONS,
  ID_TYPES,
  PATIENT_TYPES,
};

const SERVICE_ENUMS = {
  SERVICE_CATEGORIES,
  SERVICE_STATUS,
};

const PATHOLOGY_ENUMS = {
  PATHOLOGY_STATUS,
  PRIORITY,
  SEX_CODES,
};

const PARAMETER_DATATYPE_ENUM = {
  numeric: "numeric",
  text: "text",
  boolean: "boolean",
  select: "select",
};

module.exports = {
  RELATION_TYPES,
  AGE_UNITS,
  GENDER_TYPES,
  MARITAL_STATUS,
  RELIGIONS,
  OCCUPATIONS,
  ID_TYPES,
  PATIENT_TYPES,
  SERVICE_CATEGORIES,
  SERVICE_STATUS,
  PATHOLOGY_STATUS,
  PRIORITY,
  SEX_CODES,
  PATIENT_ENUMS,
  SERVICE_ENUMS,
  PATHOLOGY_ENUMS,
  PARAMETER_DATATYPE_ENUM,
  PAYMENT_MODES,
  ORDER_STATUS,
  getEnumValues,
  getEnumKeys,
};
