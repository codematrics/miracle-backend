# Laboratory Management API Documentation

## Overview
Complete pathology workflow management system with the following flow:
**OPD Billing → Order Creation → Collection → Result Entry → Authorization → Report**

---

## Models Structure

### 1. LabOrder
- `accessionNo`: Unique lab ID (LAB{YYYYMMDD}{NNNN})
- `patientId`: Reference to Patient
- `visitId`: Reference to Visit  
- `opdBillingId`: Reference to OPD Billing
- `doctorId`: Ordering doctor
- `status`: pending | collected | saved | authorized
- `priority`: normal | urgent | stat
- Auto-generates accession numbers

### 2. LabOrderTest
- `labOrderId`: Reference to LabOrder
- `serviceId`: Reference to Service (pathology test)
- `status`: pending | collected | saved | authorized
- Tracks individual test workflow

### 3. LabResult
- `labOrderTestId`: Reference to LabOrderTest
- `parameterId`: Reference to ParameterMaster
- `value`: Test result value
- `interpretation`: normal | high | low | critical_high | critical_low
- `isCritical`: Boolean flag for critical values
- Auto-interprets results based on reference ranges

### 4. ParameterMaster
- `serviceId`: Reference to Service
- `parameterName`: Parameter name (e.g., "Glucose")
- `unit`: Unit of measurement
- `referenceRange`: Normal range
- `criticalHigh/Low`: Critical value thresholds
- Gender/age specific ranges supported

---

## API Endpoints

### Lab Orders Management

#### GET /api/lab/orders
List all lab orders with filtering and pagination
```json
Query Parameters:
{
  "page": 1,
  "limit": 10,
  "search": "patient name or uhid",
  "status": "pending|collected|saved|authorized",
  "priority": "normal|urgent|stat",
  "patientId": "mongoId",
  "doctorId": "mongoId",
  "from": "2025-01-01",
  "to": "2025-01-31"
}
```

#### GET /api/lab/orders/:id
Get single lab order with all tests and results

#### POST /api/lab/orders
Create lab order from OPD billing
```json
Request Body:
{
  "patientId": "689cc7d2a18d0aad34684721",
  "visitId": "visit_id",
  "opdBillingId": "opd_billing_id", 
  "doctorId": "doctor_id",
  "serviceIds": ["service_id_1", "service_id_2"],
  "priority": "normal",
  "instructions": "Fasting sample required"
}
```

#### PUT /api/lab/orders/:id
Update lab order details

---

### Collection Workflow

#### GET /api/lab/collection
Get orders pending sample collection
```json
Response:
{
  "success": true,
  "data": [
    {
      "id": "order_id",
      "accessionNo": "LAB202501180001",
      "patientInfo": {
        "name": "John Doe",
        "uhid": "MH10002025...",
        "age": "35 Year",
        "gender": "Male"
      },
      "status": "pending",
      "priority": "urgent",
      "tests": [
        {
          "id": "test_id",
          "serviceInfo": {
            "name": "Blood Sugar Random",
            "code": "BSR"
          },
          "status": "pending"
        }
      ]
    }
  ]
}
```

#### POST /api/lab/collection/collect
Mark samples as collected
```json
Request Body:
{
  "testIds": ["test_id_1", "test_id_2"],
  "collectedBy": "user_id",
  "collectionData": {
    "test_id_1": {
      "sampleType": "Blood",
      "containerType": "Plain Tube",
      "hemolyzed": false,
      "lipemic": false,
      "remarks": "Sample collected at 9 AM"
    }
  }
}
```

---

### Result Entry Workflow

#### GET /api/lab/entry
Get collected tests ready for result entry
```json
Response includes tests with their parameters:
{
  "data": [
    {
      "id": "test_id",
      "labOrder": {
        "accessionNo": "LAB202501180001",
        "patientInfo": {...}
      },
      "service": {
        "name": "Blood Sugar Random"
      },
      "parameters": [
        {
          "id": "param_id",
          "parameterName": "Glucose",
          "unit": "mg/dL",
          "referenceRange": "70-100",
          "dataType": "numeric"
        }
      ],
      "results": []
    }
  ]
}
```

#### POST /api/lab/entry/save
Save test results
```json
Request Body:
{
  "labOrderTestId": "test_id",
  "enteredBy": "user_id",
  "technician": "tech_id",
  "results": [
    {
      "parameterId": "param_id",
      "value": 95,
      "technicalRemarks": "Normal sample",
      "instrumentUsed": "Auto Analyzer",
      "flags": {
        "hemolyzed": false,
        "lipemic": false
      }
    }
  ]
}
```

---

### Authorization Workflow

#### GET /api/lab/authorization
Get saved results ready for doctor authorization

#### POST /api/lab/authorization/authorize
Authorize test results
```json
Request Body:
{
  "resultIds": ["result_id_1", "result_id_2"],
  "authorizedBy": "doctor_id",
  "clinicalRemarks": "Results reviewed and approved",
  "bulkRemarks": "All results within normal limits"
}
```

---

### Report Generation

