import { describe, it } from 'node:test';
import assert from 'node:assert';

import { authModule } from '../src/modules/auth/index.js';
import { companyModule } from '../src/modules/company/index.js';
import { employeeModule } from '../src/modules/employee/index.js';
import { leadsModule } from '../src/modules/leads/index.js';
import { callsModule } from '../src/modules/calls/index.js';
import { meetingsModule } from '../src/modules/meetings/index.js';
import { policiesModule } from '../src/modules/policies/index.js';
import { approvalsModule } from '../src/modules/approvals/index.js';
import { billingModule } from '../src/modules/billing/index.js';
import { assemblyaiModule } from '../src/modules/assemblyai/index.js';
import { telephonyModule } from '../src/modules/telephony/index.js';
import { auditModule } from '../src/modules/audit/index.js';
import { proposalsModule } from '../src/modules/proposals/index.js';

describe('Modular Architecture Boundaries', () => {
  const modules = [
    authModule,
    companyModule,
    employeeModule,
    leadsModule,
    callsModule,
    meetingsModule,
    policiesModule,
    approvalsModule,
    billingModule,
    assemblyaiModule,
    telephonyModule,
    auditModule,
    proposalsModule,
  ];

  it('contains all 13 specified modules (12 foundational + proposals)', () => {
    assert.strictEqual(modules.length, 13);
  });

  it('marks active modules as active and remaining as foundation stub', () => {
    // auth is now active (JWT implemented); proposals is new active module.
    const activeModules = [
      'auth', 'company', 'policies', 'audit', 'leads', 'meetings',
      'assemblyai', 'calls', 'approvals', 'telephony', 'billing', 'proposals',
    ];
    for (const mod of modules) {
      assert.ok(mod.name, 'Module must have a name');
      assert.ok(mod.description, `Module ${mod.name} must have a description`);
      if (activeModules.includes(mod.name)) {
        assert.strictEqual(mod.status, 'active', `Module ${mod.name} should have status active`);
      } else {
        assert.strictEqual(mod.status, 'foundation_stub', `Module ${mod.name} should have status foundation_stub`);
      }
    }
  });
});
