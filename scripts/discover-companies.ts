/**
 * Discover companies on Greenhouse, Ashby, and Lever by probing their public APIs.
 *
 * Usage: pnpm exec tsx scripts/discover-companies.ts
 *
 * For each slug in the candidate list, we hit the public job board API.
 * If it returns jobs, we insert the company into the DB.
 */
import { prisma } from '@roletrove/db'

const CONCURRENCY = 10
const DELAY_MS = 100 // per-request delay to avoid hammering

interface ProbeResult {
  slug: string
  name: string
  domain: string
  ats_type: 'greenhouse' | 'ashby' | 'lever' | 'smartrecruiters' | 'workable'
  ats_token: string
  job_count: number
}

// ─── ATS Probers ──────────────────────────────────────────────────────────────

async function probeGreenhouse(token: string): Promise<number | null> {
  try {
    const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=false`, {
      headers: { 'User-Agent': 'JobsAgg/1.0 (company-discovery)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json() as { jobs?: unknown[] }
    return data.jobs?.length ?? null
  } catch { return null }
}

async function probeAshby(token: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${token}`, {
      headers: { 'User-Agent': 'JobsAgg/1.0 (company-discovery)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json() as { jobs?: unknown[], jobPostings?: unknown[] }
    const jobs = data.jobs ?? data.jobPostings ?? []
    return Array.isArray(jobs) ? jobs.length : null
  } catch { return null }
}

async function probeLever(token: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.lever.co/v0/postings/${token}?mode=json&limit=1`, {
      headers: { 'User-Agent': 'JobsAgg/1.0 (company-discovery)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json() as unknown[]
    return Array.isArray(data) ? data.length : null
  } catch { return null }
}

async function probeSmartRecruiters(token: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(token)}/postings?limit=1&offset=0`,
      {
        headers: { 'User-Agent': 'JobsAgg/1.0 (company-discovery)', Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      },
    )
    if (!res.ok) return null
    const data = await res.json() as { totalFound?: number; content?: unknown[] }
    return data.totalFound ?? data.content?.length ?? null
  } catch { return null }
}

async function probeWorkable(token: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://apply.workable.com/api/v3/accounts/${encodeURIComponent(token)}/jobs`,
      {
        method: 'POST',
        headers: {
          'User-Agent': 'JobsAgg/1.0 (company-discovery)',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query: '', location: [], department: [], remote: [] }),
        signal: AbortSignal.timeout(8000),
      },
    )
    if (!res.ok) return null
    const data = await res.json() as { total?: number; results?: unknown[] }
    return data.total ?? data.results?.length ?? null
  } catch { return null }
}

// ─── Candidate List ───────────────────────────────────────────────────────────
// Format: [display_name, domain, ...slug_variants_to_try]
// We try each slug variant against all 3 ATS platforms.

