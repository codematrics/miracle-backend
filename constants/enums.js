const RELATION_TYPES = {
  SON_OF: "S/O",
  WIFE_OF: "W/O", 
  DAUGHTER_OF: "D/O",
  OTHER: "Other"
};

const AGE_UNITS = {
  YEAR: "Year",
  MONTH: "Month", 
  DAY: "Day"
};

const GENDER_TYPES = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other"
};

const MARITAL_STATUS = {
  DIVORCED: "Divorced",
  MARRIED: "Married",
  SEPARATED: "Separated", 
  UNMARRIED: "Unmarried",
  WIDOWED: "Widowed"
};

const RELIGIONS = {
  HINDU: "Hindu",
  BUDDHIST: "Buddhist",
  CHRISTIAN: "Christian",
  JAIN: "Jain",
  MUSLIM: "Muslim", 
  PARSI: "Parsi",
  SIKH: "Sikh",
  OTHER: "Other"
};

const OCCUPATIONS = {
  SELF_EMPLOYED: "SELF EMPLOYED",
  GOVT_SERVICE: "GOVT. SERVICE",
  PVT_SERVICE: "PVT. SERVICE",
  BUSINESS: "BUSINESS", 
  HOUSE_WORK: "HOUSE WORK",
  STUDY: "STUDY",
  UNEMPLOYED: "UN-EMPLOYED",
  OTHER: "OTHER"
};

const ID_TYPES = {
  AADHAR_CARD: "Aadhar Card",
  PAN_CARD: "Pancard",
  DRIVING_LICENSE: "Driving license",
  VOTER_ID: "Voter ID",
  PASSPORT: "Passport"
};

const PATIENT_TYPES = {
  GENERAL: "General",
  VIP: "VIP",
  STAFF: "Staff"
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
  PATIENT_TYPES
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
  PATIENT_ENUMS,
  getEnumValues,
  getEnumKeys
};