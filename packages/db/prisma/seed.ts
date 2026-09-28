import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const companies = [
  // ─── Greenhouse ──────────────────────────────────────────────────────────
  { slug: 'stripe',        name: 'Stripe',        domain: 'stripe.com',         ats_type: 'greenhouse' as const, ats_token: 'stripe' },
  { slug: 'airbnb',        name: 'Airbnb',        domain: 'airbnb.com',         ats_type: 'greenhouse' as const, ats_token: 'airbnb' },
  { slug: 'databricks',    name: 'Databricks',    domain: 'databricks.com',     ats_type: 'greenhouse' as const, ats_token: 'databricks' },
  { slug: 'shopify',       name: 'Shopify',       domain: 'shopify.com',        ats_type: 'greenhouse' as const, ats_token: 'shopify' },
  { slug: 'figma',         name: 'Figma',         domain: 'figma.com',          ats_type: 'greenhouse' as const, ats_token: 'figma' },
  { slug: 'notion',        name: 'Notion',        domain: 'notion.so',          ats_type: 'greenhouse' as const, ats_token: 'notion' },
  { slug: 'discord',       name: 'Discord',       domain: 'discord.com',        ats_type: 'greenhouse' as const, ats_token: 'discord' },
  { slug: 'reddit',        name: 'Reddit',        domain: 'reddit.com',         ats_type: 'greenhouse' as const, ats_token: 'reddit' },
  { slug: 'duolingo',      name: 'Duolingo',      domain: 'duolingo.com',       ats_type: 'greenhouse' as const, ats_token: 'duolingo' },
  { slug: 'airtable',      name: 'Airtable',      domain: 'airtable.com',       ats_type: 'greenhouse' as const, ats_token: 'airtable' },
  { slug: 'plaid',         name: 'Plaid',         domain: 'plaid.com',          ats_type: 'greenhouse' as const, ats_token: 'plaid' },
  { slug: 'brex',          name: 'Brex',          domain: 'brex.com',           ats_type: 'greenhouse' as const, ats_token: 'brex' },
  { slug: 'chime',         name: 'Chime',         domain: 'chime.com',          ats_type: 'greenhouse' as const, ats_token: 'chime' },
  { slug: 'gusto',         name: 'Gusto',         domain: 'gusto.com',          ats_type: 'greenhouse' as const, ats_token: 'gusto' },
  { slug: 'robinhood',     name: 'Robinhood',     domain: 'robinhood.com',      ats_type: 'greenhouse' as const, ats_token: 'robinhood' },
  { slug: 'scale-ai',      name: 'Scale AI',      domain: 'scale.com',          ats_type: 'greenhouse' as const, ats_token: 'scaleai' },
  { slug: 'confluent',     name: 'Confluent',     domain: 'confluent.io',       ats_type: 'greenhouse' as const, ats_token: 'confluent' },
  { slug: 'cockroachdb',   name: 'CockroachDB',   domain: 'cockroachlabs.com',  ats_type: 'greenhouse' as const, ats_token: 'cockroachdb' },
  { slug: 'datadog',       name: 'Datadog',       domain: 'datadoghq.com',      ats_type: 'greenhouse' as const, ats_token: 'datadog' },
  { slug: 'pagerduty',     name: 'PagerDuty',     domain: 'pagerduty.com',      ats_type: 'greenhouse' as const, ats_token: 'pagerduty' },
  { slug: 'twilio',        name: 'Twilio',        domain: 'twilio.com',         ats_type: 'greenhouse' as const, ats_token: 'twilio' },
  { slug: 'segment',       name: 'Segment',       domain: 'segment.com',        ats_type: 'greenhouse' as const, ats_token: 'segment' },
  { slug: 'amplitude',     name: 'Amplitude',     domain: 'amplitude.com',      ats_type: 'greenhouse' as const, ats_token: 'amplitude' },
  { slug: 'mixpanel',      name: 'Mixpanel',      domain: 'mixpanel.com',       ats_type: 'greenhouse' as const, ats_token: 'mixpanel' },
  { slug: 'sentry',        name: 'Sentry',        domain: 'sentry.io',          ats_type: 'greenhouse' as const, ats_token: 'sentry' },
  { slug: 'netlify',       name: 'Netlify',       domain: 'netlify.com',        ats_type: 'greenhouse' as const, ats_token: 'netlify' },
  { slug: 'postman',       name: 'Postman',       domain: 'postman.com',        ats_type: 'greenhouse' as const, ats_token: 'postman' },
  { slug: 'mongodb',       name: 'MongoDB',       domain: 'mongodb.com',        ats_type: 'greenhouse' as const, ats_token: 'mongodb' },
  { slug: 'elastic',       name: 'Elastic',       domain: 'elastic.co',         ats_type: 'greenhouse' as const, ats_token: 'elastic' },
  { slug: 'hashicorp',     name: 'HashiCorp',     domain: 'hashicorp.com',      ats_type: 'greenhouse' as const, ats_token: 'hashicorp' },
  { slug: 'grafana',       name: 'Grafana Labs',  domain: 'grafana.com',        ats_type: 'greenhouse' as const, ats_token: 'grafanalabs' },
  { slug: 'clickhouse',    name: 'ClickHouse',    domain: 'clickhouse.com',     ats_type: 'greenhouse' as const, ats_token: 'clickhouse' },
  { slug: 'temporal',      name: 'Temporal',      domain: 'temporal.io',        ats_type: 'greenhouse' as const, ats_token: 'temporal' },
  { slug: 'supabase',      name: 'Supabase',      domain: 'supabase.com',       ats_type: 'greenhouse' as const, ats_token: 'supabase' },
  { slug: 'sourcegraph',   name: 'Sourcegraph',   domain: 'sourcegraph.com',    ats_type: 'greenhouse' as const, ats_token: 'sourcegraph' },

  // ─── Lever ───────────────────────────────────────────────────────────────
  { slug: 'vercel',        name: 'Vercel',        domain: 'vercel.com',         ats_type: 'lever' as const, ats_token: 'vercel' },
  { slug: 'cursor',        name: 'Cursor',        domain: 'cursor.com',         ats_type: 'lever' as const, ats_token: 'cursor' },
  { slug: 'ramp',          name: 'Ramp',          domain: 'ramp.com',           ats_type: 'lever' as const, ats_token: 'ramp' },
  { slug: 'mercury',       name: 'Mercury',       domain: 'mercury.com',        ats_type: 'lever' as const, ats_token: 'mercury' },
  { slug: 'cohere',        name: 'Cohere',        domain: 'cohere.com',         ats_type: 'lever' as const, ats_token: 'cohere' },
  { slug: 'perplexity',    name: 'Perplexity',    domain: 'perplexity.ai',      ats_type: 'lever' as const, ats_token: 'perplexityai' },
  { slug: 'airbyte',       name: 'Airbyte',       domain: 'airbyte.com',        ats_type: 'lever' as const, ats_token: 'airbyte' },
  { slug: 'substack',      name: 'Substack',      domain: 'substack.com',       ats_type: 'lever' as const, ats_token: 'substack' },
  { slug: 'descript',      name: 'Descript',      domain: 'descript.com',       ats_type: 'lever' as const, ats_token: 'descript' },
  { slug: 'loom',          name: 'Loom',          domain: 'loom.com',           ats_type: 'lever' as const, ats_token: 'loom' },
  { slug: 'netlify-lever', name: 'Netlify',       domain: 'netlify.com',        ats_type: 'lever' as const, ats_token: 'netlify' },
  { slug: 'mux',           name: 'Mux',           domain: 'mux.com',            ats_type: 'lever' as const, ats_token: 'mux' },
  { slug: 'modal',         name: 'Modal',         domain: 'modal.com',          ats_type: 'lever' as const, ats_token: 'modal' },
  { slug: 'fly-io',        name: 'Fly.io',        domain: 'fly.io',             ats_type: 'lever' as const, ats_token: 'fly' },
  { slug: 'replit',        name: 'Replit',        domain: 'replit.com',         ats_type: 'lever' as const, ats_token: 'replit' },
  { slug: 'browserbase',   name: 'Browserbase',   domain: 'browserbase.com',    ats_type: 'lever' as const, ats_token: 'browserbase' },

  // ─── Ashby ───────────────────────────────────────────────────────────────
  { slug: 'linear',        name: 'Linear',        domain: 'linear.app',         ats_type: 'ashby' as const, ats_token: 'linear' },
  { slug: 'retool',        name: 'Retool',        domain: 'retool.com',         ats_type: 'ashby' as const, ats_token: 'retool' },
  { slug: 'dbt-labs',      name: 'dbt Labs',      domain: 'getdbt.com',         ats_type: 'ashby' as const, ats_token: 'dbtlabs' },
  { slug: 'anthropic',     name: 'Anthropic',     domain: 'anthropic.com',      ats_type: 'ashby' as const, ats_token: 'anthropic' },
  { slug: 'openai',        name: 'OpenAI',        domain: 'openai.com',         ats_type: 'ashby' as const, ats_token: 'openai' },
  { slug: 'mistral',       name: 'Mistral AI',    domain: 'mistral.ai',         ats_type: 'ashby' as const, ats_token: 'mistralai' },
  { slug: 'together-ai',   name: 'Together AI',   domain: 'together.ai',        ats_type: 'ashby' as const, ats_token: 'togetherai' },
  { slug: 'anysphere',     name: 'Anysphere',     domain: 'anysphere.inc',      ats_type: 'ashby' as const, ats_token: 'anysphere' },
  { slug: 'posthog',       name: 'PostHog',       domain: 'posthog.com',        ats_type: 'ashby' as const, ats_token: 'posthog' },
  { slug: 'ray',           name: 'Anyscale',      domain: 'anyscale.com',       ats_type: 'ashby' as const, ats_token: 'anyscale' },
  { slug: 'prefect',       name: 'Prefect',       domain: 'prefect.io',         ats_type: 'ashby' as const, ats_token: 'prefect' },
  { slug: 'turso',         name: 'Turso',         domain: 'turso.tech',         ats_type: 'ashby' as const, ats_token: 'turso' },
  { slug: 'inngest',       name: 'Inngest',       domain: 'inngest.com',        ats_type: 'ashby' as const, ats_token: 'inngest' },
  { slug: 'resend',        name: 'Resend',        domain: 'resend.com',         ats_type: 'ashby' as const, ats_token: 'resend' },
  { slug: 'trigger-dev',   name: 'Trigger.dev',   domain: 'trigger.dev',        ats_type: 'ashby' as const, ats_token: 'triggerdev' },
  { slug: 'neon',          name: 'Neon',          domain: 'neon.tech',          ats_type: 'ashby' as const, ats_token: 'neon' },
  { slug: 'planetscale',   name: 'PlanetScale',   domain: 'planetscale.com',    ats_type: 'ashby' as const, ats_token: 'planetscale' },
  { slug: 'grafbase',      name: 'Grafbase',      domain: 'grafbase.com',       ats_type: 'ashby' as const, ats_token: 'grafbase' },
  { slug: 'highlight',     name: 'Highlight',     domain: 'highlight.io',       ats_type: 'ashby' as const, ats_token: 'highlight' },
  { slug: 'cal-com',       name: 'Cal.com',       domain: 'cal.com',            ats_type: 'ashby' as const, ats_token: 'calcom' },
  { slug: 'crowd-dev',     name: 'crowd.dev',     domain: 'crowd.dev',          ats_type: 'ashby' as const, ats_token: 'crowddev' },
  { slug: 'lago',          name: 'Lago',          domain: 'getlago.com',        ats_type: 'ashby' as const, ats_token: 'lago' },
  { slug: 'infisical',     name: 'Infisical',     domain: 'infisical.com',      ats_type: 'ashby' as const, ats_token: 'infisical' },
  { slug: 'windmill',      name: 'Windmill',      domain: 'windmill.dev',       ats_type: 'ashby' as const, ats_token: 'windmill' },
  { slug: 'liveblocks',    name: 'Liveblocks',    domain: 'liveblocks.io',      ats_type: 'ashby' as const, ats_token: 'liveblocks' },
  { slug: 'stytch',        name: 'Stytch',        domain: 'stytch.com',         ats_type: 'ashby' as const, ats_token: 'stytch' },
  { slug: 'descope',       name: 'Descope',       domain: 'descope.com',        ats_type: 'ashby' as const, ats_token: 'descope' },
  { slug: 'propelauth',    name: 'PropelAuth',    domain: 'propelauth.com',     ats_type: 'ashby' as const, ats_token: 'propelauth' },
  { slug: 'apideck',       name: 'Apideck',       domain: 'apideck.com',        ats_type: 'ashby' as const, ats_token: 'apideck' },
  { slug: 'merge-dev',     name: 'Merge',         domain: 'merge.dev',          ats_type: 'ashby' as const, ats_token: 'merge' },

  // ─── Workable ─────────────────────────────────────────────────────────────
  { slug: 'typeform',      name: 'Typeform',      domain: 'typeform.com',       ats_type: 'workable' as const, ats_token: 'typeform' },
  { slug: 'skroutz',       name: 'Skroutz',       domain: 'skroutz.gr',         ats_type: 'workable' as const, ats_token: 'skroutz' },

  // ─── SmartRecruiters ──────────────────────────────────────────────────────
  { slug: 'bosch',         name: 'Bosch',         domain: 'bosch.com',          ats_type: 'smartrecruiters' as const, ats_token: 'BOSCH' },
  { slug: 'ikea',          name: 'IKEA',          domain: 'ikea.com',           ats_type: 'smartrecruiters' as const, ats_token: 'IKEA' },
]

async function main() {
  console.log('🌱 Seeding companies...')

  let created = 0
  let skipped = 0

  for (const company of companies) {
    try {
      await prisma.company.upsert({
        where: { slug: company.slug },
        update: {
          name: company.name,
          domain: company.domain,
          ats_type: company.ats_type,
          ats_token: company.ats_token,
        },
        create: {
          slug: company.slug,
          name: company.name,
          domain: company.domain,
          ats_type: company.ats_type,
          ats_token: company.ats_token,
        },
      })
      created++
    } catch (err) {
      console.warn(`  ⚠ Skipped ${company.slug}:`, err)
      skipped++
    }
  }

  console.log(`✅ Done. Created/updated: ${created}, Skipped: ${skipped}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