#### GET /api/lab/report/:accessionNo
Generate complete lab report
```json
Query Parameters:
{
  "format": "json|pdf",
  "includeRanges": true,
  "includeFlags": true,
  "includeRemarks": true
}

Response:
{
  "success": true,
  "data": {
    "reportHeader": {
      "accessionNo": "LAB202501180001",
      "reportDate": "2025-01-18T10:30:00Z",
      "status": "authorized"
    },
    "patientInfo": {
      "name": "John Doe",
      "uhid": "MH10002025...",
      "age": "35 Year",
      "gender": "Male"
    },
    "doctorInfo": {
      "name": "Dr. Smith"
    },
    "tests": [
      {
        "serviceName": "Blood Sugar Random",
        "results": [
          {
            "parameterName": "Glucose",
            "value": "95",
            "unit": "mg/dL",
            "referenceRange": "70-100",
            "interpretation": "Normal",
            "isCritical": false,
            "authorizedBy": "dr_smith"
          }
        ]
      }
    ],
    "summary": {
      "totalTests": 1,
      "completedTests": 1,
      "criticalResults": 0,
      "abnormalResults": 0
    }
  }
}
```

---

### Parameter Management

#### GET /api/lab/parameters
List parameters for services
```json
Query Parameters:
{
  "serviceId": "service_id",
  "isActive": true,
  "dataType": "numeric|text|boolean|select"
}
```

#### POST /api/lab/parameters
Create new parameter
```json
Request Body:
{
  "serviceId": "service_id",
  "parameterName": "Glucose",
  "parameterCode": "GLU",
  "unit": "mg/dL",
  "referenceRange": "70-100",
  "maleRange": "70-110",
  "femaleRange": "65-95",
  "dataType": "numeric",
  "criticalHigh": 400,
  "criticalLow": 40,
  "methodology": "Enzymatic",
  "sortOrder": 1
}
```

---

## Example Workflow: Blood Sugar & Lipid Profile

### 1. Order Creation (from OPD Billing)
```bash
POST /api/lab/orders
{
  "patientId": "689cc7d2a18d0aad34684721",
  "visitId": "visit_123",
  "opdBillingId": "opd_456",
  "doctorId": "doctor_789",
  "serviceIds": ["blood_sugar_service_id", "lipid_profile_service_id"],
  "priority": "normal",
  "instructions": "Fasting 12 hours required"
}

Response:
{
  "success": true,
  "data": {
    "accessionNo": "LAB202501180001",
    "status": "pending",
    "tests": [
      {
        "serviceInfo": { "name": "Blood Sugar Random" },
        "status": "pending"
      },
      {
        "serviceInfo": { "name": "Lipid Profile" }, 
        "status": "pending"
      }
    ]
  }
}
```

### 2. Sample Collection
```bash
POST /api/lab/collection/collect
{
  "testIds": ["test_id_1", "test_id_2"],
  "collectedBy": "phlebotomist_id",
  "collectionData": {
    "test_id_1": {
      "sampleType": "Blood",
      "containerType": "Fluoride Tube",
      "remarks": "Fasting sample - 12 hours"
    },
    "test_id_2": {
      "sampleType": "Blood", 
      "containerType": "Plain Tube"
    }
  }
}
```

### 3. Result Entry
```bash
POST /api/lab/entry/save
{
  "labOrderTestId": "test_id_1",
  "enteredBy": "technician_id",
  "results": [
    {
      "parameterId": "glucose_param_id",
      "value": 95,
      "technicalRemarks": "Good sample quality"
    }
  ]
}

POST /api/lab/entry/save  
{
  "labOrderTestId": "test_id_2",
  "enteredBy": "technician_id", 
  "results": [
    {
      "parameterId": "cholesterol_param_id",
      "value": 180
    },
    {
      "parameterId": "triglycerides_param_id", 
      "value": 120
    },
    {
      "parameterId": "hdl_param_id",
      "value": 45
    },
    {
      "parameterId": "ldl_param_id",
      "value": 110
    }
  ]
}
```

### 4. Authorization
```bash
POST /api/lab/authorization/authorize
{
  "resultIds": ["result_1", "result_2", "result_3", "result_4", "result_5"],
  "authorizedBy": "doctor_id",
  "clinicalRemarks": "All results reviewed. Patient should maintain diet control."
}
```

### 5. Report Generation
```bash
GET /api/lab/report/LAB202501180001?format=json&includeRanges=true
```

---

## Status Flow Summary

1. **Order Creation**: `pending` status
2. **Collection**: Tests marked as `collected` 
3. **Result Entry**: Tests marked as `saved`
4. **Authorization**: Tests marked as `authorized`
5. **Report**: Generated from `authorized` results only

The system automatically updates parent statuses based on child completion:
- Lab Order status updates when all tests reach the same status
- Test status updates when all parameters are completed
- Critical values are automatically flagged
- Result interpretation is automatic based on reference ranges

---

## Error Handling

All APIs return standardized error responses:
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "fieldName",
      "message": "Specific field error"
    }
  ]
}
```

## Security Features

- Rate limiting (200 requests per 15 minutes)
- Input validation and sanitization
- MongoDB injection protection
- XSS protection
- Comprehensive audit logging