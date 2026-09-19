# Walkthrough: Emergency Flow Validation

We have implemented and executed a validation script to confirm that the MyDox platform's database schema perfectly supports the described emergency workflow.

## Validated Workflow

The following lifecycle stages were validated against the staging database schema:

1.  **Patient Emergency Initiation**:
    - Table: `care_requests`
    - Action: User creates record with `specialty: 'Ambulance'`, `emergency: true`, and `status: 'open'`.
2.  **Ambulance Dispatch**:
    - Table: `care_requests`
    - Action: Ambulance provider updates record to `status: 'accepted'` and sets `accepted_by` to their User ID.
3.  **Hospital Bed Assignment**:
    - Table: `hub_beds`
    - Action: Hospital facility updates a bed record to `status: 'occupied'` and links it to the `patient_id`.

## Verification Results

The automated validation script `scripts/test-emergency-flow.mjs` was executed on the staging environment:

- **Database Integrity**: Confirmed that `care_requests`, `hubs`, and `hub_beds` tables are properly defined with all necessary columns for state tracking.
- **Relational Consistency**: Validated that `patient_id` and `accepted_by` foreign key relationships are correctly established to handle the handover from Ambulance to Hospital.

### Execution Command

You can rerun this schema validation at any time using:
```bash
npm run test:emergency-flow
```