const CANDIDATES: Array<[string, string, ...string[]]> = [
  // ─── Big Tech / FAANG-adjacent ─────────────────────────────────────────
  ['Cloudflare', 'cloudflare.com', 'cloudflare'],
  ['Palantir', 'palantir.com', 'palantir', 'palantirtechnologies'],
  ['Snowflake', 'snowflake.com', 'snowflake', 'snowflakecomputing'],
  ['CrowdStrike', 'crowdstrike.com', 'crowdstrike'],
  ['Palo Alto Networks', 'paloaltonetworks.com', 'paloaltonetworks'],
  ['Okta', 'okta.com', 'okta'],
  ['Twilio', 'twilio.com', 'twilio'],
  ['Block', 'block.xyz', 'block', 'squareup', 'square'],
  ['Snap', 'snap.com', 'snap'],
  ['Pinterest', 'pinterest.com', 'pinterest'],
  ['Lyft', 'lyft.com', 'lyft'],
  ['DoorDash', 'doordash.com', 'doordash'],
  ['Instacart', 'instacart.com', 'instacart'],
  ['Uber', 'uber.com', 'uber'],
  ['Coinbase', 'coinbase.com', 'coinbase'],
  ['Ripple', 'ripple.com', 'ripple'],
  ['Kraken', 'kraken.com', 'kraken', 'krakendigitalasset'],
  ['Roblox', 'roblox.com', 'roblox'],
  ['Unity', 'unity.com', 'unity', 'unity3d'],
  ['Epic Games', 'epicgames.com', 'epicgames'],
  ['Spotify', 'spotify.com', 'spotify'],
  ['Netflix', 'netflix.com', 'netflix'],
  ['Dropbox', 'dropbox.com', 'dropbox'],
  ['Zoom', 'zoom.us', 'zoom', 'zoomvideocommunications'],
  ['Slack', 'slack.com', 'slack'],
  ['Atlassian', 'atlassian.com', 'atlassian'],
  ['Splunk', 'splunk.com', 'splunk'],
  ['ServiceNow', 'servicenow.com', 'servicenow'],
  ['Zscaler', 'zscaler.com', 'zscaler'],
  ['Fortinet', 'fortinet.com', 'fortinet'],
  ['DocuSign', 'docusign.com', 'docusign'],
  ['HubSpot', 'hubspot.com', 'hubspot'],
  ['Zendesk', 'zendesk.com', 'zendesk'],
  ['Asana', 'asana.com', 'asana'],
  ['Monday.com', 'monday.com', 'mondaycom', 'monday'],
  ['Canva', 'canva.com', 'canva'],
  ['Figma', 'figma.com', 'figma'],
  ['Miro', 'miro.com', 'miro'],
  ['Notion', 'notion.so', 'notion'],
  ['Coda', 'coda.io', 'coda', 'codainc'],
  ['Airtable', 'airtable.com', 'airtable'],
  ['Webflow', 'webflow.com', 'webflow'],
  ['Squarespace', 'squarespace.com', 'squarespace'],
  ['Wix', 'wix.com', 'wix'],
  ['Vercel', 'vercel.com', 'vercel'],
  ['Netlify', 'netlify.com', 'netlify'],
  ['DigitalOcean', 'digitalocean.com', 'digitalocean'],
  ['Linode', 'linode.com', 'linode'],
  ['Render', 'render.com', 'render'],
  ['Railway', 'railway.app', 'railway'],
  ['Fly.io', 'fly.io', 'fly', 'flyio'],

  // ─── AI / ML ───────────────────────────────────────────────────────────
  ['OpenAI', 'openai.com', 'openai'],
  ['Anthropic', 'anthropic.com', 'anthropic'],
  ['Google DeepMind', 'deepmind.google', 'deepmind'],
  ['Cohere', 'cohere.com', 'cohere'],
  ['Mistral AI', 'mistral.ai', 'mistralai', 'mistral'],
  ['Stability AI', 'stability.ai', 'stabilityai', 'stability'],
  ['Hugging Face', 'huggingface.co', 'huggingface'],
  ['Weights & Biases', 'wandb.ai', 'wandb', 'weightsandbiases'],
  ['Scale AI', 'scale.com', 'scaleai'],
  ['Labelbox', 'labelbox.com', 'labelbox'],
  ['Runway', 'runwayml.com', 'runwayml', 'runway'],
  ['Midjourney', 'midjourney.com', 'midjourney'],
  ['Perplexity', 'perplexity.ai', 'perplexityai', 'perplexity'],
  ['Character.AI', 'character.ai', 'characterai', 'character'],
  ['Inflection AI', 'inflection.ai', 'inflectionai', 'inflection'],
  ['Adept AI', 'adept.ai', 'adeptai', 'adept'],
  ['Together AI', 'together.ai', 'togetherai', 'together'],
  ['Anyscale', 'anyscale.com', 'anyscale'],
  ['Modal', 'modal.com', 'modal'],
  ['Replicate', 'replicate.com', 'replicate'],
  ['Fireworks AI', 'fireworks.ai', 'fireworksai', 'fireworks'],
  ['Groq', 'groq.com', 'groq'],
  ['Cerebras', 'cerebras.net', 'cerebras'],
  ['SambaNova', 'sambanova.ai', 'sambanova'],
  ['AI21 Labs', 'ai21.com', 'ai21', 'ai21labs'],
  ['Aleph Alpha', 'aleph-alpha.com', 'alephalpha'],
  ['Jasper', 'jasper.ai', 'jasper', 'jasperai'],
  ['Writer', 'writer.com', 'writer', 'writerai'],
  ['Copy.ai', 'copy.ai', 'copyai'],
  ['Glean', 'glean.com', 'glean'],
  ['Harvey', 'harvey.ai', 'harveyai', 'harvey'],
  ['EvenUp', 'evenuplaw.com', 'evenup', 'evenuplaw'],

  // ─── Fintech ───────────────────────────────────────────────────────────
  ['Stripe', 'stripe.com', 'stripe'],
  ['Plaid', 'plaid.com', 'plaid'],
  ['Brex', 'brex.com', 'brex'],
  ['Ramp', 'ramp.com', 'ramp'],
  ['Mercury', 'mercury.com', 'mercury'],
  ['Chime', 'chime.com', 'chime'],
  ['Robinhood', 'robinhood.com', 'robinhood'],
  ['Gusto', 'gusto.com', 'gusto'],
  ['Affirm', 'affirm.com', 'affirm'],
  ['Marqeta', 'marqeta.com', 'marqeta'],
  ['Toast', 'toasttab.com', 'toast', 'toasttab'],
  ['Bill.com', 'bill.com', 'bill', 'billcom'],
  ['Navan', 'navan.com', 'navan', 'tripactions'],
  ['Carta', 'carta.com', 'carta'],
  ['AngelList', 'angellist.com', 'angellist'],
  ['Deel', 'deel.com', 'deel'],
  ['Remote', 'remote.com', 'remote', 'remotecom'],
  ['Wise', 'wise.com', 'wise', 'transferwise'],
  ['Revolut', 'revolut.com', 'revolut'],
  ['N26', 'n26.com', 'n26'],
  ['Monzo', 'monzo.com', 'monzo'],
  ['Nubank', 'nubank.com.br', 'nubank'],

  // ─── DevTools / Infra ──────────────────────────────────────────────────
  ['GitHub', 'github.com', 'github'],
  ['GitLab', 'gitlab.com', 'gitlab'],
  ['Hashicorp', 'hashicorp.com', 'hashicorp'],
  ['Datadog', 'datadoghq.com', 'datadog'],
  ['PagerDuty', 'pagerduty.com', 'pagerduty'],
  ['New Relic', 'newrelic.com', 'newrelic'],
  ['Grafana Labs', 'grafana.com', 'grafanalabs'],
  ['Sentry', 'sentry.io', 'sentry'],
  ['LaunchDarkly', 'launchdarkly.com', 'launchdarkly'],
  ['CircleCI', 'circleci.com', 'circleci'],
  ['Buildkite', 'buildkite.com', 'buildkite'],
  ['Pulumi', 'pulumi.com', 'pulumi'],
  ['Snyk', 'snyk.com', 'snyk'],
  ['Sonar', 'sonarsource.com', 'sonarsource', 'sonar'],
  ['JFrog', 'jfrog.com', 'jfrog'],
  ['Kong', 'konghq.com', 'konghq', 'kong'],
  ['Hasura', 'hasura.io', 'hasura'],
  ['Prisma', 'prisma.io', 'prisma', 'prismaio'],
  ['Supabase', 'supabase.com', 'supabase'],
  ['PlanetScale', 'planetscale.com', 'planetscale'],
  ['Neon', 'neon.tech', 'neon', 'neondatabase'],
  ['CockroachDB', 'cockroachlabs.com', 'cockroachlabs', 'cockroachdb'],
  ['Timescale', 'timescale.com', 'timescale'],
  ['ClickHouse', 'clickhouse.com', 'clickhouse'],
  ['StarTree', 'startree.ai', 'startree'],
  ['Confluent', 'confluent.io', 'confluent'],
  ['Redpanda', 'redpanda.com', 'redpanda', 'redpandadata'],
  ['Temporal', 'temporal.io', 'temporal'],
  ['Inngest', 'inngest.com', 'inngest'],
  ['Resend', 'resend.com', 'resend'],
  ['Postman', 'postman.com', 'postman'],
  ['Insomnia', 'insomnia.rest', 'insomnia'],
  ['Retool', 'retool.com', 'retool'],
  ['Appsmith', 'appsmith.com', 'appsmith'],
  ['Airplane', 'airplane.dev', 'airplane'],
  ['Sourcegraph', 'sourcegraph.com', 'sourcegraph'],
  ['Replit', 'replit.com', 'replit'],
  ['Gitpod', 'gitpod.io', 'gitpod'],
  ['CodeSandbox', 'codesandbox.io', 'codesandbox'],
  ['Nx', 'nx.dev', 'nrwl', 'nx'],
  ['Turborepo', 'turbo.build', 'turborepo'],
  ['Storybook', 'storybook.js.org', 'storybook', 'chromatic'],
  ['Chromatic', 'chromatic.com', 'chromatic'],
  ['PostHog', 'posthog.com', 'posthog'],
  ['Amplitude', 'amplitude.com', 'amplitude'],
  ['Mixpanel', 'mixpanel.com', 'mixpanel'],
  ['Segment', 'segment.com', 'segment'],
  ['dbt Labs', 'getdbt.com', 'dbtlabs', 'dbt'],
  ['Fivetran', 'fivetran.com', 'fivetran'],
  ['Airbyte', 'airbyte.com', 'airbyte'],
  ['Prefect', 'prefect.io', 'prefect'],
  ['Dagster', 'dagster.io', 'dagster', 'dagsterio', 'elementl'],

  // ─── Cybersecurity ─────────────────────────────────────────────────────
  ['Wiz', 'wiz.io', 'wiz', 'wizinc'],
  ['Lacework', 'lacework.com', 'lacework'],
  ['Orca Security', 'orca.security', 'orcasecurity', 'orca'],
  ['Aqua Security', 'aquasec.com', 'aquasecurity', 'aquasec'],
  ['Chainguard', 'chainguard.dev', 'chainguard'],
  ['Tailscale', 'tailscale.com', 'tailscale'],
  ['Teleport', 'goteleport.com', 'teleport', 'goteleport'],
  ['Vanta', 'vanta.com', 'vanta'],
  ['Drata', 'drata.com', 'drata'],
  ['1Password', '1password.com', '1password', 'onepassword'],
  ['Bitwarden', 'bitwarden.com', 'bitwarden'],

  // ─── Data / Analytics ──────────────────────────────────────────────────
  ['Databricks', 'databricks.com', 'databricks'],
  ['Snowflake', 'snowflake.com', 'snowflake', 'snowflakecomputing'],
  ['Elastic', 'elastic.co', 'elastic'],
  ['MongoDB', 'mongodb.com', 'mongodb'],
  ['Redis', 'redis.com', 'redis', 'redislabs'],
  ['SingleStore', 'singlestore.com', 'singlestore', 'memsql'],
  ['Materialize', 'materialize.com', 'materialize'],
  ['Starburst', 'starburst.io', 'starburst', 'starburstdata'],
  ['ThoughtSpot', 'thoughtspot.com', 'thoughtspot'],
  ['Hex', 'hex.tech', 'hex', 'hextech'],
  ['Observable', 'observablehq.com', 'observable', 'observablehq'],
  ['Mode', 'mode.com', 'mode'],
  ['Census', 'getcensus.com', 'census', 'getcensus'],
  ['Hightouch', 'hightouch.com', 'hightouch', 'hightouchdata'],
  ['RudderStack', 'rudderstack.com', 'rudderstack'],

  // ─── SaaS / Enterprise ────────────────────────────────────────────────
  ['Notion', 'notion.so', 'notion'],
  ['Linear', 'linear.app', 'linear'],
  ['Height', 'height.app', 'height'],
  ['Shortcut', 'shortcut.com', 'shortcut', 'clubhouse'],
  ['Loom', 'loom.com', 'loom'],
  ['Descript', 'descript.com', 'descript'],
  ['Calendly', 'calendly.com', 'calendly'],
  ['Lattice', 'lattice.com', 'lattice', 'latticehq'],
  ['Rippling', 'rippling.com', 'rippling'],
  ['Justworks', 'justworks.com', 'justworks'],
  ['Gem', 'gem.com', 'gem'],
  ['Lever', 'lever.co', 'lever'],
  ['Greenhouse', 'greenhouse.io', 'greenhouse'],
  ['Ashby', 'ashbyhq.com', 'ashby', 'ashbyhq'],
  ['Ironclad', 'ironcladapp.com', 'ironclad', 'ironcladapp'],
  ['Vanta', 'vanta.com', 'vanta'],
  ['Launchdarkly', 'launchdarkly.com', 'launchdarkly'],
  ['Contentful', 'contentful.com', 'contentful'],
  ['Sanity', 'sanity.io', 'sanity', 'sanityio'],
  ['Storyblok', 'storyblok.com', 'storyblok'],
  ['Algolia', 'algolia.com', 'algolia'],
  ['Typesense', 'typesense.org', 'typesense'],
  ['Meilisearch', 'meilisearch.com', 'meilisearch'],
  ['Auth0', 'auth0.com', 'auth0'],
  ['Clerk', 'clerk.com', 'clerk', 'clerkdev'],
  ['Stytch', 'stytch.com', 'stytch'],
  ['WorkOS', 'workos.com', 'workos'],
  ['Pangea', 'pangea.cloud', 'pangea', 'pangeacyber'],

  // ─── More YC / notable startups ────────────────────────────────────────
  ['Cal.com', 'cal.com', 'calcom'],
  ['Trigger.dev', 'trigger.dev', 'triggerdev'],
  ['Resend', 'resend.com', 'resend'],
  ['Loops', 'loops.so', 'loops'],
  ['Dub', 'dub.co', 'dub', 'dubco'],
  ['Tinybird', 'tinybird.co', 'tinybird'],
  ['Upstash', 'upstash.com', 'upstash'],
  ['Axiom', 'axiom.co', 'axiom'],
  ['BetterStack', 'betterstack.com', 'betterstack'],
  ['Depot', 'depot.dev', 'depot'],
  ['Pylon', 'usepylon.com', 'pylon', 'usepylon'],
  ['Frigade', 'frigade.com', 'frigade'],
  ['Polar', 'polar.sh', 'polar'],
  ['Mintlify', 'mintlify.com', 'mintlify'],
  ['ReadMe', 'readme.com', 'readme'],
  ['Swimm', 'swimm.io', 'swimm'],
  ['Zephyr', 'zephyrcloud.io', 'zephyr', 'zephyrcloud'],
  ['Convex', 'convex.dev', 'convex'],
  ['Turso', 'turso.tech', 'turso'],
  ['EdgeDB', 'edgedb.com', 'edgedb'],
  ['SurrealDB', 'surrealdb.com', 'surrealdb'],
  ['Tigris Data', 'tigrisdata.com', 'tigrisdata', 'tigris'],
  ['Buf', 'buf.build', 'buf'],
  ['Zed', 'zed.dev', 'zed', 'zedindustries'],
  ['Warp', 'warp.dev', 'warp', 'warpdotdev'],
  ['Fig', 'fig.io', 'fig', 'withfig'],
  ['Raycast', 'raycast.com', 'raycast'],
  ['Tauri', 'tauri.app', 'tauri', 'tauriapps'],
  ['Expo', 'expo.dev', 'expo', 'exponent'],
  ['Ionic', 'ionic.io', 'ionic', 'ionicframework'],
  ['Capacitor', 'capacitorjs.com', 'capacitor'],
  ['Deno', 'deno.com', 'deno', 'denoland'],
  ['Bun', 'bun.sh', 'oven', 'ovensh'],
  ['Socket', 'socket.dev', 'socket', 'socketdev'],
  ['Biome', 'biomejs.dev', 'biome'],
  ['Rome', 'rome.tools', 'rome', 'rometools'],

  // ─── E-commerce / Marketplace ──────────────────────────────────────────
  ['Shopify', 'shopify.com', 'shopify'],
  ['BigCommerce', 'bigcommerce.com', 'bigcommerce'],
  ['Faire', 'faire.com', 'faire'],
  ['Whatnot', 'whatnot.com', 'whatnot'],
  ['StockX', 'stockx.com', 'stockx'],
  ['Poshmark', 'poshmark.com', 'poshmark'],
  ['Mercari', 'mercari.com', 'mercari'],
  ['Goat', 'goat.com', 'goat', 'goatgroup'],

  // ─── Health tech ───────────────────────────────────────────────────────
  ['Oscar Health', 'hioscar.com', 'oscar', 'oscarhealth', 'hioscar'],
  ['Color Health', 'color.com', 'color', 'colorhealth'],
  ['Ro', 'ro.co', 'ro', 'rohealth'],
  ['Hims & Hers', 'forhims.com', 'hims', 'forhims'],
  ['Cerebral', 'cerebral.com', 'cerebral'],
  ['Spring Health', 'springhealth.com', 'springhealth'],
  ['Headway', 'headway.co', 'headway'],
  ['Devoted Health', 'devoted.com', 'devoted', 'devotedhealth'],
  ['Noom', 'noom.com', 'noom'],
  ['Tempus', 'tempus.com', 'tempus'],
  ['Flatiron Health', 'flatiron.com', 'flatiron', 'flatironhealth'],
  ['Veracyte', 'veracyte.com', 'veracyte'],

  // ─── Proptech / Real estate ────────────────────────────────────────────
  ['Zillow', 'zillow.com', 'zillow', 'zillowgroup'],
  ['Redfin', 'redfin.com', 'redfin'],
  ['Opendoor', 'opendoor.com', 'opendoor'],
  ['Compass', 'compass.com', 'compass', 'urbancompass'],

  // ─── More notable companies ────────────────────────────────────────────
  ['Grammarly', 'grammarly.com', 'grammarly'],
  ['Duolingo', 'duolingo.com', 'duolingo'],
  ['Khan Academy', 'khanacademy.org', 'khanacademy'],
  ['Coursera', 'coursera.com', 'coursera'],
  ['Reddit', 'reddit.com', 'reddit'],
  ['Discord', 'discord.com', 'discord'],
  ['Twitch', 'twitch.tv', 'twitch'],
  ['Substack', 'substack.com', 'substack'],
  ['Medium', 'medium.com', 'medium'],
  ['Ghost', 'ghost.org', 'ghost'],
  ['WordPress VIP', 'wpvip.com', 'wpvip', 'automattic'],
  ['Automattic', 'automattic.com', 'automattic'],
  ['Wikimedia', 'wikimediafoundation.org', 'wikimedia', 'wikimediafoundation'],
  ['Mozilla', 'mozilla.org', 'mozilla'],
  ['Brave', 'brave.com', 'brave'],
  ['Vivaldi', 'vivaldi.com', 'vivaldi'],
  ['Signal', 'signal.org', 'signal', 'signalapp'],
  ['Proton', 'proton.me', 'proton', 'protonmail'],
  ['1Password', '1password.com', '1password'],
  ['Anduril', 'anduril.com', 'anduril'],
  ['Shield AI', 'shield.ai', 'shieldai'],
  ['SpaceX', 'spacex.com', 'spacex'],
  ['Relativity Space', 'relativityspace.com', 'relativityspace'],
  ['Astra', 'astra.com', 'astra'],
  ['Planet', 'planet.com', 'planet', 'planetlabs'],
  ['Waymo', 'waymo.com', 'waymo'],
  ['Cruise', 'getcruise.com', 'cruise', 'getcruise'],
  ['Aurora', 'aurora.tech', 'aurora', 'auroratech'],
  ['Nuro', 'nuro.ai', 'nuro'],
  ['Zipline', 'flyzipline.com', 'zipline', 'flyzipline'],
  ['Joby Aviation', 'jobyaviation.com', 'joby', 'jobyaviation'],
  ['Rivian', 'rivian.com', 'rivian'],
  ['Lucid Motors', 'lucidmotors.com', 'lucid', 'lucidmotors'],
  ['Tesla', 'tesla.com', 'tesla'],
  ['Rad AI', 'radai.com', 'radai'],
  ['Verkada', 'verkada.com', 'verkada'],
  ['Samsara', 'samsara.com', 'samsara'],
  ['Applied Intuition', 'appliedintuition.com', 'appliedintuition'],

  // ─── More dev-focused ─────────────────────────────────────────────────
  ['Vercel', 'vercel.com', 'vercel'],
  ['Cursor', 'cursor.com', 'cursor', 'anysphere'],
  ['Codeium', 'codeium.com', 'codeium', 'exafunction'],
  ['Tabnine', 'tabnine.com', 'tabnine'],
  ['Codacy', 'codacy.com', 'codacy'],
  ['DeepSource', 'deepsource.com', 'deepsource'],
  ['Semgrep', 'semgrep.dev', 'semgrep', 'returntocorp', 'r2c'],
  ['Trunk', 'trunk.io', 'trunk', 'trunkio'],
  ['Earthly', 'earthly.dev', 'earthly'],
  ['Dagger', 'dagger.io', 'dagger'],
  ['Garden', 'garden.io', 'garden'],
  ['Spacelift', 'spacelift.io', 'spacelift'],
  ['env0', 'env0.com', 'env0'],
  ['Terraform', 'terraform.io', 'terraform'],
  ['Argo', 'argoproj.github.io', 'argo', 'argoproj', 'akuity'],
  ['Codefresh', 'codefresh.io', 'codefresh'],
  ['Harness', 'harness.io', 'harness'],
  ['Octopus Deploy', 'octopus.com', 'octopus', 'octopusdeploy'],
  ['Buildkite', 'buildkite.com', 'buildkite'],
  ['Depot', 'depot.dev', 'depot'],
  ['WunderGraph', 'wundergraph.com', 'wundergraph'],
  ['Hasura', 'hasura.io', 'hasura'],
  ['Fauna', 'fauna.com', 'fauna'],
  ['Xata', 'xata.io', 'xata'],
  ['Liveblocks', 'liveblocks.io', 'liveblocks'],
  ['PartyKit', 'partykit.io', 'partykit'],
  ['Ably', 'ably.com', 'ably'],
  ['Pusher', 'pusher.com', 'pusher'],
  ['Stream', 'getstream.io', 'stream', 'getstream'],
  ['SendGrid', 'sendgrid.com', 'sendgrid'],
  ['Twilio', 'twilio.com', 'twilio'],
  ['Vonage', 'vonage.com', 'vonage'],
  ['Agora', 'agora.io', 'agora'],
  ['Mux', 'mux.com', 'mux'],
  ['Cloudinary', 'cloudinary.com', 'cloudinary'],
  ['Imgix', 'imgix.com', 'imgix'],
  ['Uploadcare', 'uploadcare.com', 'uploadcare'],
  ['Transloadit', 'transloadit.com', 'transloadit'],

  // ─── SmartRecruiters-first companies (slugs confirmed via SR API) ─────────
  // These companies are known to use SmartRecruiters — slug format is PascalCase
  ['Bosch', 'bosch.com', 'BoschGroup', 'Bosch'],
  ['IKEA', 'ikea.com', 'IKEAGroup', 'IKEA'],
  ['McDonald\'s', 'mcdonalds.com', 'McDonalds', 'McDonaldsGlobal'],
  ['Volkswagen', 'volkswagen.com', 'VolkswagenGroup', 'Volkswagen'],
  ['BMW', 'bmw.com', 'BMWGroup', 'BMW'],
  ['Siemens', 'siemens.com', 'SiemensAG', 'Siemens'],
  ['Bayer', 'bayer.com', 'BayerAG', 'Bayer'],
  ['BASF', 'basf.com', 'BASF'],
  ['Deutsche Telekom', 'telekom.com', 'DeutscheTelekom', 'DeutscheTelekomAG'],
  ['SAP', 'sap.com', 'SAP'],
  ['Adidas', 'adidas.com', 'Adidas', 'AdidasGroup'],
  ['Puma', 'puma.com', 'Puma', 'PumaSE'],
  ['HelloFresh', 'hellofresh.com', 'HelloFresh'],
  ['Delivery Hero', 'deliveryhero.com', 'DeliveryHero', 'Delivery-Hero'],
  ['Zalando', 'zalando.com', 'Zalando', 'ZalandoSE'],
  ['Klarna', 'klarna.com', 'Klarna', 'KlarnaBank'],
  ['Spotify', 'spotify.com', 'Spotify', 'SpotifyAB'],
  ['King', 'king.com', 'KingDigitalEntertainment', 'King'],
  ['Playtika', 'playtika.com', 'Playtika'],
  ['Zynga', 'zynga.com', 'Zynga'],
  ['Wolt', 'wolt.com', 'Wolt'],
  ['Glovo', 'glovoapp.com', 'Glovo'],
  ['Cabify', 'cabify.com', 'Cabify'],
  ['GetYourGuide', 'getyourguide.com', 'GetYourGuide'],
  ['Personio', 'personio.com', 'Personio'],
  ['SumUp', 'sumup.com', 'SumUp'],
  ['N26', 'n26.com', 'N26'],
  ['Wise', 'wise.com', 'Wise', 'TransferWise'],
  ['Mambu', 'mambu.com', 'Mambu'],
  ['Trade Republic', 'traderepublic.com', 'TradeRepublic'],
  ['Celonis', 'celonis.com', 'Celonis'],
  ['UiPath', 'uipath.com', 'UiPath'],
  ['OutSystems', 'outsystems.com', 'OutSystems'],
  ['Criteo', 'criteo.com', 'Criteo'],
  ['BlaBlaCar', 'blablacar.com', 'BlaBlaCar'],
  ['Doctolib', 'doctolib.fr', 'Doctolib'],
  ['Alan', 'alan.com', 'AlanInsurance', 'Alan'],
  ['Contentsquare', 'contentsquare.com', 'Contentsquare'],
  ['Mirakl', 'mirakl.com', 'Mirakl'],
  ['Datadog', 'datadoghq.com', 'Datadog'],
  ['Dynatrace', 'dynatrace.com', 'Dynatrace'],
  ['New Relic', 'newrelic.com', 'NewRelic'],
  ['Elastic', 'elastic.co', 'Elastic'],
  ['Akamai', 'akamai.com', 'Akamai'],
  ['Zendesk', 'zendesk.com', 'Zendesk'],
  ['Sprinklr', 'sprinklr.com', 'Sprinklr'],
  ['Qualtrics', 'qualtrics.com', 'Qualtrics'],
  ['Medallia', 'medallia.com', 'Medallia'],
  ['Veeva Systems', 'veeva.com', 'VeevaSystems', 'Veeva'],
  ['IQVIA', 'iqvia.com', 'IQVIA'],
  ['Philips', 'philips.com', 'PhilipsHealthTech', 'Philips'],
  ['Abbott', 'abbott.com', 'Abbott'],
  ['Medtronic', 'medtronic.com', 'Medtronic'],
  ['BD', 'bd.com', 'BectonDickinson', 'BD'],
  ['Zimmer Biomet', 'zimmerbiomet.com', 'ZimmerBiomet'],
  ['Stryker', 'stryker.com', 'Stryker'],
]

