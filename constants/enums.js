const AGE_UNITS = {
  ALL: "All",
  YEAR: "Year",
  MONTH: "Month",
  DAY: "Day",
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

const SAMPLE_TYPES = {
  WHOLE_BLOOD: "whole_blood",
  SERUM: "serum",
  PLASMA: "plasma",
  URINE: "urine",
  STOOL: "stool",
  SPUTUM: "sputum",
  SWAB: "swab",
  CSF: "csf",
  PLEURAL_FLUID: "pleural_fluid",
  ASCITIC_FLUID: "ascitic_fluid",
  SYNOVIAL_FLUID: "synovial_fluid",
  PERICARDIAL_FLUID: "pericardial_fluid",
  BONE_MARROW: "bone_marrow",
  TISSUE: "tissue",
  SEMEN: "semen",
  OTHER: "other",
};

const CONTAINER_TYPES = {
  EDTA: "edta_tube", // Lavender top
  SODIUM_CITRATE: "sodium_citrate_tube", // Light Blue top
  PLAIN: "plain_tube", // Red top
  SST: "sst_gel_tube", // Yellow top
  HEPARIN: "heparin_tube", // Green top
  FLUORIDE: "fluoride_tube", // Gray top
  ESR: "esr_black_tube", // Black top
  TRACE_ELEMENT: "trace_element_tube", // Royal Blue
  URINE_CONTAINER: "urine_container",
  STOOL_CONTAINER: "stool_container",
  CULTURE_BOTTLE: "culture_bottle",
  CSF_VIAL: "csf_vial",
  HISTOLOGY_JAR: "formalin_jar",
  OTHER: "other",
};

// new flow

const ROLES = {
  ADMIN: "Admin",
  RECEPTIONIST: "Receptionist",
  DOCTOR: "Doctor",
  TECHNICIAN: "Technician",
};

const REPORT_TYPE = {
  HAEMATOLOGY: "Haematology",
  BIOCHEMISTRY: "Biochemistry",
  SEROLOGY: "Serology",
  CYTOLOGY: "Cytology",
  OUTSOURCE: "Outsource",
  HORMONES_IMMUNOLOGY: "HormonesImmunology",
  CLINICAL: "Clinical",
};

const FORMAT_TYPE = {
  TABULAR: "Tabular",
  FREESTYLE: "FreeStyle",
  SELECTIVE: "Selective",
};

const SAMPLE_TYPE = {
  SERUM: "Serum",
  URINE: "Urine",
  BLOOD: "Blood",
  FLUIDS: "Fluids",
  SEMEN: "Semen",
  TISSUE: "Tissue",
  STOOL: "Stool",
  SWAB: "Swab",
};

const ORDER_TEST_STATUS = {
  PENDING: "Pending",
  COLLECTED: "Collected",
  SAVED: "Saved",
  AUTHORIZED: "Authorized",
};

const GENDER = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

const GENDER_WITH_ALL = {
  MALE: "Male",
  FEMALE: "Female",
  ALL: "All",
};

const SERVICE_CATEGORY = {
  PROCEDURE: "Procedure",
  PATHOLOGY: "Pathology",
  CONSULTATION: "Consultation",
  SURGERY: "Surgery",
  RADIOLOGY: "Radiology",
  OTHER: "Other",
};

const SERVICE_APPLICABLE = {
  OPD: "OPD",
  IPD: "IPD",
  BOTH: "Both",
};

const VISIT_STATUS = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  CLOSED: "Closed",
};

const VISIT_TYPE = {
  OPD: "OPD",
  IPD: "IPD",
  EMG: "EMG",
  CAMP: "Camp",
  DAY_CARE: "Day Care",
  INVESTIGATION: "Investigation",
};

const RELATION_TYPES = {
  SON_OF: "S/O",
  WIFE_OF: "W/O",
  DAUGHTER_OF: "D/O",
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

const PATIENT_ENUMS = {
  RELATION_TYPES,
  AGE_UNITS,
  GENDER,
  MARITAL_STATUS,
  RELIGIONS,
  OCCUPATIONS,
  ID_TYPES,
  PATIENT_TYPES,
};

module.exports = {
  RELATION_TYPES,
  AGE_UNITS,
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
  SAMPLE_TYPES,
  CONTAINER_TYPES,
  ROLES,
  REPORT_TYPE,
  FORMAT_TYPE,
  SAMPLE_TYPE,
  ORDER_TEST_STATUS,
  GENDER,
  SERVICE_CATEGORY,
  SERVICE_APPLICABLE,
  VISIT_STATUS,
  VISIT_TYPE,
  GENDER_WITH_ALL,
  getEnumValues,
  getEnumKeys,
};
