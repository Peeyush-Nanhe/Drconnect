# Implementation Plan: Emergency Flow Test Script

This plan outlines the creation of an end-to-end automated script to simulate and verify the emergency flow: patient emergency request -> ambulance acceptance -> hospital bed assignment.

## User Review Required

> [!NOTE]
> The test script will execute completely in isolation on your staging database environment (`pyrlvjeectjikvfksukb`) using synthetic test records. All created accounts and entries will be cleanly deleted automatically after the test finishes, ensuring no leftover test data.

## Proposed Changes

### Scripts

#### [NEW] [test-emergency-flow.mjs](file:///D:/freelance/Drconnect-main/scripts/test-emergency-flow.mjs)
A new script that simulates the entire workflow:
1. **User Provisioning**: Creates a temporary patient, a temporary ambulance provider, and a temporary hospital facility.
2. **Hub Setup**: Creates a synthetic hospital hub owned by the facility, and provisions an available bed in `hub_beds`.
3. **Emergency Broadcast**: The patient initiates an emergency care request (`specialty: 'Ambulance'`, `emergency: true`).
4. **Ambulance Dispatch**: The ambulance provider accepts the care request.
5. **Bed Allocation**: The hospital assigns the patient to the provisioned bed.
6. **Cleanup**: Automatically purges all synthetic test data.

### Configuration

#### [MODIFY] [package.json](file:///D:/freelance/Drconnect-main/package.json)
Add a shortcut script to run this test flow:
- `npm run test:emergency-flow`: Executes the script with the staging environment file.

## Verification Plan

### Automated Verification
- Run `npm run test:emergency-flow -- --run` and observe step-by-step passage of every lifecycle hook.