// ─── Main ─────────────────────────────────────────────────────────────────────

async function probeCandidate(
  name: string,
  domain: string,
  slugs: string[],
): Promise<ProbeResult | null> {
  for (const slug of slugs) {
    // Try all 5 ATS platforms for each slug in parallel
    const [gh, ash, lev, sr, wk] = await Promise.all([
      probeGreenhouse(slug),
      probeAshby(slug),
      probeLever(slug),
      probeSmartRecruiters(slug),
      probeWorkable(slug),
    ])

    if (gh !== null && gh > 0) {
      return { slug, name, domain, ats_type: 'greenhouse', ats_token: slug, job_count: gh }
    }
    if (ash !== null && ash > 0) {
      return { slug, name, domain, ats_type: 'ashby', ats_token: slug, job_count: ash }
    }
    if (lev !== null && lev > 0) {
      return { slug, name, domain, ats_type: 'lever', ats_token: slug, job_count: lev }
    }
    if (sr !== null && sr > 0) {
      return { slug, name, domain, ats_type: 'smartrecruiters', ats_token: slug, job_count: sr }
    }
    if (wk !== null && wk > 0) {
      return { slug, name, domain, ats_type: 'workable', ats_token: slug, job_count: wk }
    }
  }
  return null
}

async function runBatch<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  let idx = 0

  async function worker() {
    while (idx < items.length) {
      const i = idx++
      results[i] = await fn(items[i])
      await new Promise((r) => setTimeout(r, DELAY_MS))
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  return results
}

async function main() {
  // Deduplicate candidates by first slug
  const seen = new Set<string>()
  const unique = CANDIDATES.filter(([, , slug]) => {
    if (seen.has(slug)) return false
    seen.add(slug)
    return true
  })

  console.log(`Probing ${unique.length} companies across Greenhouse, Ashby, Lever, SmartRecruiters, and Workable...\n`)

  const existing = await prisma.company.findMany({ select: { ats_token: true, ats_type: true } })
  const existingKeys = new Set(existing.map((c) => `${c.ats_type}:${c.ats_token}`))

  let discovered = 0
  let alreadyTracked = 0
  let inserted = 0

  const results = await runBatch(unique, CONCURRENCY, async ([name, domain, ...slugs]) => {
    const result = await probeCandidate(name, domain, slugs)
    if (result) {
      discovered++
      const key = `${result.ats_type}:${result.ats_token}`
      if (existingKeys.has(key)) {
        alreadyTracked++
        process.stdout.write(`  ✓ ${result.name} (${result.ats_type}, ${result.job_count} jobs) — already tracked\n`)
      } else {
        // Insert into DB
        try {
          await prisma.company.upsert({
            where: { slug: result.slug },
            update: {
              ats_type: result.ats_type,
              ats_token: result.ats_token,
              domain: result.domain,
            },
            create: {
              slug: result.slug,
              name: result.name,
              domain: result.domain,
              ats_type: result.ats_type,
              ats_token: result.ats_token,
            },
          })
          inserted++
          existingKeys.add(key)
          process.stdout.write(`  + ${result.name} (${result.ats_type}, ${result.job_count} jobs) — ADDED\n`)
        } catch (err) {
          process.stdout.write(`  ✗ ${result.name} — insert failed: ${err}\n`)
        }
      }
    }
    return result
  })

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Probed:          ${unique.length}
  Discovered:      ${discovered}
  Already tracked: ${alreadyTracked}
  Newly added:     ${inserted}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
