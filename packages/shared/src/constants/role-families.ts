import type { RoleFamily } from '../types'

// Maps role family → keywords found in job titles.
// Evaluated in order; first match wins.
export const ROLE_FAMILY_RULES: Array<{
  family: RoleFamily
  patterns: RegExp[]
}> = [
  {
    family: 'ml_engineer',
    patterns: [
      /\b(machine\s*learning|ml\s*engineer|ai\s*engineer|deep\s*learning|nlp|llm|generative\s*ai|applied\s*(scientist|ml|ai))\b/i,
    ],
  },
  {
    family: 'data_engineer',
    patterns: [
      /\b(data\s*engineer|analytics\s*engineer|data\s*platform|data\s*infra|etl|elt|data\s*pipeline)\b/i,
    ],
  },
  {
    family: 'devops',
    patterns: [
      /\b(devops|site\s*reliability|sre|platform\s*engineer|infrastructure|cloud\s*engineer|reliability|devsecops)\b/i,
    ],
  },
  {
    family: 'security',
    patterns: [
      /\b(security\s*engineer|appsec|product\s*security|pentest|penetration|security\s*researcher|trust\s*(and|&)\s*safety)\b/i,
    ],
  },
  {
    family: 'mobile',
    patterns: [
      /\b(ios|android|mobile|react\s*native|flutter)\b/i,
    ],
  },
  {
    family: 'frontend',
    patterns: [
      /\b(front[\s-]?end|frontend|ui\s*engineer|web\s*engineer)\b/i,
    ],
  },
  {
    family: 'backend',
    patterns: [
      /\b(back[\s-]?end|backend|api\s*engineer|server[\s-]?side)\b/i,
    ],
  },
  {
    family: 'fullstack',
    patterns: [
      /\b(full[\s-]?stack)\b/i,
    ],
  },
  {
    family: 'product_manager',
    patterns: [
      /\b(product\s*manager|product\s*management|pm\b|technical\s*product)\b/i,
    ],
  },
  {
    family: 'designer',
    patterns: [
      /\b(product\s*designer|ux|ui\/ux|design\s*engineer|visual\s*designer)\b/i,
    ],
  },
  {
    family: 'software_engineer',
    patterns: [
      /\b(software\s*engineer|software\s*developer|swe|sde|programmer)\b/i,
    ],
  },
]
