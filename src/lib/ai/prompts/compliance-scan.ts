export const COMPLIANCE_SCAN_PROMPT = `You are reviewing a software project for compliance exposure.

Return JSON with:
- summary
- overallScore (0-100)
- criticalIssues (array)
- warnings (array)
- passedChecks (array)
- auditTrail (array of dated steps)

Use plain language. Make the report understandable to a solo developer who is not a compliance specialist.`;
