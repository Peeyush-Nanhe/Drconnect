import { test } from 'node:test';
import assert from 'node:assert/strict';

// Helper function representing role-to-view mapping logic in auth workflow
function resolveUserView(primaryRole, requestedView) {
  const ROLE_TO_VIEW = {
    patient: 'patient',
    provider: 'medico',
    facility: 'hub',
    admin: 'admin',
    super_admin: 'admin',
  };
  const providerViews = new Set([
    'medico',
    'ambulance',
    'seva',
    'coordinator',
    'care_physician',
    'nurse',
    'technician',
    'physio_staff',
    'therapist',
  ]);
  const facilityViews = new Set(['hub', 'diagnostic', 'pharmacy', 'labs']);

  let derivedView = ROLE_TO_VIEW[primaryRole] || 'patient';
  if (primaryRole === 'provider' && requestedView && providerViews.has(requestedView)) derivedView = requestedView;
  if (primaryRole === 'facility' && requestedView && facilityViews.has(requestedView)) derivedView = requestedView;
  return derivedView;
}

// Helper function representing email pre-mapping and therapist resolution in auth workflow
function resolveAuthTarget(inputEmail) {
  const email = (inputEmail || '').trim().toLowerCase();
  const isRahulNair = email === 'rahul.nair@demo.med' || email === 'therapist1@demo.med';
  return {
    targetEmail: isRahulNair ? 'medico1@demo.med' : email,
    isRahulNair,
    overrideName: isRahulNair ? 'Rahul Nair' : undefined,
    overrideView: isRahulNair ? 'medico' : undefined,
  };
}

test('Rahul Nair credential resolution maps to therapist profile and medico view', () => {
  const creds = { email: 'rahul.nair@demo.med', password: 'demo123456' };

  assert.equal(creds.password.length >= 6, true, 'Password must satisfy minimum length of 6');

  const resolved = resolveAuthTarget(creds.email);
  assert.equal(resolved.targetEmail, 'medico1@demo.med');
  assert.equal(resolved.isRahulNair, true);
  assert.equal(resolved.overrideName, 'Rahul Nair');
  assert.equal(resolved.overrideView, 'medico');

  const view = resolveUserView('provider', resolved.overrideView);
  assert.equal(view, 'medico');
});

test('Alias therapist1@demo.med maps seamlessly to Rahul Nair', () => {
  const resolved = resolveAuthTarget('therapist1@demo.med');
  assert.equal(resolved.targetEmail, 'medico1@demo.med');
  assert.equal(resolved.overrideName, 'Rahul Nair');
});

test('Standard provider accounts map to default medico view', () => {
  const resolved = resolveAuthTarget('medico1@demo.med');
  assert.equal(resolved.isRahulNair, false);
  assert.equal(resolved.overrideName, undefined);

  const view = resolveUserView('provider', undefined);
  assert.equal(view, 'medico');
});

test('Care staff roles resolve to their dedicated portal views', () => {
  assert.equal(resolveUserView('provider', 'nurse'), 'nurse');
  assert.equal(resolveUserView('provider', 'technician'), 'technician');
  assert.equal(resolveUserView('provider', 'physio_staff'), 'physio_staff');
  assert.equal(resolveUserView('provider', 'therapist'), 'therapist');
});
