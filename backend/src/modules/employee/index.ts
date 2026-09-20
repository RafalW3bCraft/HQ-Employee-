/**
 * Employee Module — Foundation Boundary
 * Handles AI employee profile, persona instructions, and runtime state.
 * Note: Foundation stub. Not yet fully implemented.
 */

export interface EmployeeProfile {
  id: string;
  companyId: string;
  name: string;
  role: string;
  systemInstructions: string;
  isActive: boolean;
  activePolicyVersionId: string;
}

export interface EmployeeService {
  getEmployee(employeeId: string): Promise<EmployeeProfile>;
  updateInstructions(employeeId: string, instructions: string): Promise<void>;
}

export const employeeModule = {
  name: 'employee',
  status: 'foundation_stub',
  description: 'AI Employee configuration and persona boundary'
};
