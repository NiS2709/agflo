import { useState, useRef, useCallback, useEffect } from "react";

const PHASE_COLORS = {
  sourcing:"#06b6d4",intake:"#e94560",founder:"#6366f1",market:"#10b981",
  product:"#f59e0b",traction:"#0ea5e9",financial:"#ec4899",strategic:"#8b5cf6",
  deal:"#14b8a6",graveyard:"#ef4444",premortem:"#b91c1c",murder:"#ff4444",
  eisenmann:"#dc2626",bullbear:"#d97706",conviction:"#f97316",execution:"#a3e635",
  meeting:"#22d3ee",output:"#e94560",post:"#fb923c",portfolio:"#c084fc",
  exit:"#34d399",meta:"#fbbf24",
};
const PHASE_LABELS = {
  sourcing:"Sourcing",intake:"Intake",founder:"Founder",market:"Market",
  product:"Product",traction:"Traction",financial:"Financial",strategic:"Strategic",
  deal:"Deal & Diligence",graveyard:"Graveyard DB",premortem:"Pre-Mortem",
  murder:"Murder Board",eisenmann:"Eisenmann",bullbear:"Bull / Bear",
  conviction:"Conviction",execution:"Execution",meeting:"Meeting Copilot",
  output:"Output",post:"Post-Investment",portfolio:"Portfolio Mgmt",
  exit:"Exit",meta:"Meta-Learning",
};
const PHASE_ORDER = ["sourcing","intake","founder","market","product","traction","financial","strategic","deal","graveyard","premortem","murder","eisenmann","bullbear","conviction","execution","meeting","output","post","portfolio","exit","meta"];

const ALL_AGENTS = [
  {id:"S1",phase:"sourcing",label:"Thesis Deconstruction",feeds:["S2","S9","S11"],
   objective:"Deconstruct the fund's investment thesis into 5-10 specific, falsifiable hypotheses that become search signals.",
   input:"Fund's internal thesis document (pre-configured once)",
   output:'JSON: { hypotheses: [{ id, statement, keywords[], sector_tags[], falsification_criteria }] }',
   why:"Without a structured thesis, sourcing is random. This agent turns vague investment intent into precise, searchable signals the entire pipeline can act on.",
   inPractice:"A list of 5-10 crisp hypothesis statements like 'Developer-first B2B tools with open-source community will dominate the next enterprise software wave.' Each has keywords and sector tags that trigger downstream scanning agents.",
   limitations:"Only as good as the thesis document it receives. Vague or broad thesis inputs produce vague hypotheses that generate low-signal deal flow.",
   failureModes:"If hypotheses are too broad, S2 and S9 will score nearly every inbound deal highly — flooding the pipeline with noise and degrading prioritisation quality.",
   modelRationale:"T4 (Claude Opus) because transforming a nuanced investment thesis into precise, falsifiable hypotheses requires the deepest reasoning — this is the intellectual foundation of the entire sourcing engine."},

  {id:"S2",phase:"sourcing",label:"Thesis-Driven Scanner",feeds:["S9","S15"],
   objective:"Proactively scan the web and company databases for startups matching the fund's thesis hypotheses.",
   input:"Hypothesis list from S1, web search, company databases, OpenBB",
   output:'JSON: { companies: [{ name, website, hypothesis_match: [{ id, confidence }], source }] }',
   why:"Most great deals are never in your inbound. This agent turns the fund from a passive receiver of pitch decks into an active hunter of thesis-aligned companies.",
   inPractice:"A ranked list of companies with their thesis alignment scores. Each entry shows which hypothesis it matches and how it was discovered — whether through news, job postings, or database scan.",
   limitations:"Limited to publicly available company information. Stealth startups operating under the radar won't appear until they have some public signal.",
   failureModes:"Over-reliance on this agent without human curation can generate a long list of superficial matches that waste analyst time on poor-fit companies.",
   modelRationale:"T3 (Perplexity Sonar Pro) for real-time cited web research — the agent needs to actively discover companies across the live web, not reason from training data."},

  {id:"S3",phase:"sourcing",label:"Hiring Velocity Signal",feeds:["S9"],
   objective:"Identify private companies showing sudden significant increases in hiring velocity as an early breakout momentum signal.",
   input:"LinkedIn Jobs API, company career pages — tracked weekly",
   output:'JSON: { companies: [{ name, hiring_growth_pct, new_roles[], signal_strength: 1-10 }] }',
   why:"Hiring is one of the most reliable leading indicators of company momentum. A company quietly tripling its headcount is almost certainly experiencing something interesting.",
   inPractice:"A weekly digest of companies showing anomalous hiring growth, with the specific roles being hired and a signal strength score. A company suddenly posting 12 senior engineering roles after 3 months of silence is a strong signal.",
   limitations:"LinkedIn data has coverage gaps for early-stage startups that hire primarily through networks rather than job postings. Offshore hiring is often missed entirely.",
   failureModes:"Can generate false positives for companies hiring rapidly due to fundraising rather than revenue growth — needs to be cross-referenced with traction signals.",
   modelRationale:"T2 (Claude Sonnet) — straightforward summarisation and scoring of structured job posting data doesn't require frontier model reasoning."},

  {id:"S4",phase:"sourcing",label:"Product Launch Signal",feeds:["S9"],
   objective:"Detect companies that just launched a new product or major feature aligned with the fund's thesis.",
   input:"Product Hunt API, news APIs, company blog RSS feeds",
   output:'JSON: { launches: [{ company, product_name, launch_date, thesis_alignment_score: 1-10, source_url }] }',
   why:"Product launches are the clearest public signal that a company is building and shipping. Catching them at launch — before the VC crowd notices — is a sourcing edge.",
   inPractice:"A daily or weekly list of notable product launches with thesis alignment scores. A 'Show HN' post that gets 400 upvotes from developers is flagged as a high-signal launch for a developer-tools thesis.",
   limitations:"Covers public launches only. Many B2B products launch quietly to design partners without any public announcement and will be missed entirely.",
   failureModes:"Product Hunt specifically skews towards consumer and prosumer tools. Enterprise and deeptech launches often happen through press releases or analyst briefings that this agent may not catch.",
   modelRationale:"T2 (Claude Sonnet) — pattern matching launches to thesis criteria is a well-defined reasoning task that doesn't require frontier capability."},

  {id:"S5",phase:"sourcing",label:"Funding Announcement Signal",feeds:["S9","S14"],
   objective:"Track companies that just raised a pre-seed or seed round from high-signal investors.",
   input:"News APIs, Crunchbase/PitchBook scraping, investor network data",
   output:'JSON: { funded_companies: [{ name, amount, investors[], round_type, date, source_url }] }',
   why:"A seed round from a top-tier scout or operator angel is one of the strongest quality filters available. This agent surfaces those deals before the Series A competitive process begins.",
   inPractice:"A feed of recently announced seed rounds with investor quality scores. A $1.5M pre-seed backed by a known ex-founder angel in the relevant sector gets flagged at high priority regardless of the company's current traction.",
   limitations:"Many seed rounds are never announced publicly, especially in India and emerging markets. Stealth rounds and network-only fundraises are invisible to this agent.",
   failureModes:"Can create a herd mentality signal — if multiple funds are scanning the same announcements, the agent surfaces deals that are already highly competitive.",
   modelRationale:"T2 (Claude Sonnet) — extracting and scoring funding announcement data is a structured extraction and classification task."},

  {id:"S6",phase:"sourcing",label:"Customer Growth Signal",feeds:["S9"],
   objective:"Identify B2B software companies being mentioned with increasing frequency in job descriptions of other companies — a proxy for organic adoption.",
   input:"Indeed/LinkedIn job postings data — tracked monthly",
   output:'JSON: { trending_tools: [{ name, mention_growth_pct, sample_companies_requiring[], estimated_user_base }] }',
   why:"When 50 companies start requiring experience with a tool in their job postings, that tool has crossed into mainstream adoption. This is a bottoms-up signal that predates analyst reports by 12-18 months.",
   inPractice:"A monthly report showing tools with rising job description mentions. A startup whose tool went from 20 to 180 mentions across job postings in 6 months is a strong signal of genuine product-market fit.",
   limitations:"Only works for tools that require named skill sets in job postings. Infrastructure tools, APIs, and embedded software are largely invisible to this method.",
   failureModes:"Marketing-heavy companies can inflate this metric by sponsoring certifications or running developer advocacy programmes — the signal must be validated against actual traction data.",
   modelRationale:"T3 (Perplexity Sonar Pro) to actively search and aggregate job posting data across multiple platforms in real time."},

  {id:"S7",phase:"sourcing",label:"Academic Breakthrough",feeds:["S9"],
   objective:"Monitor academic publications for technological breakthroughs that could spawn new companies or disrupt existing ones within the fund's thesis domains.",
   input:"arXiv API, Semantic Scholar, Google Scholar",
   output:'JSON: { breakthroughs: [{ paper_title, authors, institution, technology_domain, commercial_opportunity, founding_probability: 1-10 }] }',
   why:"The best deeptech deals begin as research papers. Identifying a breakthrough at the paper stage — 18 months before a spinout forms — is the ultimate sourcing edge for a deeptech fund.",
   inPractice:"A biweekly digest of papers with high commercial potential scores. A paper from an IIT lab on a new radar signal processing technique gets flagged with a note on its potential defence and autonomous vehicle applications.",
   limitations:"Highly dependent on correctly interpreting technical papers. Hallucination risk is elevated here — the agent may overestimate commercial potential of narrow academic results.",
   failureModes:"If the thesis-to-domain mapping is too narrow, important breakthrough papers in adjacent fields get missed. Cross-domain breakthroughs are particularly hard to catch.",
   modelRationale:"T3 (Perplexity Sonar Pro) for real-time academic search with citation context — training data alone is insufficient for current research."},

  {id:"S8",phase:"sourcing",label:"Niche Community Trend",feeds:["S9"],
   objective:"Surface emerging tools gaining traction in specific online communities before they hit mainstream radar.",
   input:"Reddit API, Hacker News API, Discord scraping (public servers), niche forums",
   output:'JSON: { trending: [{ tool_or_topic, community, engagement_growth_pct, signal_maturity: "early/growing/mainstream" }] }',
   why:"The next big developer tool is always visible on Hacker News 18 months before it raises a Series A. Niche communities are the earliest signal available for bottoms-up product adoption.",
   inPractice:"A weekly digest of tools gaining rapid engagement in relevant communities. A tool that appears in three different Hacker News threads in one week with high upvotes and substantive comments is flagged as high-signal.",
   limitations:"Consumer and enterprise tools targeting non-technical buyers are effectively invisible in developer-heavy communities like HN and specific subreddits.",
   failureModes:"Community hype can be manufactured through coordinated posting campaigns. High engagement without sustained organic discussion across weeks is a false positive indicator.",
   modelRationale:"T2 (Claude Sonnet) for summarisation and pattern recognition across community discussions — well within Sonnet's capability."},

  {id:"S9",phase:"sourcing",label:"Inbound Pipeline Scorer",feeds:["A1","S15"],
   objective:"Score and prioritize all inbound deals from any source. Routes high-priority deals directly into the diligence pipeline.",
   input:"Pitch deck, all sourcing signal outputs S2-S8",
   output:'JSON: { deal_id, priority_score: 1-10, thesis_alignment_score: 1-10, recommended_action: "fast_track/standard/archive" }',
   why:"Most funds receive more inbound than they can properly review. Without scoring, important deals get lost in the noise while analysts waste time on clear mismatches.",
   inPractice:"Every inbound deal gets a priority score and a recommended action. A deck from a founder with a prior exit in the fund's thesis sector, backed by a top scout, scores 9.2 and gets fast-tracked to full diligence within 24 hours.",
   limitations:"Scoring is based on available signals at the time of submission. A strong company with a weak deck will be systematically underscored.",
   failureModes:"If thesis hypotheses from S1 are poorly defined, this agent becomes the funnel through which every misaligned deal passes — corrupting the quality of the entire pipeline.",
   modelRationale:"T2 (Claude Sonnet) for multi-signal synthesis and scoring — a well-defined reasoning task with structured inputs."},

  {id:"S10",phase:"sourcing",label:"Warm Intro Path Finder",feeds:[],
   objective:"Identify the shortest path to a warm introduction to a high-priority target company through the fund's network.",
   input:"Target founder names, LinkedIn API (fund team connections), CRM data",
   output:'JSON: { intro_paths: [{ path[], strength: "strong/medium/weak", suggested_message_hook }] }',
   why:"Cold outreach to founders converts at a fraction of the rate of warm introductions. Every day between identifying a target and reaching them with a warm intro is a day a competitor might move first.",
   inPractice:"A ranked list of introduction paths for a specific founder. 'You → Ravi Shankar (portfolio CEO) → Priya Mehta (target founder) — Ravi worked with Priya at Flipkart. Strong connection. Suggested hook: ask Ravi to make the intro over WhatsApp.'",
   limitations:"Only covers the documented network. Informal relationships, WhatsApp contacts, and personal friendships that aren't in the CRM are invisible.",
   failureModes:"Suggesting an intro path through a weak connection can backfire — a lukewarm introduction from a tangential contact can actually reduce the likelihood of a meeting.",
   modelRationale:"T2 (Claude Sonnet) for graph traversal and path ranking across network data."},

  {id:"S11",phase:"sourcing",label:"Conference Scanner",feeds:[],
   objective:"Identify upcoming conferences and events with high concentration of startups matching the fund's thesis.",
   input:"Event websites, speaker lists, startup demo day schedules",
   output:'JSON: { events: [{ name, date, location, thesis_relevance_score: 1-10, notable_speakers[], recommended_action }] }',
   why:"The right conference in the right sector can surface 20 qualified deals in two days. Knowing which events to attend — and which to skip — is a sourcing efficiency decision that compounds over years.",
   inPractice:"A quarterly events calendar with thesis relevance scores. 'NASSCOM Product Conclave — Score 8.4. 40+ B2B SaaS startups presenting. Recommended: attend the startup showcase on Day 2.'",
   limitations:"Event quality and startup quality are not reliably correlated. High-scoring events by thesis relevance may still produce low-quality deal flow if the event skews towards pre-revenue companies.",
   failureModes:"If the thesis tags are too narrow, the agent misses high-quality adjacent events — a defence-focused fund might miss a dual-use robotics conference scored as 'consumer electronics'.",
   modelRationale:"T2 (Claude Sonnet) for web search and relevance scoring against thesis criteria."},

  {id:"S12",phase:"sourcing",label:"University Tracker",feeds:["S9"],
   objective:"Track recent graduates and dropouts from top universities who have started new companies aligned with the thesis.",
   input:"University news feeds, LinkedIn alumni networks, campus startup competitions",
   output:'JSON: { new_companies: [{ founder_name, university, graduation_year, company_name, sector, thesis_match: bool }] }',
   why:"University spinouts from IIT, IISc, and top global institutions represent the earliest-stage entry point into potentially breakthrough companies. Catching them before any VC has seen them is a pricing advantage.",
   inPractice:"A monthly report of new companies founded by recent alumni. 'Arjun Nair, IIT Bombay CS 2023, has founded a drone swarm coordination startup. No prior funding. Early stage.'",
   limitations:"Coverage is biased towards institutions with strong alumni networks on LinkedIn. Founders from non-elite institutions are systematically underrepresented even if the company is strong.",
   failureModes:"University affiliation is a weak signal on its own. Without cross-referencing thesis alignment and founder quality, this agent produces a lot of noise from first-time founders with unvalidated ideas.",
   modelRationale:"T2 (Claude Sonnet) for alumni network scanning and thesis matching."},

  {id:"S13",phase:"sourcing",label:"Corporate Spinoff Tracker",feeds:["S9"],
   objective:"Identify large tech companies that recently shut down a project, creating a pool of expert ex-employees likely to start something new in that domain.",
   input:"Tech news APIs, LinkedIn job change tracking, company announcement feeds",
   output:'JSON: { spinoff_opportunities: [{ company_shutdown, technology_domain, estimated_ex_employees, key_people[], thesis_alignment: 1-10 }] }',
   why:"Corporate mafias are among the highest-quality founder pools. When Google kills a project, 50 experts in that technology suddenly become available — many will start companies. Getting to them first is a significant edge.",
   inPractice:"A report flagging recent corporate project shutdowns. 'Amazon closed its drone delivery division in India — 30 engineers with last-mile UAV expertise are now on the market. High thesis match for a drone fund.'",
   limitations:"Tracking individual job changes is noisy and incomplete. Many ex-employees take traditional jobs rather than founding companies, creating high false positive rates.",
   failureModes:"Acting on this signal too early — before the founders have validated their idea — can lead to investing in companies built around technology looking for a problem rather than a real market need.",
   modelRationale:"T3 (Perplexity Sonar Pro) for real-time news monitoring and LinkedIn change detection across multiple sources."},

  {id:"S14",phase:"sourcing",label:"VC Portfolio Overlap",feeds:["S9"],
   objective:"Identify companies co-funded by VCs the fund admires or frequently co-invests with as a quality filter.",
   input:"Crunchbase/PitchBook scraping, news APIs, trusted investor list (pre-configured)",
   output:'JSON: { overlapping_deals: [{ company, co_investors[], overlap_strength: 1-10, last_round_date }] }',
   why:"If three VCs you respect have all backed the same company, it has already passed multiple independent quality filters. This dramatically reduces the diligence burden on initial screening.",
   inPractice:"A list of companies backed by trusted co-investors with overlap strength scores. 'Nexus, Blume, and Elevation have all backed this SaaS company — all three have strong track records in B2B. Overlap score: 9.1.'",
   limitations:"Creates a herding risk — the most obvious deals with the most prestigious investors are also the most competitive and expensively priced.",
   failureModes:"Over-indexing on investor quality as a signal can cause the fund to chase deals rather than lead them, resulting in poor entry prices and weak deal terms.",
   modelRationale:"T2 (Claude Sonnet) for database lookups and investor quality scoring against a pre-configured trusted list."},

  {id:"S15",phase:"sourcing",label:"Sourcing Funnel Analytics",feeds:["S1"],
   objective:"Analyze which sourcing channels are generating the highest quality deals and feed learnings back into the thesis and sourcing strategy.",
   input:"Internal CRM data: all deals with source tags and progression stages",
   output:'JSON: { channel_performance: [{ channel, deals_sourced, conversion_to_diligence_pct, conversion_to_investment_pct }] }',
   why:"Without measuring which sourcing channels actually produce investments, funds optimise for deal volume rather than deal quality — wasting time and missing the channels that actually work.",
   inPractice:"A quarterly funnel report. 'Conference sourcing: 42 deals, 12% to diligence, 2% to investment. Academic tracking: 8 deals, 38% to diligence, 12% to investment. Recommendation: double down on academic sourcing.'",
   limitations:"Requires consistent CRM hygiene and source tagging — most funds don't have this discipline, making the data unreliable for the first 6-12 months of operation.",
   failureModes:"If the attribution data is incomplete or incorrectly tagged, this agent reinforces wrong conclusions — doubling down on low-quality channels and abandoning high-quality ones.",
   modelRationale:"T2 (Claude Sonnet) for analytics and pattern recognition across structured CRM data."},

  {id:"A1",phase:"intake",label:"Deck Parser",feeds:["A2"],
   objective:"Convert the raw pitch deck file into a clean, structured, machine-readable format that every downstream agent can consume.",
   input:"Raw PDF or PPTX pitch deck file",
   output:'JSON: { slides: [{ slide_number, text_content, image_descriptions[], table_data[], chart_descriptions[] }] }',
   why:"Everything downstream depends on clean data extraction. A poorly parsed deck corrupts the entire analysis — this agent is the foundation every other agent stands on.",
   inPractice:"A structured JSON where every slide's text, tables, and charts are captured. A financial projection table on slide 14 becomes clean structured data rather than an image — making it queryable by the financial agents.",
   limitations:"Poorly designed decks with text embedded in images, unusual fonts, or non-standard layouts will produce incomplete extractions that degrade downstream agent quality.",
   failureModes:"Missing a key claim on slide 8 means A2 doesn't extract it, which means no downstream agent verifies it — a material misrepresentation can slip through undetected.",
   modelRationale:"T1 (Claude Haiku) — high-volume extraction and OCR is a well-defined, repetitive task where speed and cost efficiency matter more than frontier reasoning."},

  {id:"A2",phase:"intake",label:"Entity & Claim Extractor",feeds:["A3","B1","C1","C2","C8","C9","D1","D7","D8","E5","E10","E11","F1","F6","G7","MC1"],
   objective:"Extract every verifiable entity and quantifiable claim from the parsed deck — the seed data that feeds the entire analysis pipeline.",
   input:"Parsed deck JSON from A1",
   output:'JSON: { entities: { founders[], companies[], products[], technologies[], geographies[] }, claims: { financial[], traction[], market_size[], team_size[], growth_rates[] } }',
   why:"This is the most critical agent in the intake layer. Every claim that gets extracted here gets verified. Every entity that gets identified here gets researched. Anything missed here is a blind spot in the entire analysis.",
   inPractice:"A comprehensive list of every verifiable claim: '3x revenue growth in 12 months', '$1.2M ARR', '47 enterprise customers', 'founded by ex-Google engineers'. Each claim is tagged with its source slide for traceability.",
   limitations:"Can only extract what's explicitly stated in the deck. Founders who omit key metrics or bury them in footnotes will have those claims missed entirely.",
   failureModes:"The most consequential failure in the system. If a claim like '$2M ARR' is misread as '$200K ARR', every downstream financial analysis is wrong — and the error propagates invisibly through the entire pipeline.",
   modelRationale:"T1 (Claude Haiku) — systematic extraction from structured text is a high-volume, well-defined task where Haiku's speed and cost efficiency are ideal."},

  {id:"A3",phase:"intake",label:"Red Flag Scanner",feeds:["G4","MB-A1","MB-B1","MB-C1","MB-D1","MB-E1"],
   objective:"Fast first-pass quality check on the deck artifact itself — flags missing sections, internal contradictions, and presentation issues before deep analysis begins.",
   input:"Parsed deck (A1) and entities/claims (A2)",
   output:'JSON: { missing_sections[], internal_contradictions[], quality_flags[], overall_deck_quality_score: 1-10 }',
   why:"A deck that claims $500K ARR on slide 6 and $5M ARR on slide 14 is a serious signal. Catching these contradictions at intake — before investing analyst time — is a basic quality filter.",
   inPractice:"A quality report noting missing sections ('No financials slide', 'No ask slide'), internal contradictions ('Revenue figure differs between executive summary and financial projections'), and a deck quality score.",
   limitations:"Can only identify contradictions within the deck itself. It cannot catch a claim that is consistently false across all slides — that requires cross-referencing external data.",
   failureModes:"A low deck quality score is not necessarily indicative of a bad company — some exceptional founders produce terrible decks. This agent's output must be contextualised, not used as a hard filter.",
   modelRationale:"T2 (Claude Sonnet) for logical contradiction detection and structural quality assessment — requires reasoning beyond simple extraction."},

  {id:"B1",phase:"founder",label:"Identity Resolver",feeds:["B2","B3","B5","B7","B8","B11"],
   objective:"Resolve founder names from the deck to verified, confirmed online identities across all public platforms.",
   input:"Founder names from A2",
   output:'JSON per founder: { name, linkedin_url, twitter_url, personal_site, other_profiles[], photo_match: bool }',
   why:"Every other founder agent depends on having correct identity links. A common name like 'Rahul Sharma' could match dozens of people — resolving the right identity is the prerequisite for all founder research.",
   inPractice:"A verified identity card for each founder with confirmed LinkedIn, Twitter, and personal site URLs. Where a photo from the deck is compared against LinkedIn profile photos to confirm the match.",
   limitations:"Founders with very common names, no online presence, or who use different names professionally are difficult to resolve with high confidence.",
   failureModes:"Resolving to the wrong identity — a different person with the same name — means all career history, sentiment, and track record research is done on the wrong person entirely.",
   modelRationale:"T2 (Claude Sonnet with web search) for multi-platform identity resolution and cross-referencing."},

  {id:"B2",phase:"founder",label:"Career History Builder",feeds:["B3","B4","B6","B9","H4"],
   objective:"Construct a detailed, verified chronological career timeline for each founder beyond what the deck's team slide shows.",
   input:"LinkedIn profiles from B1, LinkedIn Company API",
   output:'Per founder: { education[], career_timeline: [{ company, role, duration, key_achievements }], pattern_tags[] }',
   why:"The team slide is a marketing document. The real career history — including short tenures, gaps, and overlooked roles — is where the signal lives. This agent finds what founders don't put in their decks.",
   inPractice:"A chronological career timeline for each founder with duration at each role, inferred achievements, and pattern tags like 'serial_entrepreneur', 'deep_domain_expert', or 'first_time_founder'. A 3-month tenure at a previous startup is flagged.",
   limitations:"LinkedIn profiles are self-reported and frequently embellished. Titles are inflated, dates are sometimes fudged, and brief stints are often omitted entirely.",
   failureModes:"If LinkedIn data is sparse or inaccurate, downstream agents like B3 (track record) and B4 (market fit scorer) work from an incomplete picture, producing unreliable assessments.",
   modelRationale:"T2 (Claude Sonnet) for structured data extraction and timeline construction from LinkedIn profiles."},

  {id:"B3",phase:"founder",label:"Track Record Investigator",feeds:["B4","G4","H4","MB-A8"],
   objective:"Investigate the actual outcomes of founders' previous ventures — not the resume version, the real version.",
   input:"Identity profiles (B1), web search, news archives",
   output:'Per founder: { previous_ventures: [{ name, outcome, details, source_url }] }',
   why:"Execution history is the single best predictor of future execution. A founder who built and sold a company is categorically different from one who lists 'co-founder' on a venture that raised $50K and died quietly.",
   inPractice:"A fact-checked history of each previous venture. 'Clearpath Analytics — raised $800K seed in 2019, pivoted twice, quietly shut down in 2021 per Crunchbase and news archives. No acqui-hire, no acquirer press release.'",
   limitations:"Many startup outcomes — especially quiet shutdowns — leave very little public record. A founder whose company failed without media coverage will appear to have a clean record.",
   failureModes:"Missing a prior failure means the failure pattern detector (MB-A8) has no data to work from — a repeat offender can appear as a clean slate.",
   modelRationale:"T3 (Perplexity Sonar Pro) for multi-step cited web investigation across news archives, press releases, and company databases."},

  {id:"B4",phase:"founder",label:"Market Fit Scorer",feeds:["G5","MB-A1"],
   objective:"Assess the depth of the founding team's domain expertise in the specific market they are targeting.",
   input:"Career history (B2), track record (B3), Google Scholar, patent databases",
   output:'JSON: { founder_market_fit_score: 1-10, justification, domain_evidence: [{ type, detail }] }',
   why:"A first-time founder with 15 years of deep domain expertise in the exact problem they're solving is a fundamentally different risk profile than a generalist pivoting into an unfamiliar sector.",
   inPractice:"A scored assessment with specific evidence. 'Score: 8.2/10. CEO has 11 years in aerospace supply chain at HAL and L&T Defence. Published 3 conference papers on UAV logistics. Co-founder holds 2 drone navigation patents.'",
   limitations:"Domain expertise is necessary but not sufficient. Many deep domain experts are poor operators or struggle to commercialise their knowledge — this score measures knowledge, not execution ability.",
   failureModes:"Over-weighting domain expertise can lead to undervaluing generalist founders who compensate with exceptional learning speed, team-building, and customer obsession.",
   modelRationale:"T4 (Claude Opus) — nuanced judgment about what constitutes genuine domain expertise versus surface-level familiarity requires frontier reasoning."},

  {id:"B5",phase:"founder",label:"Public Sentiment Analyzer",feeds:["B10","G4","MB-A1"],
   objective:"Scan news, social media, podcasts, and blogs for any public mentions of founders to surface both positive signals and red flags.",
   input:"Founder identities (B1) → news archives, Twitter/X, Reddit, podcast transcripts",
   output:'JSON: { sentiment_summary, positive_signals[], negative_signals[], notable_mentions[] }',
   why:"What the internet says about a founder — unsolicited and unfiltered — is often more revealing than what they say about themselves. Awards and controversy both signal character.",
   inPractice:"A sentiment summary with specific sourced mentions. 'Positive: Featured in Economic Times as 'top 40 under 40 in deeptech', awarded at NASSCOM. Negative: 2 Glassdoor reviews from previous company cite aggressive management style and unpaid salaries during shutdown.'",
   limitations:"Founders with minimal public presence produce thin results. This agent is more useful for second or third-time founders who have left a digital trail.",
   failureModes:"Glassdoor reviews and social media complaints are easily gamed. Coordinated negative reviews from a bitter ex-employee can tank an otherwise excellent founder's sentiment score.",
   modelRationale:"T3 (Perplexity Sonar Pro) for multi-source cited web research across news, social, and community platforms."},

  {id:"B6",phase:"founder",label:"Team Completeness Analyzer",feeds:["G4","MB-A6"],
   objective:"Evaluate whether the current team has the critical functional roles needed for the company's specific stage and business model.",
   input:"Team info from A2, career histories from B2, LinkedIn Company API",
   output:'JSON: { current_roles[], missing_critical_roles[], team_completeness_score: 1-10, recommendation }',
   why:"The single biggest cause of startup failure after product-market fit is team gaps. A deep-tech hardware company without a manufacturing expert is building on a broken foundation.",
   inPractice:"A gap analysis by function. 'Current: CEO (commercial), CTO (software). Missing: Hardware engineer (Critical), Regulatory/compliance lead (Important), Head of Sales (Nice-to-have at this stage).'",
   limitations:"Role assessment is contextual and stage-dependent — what's missing at Series A may be perfectly fine at pre-seed. The agent's stage calibration requires regular tuning.",
   failureModes:"Flagging too many missing roles at early stage creates a false impression of team inadequacy. Pre-seed companies are expected to have gaps — the question is whether the existing team can fill them.",
   modelRationale:"T2 (Claude Sonnet) for structured role mapping and gap analysis against stage-appropriate benchmarks."},

  {id:"B7",phase:"founder",label:"Advisor Network Profiler",feeds:["B8","B12","G5","MB-A9"],
   objective:"Profile all advisors, board members, and existing investors to assess the quality and credibility of the company's supporting network.",
   input:"Entity list from A2, web search, LinkedIn",
   output:'JSON: { advisors: [{ name, relevance, track_record }], investors: [{ name, tier, portfolio_fit }], network_signal_score: 1-10 }',
   why:"A tier-1 VC leading the seed is a strong quality signal. A Nasscom Award winner listed as 'strategic advisor' who has no documented involvement is a red flag. This agent distinguishes the two.",
   inPractice:"A profiled roster of advisors and investors with relevance scores. 'Meera Iyer — Board Observer. Partner at Blume Ventures. Led 3 B2B SaaS investments to Series B exits. Highly relevant. Active board member per LinkedIn.'",
   limitations:"Advisory relationships are frequently listed without any actual engagement. There is no reliable public signal to distinguish an active advisor from a name that was offered equity in exchange for logo usage.",
   failureModes:"Accepting advisor listings at face value inflates the network signal score and gives the company undeserved credibility on the thesis alignment assessment.",
   modelRationale:"T2 (Claude Sonnet with web search) for multi-source profiling and relevance scoring."},

  {id:"B8",phase:"founder",label:"Network Graph Agent",feeds:["G5"],
   objective:"Map the founders' second-degree network to identify high-value connections to potential customers, investors, and key hires.",
   input:"Identity profiles (B1), advisor network (B7), LinkedIn connections",
   output:'Graph JSON: { network_clusters[], high_value_connections: [{ person, path, value_type }] }',
   why:"In venture, distribution is often more valuable than the product itself. A founder with a direct line to the CTO of Infosys is categorically better positioned than one without — even if the products are identical.",
   inPractice:"A network map highlighting high-value second-degree connections. 'Via advisor Rajesh Kumar → Anand Mehta (CISO, TCS) — potential enterprise customer. Via co-founder LinkedIn → Priya Nair (ex-Google, ML lead) — potential hire.'",
   limitations:"Only covers documented professional networks. WhatsApp groups, college friendships, and community relationships — which are often the strongest in Indian startup ecosystems — are invisible.",
   failureModes:"Overestimating the value of second-degree connections is common. A LinkedIn connection is not a warm relationship — the agent cannot assess actual relationship depth.",
   modelRationale:"T2 (Claude Sonnet) for graph traversal and connection value scoring."},

  {id:"B9",phase:"founder",label:"Employee Pedigree Agent",feeds:["G4","MB-A7"],
   objective:"Analyze where the first employees came from and detect signals of turnover or talent exodus.",
   input:"LinkedIn profiles (B2), Glassdoor scraping",
   output:'JSON: { employee_pedigree_score: 1-10, top_feeder_companies[], estimated_avg_tenure_months, turnover_risk }',
   why:"The calibre of people willing to join a company before it has proven itself is a strong signal of founder quality and company culture. Ex-Google engineers joining a pre-seed says something. So does high turnover.",
   inPractice:"A pedigree report. 'First 8 employees: 3 from IIT, 2 from ex-Ola, 1 from Flipkart. Average tenure 14 months. Note: Head of Engineering updated LinkedIn to 'Open to Work' 3 weeks ago — potential departure signal.'",
   limitations:"Small teams create enormous statistical noise — losing one person out of five is a 20% turnover rate. Early-stage team changes are often healthy restructuring rather than distress signals.",
   failureModes:"Flagging a leadership departure as a red flag when it was a planned mutual separation can unfairly penalise a company that handled a difficult situation well.",
   modelRationale:"T2 (Claude Sonnet) for LinkedIn data analysis and turnover signal detection."},

  {id:"B10",phase:"founder",label:"Coachability Signal",feeds:["MB-A4"],
   objective:"Analyze how founders respond to public feedback, criticism, and challenges to assess their openness to coaching.",
   input:"Social media replies (B5), blog comments, podcast transcripts, panel discussions",
   output:"Coachability assessment: Low/Medium/High with sourced evidence",
   why:"Uncoachable founders are one of the most common causes of investor-founder relationship breakdown. Identifying this trait before investment saves significant relationship capital and board meeting hours.",
   inPractice:"A qualitative assessment with specific examples. 'Medium-High coachability. In a 2023 podcast, founder responded to market skepticism with curiosity rather than defensiveness. On Twitter, acknowledged a product bug publicly and thanked the reporter.'",
   limitations:"Public communication style is performative. A founder who appears thoughtful in interviews may behave very differently behind closed doors in a board meeting.",
   failureModes:"Quiet, introverted founders with limited public communication records will score poorly on this agent even if they are highly coachable in private — systematic bias against a particular communication style.",
   modelRationale:"T3 (Perplexity Sonar Pro) for sourcing specific public interactions across platforms for qualitative analysis."},

  {id:"B11",phase:"founder",label:"Commitment Check",feeds:["MB-A10"],
   objective:"Check public signals that founders may not be 100% committed to the venture — active side projects, recent job searches, advisory roles.",
   input:"Founder identities (B1) → GitHub, personal websites, social media",
   output:"Report of potential commitment red flags with evidence and severity classification",
   why:"An investor's capital is allocated under the assumption that the founding team is fully committed. A founder actively interviewing at other companies or running three active side projects is a material disclosure issue.",
   inPractice:"A commitment flags report. 'CTO's GitHub shows active commits to an unrelated open-source project averaging 15 hours/week. CEO recently liked 3 'We're hiring' posts from Series B companies on LinkedIn — weak but noted signal.'",
   limitations:"Side projects and open-source contributions are not necessarily signs of divided commitment — many excellent founders are prolific contributors. Context matters enormously.",
   failureModes:"Flagging normal professional engagement as commitment risk creates adversarial investor-founder dynamics before they begin. This agent's output must be discussed carefully, not actioned automatically.",
   modelRationale:"T2 (Claude Sonnet with web search) for multi-platform signal detection and severity classification."},

  {id:"B12",phase:"founder",label:"Previous Investor Quality",feeds:["G5","H3"],
   objective:"Profile all investors from previous funding rounds and assess their track record and the quality signal their involvement provides.",
   input:"Funding data from A2, advisor/investor data from B7, news archives",
   output:'JSON: { previous_investors: [{ name, tier, notable_investments, signal }], investor_quality_score: 1-10 }',
   why:"Who has already backed this company is a pre-filtered quality signal. A seed from Sequoia or Elevation carries a different meaning than a seed from an unknown family office.",
   inPractice:"An investor quality report. 'Previous round: $500K from 3one4 Capital (Tier 1 India fund, portfolio includes Licious and DarwinBox) and 2 angel investors. Strong signal for Indian B2B.'",
   limitations:"Past investor quality is not a guarantee of future performance. Even top-tier funds make early-stage mistakes — and not every company backed by a top fund is a good deal at the current round's valuation.",
   failureModes:"Giving too much weight to investor pedigree can cause the fund to follow rather than lead — paying premium prices for deals that are already competitively priced because of the investor signal.",
   modelRationale:"T2 (Claude Sonnet with web search) for investor database lookups and track record assessment."},

  {id:"C1",phase:"market",label:"Direct Competitor Identifier",feeds:["C3","C4","C5","MB-B3"],
   objective:"Identify the 3-5 companies a target customer would evaluate directly alongside this company in a buying process.",
   input:"Company/product entities from A2, web search grounding",
   output:'JSON: { competitors: [{ name, website, one_liner, similarity_score: 1-10 }] }',
   why:"A company that claims it has no competitors either hasn't looked hard enough or is solving a problem no one cares about. This agent finds the real competitive set the customer sees — not the polished version in the deck.",
   inPractice:"A ranked list of direct competitors with similarity scores. 'Fractal Analytics (Score: 8.1), Mu Sigma (Score: 7.4), Tiger Analytics (Score: 6.9). Note: Deck competitor slide lists only one of these three.'",
   limitations:"Competitive landscape changes rapidly. A competitor that raised a Series C last week and entered the market will be captured; a well-funded stealth startup will not.",
   failureModes:"Incomplete competitive identification feeds into a feature matrix (C4) and pricing analysis (C5) built on a false picture of the market — the entire competitive section of the analysis is compromised.",
   modelRationale:"T2 (Claude Sonnet with web search) for real-time competitive discovery and similarity scoring."},

  {id:"C2",phase:"market",label:"Indirect Competitor Scanner",feeds:["C3","MB-B3"],
   objective:"Identify non-obvious threats — adjacent companies that could pivot in, incumbents that could build the feature, and emerging stealth startups.",
   input:"A2 entity list, web search, industry news, Product Hunt",
   output:'JSON: { indirect_competitors: [{ name, threat_type, rationale }] }',
   why:"The company that kills most startups isn't their named competitor — it's the incumbent that adds the feature, the adjacent player that pivots, or the well-funded new entrant that wasn't on anyone's radar.",
   inPractice:"An indirect threat map. 'Microsoft could add this as a Power Automate feature (incumbent build risk). Darwinbox is expanding from HR to adjacent ops workflows (pivot risk). Spotted 2 stealth teams on LinkedIn building in adjacent space.'",
   limitations:"Identifying stealth competitors requires inferring intent from limited signals — job postings, LinkedIn activity, research papers. This is inherently speculative and has low recall.",
   failureModes:"Over-identifying indirect threats creates a paralysis-inducing list of 'what-ifs' that makes every market look unwinnable. The agent's output must be weighted by probability, not just possibility.",
   modelRationale:"T3 (Perplexity Sonar Pro) for discovering non-obvious connections across the live web and industry news."},

  {id:"C3",phase:"market",label:"Competitor Funding Tracker",feeds:["C4","G1","G2"],
   objective:"Map the funding history of every identified competitor to contextualise the capital intensity and competitive dynamics of the market.",
   input:"Competitor names from C1 and C2, web search, press releases",
   output:'JSON: { competitor_funding: [{ name, total_raised, last_round_size, last_valuation, key_investors[], source_url }] }',
   why:"A competitor that has raised $40M Series B is a fundamentally different threat than one that raised a $1M seed. Capital context determines how aggressively a competitor can acquire customers and talent.",
   inPractice:"A funding landscape table. 'Competitor A: $28M raised, last round Series B at $120M valuation, led by Accel. Competitor B: $3.2M raised, seed stage, angel-backed. Competitive intensity: High capital asymmetry.'",
   limitations:"Many funding rounds — especially in India at early stages — are not publicly announced. Private rounds and strategic investments from corporates are frequently invisible.",
   failureModes:"Underestimating competitive capital because of incomplete data leads to false confidence in the market opportunity — the company may be entering a market where a well-funded competitor is about to dominate.",
   modelRationale:"T2 (Claude Sonnet with web search) for funding data aggregation across databases and press releases."},

  {id:"C4",phase:"market",label:"Feature Matrix Builder",feeds:["D6","MB-C2"],
   objective:"Build a side-by-side feature comparison matrix across the target company and its top competitors based on their actual product pages.",
   input:"Competitor websites and product documentation (C1, C3)",
   output:"Feature matrix: rows = features, columns = companies, cells = supported/not/partial",
   why:"The feature matrix is the most honest competitive document you can produce. It shows exactly where the company leads, where it lags, and whether its claimed differentiation is real or manufactured.",
   inPractice:"A grid table showing feature coverage across competitors. Red cells where the company is missing something competitors offer. Green cells where they lead. A claim of 'best-in-class analytics' that shows up as equal to three competitors in the matrix is an immediate flag.",
   limitations:"Features listed on product pages don't always match actual product capability. Marketing pages are aspirational. Deep competitive analysis requires customer conversations, not just website scraping.",
   failureModes:"A feature matrix built from marketing pages rather than actual product usage can be systematically misleading — showing parity where there is a significant gap in actual execution quality.",
   modelRationale:"T2 (Claude Sonnet) for multi-page web extraction and structured matrix construction."},

  {id:"C5",phase:"market",label:"GTM & Pricing Decoder",feeds:["E6","E7"],
   objective:"Analyze how competitors go to market and price their products to understand the commercial dynamics of the space.",
   input:"Competitor websites, pricing pages, case studies",
   output:'Per competitor: { gtm_motion, pricing_model, pricing_tiers[] }',
   why:"Understanding how competitors sell reveals what the market has already validated. A sector that has migrated to PLG signals that buyers want to try before they buy — a sales-led approach in that context will be costly and slow.",
   inPractice:"A GTM and pricing comparison. 'Industry is predominantly sales-led with annual contracts. Competitor A launched freemium in Q3 — early signal of market commoditisation. Average contract value across competitors: $18K-$45K/yr.'",
   limitations:"Pricing is often not publicly listed for B2B enterprise software. Pricing pages show list prices, not actual deal economics, which are frequently discounted in competitive situations.",
   failureModes:"If pricing data is sparse, the pricing power analysis (E7) is built on assumptions rather than market data — producing a false sense of precision in the company's pricing strategy.",
   modelRationale:"T2 (Claude Sonnet) for web extraction and GTM classification from competitor material."},

  {id:"C6",phase:"market",label:"TAM/SAM/SOM Estimator",feeds:["C7","G3","MB-B1"],
   objective:"Independently calculate market size using both top-down and bottom-up methods, and validate the company's own TAM claims.",
   input:"TAM claims from A2, industry reports, value chain data from C8",
   output:'JSON: { top_down_tam, bottom_up_tam, sam, som, deck_tam_claim, tam_credibility_assessment }',
   why:"TAM is the most abused metric in pitch decks. 'We are in a $50B market' is meaningless without a credible path to capturing a relevant slice. This agent builds an independent market size estimate and compares it against the claim.",
   inPractice:"A dual estimate with credibility assessment. 'Deck claims $12B TAM. Top-down estimate: $8.4B (India B2B logistics software). Bottom-up estimate: $3.1B (addressable customers × average deal size). Credibility: Deck overstates by ~50%. SAM: $800M. SOM at 5 years: $40M.'",
   limitations:"Market sizing is inherently imprecise at early stage. Both top-down and bottom-up estimates carry significant uncertainty — the gap between a $3B and $8B TAM estimate is rarely meaningful for seed-stage decisions.",
   failureModes:"Over-precision in market sizing creates a false sense of analytical rigour. An estimate that reads '$4.73B TAM' is no more accurate than one that reads 'roughly $4-5B' — presenting false decimal precision erodes credibility.",
   modelRationale:"T3 (Perplexity Sonar Pro) for cited industry data + T4 (Claude Opus) for bottom-up modelling and credibility assessment."},

  {id:"C7",phase:"market",label:"Market Trajectory Analyzer",feeds:["C10","C11","C12","MB-B2"],
   objective:"Assess whether the target market is growing, stagnant, or declining, and identify the key forces shaping its future trajectory.",
   input:"Industry reports, Google Trends, news articles",
   output:'JSON: { market_cagr_estimate, growth_direction, key_trends: [{ trend, impact, description }] }',
   why:"A 15% CAGR market is forgiving of execution mistakes. A declining market is almost impossible to win in regardless of product quality. Understanding trajectory is more important than current size.",
   inPractice:"A trend analysis with sourced CAGR estimate. 'Indian SaaS for MSME segment: estimated 22% CAGR. Tailwinds: GST digitisation, ONDC adoption, government digital India push. Headwinds: low MSME willingness to pay, high churn historically.'",
   limitations:"Most market growth estimates come from analyst reports that are themselves based on models built from limited data. CAGR figures should be treated as directional, not precise.",
   failureModes:"Conflating sector growth with company-specific opportunity is common. A fast-growing market with 15 well-funded competitors may actually be harder to succeed in than a slower market with weak competition.",
   modelRationale:"T3 (Perplexity Sonar Pro) for sourcing cited market data and trend analysis from live reports and databases."},

  {id:"C8",phase:"market",label:"Value Chain Mapper",feeds:["C6","G8"],
   objective:"Map the full industry value chain and identify where the company sits — and whether that position captures meaningful value or is structurally squeezed.",
   input:"Industry analysis via web search, public company filings",
   output:'JSON: { value_chain_stages: [{ stage, key_players, estimated_margin }], company_position, value_capture_assessment }',
   why:"Many startups build in low-margin commodity layers of a value chain while ignoring high-margin orchestration layers above them. This agent identifies whether the company is positioned to capture value or just create it for others.",
   inPractice:"A value chain diagram in text. 'Raw data → Data cleaning (commodity, 5% margin) → Analytics platform (target company, 35% margin) → BI dashboards (commodity, 8% margin) → Business decisions. Company is positioned in the high-margin analytics layer.'",
   limitations:"Margin data for private companies in the value chain is often estimated from public company proxies and may not reflect the actual economics of a nascent market.",
   failureModes:"Misidentifying the company's value chain position leads to incorrect competitive analysis and TAM sizing. A company that thinks it's in the platform layer but is actually a feature will be systematically overvalued.",
   modelRationale:"T4 (Claude Opus) for complex multi-step business reasoning about industry structure and value distribution."},

  {id:"C9",phase:"market",label:"Regulatory Scanner",feeds:["C12","G8","MB-E3"],
   objective:"Identify current and pending regulations that could materially affect the business — positively or negatively.",
   input:"Government websites, legal publications, news archives",
   output:'JSON: { regulatory_risks: [{ regulation, jurisdiction, status, impact_assessment, source_url }] }',
   why:"Regulatory risk is the single most common cause of deeptech and fintech company failures in India. A regulation that forces a business model change can wipe out years of product development overnight.",
   inPractice:"A regulatory risk register. 'DPDP Act (India data privacy): Active, implementation 2024. High impact on data processing operations — requires significant compliance investment. RBI co-lending guidelines: Directly enables the lending partnership model. Positive regulatory tailwind.'",
   limitations:"Regulatory interpretation is context-dependent and frequently contested. A regulation that appears to prohibit a business model may have carve-outs or be unenforced in practice.",
   failureModes:"Missing a key pending regulation that kills the business model is the catastrophic failure mode. This agent must be supplemented with legal counsel for high-stakes regulatory environments.",
   modelRationale:"T3 (Perplexity Sonar Pro) for finding specific regulatory texts, amendments, and enforcement history from government and legal sources."},

  {id:"C10",phase:"market",label:"Macro Tailwind/Headwind",feeds:["C12","G3","G8"],
   objective:"Identify the broad economic, social, and technological macro forces acting as tailwinds or headwinds on the business over the next 3-5 years.",
   input:"Economic reports, technology forecasts, social trend analysis",
   output:'JSON: { tailwinds: [{ force, description, strength }], headwinds: [{ force, description, strength }] }',
   why:"Great companies are built at the intersection of a strong team and a powerful macro tailwind. Understanding which macro forces are working for or against a company changes the conviction score significantly.",
   inPractice:"A macro analysis. 'Tailwinds: India's 5G rollout accelerating IoT adoption (Strong), Atmanirbhar Bharat policy driving defence indigenisation (Strong for defence plays), rising MSME formalisation post-GST (Moderate). Headwinds: Rising interest rates compressing B2B tech budgets (Moderate).'",
   limitations:"Macro forecasting is notoriously unreliable beyond 12-18 months. The COVID-19 pandemic, for example, invalidated most macro analyses produced in 2019.",
   failureModes:"Identifying a tailwind that is already fully priced into comparable company valuations means the company doesn't benefit from the tailwind in terms of its own pricing power.",
   modelRationale:"T4 (Claude Opus) for connecting disparate macro forces into a coherent investment thesis narrative."},

  {id:"C11",phase:"market",label:"Public Comparable Analyzer",feeds:["G2","H1"],
   objective:"Identify the closest publicly traded company analogs and extract their key operating metrics and valuation multiples.",
   input:"Yahoo Finance API, SEC EDGAR, market trajectory data",
   output:"Table of 3-5 public comps with revenue growth, gross margin, NRR, and EV/ARR multiples",
   why:"Public market comps anchor private market valuations. A startup pricing itself at 15x ARR when its closest public comparable trades at 6x ARR has a valuation that requires extraordinary justification.",
   inPractice:"A comparable company table. 'Freshworks: 18% growth, 72% gross margin, 108% NRR, 6.2x EV/ARR. Zendesk (at acquisition): 25% growth, 75% gross margin, 7.4x EV/ARR. Implied valuation range for target: $18-24M at current ARR.'",
   limitations:"Public company comparables are imperfect benchmarks for early-stage private companies — different scale, liquidity, governance, and market conditions make direct multiple application unreliable.",
   failureModes:"Using public company multiples without discount for private company illiquidity, execution risk, and scale premium can lead to systematic overvaluation at early stage.",
   modelRationale:"T3 (Perplexity Sonar Pro) for researching current public company financial metrics and market positions."},

  {id:"C12",phase:"market",label:"Timing & Why Now Agent",feeds:["G5","G8"],
   objective:"Identify the specific technological, regulatory, or cultural shift that makes this a compelling opportunity right now — not 2 years ago, not 2 years from now.",
   input:"All market research outputs: C6, C7, C9, C10",
   output:"2-3 paragraph 'Why Now?' thesis narrative with cited evidence",
   why:"The 'Why Now?' question is the most important question in venture. Every great investment has a specific timing unlock — a technology that just became cheap enough, a regulation that just changed, a behaviour that just shifted.",
   inPractice:"A narrative paragraph. 'Three things converged in 2024 to make this the right moment: UPI transaction volume crossed 10B/month making the payment infrastructure viable for embedded finance; ONDC went live enabling open commerce; and the RBI's digital lending guidelines created clear regulatory rails. All three were necessary prerequisites — none were present 2 years ago.'",
   limitations:"Timing arguments are retrospectively compelling and prospectively uncertain. The agent can identify current enabling factors but cannot predict how long the timing window stays open.",
   failureModes:"A compelling 'Why Now?' narrative can become a rationalisation for a deal that was already emotionally decided — it should be evidence-driven, not post-hoc justification.",
   modelRationale:"T4 (Claude Opus) for synthesising multiple market signals into a coherent, compelling narrative argument."},

  {id:"D1",phase:"product",label:"Value Proposition Distiller",feeds:["D2","G11","MB-C1"],
   objective:"Cut through marketing language to identify the core value proposition in one precise sentence — who it's for, what problem it solves, and why it's better.",
   input:"Pitch deck (A2), company website",
   output:'JSON: { target_persona, problem_statement, solution_mechanism, unique_value_prop: "one sentence" }',
   why:"If the value proposition can't be stated in one sentence, it isn't clear enough to sell, market, or scale. This agent forces the clarity that the deck's marketing language often obscures.",
   inPractice:"A clean one-liner with decomposed components. 'For Indian MSMEs (persona), managing GST compliance across multiple states is expensive and error-prone (problem). Automated tax filing with real-time validation (mechanism) — 80% cheaper than a CA, zero penalty risk (differentiation).'",
   limitations:"Single-sentence value propositions can oversimplify complex platform businesses or multi-sided marketplaces where value is created across multiple stakeholders.",
   failureModes:"A beautifully articulated value proposition that doesn't match what customers actually pay for is a dangerous output — it can hide a product-market fit problem behind good writing.",
   modelRationale:"T2 (Claude Sonnet) for distillation and simplification of marketing language into precise, structured components."},

  {id:"D2",phase:"product",label:"Product Maturity Assessor",feeds:["D3","D6"],
   objective:"Determine the actual stage of product development and assess whether the roadmap is realistic for the team's size and capability.",
   input:"Pitch deck, company website, app store listings, website history from D8",
   output:'JSON: { product_stage, live_features[], planned_features[], roadmap_feasibility_assessment }',
   why:"'We have a product' can mean anything from a working app with paying customers to a Figma prototype. This agent establishes ground truth on what is actually live and usable today.",
   inPractice:"A maturity assessment. 'Stage: Early Beta. 3 of 8 claimed features confirmed live via App Store version 0.4.2. Features claiming 'AI-powered recommendations' not visible in app screenshots. Roadmap commits to 5 major features in 6 months with a 3-person engineering team — aggressive but not impossible.'",
   limitations:"Remote product assessment from public signals misses backend capabilities, API functionality, and enterprise features that aren't visible from consumer-facing interfaces.",
   failureModes:"Assessing a product as 'MVP' when it's actually 'concept' because the company's website has well-designed mockups can lead to significant overestimation of product readiness.",
   modelRationale:"T2 (Claude Sonnet) for cross-referencing deck claims against public product signals across app stores and web presence."},

  {id:"D3",phase:"product",label:"Technology Stack Profiler",feeds:["D4","D5","D9","D10"],
   objective:"Infer the company's full technology stack from public signals — job postings, GitHub repos, developer blogs, and website technology detection.",
   input:"Job postings, GitHub API, company tech blog, website source code analysis",
   output:'JSON: { frontend[], backend[], infrastructure[], databases[], ai_ml_stack[], data_sources[] }',
   why:"Technology choices reveal experience level, scaling assumptions, and vendor dependencies. A startup running entirely on a single cloud provider's proprietary services has meaningful lock-in risk that affects the risk analysis.",
   inPractice:"A technology inventory. 'Frontend: React. Backend: Python/FastAPI. Infrastructure: AWS (Lambda, RDS, S3). AI/ML: OpenAI API (inferred from job description requirement). Note: Heavy OpenAI dependency — cost and reliability risk at scale.'",
   limitations:"Job posting requirements often include aspirational technology skills rather than actual current stack. A posting for a 'Kubernetes engineer' doesn't confirm Kubernetes is in use.",
   failureModes:"A misidentified tech stack sends D4 (technical risk) and D10 (platform risk) in the wrong direction — assessing risks against a stack the company isn't actually using.",
   modelRationale:"T2 (Claude Sonnet with web search) for multi-source stack inference and cross-validation."},

  {id:"D4",phase:"product",label:"Technical Risk Assessor",feeds:["D6","G4","MB-C5"],
   objective:"Assess technical risks that could prevent the product from scaling — architecture, vendor lock-in, single points of failure, and technical debt signals.",
   input:"Technology stack from D3",
   output:'JSON: { technical_risks: [{ risk, severity, likelihood }], scalability_assessment, tech_debt_indicators[] }',
   why:"Technical risk is invisible in a pitch deck but can become existential at Series A when the system can't handle 10x the load. Identifying scalability ceilings early saves the fund from backing a company that will need a complete rebuild.",
   inPractice:"A risk register. 'High: Monolithic architecture will require significant refactoring before 100K user scale. Medium: All compute on a single AWS region — no disaster recovery. Low: PostgreSQL choice appropriate for current scale. Tech debt indicators: 3 'senior engineer for refactoring' job postings in 4 months.'",
   limitations:"Technical risk assessment without code review is inherently incomplete. Inferring architecture from job postings and blog posts is speculative — actual engineering conversations are essential for high-conviction assessments.",
   failureModes:"Over-penalising technical choices that are appropriate for the current stage creates a false 'scalability risk' flag on companies that have deliberately chosen pragmatic early-stage architecture.",
   modelRationale:"T4 (Claude Opus) for technical reasoning about architecture, scalability, and risk — requires domain expertise beyond standard language tasks."},

  {id:"D5",phase:"product",label:"IP & Patent Mapper",feeds:["D6","G4","MB-C6"],
   objective:"Search patent databases for the company's IP portfolio and map the broader patent landscape to identify infringement risks and defensibility.",
   input:"Google Patents, USPTO, founder names and company name from A2",
   output:'JSON: { company_patents: [{ title, filing_date, status }], infringement_risk_assessment, white_space_opportunities[] }',
   why:"IP is a moat. A competitor's patent wall is a legal landmine. This agent identifies both — whether the company has defensible IP and whether it's operating in a space where someone else's patents create existential risk.",
   inPractice:"An IP report. 'Company holds 2 provisional patents filed in 2023 — both related to the core drone swarm coordination algorithm. No granted patents yet. Patent landscape analysis: 3 relevant US patents held by DJI that could create infringement risk in export markets.'",
   limitations:"Patent filing is not the same as patent granting, and patent granting is not the same as patent enforceability. This agent cannot assess the legal quality of patents — that requires IP counsel.",
   failureModes:"Identifying a patent from a large incumbent as an 'infringement risk' without assessing its actual scope can unnecessarily alarm a team building in genuinely differentiated white space.",
   modelRationale:"T3 (Perplexity Sonar Pro) for comprehensive patent database search and landscape mapping across USPTO, EPO, and Indian patent databases."},

  {id:"D6",phase:"product",label:"Moat Type Classifier",feeds:["G5","G3","MB-C2"],
   objective:"Identify and classify the primary competitive moat the company is building, and assess how strong that moat is today versus at scale.",
   input:"D2, D4, D5, D7, C4",
   output:'JSON: { primary_moat_type, secondary_moat_type, moat_strength_today: 1-10, moat_strength_at_scale: 1-10, justification }',
   why:"The moat determines the long-term defensibility of the business. A company with no moat is a feature, not a business — it will be copied the moment it proves the concept works.",
   inPractice:"A moat assessment. 'Primary moat: Data network effect (Score today: 4/10, at scale: 8/10) — each additional customer's data improves the AI model, creating a compounding advantage over time. Secondary moat: Switching costs (Score today: 3/10, at scale: 6/10) — 3 month implementation time creates retention friction.'",
   limitations:"Moat strength is highly subjective and frequently overestimated at early stage. Most 'network effects' at pre-seed are actually virality, and most 'switching costs' are not as sticky as founders believe.",
   failureModes:"Identifying a moat that doesn't materialise at scale leads the scenario modeller (G3) to project returns based on defensibility that doesn't exist — systematically overstating exit valuations.",
   modelRationale:"T4 (Claude Opus) for strategic judgment about moat quality and durability — requires synthesis across multiple evidence sources and nuanced business reasoning."},

  {id:"D7",phase:"product",label:"OSS Community Analyzer",feeds:["D6"],
   objective:"For companies with open-source components, analyze the health and growth trajectory of their open-source community.",
   input:"GitHub API",
   output:'JSON: { has_oss_component: bool, github_stars, forks, contributors, commit_frequency_30d, community_health_score: 1-10 }',
   why:"A thriving open-source community is a powerful moat — it creates organic distribution, free beta testing, and a talent pipeline. A stagnant community despite claims of 'developer-first' positioning is a red flag.",
   inPractice:"A community health dashboard. 'GitHub: 2,400 stars (growing 12%/month), 180 forks, 23 active contributors (8 external). Commit frequency: 4.2/day. Issue resolution: avg 3.2 days. Community health: 7.8/10. Strong and growing.'",
   limitations:"GitHub metrics can be gamed through star-buying services and coordinated promotion. Raw star counts are a weak signal — contributor diversity and issue resolution quality are more meaningful.",
   failureModes:"For companies without an OSS component, this agent outputs minimal data. If incorrectly triggered on a closed-source company, it produces empty results that could be mistaken for a negative signal.",
   modelRationale:"T1 (Claude Haiku) for structured API data aggregation and metric calculation — well-defined task with structured inputs requiring no deep reasoning."},

  {id:"D8",phase:"product",label:"Website Evolution Tracker",feeds:["D2","MB-D10"],
   objective:"Analyze the historical evolution of the company's website to surface pivots, messaging changes, and product shifts that aren't disclosed in the deck.",
   input:"Wayback Machine API — historical snapshots",
   output:"Timeline of key changes in website design, messaging, and product offerings",
   why:"The Wayback Machine is the most honest document about a company's history. Every pivot, every failed product line, and every positioning change is preserved there — and founders rarely disclose them voluntarily.",
   inPractice:"A pivot timeline. 'Jan 2022: B2C logistics marketplace. Aug 2022: B2B supply chain SaaS (homepage completely rebuilt). Mar 2023: Added 'AI-powered' to all product descriptions. Note: This is the company's third positioning in 18 months — not disclosed in deck.'",
   limitations:"Website changes don't always signal pivots — redesigns, marketing tests, and product additions can look like pivots in snapshot analysis. Context is required to distinguish.",
   failureModes:"Flagging a legitimate brand refresh or product expansion as a 'pivot' incorrectly penalises companies that have thoughtfully evolved their positioning based on market feedback.",
   modelRationale:"T2 (Claude Sonnet) for timeline analysis and change detection across historical website snapshots."},

  {id:"D9",phase:"product",label:"Developer Ecosystem Agent",feeds:["D6"],
   objective:"For API-first companies, assess the health of the developer ecosystem — are third-party developers actually building on the platform?",
   input:"GitHub (forks, issues), Stack Overflow, developer forums",
   output:'JSON: { ecosystem_health_score: 1-10, key_projects_built_on_platform[], developer_sentiment, active_contributors_90d }',
   why:"For API-first and platform companies, the developer ecosystem IS the moat. A platform that developers love and build on top of has compounding distribution — each integration is a new acquisition channel.",
   inPractice:"An ecosystem health report. 'Stack Overflow: 47 questions tagged with platform API, 89% have accepted answers (strong support signal). GitHub: 12 public projects built using the API. Developer forum: Active community of 340 members, predominantly positive sentiment about documentation quality.'",
   limitations:"Only applicable to companies with a public API or developer-facing product. Enterprise software companies with private APIs will produce empty results.",
   failureModes:"A low ecosystem health score for a company in its first year of public API availability is expected, not a red flag. The agent's benchmarks must be calibrated against company age.",
   modelRationale:"T2 (Claude Sonnet) for multi-platform community health assessment and sentiment analysis."},

  {id:"D10",phase:"product",label:"Platform Risk Assessor",feeds:["G4","MB-C4"],
   objective:"Assess how dependent the business is on a single platform or infrastructure provider and quantify what happens if that platform changes its terms.",
   input:"Product architecture (D3), business model (F1)",
   output:"Platform dependency assessment including rule change risk, fee increase risk, and mitigation strategies",
   why:"Platform dependency is an existential risk that most founders underestimate. When Apple changed its App Store tracking policy, it destroyed the unit economics of half the adtech industry overnight.",
   inPractice:"A platform risk report. 'Critical dependency: 100% of distribution through iOS App Store. Risk scenarios: (1) Commission rate increase from 30% to higher — margin impact: significant. (2) Competing Apple feature — existential risk. Mitigation: No web app currently exists. High risk rating.'",
   limitations:"Platform risk is partially mitigable through technical and contractual decisions that may not be visible from external analysis. The actual risk level may be lower if the company has negotiated custom terms.",
   failureModes:"Treating every cloud provider dependency as high risk is an over-correction. Using AWS S3 is not a platform risk — being built entirely on a single proprietary platform with no migration path is.",
   modelRationale:"T2 (Claude Sonnet) for structured risk scenario modelling against identified platform dependencies."},

  {id:"E1",phase:"traction",label:"Claims vs Reality Verifier",feeds:["E2","E3","E4","G6","MB-E1"],
   objective:"Cross-reference every quantifiable claim in the deck against independent public data to confirm, contradict, or flag as unverifiable.",
   input:"All claims from A2, news archives, press releases",
   output:'JSON: { verified_claims: [{ claim, evidence, source_url, verdict: "confirmed/plausible/unverifiable/contradicted" }] }',
   why:"Founders put their best numbers in decks, and sometimes those numbers are exaggerated or misleading. This agent is the most direct check on the integrity of the entire pitch.",
   inPractice:"A claim audit. 'Claim: 3x YoY revenue growth. Evidence: Press release from Q3 confirms revenue milestone. Verdict: Plausible but unverified. Claim: 200 enterprise customers. Evidence: Website shows 12 logos, Glassdoor reviews from 4 companies. Verdict: Likely overstated — recommend clarification.'",
   limitations:"Most early-stage metrics are impossible to independently verify because private companies have no external reporting obligation. 'Unverifiable' is the most common verdict, which doesn't mean false.",
   failureModes:"Marking too many claims as 'contradicted' based on weak negative evidence creates a false impression of founder dishonesty for companies that simply lack public documentation.",
   modelRationale:"T3 (Perplexity Sonar Pro) for multi-source cited web investigation of specific numerical claims."},

  {id:"E2",phase:"traction",label:"Web Traffic Analyzer",feeds:["E8"],
   objective:"Pull web traffic estimates for the company and its top competitors to assess digital traction and trend direction.",
   input:"SimilarWeb free tier, company URL, competitor URLs from C1",
   output:'JSON: { company_traffic: { monthly_visits, trend_3m, trend_6m, top_sources[] }, competitor_comparison[] }',
   why:"For consumer and PLG companies, web traffic is an honest traction signal that founders can't easily fabricate. Growing traffic before a VC conversation is one of the cleanest product-market fit indicators.",
   inPractice:"A traffic dashboard. 'Monthly visits: 48,400 (growing 34% over 3 months). Top source: Organic search (42%). Competitive position: 3rd in category behind Zoho (1.2M/mo) and Freshbooks (890K/mo). 6-month trend: Consistent growth.'",
   limitations:"SimilarWeb estimates for small websites (under 50K monthly visits) are highly unreliable — based on panel extrapolation with significant error margins. Treat as directional only.",
   failureModes:"Taking SimilarWeb data at face value for very early-stage companies leads to false confidence in traffic metrics that may be off by 3-5x in either direction.",
   modelRationale:"T2 (Claude Sonnet) for traffic data interpretation and competitive benchmarking."},

  {id:"E3",phase:"traction",label:"App Store Intelligence",feeds:["G4"],
   objective:"For companies with mobile apps, extract ratings, review sentiment, download estimates, and comparative positioning against competitor apps.",
   input:"Apple App Store and Google Play Store scraping",
   output:'JSON: { ios: { rating, review_count, estimated_downloads }, android: {...}, top_complaints[], top_praises[] }',
   why:"App store data is user-reported and hard to fake at scale. A 4.8-star app with 2,000 reviews tells a very different story than a 3.1-star app that claims market leadership.",
   inPractice:"An app intelligence report. 'iOS: 4.6★, 1,847 reviews. Top praised: Ease of use, offline mode. Top complaints: Poor customer support response time, sync issues on older devices. Android: 3.9★, 412 reviews — notably lower, suggesting iOS-first development focus.'",
   limitations:"App store reviews can be gamed through incentivised review campaigns. A sudden spike in 5-star reviews without a corresponding product update is a manipulation signal.",
   failureModes:"For B2B companies whose app is a companion to an enterprise product, App Store ratings reflect the onboarding experience, not the core product value — a common source of misleading signal.",
   modelRationale:"T2 (Claude Sonnet) for review sentiment analysis and rating interpretation across platforms."},

  {id:"E4",phase:"traction",label:"Social Listening Agent",feeds:["E9"],
   objective:"Monitor organic social media mentions of the company across platforms to assess genuine market interest and sentiment.",
   input:"Twitter/X API, Reddit search, Hacker News API, LinkedIn mentions",
   output:'JSON: { mention_volume_30d, sentiment, organic_vs_paid_ratio, notable_mentions[] }',
   why:"Organic social mentions are the most honest signal of whether people actually care about a product. Manufactured buzz from the company's own accounts is easy to create — organic third-party mentions are not.",
   inPractice:"A social pulse report. '30-day mentions: 847 (62% organic). Sentiment: 71% positive, 18% neutral, 11% negative. Notable: 3 HN threads with substantive discussion, 1 with 200+ upvotes. Primary complaint theme: Missing integration with Tally.ERP.'",
   limitations:"Social mention volume is heavily skewed towards B2C and developer-focused products. B2B enterprise software that is purchased by procurement committees has almost no organic social signal.",
   failureModes:"Low social mention volume for a B2B company is not a product-market fit problem — it's an expected characteristic of the category. Using this metric to assess a logistics SaaS is a category error.",
   modelRationale:"T2 (Claude Sonnet) for multi-platform sentiment analysis and mention categorisation."},

  {id:"E5",phase:"traction",label:"Hiring Signal Decoder",feeds:["E6"],
   objective:"Analyze current job postings to infer the company's strategic priorities, growth trajectory, and any operational distress signals.",
   input:"LinkedIn Jobs, company careers page, major job boards",
   output:'JSON: { open_roles_count, roles_by_function{}, hiring_velocity, strategic_inference }',
   why:"Hiring patterns are the most honest strategic signal a company sends. A sudden burst of sales hires means they have product confidence. A freeze across all functions often signals a runway problem.",
   inPractice:"A hiring intelligence report. '14 open roles. Engineering: 8 (57% of hiring — product-heavy). Sales: 4. Marketing: 1. Note: This is the 3rd posting for 'Head of Data Engineering' in 6 months — suggests difficulty filling a critical role or repeated departures.'",
   limitations:"Many early-stage companies hire primarily through referrals and WhatsApp networks rather than job postings, making their actual hiring velocity invisible to this agent.",
   failureModes:"Reading a hiring freeze as a runway problem when the company has simply completed a hiring cycle creates a false distress signal. Hiring patterns must be contextualised against funding timing.",
   modelRationale:"T2 (Claude Sonnet) for job posting analysis, role classification, and strategic inference."},

  {id:"E6",phase:"traction",label:"GTM Motion Classifier",feeds:["E7"],
   objective:"Classify the company's primary go-to-market motion and assess whether it's appropriate and well-executed for its stage.",
   input:"Company website, pricing model, hiring patterns (E5), partnership data (E10)",
   output:'JSON: { primary_gtm_motion, secondary_gtm_motion, evidence[], gtm_maturity_assessment }',
   why:"GTM motion determines capital efficiency. A PLG company that acquires customers at $0 CAC is structurally different from a sales-led company spending $40K per customer acquisition — and both are appropriate in different markets.",
   inPractice:"A GTM classification. 'Primary motion: Product-led growth (evidence: freemium tier, self-serve sign-up, no sales team in hiring). Secondary: Inbound content (36K organic monthly visits). Note: 4 recent 'Enterprise Sales' job postings signal an emerging sales motion layered onto PLG — appropriate for upmarket expansion.'",
   limitations:"Many companies are in transition between GTM motions, which makes clean classification difficult. A company shifting from PLG to sales-led will appear to have a confused GTM during the transition.",
   failureModes:"Misclassifying a sales-led company as PLG leads to a flawed CAC analysis in E7 and incorrect unit economics assumptions in F2 — both downstream of the GTM classification.",
   modelRationale:"T2 (Claude Sonnet) for multi-signal GTM inference and maturity assessment."},

  {id:"E7",phase:"traction",label:"Pricing Power Analyzer",feeds:["G3","MB-B4"],
   objective:"Assess the company's pricing position relative to competitors and evaluate whether it has the ability to increase prices over time.",
   input:"Company pricing page, competitor pricing from C5, GTM motion from E6",
   output:'JSON: { pricing_position, pricing_vs_competitors, pricing_power_assessment: "strong/moderate/weak", justification }',
   why:"Pricing power is the most direct expression of a company's value capture ability. Companies that compete on price are in a race to the bottom — companies with pricing power compound their advantage over time.",
   inPractice:"A pricing analysis. 'Company prices at ₹8,999/month (midmarket vs competitor range ₹4,999-₹24,999/month). Pricing power assessment: Moderate. Positive: Customers in reference calls cite willingness to pay 20-30% more for the analytics feature. Negative: No evidence of successful price increases to existing customers.'",
   limitations:"Pricing page analysis reveals list prices, not actual contract economics. Discounting practices — which can be significant in Indian enterprise sales — are invisible from public data.",
   failureModes:"Assessing pricing power as strong based on price positioning alone misses the reality that customers may be accepting the price while actively searching for cheaper alternatives.",
   modelRationale:"T2 (Claude Sonnet) for competitive price positioning analysis and pricing power reasoning."},

  {id:"E8",phase:"traction",label:"Content & SEO Agent",feeds:["G5"],
   objective:"Assess the strength of the company's content marketing and SEO presence as a long-term organic distribution moat.",
   input:"Moz/Ahrefs free APIs, web traffic data (E2)",
   output:'JSON: { domain_authority_score, top_referring_domains[], top_ranking_keywords[], content_strategy_assessment }',
   why:"Organic search is the highest ROI distribution channel for SaaS companies. A company with 50 top-3 keyword rankings has built a distribution asset that compounds for years — a company with zero organic presence is perpetually dependent on paid acquisition.",
   inPractice:"An SEO report. 'Domain authority: 34 (moderate for 3-year-old domain). Top 3 rankings: 12 keywords averaging 2,400 monthly searches. Top referring domains: Inc42, YourStory, Economic Times. Content assessment: Consistent publishing cadence, strong sector-specific content.'",
   limitations:"SEO takes 12-24 months to compound meaningfully. An early-stage company with low authority is not necessarily making an SEO mistake — it may simply be too new to have built authority.",
   failureModes:"High domain authority from a legacy domain acquired or rebranded into doesn't reflect earned organic trust — it's inherited authority that may not be relevant to the current product.",
   modelRationale:"T2 (Claude Sonnet with web search) for SEO metric analysis and content strategy assessment."},

  {id:"E9",phase:"traction",label:"Community Pulse Agent",feeds:["D6"],
   objective:"For community-led businesses, assess the size, engagement rate, and health of the community as a distribution and retention moat.",
   input:"Discord/Slack scraping (if public), forum analysis, social sentiment (E4)",
   output:'JSON: { community_size, engagement_rate, sentiment, key_topics[], growth_rate_30d }',
   why:"For community-led companies, the community is the product. A highly engaged 10,000-member Discord is worth more than a disengaged 100,000-member one — this agent distinguishes the two.",
   inPractice:"A community health report. 'Discord: 8,400 members, 34% weekly active. Top topics: Integration questions (positive signal — users actively building), Feature requests (product feedback channel), Peer knowledge sharing (community value creation). Growth: 12% monthly.'",
   limitations:"Many communities appear healthy in terms of size but are dominated by passive lurkers. Active-to-lurker ratios are difficult to assess from public metrics alone.",
   failureModes:"Measuring community size rather than quality leads to a misleading moat assessment — a massive inactive community is not a distribution advantage.",
   modelRationale:"T2 (Claude Sonnet) for community metric analysis and engagement quality assessment."},

  {id:"E10",phase:"traction",label:"Partnership Mapper",feeds:["E6"],
   objective:"Identify and assess the strategic value of the company's partnerships and integrations, distinguishing meaningful relationships from logo partnerships.",
   input:"Company website integrations page, press releases, A2 entity list",
   output:"List of key partners with: { partner, type, strategic_value: 1-10, depth_evidence }",
   why:"A partnership with Salesforce that drives actual customer referrals is a distribution moat. A 'strategic partnership' that exists only as a press release is misleading — and this agent identifies which is which.",
   inPractice:"A partnership assessment. 'Salesforce integration: Native AppExchange listing (verified), 34 customer reviews, 1,200 installs. Strategic value: 8/10 — active distribution channel. HDFC Bank 'partnership': Press release only, no co-marketing or product integration visible. Strategic value: 2/10 — logo partnership.'",
   limitations:"The depth of many B2B partnerships is only visible from inside the commercial relationship — whether there are actual referral fees, joint sales motions, or customer sharing cannot always be confirmed publicly.",
   failureModes:"Assigning high strategic value to a partnership based on partner brand name rather than actual commercial depth leads to overestimating the company's distribution advantages.",
   modelRationale:"T2 (Claude Sonnet with web search) for partnership verification and depth assessment."},

  {id:"E11",phase:"traction",label:"Customer Concentration",feeds:["E1","G4","MB-D6"],
   objective:"Detect signals that revenue is highly concentrated in a small number of customers, creating significant churn and negotiation risk.",
   input:"Case studies, testimonials, news articles, A2 entity list",
   output:'JSON: { concentration_risk: "low/medium/high/critical", evidence[], estimated_top_customer_revenue_pct }',
   why:"A company with 80% of revenue from 3 customers is one bad quarter away from a crisis. Customer concentration is the most common hidden risk in early-stage B2B companies.",
   inPractice:"A concentration risk report. 'Evidence: Case studies feature 4 enterprise clients prominently. Press release confirms Infosys contract worth ₹2.4Cr. CEO mentioned 'a large BFSI client represents a significant portion of revenue' in a podcast. Estimated concentration: 60-70% from top 3 customers. Risk: High.'",
   limitations:"Revenue concentration is rarely disclosed precisely at early stage. This agent works from indirect evidence and produces estimates, not confirmed figures — follow-up diligence is essential.",
   failureModes:"Missing a concentration problem because the company's language is carefully calibrated to hide it is the most dangerous failure mode. 'A handful of marquee clients' should always trigger deeper investigation.",
   modelRationale:"T3 (Perplexity Sonar Pro) for multi-source investigation of customer relationships and revenue signals."},

  {id:"F1",phase:"financial",label:"Business Model Deconstructionist",feeds:["F2","F7","F8","F9","E6","D10"],
   objective:"Deconstruct the business model into its component revenue streams and identify the mechanics that drive expansion and retention.",
   input:"Pitch deck (A2), company website, pricing page",
   output:'JSON: { model_type, revenue_streams: [{ stream, type, estimated_contribution }], expansion_drivers[] }',
   why:"The business model determines everything downstream — unit economics, capital requirements, scaling path, and exit multiples. Getting this wrong cascades through the entire financial analysis.",
   inPractice:"A model breakdown. 'Primary revenue: SaaS subscription (est. 80% of revenue). Secondary: Implementation services (est. 20%). Expansion drivers: Seat-based expansion, module upsell (advanced analytics). Recurring revenue ratio: ~80%. Note: Services revenue drag on gross margin — watch gross margin at scale.'",
   limitations:"Revenue mix is rarely disclosed precisely at early stage. Service revenue is frequently bundled into subscription pricing to inflate reported ARR — this requires careful investigation.",
   failureModes:"Misidentifying a services-heavy business as a SaaS business leads to incorrect gross margin assumptions, wrong comparable company selection, and a systematically overvalued exit multiple.",
   modelRationale:"T2 (Claude Sonnet) for business model classification and revenue stream decomposition."},

  {id:"F2",phase:"financial",label:"Unit Economics Estimator",feeds:["F3","F4","F5"],
   objective:"Model the unit economics of the business from available data and stated assumptions, making every assumption explicit and traceable.",
   input:"Deck claims (A2), industry benchmarks, competitor data, cohort data (F7), viral coefficient (F8)",
   output:'JSON: { estimated_ltv, estimated_cac, ltv_cac_ratio, payback_period_months, gross_margin_estimate, assumptions[], viability_assessment }',
   why:"Unit economics are the foundation of every financial decision in the investment. A business with LTV:CAC of 8:1 and 14-month payback is structurally sound. One with 1.2:1 is burning capital to acquire customers it will never profitably serve.",
   inPractice:"A unit economics model. 'Estimated LTV: ₹4.2L (24-month avg contract, 85% gross margin, 92% net retention). Estimated CAC: ₹52K (based on headcount and role mix). LTV:CAC ratio: 8.1. Payback period: 14 months. Key assumption: 92% net retention is based on deck claim — unverified.'",
   limitations:"All early-stage unit economics are estimates built on assumptions. The quality of this output is entirely dependent on the quality of the input claims — garbage in, garbage out.",
   failureModes:"Presenting model outputs with false precision obscures the uncertainty in the underlying assumptions. A LTV:CAC of 8.1 is not meaningfully different from 7.8 or 9.2 at this level of data quality.",
   modelRationale:"T4 (Claude Opus) for financial modelling requiring multi-step reasoning across interdependent assumptions."},

  {id:"F3",phase:"financial",label:"Financial Projection Stress Tester",feeds:["G3","MB-D2"],
   objective:"Stress-test the deck's financial projections against historical benchmarks and identify the assumptions most likely to be wrong.",
   input:"Deck projections from A2, comparable company growth data, unit economics (F2), seasonality (F9)",
   output:'JSON: { projection_assessment, key_flags: [{ metric, deck_value, benchmark_value, assessment }], adjusted_projections{} }',
   why:"Almost every pitch deck shows a hockey stick. This agent quantifies exactly how aggressive the hockey stick is and whether there is any historical precedent for a company in this sector achieving this growth rate.",
   inPractice:"A projection audit. 'Deck projects 8x revenue growth in Year 3. Benchmark: Top quartile Indian B2B SaaS at same stage: 3.2x in Year 3. Assessment: Aggressive. Key assumption at risk: Projects 180% net revenue retention (benchmark: 110-130%). Adjusted base case: 3.5x growth.'",
   limitations:"Historical benchmarks don't account for category-creating companies that genuinely grow faster than precedent. Unicorns looked unrealistic in their early projections too.",
   failureModes:"Using the wrong benchmark peer group — comparing a horizontal SaaS to a vertical SaaS — can make realistic projections appear aggressive or aggressive projections appear reasonable.",
   modelRationale:"T4 (Claude Opus) for financial stress testing requiring complex multi-scenario modelling and benchmark synthesis."},

  {id:"F4",phase:"financial",label:"Burn Rate Estimator",feeds:["F5","G3","MB-D3"],
   objective:"Estimate the company's monthly cash burn and remaining runway from publicly available signals, without relying on founder-reported figures.",
   input:"LinkedIn headcount, industry salary benchmarks, funding data from A2, cap table from F6",
   output:'JSON: { estimated_team_size, estimated_monthly_burn, last_known_funding, estimated_runway_months, urgency_flag: bool }',
   why:"A founder under runway pressure is a compromised negotiating partner and a flight-risk. Understanding the real burn rate and runway — independent of what the founder reports — is essential for deal timing and term decisions.",
   inPractice:"A burn estimate. 'Estimated team: 24 (from LinkedIn). Estimated monthly burn: ₹38-45L (salary bench × headcount + estimated office/infra costs). Last confirmed funding: ₹4.5Cr in Jan 2023. Estimated runway: 10-13 months. Urgency flag: TRUE — fundraising pressure likely.'",
   limitations:"Burn estimation from headcount is imprecise. It doesn't capture contractor costs, unusual compensation structures, heavy infrastructure spend, or deferred salaries.",
   failureModes:"Underestimating burn creates false confidence that the company has time to close a larger round at better terms. Many founders negotiate slowly because the investor thinks there's no urgency — when there is.",
   modelRationale:"T4 (Claude Opus) for multi-input burn modelling with salary benchmarking and runway calculation."},

  {id:"F5",phase:"financial",label:"Capital Efficiency Benchmarker",feeds:["G3","G12"],
   objective:"Calculate capital efficiency metrics and benchmark them against comparable companies at the same stage and sector.",
   input:"Unit economics (F2), burn rate (F4), industry benchmarks",
   output:'JSON: { burn_multiple, revenue_per_employee, funding_efficiency_ratio, benchmark_comparison[] }',
   why:"Capital efficiency is the measure of how well the team converts investor money into business progress. A company that has raised ₹20Cr and generates ₹1Cr ARR is in a very different position than one that raised ₹5Cr to generate the same ARR.",
   inPractice:"An efficiency report. 'Burn multiple: 2.4x (net burn/net new ARR). Benchmark: Top quartile India B2B SaaS: 1.8x. Assessment: Below top quartile but within acceptable range. Revenue per employee: ₹4.8L/year. Best-in-class at this stage: ₹8-12L. Opportunity for operational leverage.'",
   limitations:"Capital efficiency benchmarks vary enormously by sector. A deeptech company building hardware will have a legitimately higher burn multiple than a pure-play SaaS company — direct comparison is misleading.",
   failureModes:"Penalising a company for high burn multiples without contextualising them against sector norms can cause the fund to pass on high-quality deeptech companies that are capital-efficient relative to their peers.",
   modelRationale:"T4 (Claude Opus) for multi-metric efficiency calculation and benchmark contextualisation."},

  {id:"F6",phase:"financial",label:"Cap Table Modeler",feeds:["F4","H1","H3","MB-A10"],
   objective:"Model the likely cap table structure based on disclosed funding history and estimate post-money ownership for the current round.",
   input:"Funding data from A2, standard ownership benchmarks",
   output:"Estimated cap table (founders, investors, ESOP) and post-money ownership model for this round",
   why:"A cap table with founders diluted below 40% before Series A, stacked SAFEs at multiple valuations, and an underfunded ESOP pool is a structural problem that will make the company difficult to finance in future rounds.",
   inPractice:"A cap table reconstruction. 'Estimated post-current-round ownership: Founders 52%, Seed investors 28% (3one4: 14%, angels: 14%), ESOP pool 12%, This round (20% dilution assumption): 8%. Note: Founders retain majority control — healthy structure. ESOP pool appears adequate for next 18 months.'",
   limitations:"Cap table reconstruction from public data is imprecise — actual ownership depends on SAFE conversion caps, pro-rata rights, and anti-dilution provisions that are not publicly disclosed.",
   failureModes:"Estimating founder ownership higher than actual based on incomplete SAFE disclosure history can make a highly diluted founding team appear adequately incentivised when they are not.",
   modelRationale:"T4 (Claude Opus) for financial modelling of ownership dilution across multiple round scenarios."},

  {id:"F7",phase:"financial",label:"Cohort Retention Agent",feeds:["F2"],
   objective:"For subscription businesses, model user and revenue retention by cohort to assess whether early customers are staying and expanding.",
   input:"Deck claims (A2), industry benchmarks for specific vertical",
   output:"Modeled cohort retention curve, revenue retention by cohort, LTV derived from retention model",
   why:"Cohort retention is the most important single metric in a subscription business. Everything else — LTV, payback period, growth trajectory — is built on this foundation. Poor cohort retention makes everything else irrelevant.",
   inPractice:"A cohort model. 'Based on stated 92% gross retention and 108% net retention (validated as plausible for vertical SaaS): Month-6 cohort retention: ~78%, Month-12: ~68%. Net revenue retention suggests meaningful expansion. LTV derived from retention curve: ₹3.8-4.4L (range based on retention uncertainty).'",
   limitations:"Without access to actual cohort data, this model is built on deck-stated retention figures. If those figures are wrong — even slightly — the entire LTV calculation is wrong.",
   failureModes:"A company that reports blended retention figures rather than cohort-specific retention may be masking significant early churn hidden by rapid new customer acquisition — a classic treadmill business.",
   modelRationale:"T4 (Claude Opus) for cohort modelling and financial projection requiring multi-step analytical reasoning."},

  {id:"F8",phase:"financial",label:"Viral Coefficient Estimator",feeds:["F2"],
   objective:"For PLG and consumer businesses, estimate the viral K-factor and model its impact on organic growth and CAC.",
   input:"Product features (D1), user reviews (E3), social mentions (E4), referral program analysis",
   output:"Estimated K-factor with stated assumptions, modeled CAC impact",
   why:"A K-factor above 1.0 means the product grows itself. Even a K-factor of 0.5 dramatically reduces effective CAC. For PLG businesses, this is the primary driver of capital efficiency.",
   inPractice:"A virality estimate. 'Product has in-app sharing mechanics and team collaboration features. Social mentions show 23% of mentions are peer recommendations. Estimated K-factor: 0.3-0.4. Interpretation: Each 10 acquired users organically generate 3-4 additional users. Effective CAC reduction: ~30%.'",
   limitations:"K-factor estimation without access to actual referral tracking data is speculative. The estimate range is typically wide, and the model's output should be treated as directional.",
   failureModes:"Overestimating the K-factor inflates the organic growth assumption in the financial model — leading to significantly overoptimistic CAC projections in later-stage scenarios.",
   modelRationale:"T4 (Claude Opus) for viral coefficient modelling requiring synthesis of multiple indirect signals."},

  {id:"F9",phase:"financial",label:"Seasonality Analyzer",feeds:["F3"],
   objective:"Determine whether the business has significant seasonal revenue patterns that affect financial projections and cash flow planning.",
   input:"Google Trends data, business model analysis (F1), hiring patterns (E5)",
   output:"Seasonality assessment including estimated revenue variance by quarter",
   why:"A company with strong Q4 seasonal revenue looks very different in Q1. A VC meeting the company in March and projecting Q4 performance based on Q1 run rate will be significantly misled without seasonality context.",
   inPractice:"A seasonality analysis. 'Google Trends for primary category shows consistent Q4 peak (Nov-Dec) and Q1 trough (Jan-Feb) across 3 years. Estimated revenue variance: ±35% vs annual average. Impact on projections: Year-1 revenue target is Q4-weighted — meeting year targets requires strong H2 performance.'",
   limitations:"For very new companies with limited operating history, seasonality signals from industry proxies may not reflect the company's actual revenue patterns, which could be customer-mix driven.",
   failureModes:"Missing a significant seasonal pattern leads to a financial model that looks like a smooth growth curve when the actual cash flow has 40% swings — creating liquidity risk that isn't visible in the projections.",
   modelRationale:"T2 (Claude Sonnet) for Google Trends analysis and seasonality pattern identification."},

  {id:"G1",phase:"strategic",label:"Exit Pathway Architect",feeds:["G3"],
   objective:"Map the most plausible exit scenarios — strategic M&A, IPO, or secondary — and identify the most likely acquirers with a rationale for each.",
   input:"Comparable transactions (G2), competitor M&A history, public company strategies",
   output:'JSON: { primary_exit_scenario, potential_acquirers: [{ company, rationale, likelihood }], ipo_feasibility_assessment }',
   why:"Venture is about exits. If there is no credible exit path, there is no investment case. This agent forces the question that most deal memos leave implicit: who actually buys this company, and why?",
   inPractice:"An exit analysis. 'Primary scenario: Strategic acquisition (70% probability). Most likely acquirers: Zoho (product line extension, strong India M&A appetite), Freshworks (competitive defensive acquisition), Tata Tele Business Services (enterprise customer base). IPO: Possible at $50M+ ARR in 5-7 years. Secondary: Limited options at this stage.'",
   limitations:"M&A prediction is inherently speculative. Strategic priorities of acquirers change with their own product roadmaps, financial conditions, and management changes.",
   failureModes:"Identifying an acquirer that is structurally unable to complete acquisitions (family-owned, under regulatory scrutiny, capital constrained) creates a false sense of exit optionality.",
   modelRationale:"T3 (Perplexity Sonar Pro) for M&A research + T4 (Claude Opus) for strategic reasoning about acquirer motivations."},

  {id:"G2",phase:"strategic",label:"Comparable Transaction Analyzer",feeds:["G1","H1","C11"],
   objective:"Find recent funding rounds and M&A transactions for comparable companies and calculate the valuation multiples implied.",
   input:"Competitor funding data (C3), M&A databases via Perplexity, news archives",
   output:'JSON: { comparable_transactions: [{ company, type, date, valuation, revenue_multiple, source_url }], median_multiple, suggested_valuation_range }',
   why:"Valuation is not an opinion — it's anchored in comparable transactions. This agent establishes the market-clearing price for companies like this one, making the valuation conversation evidence-based.",
   inPractice:"A transaction comparable table. '5 relevant transactions in the last 18 months: Median acquisition multiple 6.2x ARR, seed-stage median 12x forward ARR. Implied valuation range for target at current ARR: $8-14M. Deck asks at $18M — 29% above median. Requires justification.'",
   limitations:"Comparable transaction data for Indian early-stage companies is sparsely reported. Many acquisitions happen quietly without disclosed valuations, creating selection bias in the comparable set.",
   failureModes:"Using a small sample of comparable transactions — especially cherry-picked outliers — produces a misleading valuation range that can anchor negotiations at incorrect levels.",
   modelRationale:"T3 (Perplexity Deep Research) for comprehensive multi-step transaction research requiring synthesis across multiple databases."},

  {id:"G3",phase:"strategic",label:"Scenario Modeler",feeds:["G5","G12"],
   objective:"Build rigorous bull, base, and bear scenarios for the company's 3-5 year trajectory, each with explicit assumptions and estimated return multiples.",
   input:"G1, G2, G4, G7, G10, G11, F3, F5, C6, C7 — full synthesis required",
   output:'JSON: { bull_case: { assumptions[], exit_value, return_multiple }, base_case: {...}, bear_case: {...} }',
   why:"Investing without a scenario model is guessing. This agent forces explicit assumption articulation across three futures — which makes the bet being taken transparent and testable against actual outcomes.",
   inPractice:"A three-scenario model. 'Bull (25% probability): 4x revenue growth, $45M acquisition at 8x ARR in Year 5 — 11x return. Base (50%): 2.5x growth, $22M acquisition at 5.5x ARR — 5x return. Bear (25%): Growth stalls, bridge round at down valuation, acqui-hire at $4M — 0.8x return. Expected value: 6.1x.'",
   limitations:"Scenario modelling creates false precision around inherently uncertain futures. The probabilities assigned to each scenario are subjective and anchored in the analyst's biases.",
   failureModes:"A scenario model built on optimistic base-case assumptions produces an expected value calculation that feels rigorous but is actually just a more elaborate form of wishful thinking.",
   modelRationale:"T4 (Claude Opus) for complex multi-variable scenario construction requiring synthesis of all upstream analytical outputs."},

  {id:"G4",phase:"strategic",label:"Risk Matrix Constructor",feeds:["G5","G6","H2","K6"],
   objective:"Aggregate all risks identified across every agent into a single, prioritised risk matrix scored by likelihood and impact.",
   input:"All previous agent outputs — especially A3, B3, B5, B6, C9, D4, D5, E11, F3, F4",
   output:"Risk matrix: [{ risk, category, likelihood: 1-5, impact: 1-5, mitigation_strategy }]",
   why:"Investors don't avoid risk — they price it. A comprehensive risk matrix makes the risks being accepted explicit, ensures none are missed, and anchors the valuation and deal terms discussion.",
   inPractice:"A risk register. 'Critical risks: Regulatory (DPDP Act compliance, likelihood 4/5, impact 5/5), Customer concentration (top 3 clients = 65% revenue, likelihood 3/5, impact 5/5). Major risks: Key person dependency (CTO single point of failure), Technical debt (3rd posting for engineering lead). Mitigation strategies provided for each.'",
   limitations:"Risk matrices create false precision through numerical scoring of inherently qualitative judgments. A risk scored 4/5 × 4/5 is not meaningfully different from 3/5 × 5/5.",
   failureModes:"A risk matrix that lists 25 risks of similar severity is less useful than one that clearly identifies the top 3 existential risks. Length and comprehensiveness are not the same as usefulness.",
   modelRationale:"T4 (Claude Opus) for cross-agent risk synthesis requiring judgment across all analytical dimensions."},

  {id:"G5",phase:"strategic",label:"Fund Thesis Alignment Scorer",feeds:["L1"],
   objective:"Score the company's alignment with the fund's stated investment thesis across every relevant dimension.",
   input:"Fund thesis document (pre-configured), all previous outputs",
   output:'JSON: { overall_alignment_score: 1-10, dimension_scores{}, recommendation, justification }',
   why:"A fund that invests outside its thesis destroys LP trust and dilutes its own brand. This agent enforces thesis discipline at scale — ensuring every investment decision is anchored in the fund's stated mandate.",
   inPractice:"An alignment scorecard. 'Overall alignment: 7.8/10. Sector: 9/10 (direct deeptech match). Stage: 8/10 (seed to pre-Series A). Geography: 10/10 (India-first). Business model: 7/10 (hardware revenue component slightly outside pure-software thesis). Return profile: 6/10 (longer path to liquidity than target).'",
   limitations:"Thesis documents are living documents. If the fund thesis hasn't been updated recently, it may not reflect the GP's actual current conviction — and alignment scoring against a stale thesis is misleading.",
   failureModes:"A high alignment score on a poorly defined thesis doesn't validate the investment — it validates the thesis matching process. The thesis itself must be regularly reviewed for quality.",
   modelRationale:"T4 (Claude Opus) for multi-dimensional thesis alignment reasoning requiring contextual judgment."},

  {id:"G6",phase:"strategic",label:"Key Question Generator",feeds:["L1","MC4"],
   objective:"Generate a prioritised list of questions that a GP should ask the founder in follow-up conversations to resolve the remaining uncertainties.",
   input:"All previous outputs — especially unverified claims (E1) and risk matrix (G4)",
   output:'JSON: { questions: [{ question, category, priority: "critical/important/nice-to-have", context }] }',
   why:"A GP walking into a founder meeting without a targeted question list wastes the most valuable diligence resource: direct access to the people who know everything about the company.",
   inPractice:"A structured question list. 'Critical: What is the actual breakdown of revenue by customer — specifically, what % comes from your top 3 customers? (Context: We estimate 60-70% concentration — a material risk if accurate.) Important: Walk us through the CTO's departure and return — what changed? Nice-to-have: What's the current Glassdoor review response policy?'",
   limitations:"The quality of the question list is directly proportional to the quality of the preceding analysis. If key risks were missed upstream, the most important questions won't be asked.",
   failureModes:"A question list that is too long (20+ questions) is as useless as one that is too short — founders shut down when they feel interrogated rather than engaged. The top 5-7 critical questions are what matters.",
   modelRationale:"T4 (Claude Opus) for synthesising all analytical gaps into high-leverage, precisely worded questions."},

  {id:"G7",phase:"strategic",label:"Analogous Company Mapper",feeds:["G3"],
   objective:"Identify 3-5 companies that followed a similar trajectory at a similar stage and map what actually happened to them.",
   input:"Company entities from A2, web search, historical company data",
   output:'JSON: { analogous_companies: [{ name, similarity_basis, trajectory_summary, outcome, lesson_for_target_company }] }',
   why:"Pattern matching against historical companies is the most honest form of scenario planning available. 'This looks like Razorpay in 2015' or 'This looks like TaxiForSure in 2013' anchors the analysis in real outcomes.",
   inPractice:"A historical analog report. 'Most similar: Paperflite (2019 seed stage, similar B2B SaaS profile, raised Series A in 2021 at 8x multiple — comparable trajectory). Warning analog: Instamojo (similar SMB payments play, struggled with NPA risk and regulatory headwinds — key risk to monitor). Lesson: Regulatory navigation is the differentiating factor.'",
   limitations:"No two companies are truly analogous — different market conditions, different teams, and different timing mean historical patterns are guides, not templates.",
   failureModes:"Matching to a successful analog can create confirmation bias — finding the Razorpay comparison while missing the Instamojo comparison produces a systematically optimistic picture.",
   modelRationale:"T3 (Perplexity Sonar Pro) for historical company research and outcome tracking across databases and news archives."},

  {id:"G8",phase:"strategic",label:"Sector Expert Briefing",feeds:["G5"],
   objective:"Produce a standalone sector briefing document that equips any reader — regardless of prior sector knowledge — to evaluate this company intelligently.",
   input:"All market/product outputs (C6-C10, D1-D6) + Perplexity Deep Research",
   output:"5-8 page cited sector briefing document",
   why:"No fund can have deep expertise in every sector. This agent is the institutional equaliser — it ensures that a GP from a fintech background can walk into a deeptech IC meeting with the context they need.",
   inPractice:"A briefing document covering the sector in full: market structure, key players, recent M&A, regulatory environment, technology trends, key metrics to watch, and investment thesis. Written for a smart generalist, not a technical expert.",
   limitations:"A briefing document built primarily from AI research will miss the nuanced, on-the-ground insights that come from industry practitioner conversations. It is a foundation for sector understanding, not a replacement for expert calls.",
   failureModes:"A sector briefing that is too long and comprehensive becomes unusable in practice. If it takes 3 hours to read, it won't be read — the agent must make editorial choices about depth vs breadth.",
   modelRationale:"T3 (Perplexity Deep Research) for comprehensive multi-source sector research producing a cited, structured briefing document."},

  {id:"G9",phase:"strategic",label:"Counter Thesis Generator",feeds:["L1","K6"],
   objective:"Generate the strongest possible, data-driven argument against investing in this company.",
   input:"All previous outputs — especially risk matrix (G4) and scenario model (G3)",
   output:"Well-reasoned 3-5 paragraph bear thesis memo targeting the 3 most vulnerable assumptions",
   why:"Every investor is subconsciously building a bull case. This agent plays devil's advocate at the highest level of sophistication — it ensures the bear case gets a fair hearing before capital is committed.",
   inPractice:"A bear thesis memo. 'The bull case rests on three assumptions that we believe are materially flawed: (1) The claimed 3x YoY growth is unverifiable and likely overstated based on web traffic analysis. (2) The 'AI differentiation' is an OpenAI API wrapper that any competitor can replicate in 6 weeks. (3) The primary exit buyer (Zoho) has a stated policy of building rather than buying in this category. Together, these make the base case more likely a 2x return than a 5x.'",
   limitations:"The counter thesis is deliberately one-sided. Its purpose is to stress-test the bull case, not to provide a balanced view — it should always be read alongside the thesis alignment output.",
   failureModes:"A counter thesis that finds bear arguments everywhere — including in companies that are genuinely excellent — produces analytical fatigue and erodes the signal value of the output.",
   modelRationale:"T4 (Claude Opus) for sophisticated adversarial reasoning that constructs the strongest possible case against a position, requiring full context synthesis."},

  {id:"G10",phase:"strategic",label:"Geographic Expansion Agent",feeds:["G3"],
   objective:"Assess how easily the business can expand beyond its current geographic market and identify the key barriers to international growth.",
   input:"Business model (F1), regulatory landscape (C9), competitive landscape in other geos",
   output:"Assessment of internationalization potential and challenges by target market",
   why:"A business that is fundamentally India-only (due to regulatory structure, customer behavior, or unit economics) has a much smaller TAM than one with credible international potential. This affects exit options and return multiples significantly.",
   inPractice:"A geographic expansion analysis. 'Current market: India (90% revenue). Southeast Asia potential: High — similar regulatory environment, similar SMB digitisation curve, 2 competitors present but not dominant. USA potential: Low — highly competitive, requires local sales team, product not differentiated enough for premium pricing. Recommended expansion sequence: India → Southeast Asia → Middle East.'",
   limitations:"Geographic expansion analysis from desktop research misses the on-the-ground realities of local market dynamics, relationship-based sales cultures, and regulatory nuances that only practitioners know.",
   failureModes:"Recommending aggressive international expansion for a company that hasn't yet won its home market creates a distraction that historically destroys more value than it creates.",
   modelRationale:"T3 (Perplexity Sonar Pro) for geographic market research and regulatory comparison across target markets."},

  {id:"G11",phase:"strategic",label:"Adjacent Market Agent",feeds:["G3"],
   objective:"Identify high-potential adjacent markets that the company could serve with its existing customer relationships and core technology.",
   input:"Customer profile from D1, product analysis, customer concentration data (E11)",
   output:"List of 3-5 high-potential adjacent market opportunities with market size and fit rationale",
   why:"The best venture returns often come from companies that expand into adjacent markets beyond their original scope. Identifying those adjacencies at seed stage informs the exit optionality and long-term return potential.",
   inPractice:"An adjacency map. 'Core market: GST compliance for MSMEs. Adjacent 1: Payroll and HR compliance (same buyer, similar workflow, $1.4B market). Adjacent 2: Inventory financing (access to financial data creates credit underwriting capability, high-value adjacency). Adjacent 3: Legal compliance (lower value, more complex, lower priority).'",
   limitations:"Adjacency analysis is highly speculative at early stage. Companies routinely identify adjacencies that they never actually pursue — the analysis is useful for optionality assessment but should not drive the core investment thesis.",
   failureModes:"Founders who over-rotate toward identified adjacencies before winning their primary market are a common failure pattern — the agent's output should inform but not encourage premature diversification.",
   modelRationale:"T3 (Perplexity Sonar Pro) for adjacent market research and opportunity sizing."},

  {id:"G12",phase:"strategic",label:"Follow-on Probability Agent",feeds:["L1"],
   objective:"Estimate the probability that this company will successfully raise its next funding round and identify the key factors that will determine the outcome.",
   input:"All previous outputs — especially G3, F5, G4",
   output:"Probability score (%) with detailed justification broken down by team, metrics, market, and investor relationships",
   why:"A fund that cannot follow-on its best companies faces a binary choice: protect pro-rata rights and risk overconcentration, or get diluted in the next round. Follow-on probability assessment informs reserve allocation decisions.",
   inPractice:"A follow-on probability assessment. 'Estimated probability of successful Series A raise within 18 months: 52%. Positive factors: Strong investor network, metrics trajectory improving. Negative factors: Current burn multiple (2.4x) exceeds Series A benchmarks, revenue concentration risk may deter institutional investors, competitive market dynamic intensifying.'",
   limitations:"Follow-on probability depends heavily on market conditions at the time of raise — conditions that are inherently unpredictable 18 months in advance.",
   failureModes:"A high follow-on probability score for a company that hasn't solved its unit economics can create overconfidence in the reserve allocation — leading to insufficient reserves when the raise takes longer than expected.",
   modelRationale:"T4 (Claude Opus) for probability estimation requiring synthesis of all upstream outputs into a coherent forward-looking judgment."},

  {id:"H1",phase:"deal",label:"Valuation & Deal Terms",feeds:["H2"],
   objective:"Recommend a credible pre-money valuation range and the key deal terms the fund should propose based on comparable transactions and risk assessment.",
   input:"Comparable transactions (G2), public comps (C11), cap table (F6)",
   output:"Recommended pre-money valuation range + key terms: board seat, pro-rata, information rights, liquidation preference",
   why:"Negotiating blind is the fastest way to either overpay or lose the deal. This agent arms the GP with a data-backed anchor and a structured term sheet framework before any negotiation conversation begins.",
   inPractice:"A deal recommendation. 'Recommended valuation: $10-14M pre-money (comparable transactions suggest $8-14M range; company quality warrants upper half). Key terms: Board seat (YES — risk profile warrants board representation), Pro-rata rights through Series B (YES — portfolio construction), 1x non-participating liquidation preference (STANDARD).'",
   limitations:"Valuation recommendations are anchored in transaction comparables that may not reflect the fund's specific return requirements, portfolio construction goals, or competitive dynamics of this specific deal.",
   failureModes:"Treating the recommended valuation as a hard target rather than an evidence-based starting point can cause the fund to walk away from an excellent company over a $1-2M valuation disagreement.",
   modelRationale:"T4 (Claude Opus) for valuation reasoning that integrates comparables, risk factors, and deal structure considerations."},

  {id:"H2",phase:"deal",label:"Diligence Checklist Generator",feeds:["L1"],
   objective:"Generate a customised legal and technical diligence checklist tailored to this company's specific risks and stage — not a generic template.",
   input:"Risk matrix (G4), all agent outputs, deal terms (H1)",
   output:"Customised diligence checklist organised by: legal, technical, financial, commercial, regulatory, IP",
   why:"Generic diligence checklists miss company-specific risks. A company with high regulatory risk needs a deeper regulatory legal review. A company with IP claims needs a patent attorney, not just a commercial lawyer.",
   inPractice:"A prioritised checklist. 'Priority legal: Independent verification of cap table (customer concentration risk flagged), Review of data processing agreements (DPDP Act compliance risk). Priority commercial: Customer reference calls specifically asking about revenue concentration and NPS. Priority technical: Code review of core ML pipeline and data security practices.'",
   limitations:"The checklist quality is only as good as the risk identification upstream. Risks that the Murder Board and Risk Matrix missed won't appear in the checklist.",
   failureModes:"A checklist that is too comprehensive — covering every theoretical risk — leads to diligence fatigue and missed deadlines. The agent must prioritise ruthlessly based on the risk severity ranking.",
   modelRationale:"T3 (Perplexity Sonar Pro) for researching standard diligence requirements combined with custom risk-based prioritisation."},

  {id:"H3",phase:"deal",label:"Cap Table Purity Agent",feeds:["H1"],
   objective:"Screen all existing cap table investors for potential issues — sanctions, controversies, conflicts of interest, or problematic cap table structures.",
   input:"Previous investor list from B12, news archives, regulatory databases",
   output:'JSON: { flagged_investors: [{ name, issue, severity }], overall_purity_assessment }',
   why:"One problematic investor on a cap table — whether sanctioned, controversial, or conflicted — can kill an otherwise excellent deal. Finding this before term sheet is critical; finding it during legal diligence is expensive.",
   inPractice:"A cap table screening report. 'All investors screened against OFAC, UK sanctions, and Indian regulatory blacklists — no hits. Attention: One angel investor has an ongoing SEBI enforcement proceeding for insider trading — classified as Major flag. Recommend obtaining formal legal clearance before proceeding.'",
   limitations:"Sanctions databases have coverage gaps, especially for newer designations and for individuals operating through corporate structures to obscure beneficial ownership.",
   failureModes:"Missing a sanctioned beneficial owner who holds equity through a clean-looking corporate entity can expose the fund to regulatory risk that surfaces during legal diligence — after significant time and cost has been spent.",
   modelRationale:"T3 (Perplexity Sonar Pro) for comprehensive screening across regulatory databases and news archives."},

  {id:"H4",phase:"deal",label:"Reference Check Questions",feeds:["L1"],
   objective:"Generate targeted, non-generic reference check questions for each founder based on specific diligence findings that need verification.",
   input:"Founder track record (B3), career history (B2), risk matrix (G4)",
   output:"List of tailored questions per founder organised by: management style, execution, integrity, coachability",
   why:"Generic reference check questions produce generic answers. Targeted questions built on actual diligence findings produce the specific confirmation or contradiction that resolves remaining uncertainties.",
   inPractice:"A targeted question list per founder. 'For CEO — Ask former co-founder at previous venture: 'Can you describe what happened to the company and how Arjun responded to the wind-down situation?' (Context: We believe the previous company failed due to a co-founder conflict that isn't disclosed.) For CTO — Ask former manager: 'How did he respond to technical decisions being overruled by the CEO?'",
   limitations:"Reference checks are inherently biased — founders only provide references who will speak positively about them. The most valuable reference checks are on references not provided.",
   failureModes:"Using this agent's questions in a formal reference call rather than a natural conversation will make the founder's references defensive and produce less honest answers.",
   modelRationale:"T2 (Claude Sonnet) for generating targeted, context-aware questions from structured diligence findings."},

  {id:"GY1",phase:"graveyard",label:"Cemetery Search Agent",feeds:["GY2"],
   objective:"Search the Graveyard Database — a curated library of failed startups — to find the 5 most similar companies to the current deal that are now dead.",
   input:"Entity and claim data from A2, Graveyard Database (internal — populated from public post-mortems, news archives, and system's own killed deals)",
   output:'JSON: { similar_dead_companies: [{ name, sector, stage_at_death, similarity_score: 1-10, cause_of_death_summary }] }',
   why:"History rhymes. Before investing in a company, the most important question is: who tried this before and why did they fail? This agent answers that question systematically rather than leaving it to memory.",
   inPractice:"A graveyard search report. 'Top 5 similar failed companies: (1) Supplyfy — B2B supply chain SaaS, failed 2021, similarity score 8.2/10. Cause: Customer concentration (2 clients = 80% revenue), both churned in same quarter. (2) LogiTech India — similar GTM, failed 2019, similarity 7.4/10. Cause: Regulatory change destroyed unit economics.'",
   limitations:"The Graveyard Database is only as comprehensive as its curation. Early-stage failures that happen quietly — without press coverage or post-mortems — are systematically underrepresented.",
   failureModes:"A graveyard search that surfaces no similar failed companies when many exist (due to database gaps) creates false confidence that the current path hasn't been tried and failed before.",
   modelRationale:"T3 (Perplexity Sonar Pro) for real-time web research to supplement the internal Graveyard Database with publicly documented failures."},

  {id:"GY2",phase:"graveyard",label:"Autopsy Report Agent",feeds:["GY3"],
   objective:"For each of the 5 identified dead companies, produce a detailed post-mortem examining what went wrong and what the early warning signs were.",
   input:"Dead company list from GY1, web search, news archives, founder interviews",
   output:'Per dead company: { company_name, what_they_were, what_went_wrong[], early_warning_signs[], signals_missed[] }',
   why:"Knowing a company failed is not useful. Knowing what specific failure mode played out — and what early warning signals were visible but missed — is the most valuable input into the current deal analysis.",
   inPractice:"An autopsy report. 'Supplyfy (failed 2021): What went wrong — single large customer account (Flipkart supply chain division) represented 67% of ARR and churned when Flipkart insourced. Early warning signs visible at seed stage: (1) CEO mentioned only 'strategic customers' in pitches — red flag language for concentration. (2) Sales pipeline showed only enterprise deals, no SMB diversification.'",
   limitations:"Post-mortems are inherently retrospective and subject to survivor bias in the documentation. Failures that founders chose not to discuss publicly are the most valuable ones and the least documented.",
   failureModes:"An autopsy report that attributes failure to external factors ('the COVID pandemic') rather than internal factors ('the company had no cash reserves and a single customer') misses the actionable lesson.",
   modelRationale:"T4 (Claude Opus) for nuanced analysis of failure causation requiring sophisticated reasoning across multiple data sources."},

  {id:"GY3",phase:"graveyard",label:"Pattern of Death Matcher",feeds:["K6","CV2"],
   objective:"Compare the current deal's profile against the failure patterns documented in the autopsy reports and flag if the same patterns are present today.",
   input:"Autopsy reports from GY2, all current deal diligence data",
   output:'JSON: { matched_patterns: [{ pattern_name, dead_company, current_deal_evidence, severity }], critical_flag_triggered: bool }',
   why:"A founder who is repeating the same mistake that killed three previous companies in the same sector deserves a critical red flag — not because they will necessarily fail, but because the pattern is there and must be actively addressed.",
   inPractice:"A pattern match report. 'Pattern match: CUSTOMER CONCENTRATION RISK. Dead company analogs: Supplyfy (2021), LogiTech India (2019). Current deal evidence: Estimated top 3 clients = 65% revenue. Severity: Critical. Pattern matched: 2/5 dead analogs failed for exactly this reason. Triggering Critical Flag.'",
   limitations:"Pattern matching across different market conditions, geographies, and time periods can overfit — a pattern that was fatal in 2019 may be manageable with better tools and market awareness in 2024.",
   failureModes:"Matching a superficial pattern (same sector, similar business model) without checking whether the underlying cause is present in the current company can trigger false Critical Flags on strong companies.",
   modelRationale:"T4 (Claude Opus) for sophisticated pattern matching across multiple failure case studies and current deal data."},

  {id:"PM-BC",phase:"premortem",label:"Base Rate Calculator",feeds:["PM-RC","PM-PM","CV4"],
   objective:"Calculate the historical base rate of success for companies like this one — by sector, stage, geography, and business model — to ground conviction in statistical reality.",
   input:"Sector, stage, geography, and business model from A2. Historical startup outcome databases via Perplexity.",
   output:'JSON: { base_rate_success_pct, reference_population, data_sources[], confidence_in_estimate, implication }',
   why:"Humans are systematically overconfident about specific cases relative to base rates. This agent forces the question: if you invested in 100 companies exactly like this one, how many would generate a 3x+ return? The answer is almost always sobering.",
   inPractice:"A base rate report. 'Reference population: Indian B2B SaaS seed-stage companies, 2020-2023 vintage. Historical base rate of 3x+ return: ~12%. Historical base rate of total loss: ~38%. Note: This company has several factors (prior founder exit, strong domain expertise) that could shift it above the base rate — but the base rate anchors the analysis.'",
   limitations:"Base rates for Indian early-stage startups are poorly documented. The estimate is built from limited public data and carry significant uncertainty ranges that should be acknowledged.",
   failureModes:"Presenting the base rate as a precise prediction rather than a statistical anchor creates a false sense of certainty about a fundamentally uncertain outcome.",
   modelRationale:"T3 (Perplexity Sonar Pro) for research across startup outcome databases and academic literature on venture return distributions."},

  {id:"PM-RC",phase:"premortem",label:"Reference Class Forecaster",feeds:["PM-PM","CV4"],
   objective:"Identify 5-10 real companies that were in a similar position at a similar stage and document what actually happened to each of them.",
   input:"Base rate data (PM-BC), company profile from A2, analogous companies from G7",
   output:'JSON: { reference_class: [{ company, similarity_basis, stage_at_comparison, outcome }], class_success_rate_pct, class_failure_modes[], implied_outcome_distribution{} }',
   why:"Moving from abstract base rates to specific reference companies makes the probabilistic thinking concrete. 'Companies like this have a 12% success rate' becomes 'here are 10 companies like this — 1 was acquired well, 4 are still alive, 5 are dead.'",
   inPractice:"A reference class report with outcome distribution. 'Reference class of 10 most similar companies at same stage: 2 achieved strong exits (Zoho acquisition-level), 2 are ongoing with uncertain outlook, 1 pivoted successfully, 5 failed. Implied success rate: 20-40% (better than base rate — this cohort is selected for quality). Most common failure mode: Runway exhaustion during scale-up.'",
   limitations:"Selecting the reference class is a judgment call that carries significant subjectivity. The choice of which companies are 'similar' shapes the output more than any calculation.",
   failureModes:"A reference class that is self-servingly selected to include more successful companies than is statistically representative produces an optimistic outcome distribution that defeats the purpose of the exercise.",
   modelRationale:"T3 (Perplexity Sonar Pro) for researching specific company outcomes across databases and news archives."},

  {id:"PM-PM",phase:"premortem",label:"Pre-Mortem Agent",feeds:["CV2","CV4","K6"],
   objective:"Write a detailed, specific, first-person narrative of how this investment failed — from the perspective of a regretful investor looking back three years later.",
   input:"All diligence outputs, base rate (PM-BC), reference class outcomes (PM-RC), Graveyard patterns (GY3)",
   output:"400-600 word narrative in past tense + JSON: { core_wrong_assumption, early_warning_signs_rationalized[], turning_point, final_outcome }",
   why:"The most powerful anti-sycophancy mechanism in the system. By forcing the system to construct a concrete, emotionally resonant failure story before the decision, it makes the risks feel real — not abstract percentages. This is the single most effective check against confirmation bias.",
   inPractice:"A narrative. 'It is March 2027. We are writing off our investment in [Company]. Looking back, the signs were there. We knew the top 3 clients were 65% of revenue — we told ourselves they would diversify. They didn't. In Q3 2025, one client insourced. The company had 4 months of runway. The bridge round failed when two investors saw the churn data...' The story continues with specific detail about what was missed and what was rationalized away.",
   limitations:"A well-written failure narrative is emotionally compelling but may reflect the writer's priors more than the actual probability distribution of outcomes. The story feels more certain than reality warrants.",
   failureModes:"If this narrative is so compelling that it causes the fund to pass on an excellent deal that has a manageable risk profile, the pre-mortem has overcorrected from optimism to paralysis.",
   modelRationale:"T4 (Claude Opus) at maximum adversarial reasoning — this agent must generate a genuinely disturbing, specific, and plausible failure story that would make any investor pause."},

  {id:"MB-A1",phase:"murder",label:"Founder Narcissism Detector",feeds:["K6"],
   objective:"Analyze the founder's public communications for narcissistic personality traits that research correlates with startup failure.",
   input:"Pitch deck text, founder LinkedIn posts, blog posts, podcast transcripts, public interviews",
   output:'JSON: { narcissism_risk_score: 1-10, evidence: [{ quote, source_url, flag_type }] }',
   why:"Narcissistic founders are systematically worse at building companies. They ignore customer feedback, alienate key team members, and create culture problems that compound over time. Identifying this early prevents relationship disasters.",
   inPractice:"A behavioral analysis. 'Score: 6.4/10. Flags: (1) Deck uses 'I' 47 times, 'we' 8 times — significantly above average. (2) Podcast quote: 'None of my competitors understand this market like I do' — dismissive framing. (3) LinkedIn post dismissing a critical industry analyst report as 'written by someone who clearly never built anything.' Moderate risk.'",
   limitations:"Cultural context matters enormously. Some communication styles that register as narcissistic in a Western context are normal professional confidence in South Asian business cultures. Calibration is required.",
   failureModes:"Misidentifying confident, clear communication as narcissism will cause the system to penalise founders who are simply direct and decisive — critical traits for early-stage company building.",
   modelRationale:"T2 (Claude Sonnet) for text analysis and behavioral pattern recognition across communication samples."},

  {id:"MB-A2",phase:"murder",label:"Relationship With Truth",feeds:["K6"],
   objective:"Cross-reference every factual claim the founder makes across all public sources to detect patterns of exaggeration or misrepresentation.",
   input:"Pitch deck claims, web search, LinkedIn, Wayback Machine, SimilarWeb",
   output:'JSON: { truth_score: 1-10, discrepancies: [{ claim, verified_reality, source_url, severity }] }',
   why:"A single verifiable lie in a deck is a red flag. A pattern of small exaggerations is a critical flag. Both indicate a founder who will tell investors what they want to hear rather than what is true — a relationship that always ends badly.",
   inPractice:"A truth audit. 'Claim: 'Ex-Google, IIT alumni.' Reality: LinkedIn shows 3-month internship at Google (not full-time employment). Severity: Moderate — misleading framing. Claim: '$1.2M ARR.' Reality: Web traffic and app install data inconsistent with this revenue level at stated pricing. Severity: High — requires verification. Overall truth score: 5.8/10.'",
   limitations:"Legitimate rounding, marketing framing, and aspirational language are normal in pitch decks. Not every discrepancy is a lie — the severity classification requires nuanced judgment.",
   failureModes:"Flagging every minor rounding or aspirational claim as a truth discrepancy creates a false impression of dishonesty for founders who are operating within normal pitch norms.",
   modelRationale:"T3 (Perplexity Sonar Pro) for systematic cross-referencing of specific claims against multiple independent sources."},

  {id:"MB-A3",phase:"murder",label:"Adversity Response Analyzer",feeds:["K6"],
   objective:"Research historical instances where the founder faced adversity and analyze whether they took responsibility or attributed failure to external factors.",
   input:"News archives, blog posts, social media, Glassdoor reviews of previous companies",
   output:"Narrative assessment of founder's adversity response pattern with sourced examples",
   why:"How a founder responds to failure is a better predictor of future performance than how they perform in good times. Harvard research identifies the fundamental attribution error — blaming others for failure, taking credit for success — as a key predictor of founder failure.",
   inPractice:"A behavioral assessment. 'Previous company post-mortem blog post (2021) took full personal accountability for the failure: 'We built a product no one needed. That's on me.' Public response to a critical Twitter thread in 2023 was measured and substantive rather than defensive. Pattern: Accountable and growth-oriented. Rating: High coachability.'",
   limitations:"Public post-mortems and crisis communications are often written by PR professionals rather than the founder themselves — what appears as genuine accountability may be managed communication.",
   failureModes:"A single public instance of blaming external factors (a reasonable response to genuine bad luck) can unfairly pattern-match to a fundamental attribution error — context and frequency both matter.",
   modelRationale:"T3 (Perplexity Sonar Pro) for sourcing specific adversity instances + T2 for behavioral pattern analysis."},

  {id:"MB-A4",phase:"murder",label:"Uncoachability Detector",feeds:["K6"],
   objective:"Analyze the founder's public interactions for patterns of defensiveness, feedback dismissal, and resistance to criticism.",
   input:"Podcast transcripts, YouTube interviews, Twitter/X threads, Reddit AMAs",
   output:'JSON: { coachability_score: "Low/Medium/High", evidence[] }',
   why:"An uncoachable founder is not just an IC problem — they create a board relationship that is adversarial from day one. Identifying this before investment saves enormous relationship capital.",
   inPractice:"A coachability assessment. 'Score: Medium. Positive signals: Responded thoughtfully to a critical VC question in a panel discussion. Negative signal: Twitter thread where founder dismissed a competitor's technical critique as 'jealousy' rather than engaging with the specific points. Pattern: Generally coachable but defensive about product decisions.'",
   limitations:"Podcast and public forum performance is inherently performative. Founders with media training will appear coachable in public regardless of their actual behavior in private.",
   failureModes:"Rating a founder as uncoachable based on a single heated Twitter exchange misses the context — a single bad day on social media is not a pattern.",
   modelRationale:"T2 (Claude Sonnet) for qualitative behavioral analysis across communication samples."},

  {id:"MB-A5",phase:"murder",label:"Co-Founder Conflict Risk",feeds:["K6"],
   objective:"Assess the risk of co-founder conflict based on equity split, role clarity, prior relationship, and any public signals of tension.",
   input:"Pitch deck (equity split, roles), LinkedIn, web search for tension signals",
   output:'JSON: { conflict_risk_score: "Low/Medium/High/Critical", equity_split_assessment, role_clarity_score: 1-10, tension_signals[] }',
   why:"Co-founder conflict is, after product-market fit problems, the single most common cause of startup failure. Hustle Fund research identifies it as a top reason for early-stage company death — catching it before investment is critical.",
   inPractice:"A conflict risk assessment. 'Equity split: 60/40 (slight imbalance but within acceptable range). Roles: Clear delineation — CEO handles commercial, CTO handles engineering. Prior relationship: Worked together for 4 years at same company. Public signals: None found. Conflict risk: Low. Note: No track record of working under pressure together — first venture partnership.'",
   limitations:"Co-founder conflict rarely has public signals until it's severe. The most dangerous conflicts are those that appear settled on paper but have underlying resentment that only surfaces under fundraising or growth pressure.",
   failureModes:"Assigning a clean bill of health based on a stable-looking equity split and role description misses the fact that most co-founder conflicts are interpersonal and invisible until they erupt.",
   modelRationale:"T2 (Claude Sonnet) for structured risk assessment across multiple co-founder relationship signals."},

  {id:"MB-A6",phase:"murder",label:"Key Person Risk",feeds:["K6"],
   objective:"Determine whether the company is critically dependent on a single individual across multiple functions — creating existential key-person risk.",
   input:"Pitch deck (team structure), LinkedIn profiles of team",
   output:'JSON: { key_person_dependency_score: 1-10, dependencies: [{ function, person, fallback_exists: bool }] }',
   why:"A company where one person is simultaneously the technical architect, the sole sales relationship, and the primary customer contact is one accident or resignation away from collapse. This is uninsurable risk.",
   inPractice:"A dependency map. 'CEO (Arjun): Primary customer relationship for top 3 clients (Critical dependency — no fallback). CTO (Priya): Sole architect of core ML system (High dependency — no documentation). Note: This is a two-person functional company despite having 14 employees. Key person risk: Critical.'",
   limitations:"Key person risk is universal at pre-seed stage — most founders are the only people who can do many critical functions. The agent must calibrate its severity assessment to what is normal vs what is genuinely dangerous at each stage.",
   failureModes:"Flagging every pre-seed company as having critical key-person risk because the founder is central to the business renders the flag meaningless — it must be reserved for genuinely dangerous concentrations.",
   modelRationale:"T2 (Claude Sonnet) for dependency mapping across team structure and functional coverage."},

  {id:"MB-A7",phase:"murder",label:"Talent Flight Risk",feeds:["K6"],
   objective:"Check for signals that key employees have recently departed or are planning to leave — an early indicator of culture problems or operational distress.",
   input:"LinkedIn (recent profile updates), Glassdoor, job boards (same role posted multiple times)",
   output:'JSON: { talent_stability: "Stable/At Risk/Deteriorating", recent_departures[], turnover_indicators[] }',
   why:"Employee departures are the canary in the coal mine. A company that has replaced its Head of Engineering three times in 18 months has a problem that the deck will never mention.",
   inPractice:"A talent stability report. 'Signals detected: Same 'Head of Data Engineering' role posted 3 times in 8 months (likely 2 departures). LinkedIn scan: 2 engineering employees updated to 'Open to Work' in last month. Glassdoor: 2 reviews in last 6 months mention 'unclear direction' and 'leadership issues.' Stability assessment: At Risk.'",
   limitations:"LinkedIn job change alerts have a lag — employees often don't update their profiles until months after leaving. The signal is real but delayed.",
   failureModes:"Interpreting strategic team restructuring (removing a role that was no longer needed) as talent flight can unfairly penalise a company making good operational decisions.",
   modelRationale:"T2 (Claude Sonnet) for multi-platform signal detection and synthesis into a stability assessment."},

  {id:"MB-A8",phase:"murder",label:"Previous Failure Pattern",feeds:["K6"],
   objective:"Investigate whether the founder has previously failed and, if so, whether the current venture shows the same underlying failure pattern.",
   input:"Crunchbase, web search, news archives, previous company data from B3",
   output:'JSON: { previous_failures: [{ company, failure_reason, pattern_match_to_current: bool }], overall_pattern_risk }',
   why:"A founder who failed because of poor capital discipline and is now running a capital-intensive startup without showing evidence of learning is a critical red flag. Failure is not the problem — unreflective repetition is.",
   inPractice:"A failure pattern analysis. 'Previous venture: Yuvaan Retail — raised ₹3Cr seed, spent aggressively on marketing before validating unit economics, ran out of runway in 18 months. Current venture: Same growth-before-unit-economics approach visible in the deck projections. Pattern match: YES. Note: No public post-mortem or reflection on the previous failure found.'",
   limitations:"Many excellent founders fail once before succeeding. The presence of a failure in the track record — without the pattern repeat — should not be penalised. Context is everything.",
   failureModes:"A pattern-match false positive — identifying superficial similarities between a past failure and the current venture when the underlying cause is absent — unfairly penalises founders who have genuinely learned.",
   modelRationale:"T3 (Perplexity Sonar Pro) for researching previous venture outcomes + T2 for pattern matching analysis."},

  {id:"MB-A9",phase:"murder",label:"Advisor Quality Assessor",feeds:["K6"],
   objective:"Evaluate whether each advisor listed on the pitch deck has a genuine, documented relationship with the company or is a name added for credibility.",
   input:"LinkedIn, web search, advisors' own public profiles",
   output:'JSON: { advisors: [{ name, genuine: bool, evidence_of_activity, domain_relevance: 1-10 }], advisor_quality_score: 1-10 }',
   why:"Fake advisors are surprisingly common in early-stage pitch decks. A name-drop without engagement is misleading — and worse, it suggests a founder who prioritises the appearance of credibility over the reality of it.",
   inPractice:"An advisor verification report. 'Listed 5 advisors. Verified genuine: 3 (LinkedIn shows mutual connection posts, company tagged in advisor's content). Likely nominal: 2 (no public acknowledgment of advisory role, no mutual engagement found). Note: Dr. Raghavan listed as 'Technical Advisor' — he is a distinguished DRDO alumnus but has not posted about or acknowledged the company publicly.'",
   limitations:"Genuine advisors who maintain confidentiality about their advisory relationships will appear nominal in this analysis — the agent cannot distinguish genuine private advisors from name-drops.",
   failureModes:"Flagging a legitimately engaged but private advisor as nominal can create an incorrect red flag that damages the fund-founder relationship during diligence.",
   modelRationale:"T2 (Claude Sonnet) for multi-platform verification of advisor engagement and relationship evidence."},

  {id:"MB-A10",phase:"murder",label:"Bad Leaver Clause Risk",feeds:["K6"],
   objective:"Analyze the cap table and vesting schedule for structural risks that create misaligned incentives or could complicate future financing.",
   input:"Pitch deck, any available cap table data, standard vesting benchmarks",
   output:'JSON: { vesting_risk: "Low/Medium/High", unusual_structures[], misalignment_indicators[] }',
   why:"A co-founder with fully vested equity who is no longer engaged with the company is dead weight on the cap table. It creates a governance problem, a motivation problem, and a future investor problem — all in one.",
   inPractice:"A vesting risk report. 'Standard 4-year vest with 1-year cliff confirmed for current founders. Risk flag: Previous co-founder departed 8 months ago (before 1-year cliff — likely forfeited equity, which is positive). No unusual vesting acceleration clauses found. Vesting risk: Low. However: 12% ESOP pool may be insufficient for the next 3 hires at the level the team is targeting.'",
   limitations:"Cap table details are rarely fully disclosed at early stage. The vesting schedule analysis is based on limited information and may miss custom provisions negotiated outside standard templates.",
   failureModes:"Assuming standard vesting terms when unusual provisions exist — discovered during legal diligence — is an expensive surprise. This agent must flag uncertainty rather than assume best-case structure.",
   modelRationale:"T2 (Claude Sonnet) for cap table analysis and vesting risk assessment."},

  {id:"MB-B1",phase:"murder",label:"Market Is A Niche",feeds:["K6"],
   objective:"Build the strongest possible case that the claimed market is much smaller than stated — the adversarial counterpart to the TAM estimator.",
   input:"TAM claims from A2, C6 market sizing outputs, industry data",
   output:'JSON: { counter_tam_estimate, delta_from_deck_claim_pct, challenged_assumptions[] }',
   why:"Founders systematically overstate TAM. This agent is the adversarial check — it assumes the deck is wrong and works backwards from first principles to find where the number is inflated.",
   inPractice:"A TAM challenge analysis. 'Deck claims $12B TAM (all Indian MSME software spend). Counter-analysis: Addressable MSMEs who both need AND can afford this product: 380,000 (not 6M). At realistic ₹8,000/month average: addressable market = $380M, not $12B. The deck inflates by 30x through inappropriate market definition.'",
   limitations:"Counter-TAM analysis can be too conservative — rejecting large genuine opportunities by applying overly narrow addressability criteria that ignore category expansion.",
   failureModes:"A counter-TAM that is technically correct but strategically wrong — identifying that today's addressable market is small while missing that the market will expand as the product creates it — causes funds to pass on category-defining companies.",
   modelRationale:"T3 (Perplexity Sonar Pro) for grounding the counter-analysis in real market sizing data."},

  {id:"MB-B2",phase:"murder",label:"Market Timing Wrong",feeds:["K6"],
   objective:"Make the strongest case that the timing is wrong for this company — either too early for the market or too late to win against incumbents.",
   input:"Market trajectory data (C7), regulatory status (C9), competitive landscape (C1, C2)",
   output:'JSON: { timing_risk: "too_early/too_late/right_time/uncertain", scenario, evidence[], severity: 1-10 }',
   why:"The most common VC mistake is backing a right idea at the wrong time. This agent forces the question: what evidence suggests the timing window is either not yet open or already closed?",
   inPractice:"A timing risk analysis. 'Assessment: Potentially TOO EARLY. Evidence: ONDC adoption still below 5% of target merchant base. Regulatory framework for embedded finance not yet finalized. 2 previous companies tried this exact model in 2020-2021 and failed due to market unreadiness. Counterfactual: Same analysis would have said 'too early' about Razorpay in 2014 — requires nuanced judgment.'",
   limitations:"Timing is the hardest variable to assess and the one where the analysis is most frequently wrong in both directions. The market timing question is ultimately a judgment call, not an analytical one.",
   failureModes:"Overfitting to 'too early' signals can cause a fund to miss the exactly right moment — the window when a market transitions from 'not ready' to 'ready' is often invisible until after it opens.",
   modelRationale:"T3 (Perplexity Sonar Pro) for sourcing current market readiness data and competitive dynamics."},

  {id:"MB-B3",phase:"murder",label:"Competitor Is A Giant",feeds:["K6"],
   objective:"Identify whether the company is on a collision course with a well-funded giant that can replicate the core value proposition as a feature.",
   input:"Competitive analysis (C1, C2), company value proposition (D1)",
   output:'JSON: { giant_threat: bool, threatening_giants: [{ name, capability_to_replicate, timeline_estimate }], risk_level }',
   why:"Microsoft adding a feature to Office killed more startups in the 2000s than any VC mistake. Salesforce acquiring competitors is an existential risk pattern that repeats endlessly. This agent asks: could a giant just build this?",
   inPractice:"A giant threat analysis. 'Giant threat: HIGH. Zoho is actively building in this exact category — their Zoho Commerce product roadmap (published Q2) lists 3 of the target company's core features as upcoming releases. Estimated time to feature parity: 9-12 months. Note: Zoho's distribution advantage (5M paying customers) means feature parity = competitive defeat for the startup.'",
   limitations:"Roadmap announcements are frequently aspirational — large companies consistently overestimate their speed of product development. An announced feature is not a shipped feature.",
   failureModes:"Treating every large adjacent company as a giant threat creates a framework where no startup can compete in any market that incumbents could theoretically enter — which is almost every market.",
   modelRationale:"T2 (Claude Sonnet) for competitive threat assessment and timeline estimation."},

  {id:"MB-B4",phase:"murder",label:"Pricing Power Erosion",feeds:["K6"],
   objective:"Identify whether the market is experiencing structural pricing pressure that will commoditise the company's product over time.",
   input:"Competitor pricing data (C5), market analysis, pricing trends over time",
   output:'JSON: { pricing_erosion_risk: "Low/Medium/High", trajectory: "improving/stable/eroding", evidence[] }',
   why:"A company winning on price in a commoditising market is a short-term victory. This agent identifies whether the pricing dynamics of the market will work for or against the company as it scales.",
   inPractice:"A pricing erosion analysis. 'Risk: MEDIUM-HIGH. Evidence: Category average pricing has declined 40% in 3 years (₹15K/month average in 2021, ₹9K/month average today). 2 competitors have launched freemium plans in last 6 months — classic commoditisation signal. Trajectory: Eroding. Implication: Gross margin at scale will be materially lower than current estimates suggest.'",
   limitations:"Price erosion in the broader market may not affect a company with strong moat and customer lock-in. The analysis must account for whether the company's specific positioning is immune to category pricing dynamics.",
   failureModes:"Flagging pricing erosion in a market where the company has pricing power insulation (switching costs, premium positioning, unique value) creates a false risk signal.",
   modelRationale:"T2 (Claude Sonnet) for pricing trend analysis and competitive pricing dynamics assessment."},

  {id:"MB-B5",phase:"murder",label:"Investor Herd Risk",feeds:["K6"],
   objective:"Assess whether the current enthusiasm around this deal is driven by genuine fundamentals or by investor herd dynamics in a hot sector.",
   input:"News archives, funding announcements, sector trend analysis (C7)",
   output:'JSON: { hype_risk_score: 1-10, hype_indicators[], sector_hype_cycle_position }',
   why:"Herd investing produces the worst outcomes in venture. Buying the hottest company in the hottest sector at the peak of a hype cycle — at 20x revenue — is the fastest path to a write-off.",
   inPractice:"A hype risk analysis. 'Hype risk score: 7.2/10. Signals: (1) 4 competing term sheets in 2 weeks — unusual velocity. (2) Sector featured in Economic Times 3x in 1 month. (3) 8 investors announced investments in similar companies in Q3. (4) CEO described as 'visionary' in 3 separate press articles. Recommendation: Verify whether FOMO is driving valuation above fundamentals.'",
   limitations:"High investor interest can reflect genuine quality, not just hype. The challenge is distinguishing fundamentally excellent companies that are also hot from fundamentally mediocre companies that are temporarily hot.",
   failureModes:"Treating competitive deal dynamics as inherently a red flag can cause a fund to self-exclude from excellent opportunities because they are oversubscribed. Competition is sometimes a quality signal.",
   modelRationale:"T2 (Claude Sonnet) for hype cycle analysis and investor sentiment assessment."},

  {id:"MB-B6",phase:"murder",label:"Zombie Company Detector",feeds:["K6"],
   objective:"Identify signals that the company is a 'zombie' — alive on paper but not growing, surviving on old funding without meaningful traction.",
   input:"Pitch deck claims, web traffic trends (E2), hiring signals (E5), funding history",
   output:'JSON: { zombie_risk: "Low/Medium/High/Critical", indicators[] }',
   why:"Zombie companies are the hardest deals to reject because they have all the trappings of legitimacy — a product, a team, a website, some customers. But they are not growing and never will. This agent looks for the flatline beneath the presentation.",
   inPractice:"A zombie risk assessment. 'Risk: HIGH. Evidence: Web traffic flat for 12 months (not down, not up — a precise flatline is suspicious). No new hiring in 8 months despite claiming 'rapid growth'. Last funding round: 22 months ago. The company is consuming capital without growing. The pitch deck contains no absolute numbers, only percentage claims ('40% MoM growth') without a baseline.'",
   limitations:"Some companies genuinely plateau during product rebuilds, pivots, or conscious decisions to prioritise profitability over growth — a flatline is not always zombification.",
   failureModes:"Misidentifying a company in a deliberate consolidation phase as a zombie causes a fund to pass on a company that is actually in the strongest operational position it has ever been.",
   modelRationale:"T2 (Claude Sonnet) for pattern recognition across multiple growth signals to identify zombie characteristics."},

  {id:"MB-B7",phase:"murder",label:"Single Channel Dependency",feeds:["K6"],
   objective:"Identify whether the company's growth is critically dependent on a single acquisition channel that could be disrupted.",
   input:"Pitch deck, web traffic analysis (E2), marketing channel data (E8)",
   output:'JSON: { channel_concentration_risk: "Low/Medium/High", primary_channel, dependency_pct_estimate }',
   why:"The Fab.com failure is the definitive case study. 90% of revenue came from social media virality — when that dried up, the company had no other acquisition engine and collapsed in months. Single-channel dependency is an existential fragility.",
   inPractice:"A channel dependency analysis. 'Primary channel: LinkedIn outbound SDR (estimated 70-80% of new customer acquisition based on hiring pattern and founder interview). Dependency risk: HIGH. Disruption scenarios: (1) LinkedIn algorithm changes (precedent exists). (2) Cost per qualified lead increases as SDR team scales. (3) No organic or inbound flywheel evident.'",
   limitations:"Early-stage companies are expected to have concentrated channel dependency — diversification comes with scale. The agent must calibrate severity to what is normal vs dangerous at the current stage.",
   failureModes:"Flagging a pre-seed company for not having 5 acquisition channels is unreasonable — the question should be whether the primary channel is fundamentally sound, not whether it's diversified.",
   modelRationale:"T2 (Claude Sonnet) for acquisition channel inference and dependency risk assessment."},

  {id:"MB-B8",phase:"murder",label:"Geographic Risk",feeds:["K6"],
   objective:"Assess geopolitical, regulatory, and operational risks associated with the company's geographic footprint.",
   input:"Web search, geopolitical risk databases, company location data from A2",
   output:'JSON: { geo_risks: [{ risk_type, affected_geography, severity }], overall_geo_risk }',
   why:"For Indian deeptech companies, export control regulations (SCOMET), US-India technology transfer restrictions, and China supply chain dependencies can create company-level risks that are invisible without geographic analysis.",
   inPractice:"A geographic risk report. 'Primary geography: India (low geopolitical risk). Manufacturing dependency: Key components from Chinese suppliers (Medium risk — trade restriction exposure). Export markets planned: UAE and SEA (Low risk). SCOMET classification: Product may fall under dual-use controls for drone payloads — requires legal review before export.'",
   limitations:"Geopolitical risk is one of the least predictable variables in business analysis. An agent trained on historical data cannot anticipate novel geopolitical events.",
   failureModes:"Overstating geographic risk for India-focused companies — which is a relatively benign regulatory environment for most startups — creates a false complexity that obscures the actual risk profile.",
   modelRationale:"T2 (Claude Sonnet) for geographic risk assessment using geopolitical risk frameworks."},

  {id:"MB-C1",phase:"murder",label:"Solution In Search Of Problem",feeds:["K6"],
   objective:"Determine whether the company is building impressive technology in search of a problem, rather than solving a specific, documented, painful customer need.",
   input:"Pitch deck value proposition (D1), customer evidence, market analysis",
   output:'JSON: { problem_solution_fit: "Strong/Weak/None", evidence_of_real_pain[], customer_willingness_to_pay_signals[] }',
   why:"The technology is real. The team is excellent. The product is impressive. But nobody will pay for it. This is the most common failure mode in deep tech and the hardest to identify from a pitch deck — this agent looks specifically for evidence of customer pull.",
   inPractice:"A problem-solution fit assessment. 'Fit assessment: WEAK. Evidence: All customer evidence in the deck is about product capabilities, not customer pain (tech push, not market pull). No documented evidence of customers paying before the product was feature-complete. Customer quotes focus on 'impressive technology' not 'solves my problem.' Asking price has been reduced twice since launch.'",
   limitations:"Early-stage companies that are creating new categories don't always have documented customer pain evidence before building — they are discovering the market as they build. This is especially true for deeptech.",
   failureModes:"Applying too strict a 'documented pain evidence' standard to category-creating companies causes funds to miss investments in genuinely innovative products that customers didn't know they needed yet.",
   modelRationale:"T2 (Claude Sonnet) for problem-solution fit analysis based on customer evidence signals."},

  {id:"MB-C2",phase:"murder",label:"Unfair Advantage Is A Myth",feeds:["K6"],
   objective:"Systematically attack every claimed competitive moat and determine whether each is genuinely defensible or is founder-optimism masquerading as strategy.",
   input:"Moat classification (D6), competitive analysis (C4), product data",
   output:'JSON: { moat_destruction_analysis: [{ claimed_moat, attack_argument, verdict: "Real/Overstated/Myth" }] }',
   why:"Founders always believe their moat is stronger than it is. This agent takes the opposite position — it assumes every claimed moat is false until proven defensible — which is the correct prior for early-stage analysis.",
   inPractice:"A moat challenge analysis. 'Claimed: Data network effect. Attack: With 50 customers, the training dataset is too small to produce AI performance meaningfully better than a well-tuned open-source model. Verdict: MYTH at current scale — REAL at 5,000+ customers. Claimed: Switching costs. Attack: The average implementation time of 3 weeks creates friction but not genuine lock-in — 3 competitors offer data migration services. Verdict: OVERSTATED.'",
   limitations:"Some moats that appear easily replicable from outside are actually deeply embedded in customer workflows in ways that are invisible to competitive analysis — underestimating switching costs is as common as overstating them.",
   failureModes:"Destroying every claimed moat without acknowledging any real competitive advantages produces an analysis that makes every company look defenseless — which is a signal that the adversarial model is uncalibrated.",
   modelRationale:"T3 (Perplexity Sonar Pro) for competitor capability research + T4 (Claude Opus) for strategic moat attack reasoning."},

  {id:"MB-C3",phase:"murder",label:"Technology Obsolescence Risk",feeds:["K6"],
   objective:"Assess whether the company's core technology is at risk of being rendered obsolete by emerging technologies in the near-to-medium term.",
   input:"Academic papers, tech news, patent filings, technology stack (D3)",
   output:'JSON: { obsolescence_risk: "Low/Medium/High/Critical", threatening_technologies[], mitigation_options[] }',
   why:"The NLP startup built in 2021 that didn't pivot after GPT-3 was obsolete by definition. Technology obsolescence is the silent killer of deeptech companies that build on technology curves without watching adjacent curves.",
   inPractice:"An obsolescence risk assessment. 'Risk: HIGH. Core technology: Computer vision-based defect detection. Threatening development: Multimodal foundation models (GPT-4V, Gemini) can now perform comparable defect detection with prompt engineering and no custom training. Timeline: Foundation model parity likely 12-18 months. Mitigation: Company's domain data advantage may persist — but only if they move to fine-tune foundation models rather than build from scratch.'",
   limitations:"Technology forecasting is inherently uncertain. The timeline and impact of emerging technologies on specific applications are frequently misjudged in both directions.",
   failureModes:"Flagging every AI company as having 'foundation model obsolescence risk' creates an analysis that is technically correct but strategically useless — the agent must distinguish companies genuinely at risk from those building on durable technological foundations.",
   modelRationale:"T3 (Perplexity Sonar Pro) for sourcing current technology development research and assessing competitive technical trajectories."},

  {id:"MB-C4",phase:"murder",label:"Platform Dependency Risk",feeds:["K6"],
   objective:"Quantify the company's dependency on external platforms and model what happens to the business if those platforms change their terms.",
   input:"Product architecture (D3), business model (F1), D10 output",
   output:'JSON: { platform_dependency: "Low/Medium/High/Critical", platform, risk_scenarios[] }',
   why:"When Apple deprecated IDFA, it destroyed the unit economics of hundreds of mobile advertising companies overnight. This agent models the specific blast radius of a platform policy change on this company.",
   inPractice:"A platform risk quantification. 'Critical dependency: OpenAI API (core product functionality). Risk scenario 1: Price increase of 3x (OpenAI precedent exists) — gross margin drops from 72% to 41%. Risk scenario 2: OpenAI launches competing product in target category — direct competitive threat from primary infrastructure provider. Mitigation: No alternative provider with comparable capability. Risk rating: Critical.'",
   limitations:"Platform risk scenarios are inherently speculative — not every platform dependency results in disruption. AWS has maintained pricing stability for over a decade despite being a dominant infrastructure provider.",
   failureModes:"Treating OpenAI dependency identically to AWS dependency misses the fundamental difference — AWS has a structural interest in enabling customer success; OpenAI is building products that directly compete with its API customers.",
   modelRationale:"T2 (Claude Sonnet) for platform risk scenario modelling and impact quantification."},

  {id:"MB-C5",phase:"murder",label:"Technical Debt Assessor",feeds:["K6"],
   objective:"Estimate the level of technical debt accumulated in the codebase from available external signals, assessing the risk of a costly rebuild requirement.",
   input:"Job postings, Glassdoor, GitHub (if OSS), pitch deck team/product data",
   output:'JSON: { technical_debt_risk: 1-10, indicators[] }',
   why:"Technical debt is the hidden cost that derails Series A companies. A startup that has shipped fast on a shaky technical foundation will eventually face a rebuild that consumes 12-18 months of engineering capacity — right when growth should be accelerating.",
   inPractice:"A technical debt signal analysis. 'Debt risk score: 6.8/10. Indicators: (1) Job postings for 'system migration' and 'infrastructure overhaul' engineers in last 3 months — strong signal of active debt paydown. (2) Glassdoor review: 'Technical decisions made under pressure, lots of shortcuts.' (3) CTO LinkedIn shows no cloud-native or distributed systems experience — architecture choices may not anticipate scale.'",
   limitations:"Technical debt assessment without code review is fundamentally limited. External signals are weak proxies — the only way to truly know is to have an engineer look at the codebase.",
   failureModes:"Treating all fast-shipping early-stage technical decisions as 'debt' penalises companies that have made pragmatic choices appropriate for their stage. Speed over perfection is correct until scale demands otherwise.",
   modelRationale:"T2 (Claude Sonnet) for multi-signal technical debt inference from public sources."},

  {id:"MB-C6",phase:"murder",label:"IP Ownership Dispute",feeds:["K6"],
   objective:"Identify potential IP ownership issues — technology developed at previous employers, pending patent disputes, problematic open-source licenses.",
   input:"Patent databases, web search, legal filings, founder background (B2, B3)",
   output:'JSON: { ip_ownership_risk: "Low/Medium/High/Critical", risks[] }',
   why:"A startup that builds its core product using IP developed at a previous employer faces an existential legal risk that can surface years later — destroying value at exactly the wrong time. DRDO spinouts in India frequently have this issue.",
   inPractice:"An IP risk report. 'Risk: MEDIUM. Flag: CTO developed similar technology at their previous employer (HAL) under a government research contract. The IP ownership of government-funded research in India is ambiguous and potentially state-owned. Recommend: Legal review of CTO's employment contract and any NDA/IP assignment agreements from HAL before investment.'",
   limitations:"IP ownership for government-funded research in India is particularly complex and context-dependent. The agent can flag the risk but cannot resolve it — legal counsel is essential.",
   failureModes:"Triggering an IP ownership investigation on a company where the technology was clearly developed independently — after the founder left their previous employer — creates unnecessary diligence friction.",
   modelRationale:"T3 (Perplexity Sonar Pro) for patent database research and employment history cross-referencing."},

  {id:"MB-C7",phase:"murder",label:"Overly Complex Pitch",feeds:["K6"],
   objective:"Measure the complexity and clarity of the pitch deck as a proxy for how clearly the founders understand and can communicate their own business.",
   input:"Pitch deck text (A1)",
   output:'JSON: { readability_score, jargon_count, one_sentence_explainability: bool, complexity_flag_level }',
   why:"If a founder can't explain their business clearly, they can't sell it to customers, can't hire great people with it, and can't make the IC presentation land. Excessive complexity is often a signal of muddled thinking.",
   inPractice:"A pitch clarity assessment. 'Readability score: Complex (Flesch-Kincaid Grade 18 — requires postgraduate reading level). Jargon terms: 34 identified. One-sentence explainability: FAIL — no version of a single sentence that accurately captures the business appears in the deck. Note: The value proposition changes between slide 3 and slide 11.'",
   limitations:"Complex businesses legitimately require complex explanations. A deeptech defence company operating across multiple TRL levels and customer segments will have a more complex pitch than a consumer app.",
   failureModes:"Using complexity as a red flag for sophisticated technical businesses creates a systematic bias against deeptech investments that require nuanced explanation by definition.",
   modelRationale:"T1 (Claude Haiku) for readability scoring and jargon detection — well-defined computational text analysis task."},

  {id:"MB-D1",phase:"murder",label:"Business Model Fatal Flaw",feeds:["K6"],
   objective:"Identify fundamental, structurally unfixable flaws in the business model that make it impossible to reach profitability at any scale.",
   input:"Business model (F1), unit economics (F2), pricing analysis (E7)",
   output:'JSON: { fatal_flaw_detected: bool, flaw_description, evidence[], confidence }',
   why:"Some business models are simply broken. Negative gross margins that worsen at scale, regulatory structures that prohibit the revenue model, or pricing dynamics that guarantee unprofitability — these are not execution problems, they are structural impossibilities.",
   inPractice:"A fatal flaw analysis. 'Fatal flaw detected: HIGH confidence. The company's model requires purchasing inventory at ₹100 and selling at ₹120, with logistics costing ₹30 — a structurally negative gross margin that worsens as the company scales and loses negotiating leverage. There is no plausible path to profitability without a fundamental model change.'",
   limitations:"What appears to be a fatal flaw in the business model today may be solvable at scale through volume pricing, vertical integration, or business model evolution. Amazon was 'unprofitable by design' for years.",
   failureModes:"Identifying a 'fatal flaw' in a temporarily unprofitable business that has a clear path to unit economics improvement creates a false negative on an otherwise strong investment.",
   modelRationale:"T4 (Claude Opus) for business model reasoning requiring sophisticated multi-step logic to identify genuinely unfixable structural problems."},

  {id:"MB-D2",phase:"murder",label:"Fantasy Math Detector",feeds:["K6"],
   objective:"Systematically dismantle the financial projections to find every assumption that is unrealistic, unsupported, or mathematically questionable.",
   input:"Financial projections from A2, F3 stress test outputs, industry benchmarks",
   output:'JSON: { fantasy_math_score: 1-10, attacked_assumptions: [{ assumption, deck_value, realistic_value, verdict }] }',
   why:"Every pitch deck hockey stick looks achievable if you don't interrogate the assumptions. This agent plays the forensic accountant — assuming every number is wrong until proven right.",
   inPractice:"A projection deconstruction. 'Fantasy math score: 7.8/10. Attack findings: (1) Projects 180% NRR — only 3 Indian SaaS companies have ever achieved this. (2) CAC assumption implies each SDR closes 12 enterprise accounts/year — industry benchmark is 4-6. (3) Year 3 revenue requires 94% of the entire stated TAM — mathematically impossible if TAM is correctly stated. (4) Gross margin improves from 45% to 82% with no explanation of what changes.'",
   limitations:"Financial projections are aspirational by design. The point is not to find achievable projections but to identify which assumptions are most likely to determine the actual outcome.",
   failureModes:"A fantasy math score that makes every company's projections look unrealistic destroys the signal value of the output. The benchmark must be calibrated to what the top quartile of companies at this stage actually achieves.",
   modelRationale:"T2 (Claude Sonnet) — systematic assumption challenge with structured output, appropriate for Sonnet's capabilities."},

  {id:"MB-D3",phase:"murder",label:"Capital Inefficiency",feeds:["K6"],
   objective:"Calculate the burn multiple and identify whether the company is converting capital into growth at an acceptable rate.",
   input:"Pitch deck, financial data (F4, F5), team size data",
   output:'JSON: { burn_multiple, benchmark, capital_efficiency_flag }',
   why:"A burn multiple above 3x means the company is burning ₹3 to generate ₹1 of new ARR — an unsustainable pattern that will kill the company before it reaches the scale where unit economics could improve.",
   inPractice:"A capital efficiency flag. 'Burn multiple: 3.8x (burning ₹38L/month to generate ₹10L/month net new ARR). Benchmark: Top quartile India B2B SaaS seed: 1.5-2.0x. Assessment: Below acceptable range. At current burn, the company will exhaust its runway before reaching the ARR level where a Series A becomes fundable on unit economics alone. Capital efficiency flag: RED.'",
   limitations:"Burn multiple is an outcome of business model choices that may be stage-appropriate. A company investing heavily in product development before monetisation will have a high burn multiple that improves sharply at commercial launch.",
   failureModes:"Applying a burn multiple threshold designed for growth-stage companies to a pre-revenue deeptech company is a category error — the metric is only meaningful once commercial revenue has started.",
   modelRationale:"T2 (Claude Sonnet) for burn multiple calculation and benchmark comparison."},

  {id:"MB-D4",phase:"murder",label:"Vanity Metrics Detector",feeds:["K6"],
   objective:"Identify when the founder is presenting metrics that look impressive but don't reflect actual business health.",
   input:"Pitch deck claims (A2), traction metrics presented by the founder",
   output:'JSON: { vanity_metric_count, flagged_metrics: [{ metric_used, preferred_metric, red_flag_reason }] }',
   why:"Vanity metrics are the language of founders who haven't yet found real traction. 'Total downloads' instead of DAUs, 'GMV' instead of take rate revenue, 'LOIs signed' instead of contracts — each tells you something important about what the company is hiding.",
   inPractice:"A metrics quality audit. 'Flagged metrics: (1) '200,000 registered users' — preferred metric: DAU/MAU. Ratio likely poor given no mention of it. (2) '₹45Cr GMV transacted' — preferred metric: revenue or take rate. At standard 2% take rate: ₹90L actual revenue. (3) '47 enterprise pilots' — preferred metric: paid pilots. No distinction made.'",
   limitations:"Some vanity metrics are appropriate for certain business stages. 'Total users' is legitimate at pre-monetisation when the goal is adoption over revenue.",
   failureModes:"Flagging every non-standard metric as a vanity metric can penalise innovative business models where new metrics are genuinely more informative than traditional ones.",
   modelRationale:"T2 (Claude Sonnet) for metric quality classification and identification of preferred alternatives."},

  {id:"MB-D5",phase:"murder",label:"Hidden Debt & Liability",feeds:["K6"],
   objective:"Search for undisclosed financial obligations that could affect the company's financial health or complicate the investment.",
   input:"Web search, legal databases, pitch deck (A2)",
   output:'JSON: { hidden_liabilities: [{ type, estimated_amount, source_url, severity }], overall_liability_risk }',
   why:"Stacked SAFEs, outstanding lawsuits, unpaid vendor invoices, and deferred salary obligations are real-world complications that founders sometimes omit from pitch decks — either through oversight or intentional omission.",
   inPractice:"A liability search report. 'Liabilities found: (1) NCLT records show a ₹12L unpaid vendor dispute filed 6 months ago — company is defendant. (2) LinkedIn shows salary complaints from 2 employees (both since deleted) alleging payment delays during a cash crunch 9 months ago. (3) No stacked SAFEs identified beyond disclosed rounds. Overall liability risk: MEDIUM — requires legal review.'",
   limitations:"Most financial liabilities of private companies are not publicly visible. This agent catches a fraction of actual obligations — comprehensive liability discovery requires legal diligence.",
   failureModes:"Finding a minor vendor dispute and treating it as equivalent to a major legal liability overstates the risk — operational disputes of small amounts are normal for any operating company.",
   modelRationale:"T3 (Perplexity Sonar Pro) for legal database searches and adverse financial record discovery."},

  {id:"MB-D6",phase:"murder",label:"Customer Concentration Risk",feeds:["K6"],
   objective:"Build the strongest case that the company's revenue is dangerously concentrated in a small number of customers.",
   input:"Case studies, testimonials, news articles (E11)",
   output:'JSON: { concentration_risk, top_customer_revenue_pct_estimate, evidence[] }',
   why:"The highest-severity hidden risk in early-stage B2B. A company where one customer represents 40% of revenue is not an investible business — it is a single-customer dependency with a startup attached.",
   inPractice:"A concentration risk case. 'Estimated concentration: TOP. Evidence chain: (1) 4 case studies, all of which feature the same 3 companies prominently. (2) CEO mentioned 'our anchor customer in BFSI' in 3 separate podcasts — singular usage suggests one dominant client. (3) LinkedIn shows 6 'Customer Success' employees, 4 of whom have titles referencing a specific client name. Concentration estimate: 65-75% from top 3 customers. Risk: CRITICAL.'",
   limitations:"High customer concentration at seed stage is sometimes a deliberate land-and-expand strategy rather than a risk — the question is whether the company is aware of the risk and has a credible diversification plan.",
   failureModes:"Flagging a company with 3 anchor customers and 40 smaller ones as high concentration when the anchors represent 20% collectively — correct counting is critical to avoid false positives.",
   modelRationale:"T3 (Perplexity Sonar Pro) for multi-source customer relationship investigation."},

  {id:"MB-D7",phase:"murder",label:"No Clear Path to VC Scale",feeds:["K6"],
   objective:"Determine whether this company can realistically achieve the scale (typically $50-100M+ revenue) required to generate a meaningful VC return.",
   input:"Market sizing (C6), business model (F1), competitive analysis, growth trajectory",
   output:'JSON: { vc_scale_probability: "Low/Medium/High", max_revenue_potential_estimate, bottlenecks[] }',
   why:"Many excellent businesses are not good venture investments. A company that maxes out at $8M ARR in a niche market is a great small business — but it will return 1-2x to a VC, not 10x. This agent makes the distinction explicit.",
   inPractice:"A scale assessment. 'VC scale probability: LOW. Max revenue potential: $12-18M ARR. Reasoning: (1) Total addressable customer base: 8,000 companies (narrow niche). (2) Average contract value: ₹2.4L/year. (3) At 20% market share (ambitious): ₹38Cr ARR. This is a good lifestyle business at best. VC return at this scale: 1.5-2.5x. Insufficient for a VC portfolio company.'",
   limitations:"Market size assessments at seed stage are notoriously wrong — category creators expand markets that analysts said were too small. Shopify investors were told the 'small business e-commerce' market was too niche to generate VC returns.",
   failureModes:"Applying a narrow TAM to a company that is capable of category creation causes funds to systematically miss category-defining investments by thinking too small about the market the company will build.",
   modelRationale:"T3 (Perplexity Sonar Pro) for market sizing + T4 (Claude Opus) for scale pathway reasoning."},

  {id:"MB-D8",phase:"murder",label:"Unsustainable Growth",feeds:["K6"],
   objective:"Model what happens to the business when current growth rates slow — specifically whether the unit economics of later cohorts will support the business at scale.",
   input:"Growth data from A2, cohort data (F7), burn rate (F4)",
   output:'JSON: { growth_sustainability, cohort_degradation_model{}, financial_impact_if_slowdown }',
   why:"NFX's Speed Trap is the most underappreciated failure pattern in venture. Companies that grow rapidly through unsustainable tactics find that their later cohorts perform significantly worse — and the financial model built on early cohort economics collapses.",
   inPractice:"A growth sustainability analysis. 'Growth sustainability: AT RISK. Signal: Current growth is 15% MoM but burn is 3.8x — unsustainable by definition. Cohort degradation model: Early cohorts (Month 1-6 customers) show 88% 12-month retention. Month 7-12 cohorts show 71% retention — 17pp degradation as the company moved from warm network to cold outbound. Trend suggests later cohorts at 55-60% — below breakeven retention.'",
   limitations:"Cohort degradation is a normal characteristic of growth companies that move from warm leads to cold acquisition — the question is whether the degradation is within the expected range or is accelerating.",
   failureModes:"Modeling cohort degradation to its logical extreme produces a pessimistic case that makes every growing company look unsustainable. The model must be calibrated against what is normal for this GTM motion.",
   modelRationale:"T2 (Claude Sonnet) for cohort degradation modelling and growth sustainability assessment."},

  {id:"MB-D9",phase:"murder",label:"Lack Of Focus",feeds:["K6"],
   objective:"Assess whether the company is trying to do too many things simultaneously, fragmenting execution and preventing market leadership in any one area.",
   input:"Pitch deck (A2), company website, product roadmap",
   output:'JSON: { focus_score: 1-10, unfocused_signals[] }',
   why:"The single-biggest execution mistake in early-stage startups is not picking one thing and going deep. Companies that try to serve 3 customer segments with 4 products across 2 geographies in their first 18 months almost always fail at all of them.",
   inPractice:"A focus assessment. 'Focus score: 4.2/10. Unfocused signals: (1) Deck addresses 3 distinct customer segments (MSMEs, mid-market enterprises, and 'government') with no clear primary. (2) 4 separate product lines with no apparent sequencing rationale. (3) International expansion into UAE planned for Year 1 without domestic market leadership. (4) CEO LinkedIn bio lists 6 different company focus areas.'",
   limitations:"Platform companies legitimately serve multiple segments and use cases — judging a marketplace as unfocused because it serves buyers and sellers misapplies the focus framework.",
   failureModes:"Penalising a company that is deliberately building a platform-level product with multiple use cases as 'unfocused' when the multi-product strategy is the core value proposition.",
   modelRationale:"T2 (Claude Sonnet) for focus signal detection and assessment across deck and public materials."},

  {id:"MB-D10",phase:"murder",label:"Pivot Fatigue Detector",feeds:["K6"],
   objective:"Identify whether the company has pivoted multiple times, suggesting lack of market conviction, poor market understanding, or an inability to execute consistently.",
   input:"Wayback Machine history (D8), Crunchbase, web search, news archives",
   output:'JSON: { pivot_count, pivot_history: [{ date, from, to, trigger }], pivot_fatigue_flag: bool }',
   why:"One pivot is healthy learning. Two can be necessary. Three or more pivots in 18 months suggests a team that doesn't understand its market, can't execute against a plan, or is chasing funding rather than customers.",
   inPractice:"A pivot history reconstruction. 'Pivot 1 (Jan 2022): B2C consumer app → B2B enterprise tool (reasonable market learning). Pivot 2 (Aug 2022): Enterprise tool → SMB SaaS (market too narrow). Pivot 3 (Feb 2023): SMB SaaS → API platform (product couldn't compete on features). Note: 3 pivots in 13 months, each with messaging changes on website. Current positioning (Jul 2023): 4th distinct product identity. Pivot fatigue flag: TRUE.'",
   limitations:"Pivots that are small and iterative — adjusting ICP, refining pricing, narrowing the feature set — are healthy and should not count as pivots. Only fundamental business model or market changes are genuine pivots.",
   failureModes:"Counting minor product evolution or messaging refinements as pivots dramatically inflates the pivot count and unfairly penalises companies that are doing exactly what they should — learning and adjusting.",
   modelRationale:"T2 (Claude Sonnet) for pivot detection and classification from historical website and database analysis."},

  {id:"MB-E1",phase:"murder",label:"Fraud & Deception Detector",feeds:["K6"],
   objective:"Search systematically for evidence of outright fraud, material misrepresentation, or deliberate deception in the company or its founders.",
   input:"All agent outputs, public records, legal databases, SEC filings, news archives",
   output:'JSON: { fraud_risk: "Low/Medium/High/Critical/Instant Kill", evidence[] }',
   why:"Theranos and FTX demonstrated that sophisticated investors can be systematically deceived by charismatic founders. This agent runs the most adversarial check in the system — assuming fraud is possible until explicitly ruled out.",
   inPractice:"A fraud risk report. 'Risk level: MEDIUM. Findings: (1) Revenue claim of $1.2M ARR is inconsistent with SimilarWeb traffic data and pricing model — implied user count is 3x what the traffic data supports. (2) One NCLT filing found against the founder's previous company for non-payment to vendors. (3) Two LinkedIn endorsements are from profiles created in the same month — likely manufactured. Not fraud level but concerning pattern — classified as Major flag.'",
   limitations:"The most sophisticated fraud is undetectable from public data. Theranos had perfect data hygiene — the deception was in the product demonstrations, not the documents. This agent can catch careless fraud, not sophisticated fraud.",
   failureModes:"Triggering a fraud flag based on insufficient evidence — such as minor statistical anomalies — destroys the fund-founder relationship before it has a chance to begin.",
   modelRationale:"T3 (Perplexity Sonar Pro) for comprehensive multi-source cited investigation across legal, financial, and public record databases."},

  {id:"MB-E2",phase:"murder",label:"Founder Inconsistency Tracker",feeds:["K6"],
   objective:"Compare the founder's narrative across all available sources and flag any inconsistencies that suggest selective truth-telling.",
   input:"All available text artifacts: deck (A1), web content, interview transcripts, previous decks",
   output:'JSON: { inconsistencies: [{ claim_source_1, claim_source_2, discrepancy, severity }], inconsistency_score: 1-10 }',
   why:"A single inconsistency might be a mistake or a rounding convention. A pattern of inconsistencies across multiple sources is a systematic signal of selective truth-telling — a founder optimising their narrative for each audience.",
   inPractice:"An inconsistency report. 'Inconsistency 1: Deck claims $1.2M ARR. Podcast from 3 months ago: 'We're approaching $800K in run-rate revenue.' Severity: Material — ₹40L difference in 3 months requires explanation. Inconsistency 2: Deck claims 200 enterprise customers. Website case studies show 12. Severity: High — 16x discrepancy. Inconsistency score: 7.4/10. Pattern: Consistent upward narrative optimisation.'",
   limitations:"Some inconsistencies reflect genuine business progress — a company that had $800K ARR 3 months ago and claims $1.2M ARR today may simply have grown quickly. The timeline must be considered.",
   failureModes:"Treating natural business metric evolution as a narrative inconsistency creates false fraud flags for companies that are growing rapidly between conversations.",
   modelRationale:"T2 (Claude Sonnet) for cross-source narrative comparison and inconsistency classification."},

  {id:"MB-E3",phase:"murder",label:"Regulatory & Legal Risk",feeds:["K6"],
   objective:"Identify specific regulatory proceedings, pending legal actions, or grey-area regulatory positions that could materially affect the business.",
   input:"Legal databases, regulatory filings, web search, C9 regulatory scanner output",
   output:'JSON: { legal_risk, risks: [{ type, description, source_url, status }] }',
   why:"A pending SEBI investigation or an ambiguous regulatory classification can destroy a company's fundraising options and operational freedom — even if the ultimate legal outcome is favorable. The process itself is the punishment.",
   inPractice:"A legal risk report. 'Legal risk: MEDIUM. Findings: (1) SEBI show-cause notice to the CEO's previous company (2021) for related-party transaction disclosure failures — proceedings closed but on public record. (2) The company's lending model operates in a regulatory grey area under RBI's digital lending guidelines — requires formal legal opinion on whether registration is required. (3) No pending litigation found against current entity.'",
   limitations:"Many regulatory grey areas are deliberately ambiguous — regulators use ambiguity strategically to maintain flexibility. A company operating in a grey area may have tacit regulatory acceptance that isn't publicly visible.",
   failureModes:"Treating any regulatory ambiguity as a fatal risk prevents investment in any company operating in India's financial services sector — where ambiguity is the norm and most companies operate successfully within it.",
   modelRationale:"T3 (Perplexity Sonar Pro) for legal database research and regulatory filing discovery."},

  {id:"MB-E4",phase:"murder",label:"Ethical & ESG Red Flag",feeds:["K6"],
   objective:"Identify ethical concerns or ESG risks that could attract regulatory scrutiny, reputational damage, or LP conflict.",
   input:"Web search, news archives, company product analysis",
   output:'JSON: { esg_risk, red_flags: [{ area, description, severity }] }',
   why:"An LP-funded VC that invests in a company with problematic labour practices or data privacy violations faces downstream reputational and regulatory risk. ESG screening protects the fund, not just the portfolio company.",
   inPractice:"An ESG risk report. 'ESG risk: MEDIUM. Findings: (1) Social: Company's gig worker platform classifies drivers as 'partners' rather than employees — potential labour classification risk as Indian courts increasingly scrutinise gig economy labour practices. (2) Governance: No independent board members at current stage (standard but worth noting). (3) Environmental: Not applicable to software business. Primary risk: Labour classification dispute could attract regulatory attention.'",
   limitations:"ESG risk frameworks designed for public companies are frequently inappropriate for early-stage startups. Many ESG concerns that matter at institutional scale are irrelevant at seed stage.",
   failureModes:"Applying a large-company ESG framework to a 15-person startup produces a risk report that identifies dozens of governance gaps that are completely normal for the company's stage.",
   modelRationale:"T2 (Claude Sonnet) for ESG risk identification and classification."},

  {id:"MB-E5",phase:"murder",label:"Pass Reason Generator",feeds:[],
   objective:"Generate a well-crafted, empathetic, and constructive pass explanation for the founder when the deal is killed.",
   input:"Kill Gate output (K6), specific triggering flag outputs",
   output:"Well-written, professional pass email draft suitable for direct founder communication",
   why:"How a fund says no is as important to its brand as how it says yes. A thoughtful, specific, actionable pass letter builds reputation and leaves doors open. A vague form rejection closes them permanently.",
   inPractice:"A pass letter draft. 'Thank you for sharing the Vetrn story with us. We've spent meaningful time on the analysis and genuinely admire what you're building. After careful consideration, we've decided not to proceed at this stage for two specific reasons: (1) The customer concentration profile (estimated >65% from top 3 clients) creates a risk profile that sits outside our current portfolio construction parameters. (2) We have an existing portfolio company with meaningful overlap in the MSME compliance space. We would genuinely love to revisit this conversation in 12 months if the concentration risk has improved. We'll be watching your progress closely.'",
   limitations:"A well-crafted pass letter cannot substitute for a genuinely thoughtful pass decision. If the reasons for passing are weak or incorrect, no amount of good writing makes the letter more honest.",
   failureModes:"Sharing an overly specific pass letter that reveals the depth of the diligence analysis — including sensitive findings about founder behavior — can create legal and relationship risk.",
   modelRationale:"T2 (Claude Sonnet) for professional communication drafting — this is a writing task, not an analytical one."},

  {id:"K6",phase:"murder",label:"Kill Gate Evaluator",feeds:["CV1","L1"],
   objective:"Aggregate all Murder Board flag outputs, apply asymmetric weighted scoring, and execute pass/fail decisions at each of 4 Kill Gates.",
   input:"All MB-A1 through MB-E5 flag outputs. Instant Kill (10), Critical (7-9), Major (4-6), Minor (1-3). Positive signals discounted at 67% of equivalent negative weight.",
   output:'JSON: { deal_health_score: 0-100, gate_results: [{ gate, pass: bool, triggering_flags[] }], final_recommendation: "pass/kill/watchlist/too_early" }',
   why:"The Kill Gate Evaluator is the final anti-sycophancy mechanism in the system. It is architecturally prevented from being optimistic — the default state is KILL, and a deal must affirmatively earn its way through 4 gates. No rounding up. No benefit of the doubt.",
   inPractice:"A kill gate decision report. 'Deal health score: 62/100. Gate 1 (Thesis): PASS. Gate 2 (Triage): PASS — no Instant Kill flags. Gate 3 (Diligence): CONDITIONAL FAIL — Deal Health Score below threshold due to customer concentration (Critical, -8 points) and fraud risk signal (Critical, -8 points). Recommendation: WATCHLIST — revisit in 6 months when concentration data can be verified.'",
   limitations:"Weighted scoring creates the appearance of objectivity while the weights themselves are inherently subjective. A Critical flag with weight 8 vs 9 is a judgment call, not a calculation.",
   failureModes:"A Kill Gate that is too tight will systematically exclude good companies. A Kill Gate that is too loose defeats its purpose. Calibrating the thresholds requires ongoing review against actual investment outcomes.",
   modelRationale:"T4 (Claude Opus) for the final aggregation and judgment call — this is the system's most consequential decision point and requires the highest-quality reasoning available."},

  {id:"EP0",phase:"eisenmann",label:"Eisenmann Pattern Detector",feeds:["K6","CV2"],
   objective:"Run all six Harvard-researched failure pattern checks simultaneously and trigger a Critical Flag if two or more patterns are detected.",
   input:"All diligence outputs — runs as a synthesis layer over the full analysis",
   output:'JSON: { patterns_detected: [{ pattern, confidence, evidence }], pattern_count, critical_flag_triggered: bool }',
   why:"Harvard Business School Professor Tom Eisenmann's research identified six specific failure patterns that recur across startup failures. Systematically checking for all six is more reliable than hoping an analyst remembers them.",
   inPractice:"A pattern detection report. 'Patterns detected: 2 of 6. (1) False Positive (confidence: 72%): Early traction concentrated in founders' personal network — not representative of mainstream market demand. (2) Speed Trap (confidence: 65%): Burn multiple of 3.8x while later-cohort retention is declining. Critical flag triggered: TRUE. Note: Even if confidence in each pattern is moderate, the combination of two patterns significantly elevates risk.'",
   limitations:"The six Eisenmann patterns do not exhaust the universe of startup failure modes. They are six of many — the system's failure coverage is stronger but not complete.",
   failureModes:"Treating pattern detection as deterministic — this pattern always leads to failure — misunderstands the probabilistic nature of the framework. The patterns are risk multipliers, not death sentences.",
   modelRationale:"T4 (Claude Opus) for sophisticated pattern matching requiring synthesis of all upstream outputs."},

  {id:"EP1",phase:"eisenmann",label:"Bad Bedfellows",feeds:["EP0"],
   objective:"Detect the 'Bad Bedfellows' failure pattern — a good idea with a fundamentally mismatched team, investor base, or both.",
   input:"Founder market fit score (B4), team completeness (B6), investor quality (B12, B7)",
   output:'JSON: { pattern: "Bad Bedfellows", detected: bool, evidence[], severity: 1-10 }',
   why:"A great idea with the wrong team almost always fails. A great idea with a team that has no domain expertise, backed by investors who push the wrong growth levers, is a particularly dangerous combination.",
   inPractice:"A bad bedfellows detection. 'Pattern detected: YES (severity 7/10). Evidence: (1) Founder team has no prior B2B enterprise sales experience — building a complex enterprise product. (2) Lead investor is a consumer-focused fund with no enterprise portfolio experience — likely to push PLG strategy inappropriate for the sales cycle. (3) Advisor list has no senior enterprise sales executive.'",
   limitations:"Generalist founders with exceptional learning speed frequently succeed in markets where domain expertise initially seems required. The pattern is a signal, not a verdict.",
   failureModes:"Applying this pattern to first-generation founders from non-traditional backgrounds creates a systematic bias against the kinds of unconventional combinations that sometimes produce breakthrough companies.",
   modelRationale:"T4 (Claude Opus) for nuanced assessment of team-opportunity-investor fit requiring judgment across multiple dimensions."},

  {id:"EP2",phase:"eisenmann",label:"False Start",feeds:["EP0"],
   objective:"Detect the 'False Start' pattern — a good team that built too quickly before validating the core assumption, wasting capital on the wrong product.",
   input:"Burn rate (F4), product maturity (D2), pivot history (MB-D10), unit economics (F2)",
   output:'JSON: { pattern: "False Start", detected: bool, evidence[], severity: 1-10 }',
   why:"Spending 18 months and ₹5Cr building a product that nobody will pay for is the False Start. The signal is high early burn relative to validated learning — building fast when you should be learning cheap.",
   inPractice:"A false start detection. 'Pattern: MODERATE (severity 6/10). Evidence: (1) ₹4Cr raised at seed, ₹3.2Cr spent on engineering before any paying customer (high pre-validation burn). (2) 2 pivots in first 12 months — neither preceded by customer discovery, both preceded by product launches. (3) First paying customer acquired 14 months after founding — very long time to first revenue.'",
   limitations:"For hardware and deep tech companies, long pre-revenue periods are standard — the time required to build the product is inherent to the category, not a false start signal.",
   failureModes:"Applying False Start criteria to companies building complex physical products or navigating multi-year certification processes creates false positives that penalise legitimate long-cycle businesses.",
   modelRationale:"T4 (Claude Opus) for pattern detection across burn, product, and pivot history signals."},

  {id:"EP3",phase:"eisenmann",label:"False Positive",feeds:["EP0"],
   objective:"Detect the 'False Positive' pattern — early traction that looks like product-market fit but is concentrated in an unrepresentative early adopter segment.",
   input:"Cohort data (F7), customer profile (D1), web traffic trends (E2), traction claims (E1)",
   output:'JSON: { pattern: "False Positive", detected: bool, early_adopter_vs_mainstream_divergence, evidence[] }',
   why:"The classic False Positive: tech enthusiasts love the product, pay for it, give testimonials. Then the company expands to the mainstream market and discovers that normal customers don't have the same pain, patience, or technical sophistication.",
   inPractice:"A false positive detection. 'Pattern: DETECTED (severity 8/10). Evidence: (1) All 12 named customers are tech-forward companies in Bangalore/Mumbai — no traditional enterprises or non-metro businesses. (2) Average NPS from current customers: 72 (excellent). Sales cycle for newer customers: 4.5 months vs 1.5 months for early customers — growing friction with mainstream buyers. (3) Customer profile: CTO-buyer vs expansion customers requiring CFO/CEO approval.'",
   limitations:"Early adopter concentration is universal in early-stage companies and is not inherently a false positive — it depends on whether the early adopters are representative of the mainstream market or genuinely different.",
   failureModes:"Misidentifying deliberate land-and-expand strategy (starting with sophisticated customers by design) as a False Positive pattern penalises companies following a legitimate enterprise sales playbook.",
   modelRationale:"T4 (Claude Opus) for sophisticated market segmentation reasoning and cohort comparison analysis."},

  {id:"EP4",phase:"eisenmann",label:"Speed Trap",feeds:["EP0"],
   objective:"Detect the 'Speed Trap' pattern — growth pushed too fast by investor pressure, resulting in operational chaos and deteriorating later cohort performance.",
   input:"Burn multiple (F5), cohort retention (F7), hiring velocity (E5)",
   output:'JSON: { pattern: "Speed Trap", detected: bool, cohort_degradation_signal: bool, burn_multiple }',
   why:"NFX's research on the Speed Trap is the most important insight in the failure pattern literature for growth-stage companies. Rapid growth that outpaces operational capacity creates problems that compound — each new customer cohort performs worse than the last.",
   inPractice:"A speed trap detection. 'Pattern: EARLY SIGNAL (severity 5/10). Evidence: (1) Headcount grew 4x in 12 months (hiring fast — potential operational chaos risk). (2) Month 1-4 cohort NRR: 118%. Month 8-12 cohort NRR: 98% — 20pp decline in newer cohorts. (3) 6 Glassdoor reviews in last 6 months cite 'growing pains', 'unclear processes', 'chaotic environment.' Signal: Early speed trap indicators — manageable now but bears watching.'",
   limitations:"Cohort degradation is normal during rapid team scaling as onboarding processes haven't yet caught up with growth. The pattern must be persistent and accelerating, not just present.",
   failureModes:"Flagging any cohort degradation as a Speed Trap causes funds to penalise healthy growth companies that are experiencing normal growing pains rather than structural operational failure.",
   modelRationale:"T4 (Claude Opus) for multi-signal speed trap pattern detection requiring nuanced threshold calibration."},

  {id:"EP5",phase:"eisenmann",label:"Help Wanted",feeds:["EP0"],
   objective:"Detect the 'Help Wanted' pattern — genuine product-market fit but a critical missing person or resource preventing the company from scaling.",
   input:"Team completeness (B6), PMF signals (E1, E2, E4), missing critical roles",
   output:'JSON: { pattern: "Help Wanted", detected: bool, pmf_evidence[], critical_missing_resource }',
   why:"Help Wanted is the only failure pattern that is fixable — and quickly. The company has proven the market exists, but lacks one critical person or resource to capture it. Identifying this pattern is an opportunity, not a death sentence.",
   inPractice:"A help wanted detection. 'Pattern: DETECTED (severity 6/10, fixable). Evidence: (1) Product-market fit confirmed: 114% NRR, growing organic referrals, waiting list. (2) Critical bottleneck: No enterprise sales leader — the company is losing deals because their technical founders can't navigate procurement processes. (3) Every lost deal analysis points to sales cycle management, not product gaps. Assessment: Help Wanted — one hire away from breakout. Recommend: Source enterprise sales leader before closing this round.'",
   limitations:"Not every missing hire is the single critical bottleneck. Companies sometimes have multiple simultaneous Help Wanted problems — identifying which one matters most requires judgment.",
   failureModes:"Recommending a specific hire based on an external analysis without direct customer conversation can lead to solving the wrong Help Wanted problem — the real bottleneck may not be visible from public signals.",
   modelRationale:"T4 (Claude Opus) for PMF validation combined with team gap analysis to identify the specific Help Wanted pattern."},

  {id:"EP6",phase:"eisenmann",label:"Cascading Miracles",feeds:["EP0"],
   objective:"Detect the 'Cascading Miracles' pattern — a business plan that requires too many independent things to go right simultaneously.",
   input:"Business model (F1), financial projections (F3), market assumptions (C6), competitive assumptions (C1)",
   output:'JSON: { pattern: "Cascading Miracles", detected: bool, required_miracles: [{ assumption, probability }], combined_probability }',
   why:"Every business requires some optimism. But a business that requires (1) a regulatory change, AND (2) a technology breakthrough, AND (3) a major competitor to fail, AND (4) customer behavior to shift — all in the same 18 months — is not a business plan, it's a prayer.",
   inPractice:"A cascading miracles detection. 'Pattern: DETECTED (severity 7/10). Required concurrent successes: (1) ONDC adoption reaching 15%+ of target merchants (currently 3%) — Probability: 35%. (2) RBI finalising digital lending registration (currently pending) — Probability: 55%. (3) Main competitor maintaining current product quality without catching up — Probability: 40%. (4) Customer ACV increasing from ₹2.4L to ₹4.8L as the company claimed — Probability: 30%. Combined probability of all four: ~2.3%. Business plan requires this to work.'",
   limitations:"Complex businesses have many interdependencies by definition. The threshold for how many concurrent successes constitute a Cascading Miracles problem requires careful calibration.",
   failureModes:"Treating all multi-factor business models as Cascading Miracles causes funds to systematically undervalue complex platform businesses and multi-stakeholder plays that are legitimately difficult to build but highly valuable.",
   modelRationale:"T4 (Claude Opus) for probability estimation and dependency chain analysis across multiple business model assumptions."},

  {id:"BB1",phase:"bullbear",label:"TAM Sizing (Bull)",feeds:["CV3","CV5"],
   objective:"Build the most credible, evidence-backed case for the market being large and growing — the bull case TAM argument.",
   input:"Market data, industry reports, bottom-up customer analysis",
   output:'JSON: { bull_tam_estimate, supporting_evidence[], confidence: 1-10 }',
   why:"Every deal needs an honest bull case. This agent ensures that the optimistic market sizing has real evidence behind it — not manufactured enthusiasm — so the conviction assessment is based on the strongest version of the opportunity.",
   inPractice:"A bull TAM case. 'Bull TAM estimate: $6.8B. Evidence: (1) MSME formalisation post-GST has created 2.3M new digitally trackable businesses (NASSCOM data). (2) Average software spend per formalised MSME growing at 34% YoY (Tracxn data). (3) Bottom-up: 2.3M businesses × $3K average annual software budget = $6.9B. Confidence: 7/10.'",
   limitations:"Bull case TAM arguments by design present the most favorable market interpretation. They should always be read alongside the bear case (MB-B1) to understand the realistic range.",
   failureModes:"A bull case with no cited evidence — just a confident narrative — produces false conviction. Every claim in the bull case must be traceable to a source.",
   modelRationale:"T3 (Perplexity Sonar Pro) for sourcing real market data to back the bull case with citations."},

  {id:"BB2",phase:"bullbear",label:"Market Is A Niche (Bear)",feeds:["K6","CV2"],
   objective:"Build the most credible case that the market is actually much smaller than the bull case suggests — the adversarial TAM challenge.",
   input:"Same data as BB1 — deliberately contrary interpretation",
   output:'JSON: { bear_tam_estimate, challenged_assumptions[] }',
   why:"The bull and bear TAM must both be presented to the IC. Without seeing both, the conviction decision is made on incomplete information.",
   inPractice:"A bear TAM case. 'Bear TAM estimate: $380M. Challenge: The 2.3M businesses cited are GST-registered but are not all addressable — only businesses with > ₹5Cr turnover can afford this product at current pricing. Addressable businesses: ~380,000. At $1K average annual spend: $380M TAM.'",
   limitations:"The bear case is deliberately pessimistic and equally as selected as the bull case. Neither is the truth — the truth sits somewhere between them.",
   failureModes:"If the bear TAM is technically correct but strategically irrelevant (the market expands as the product creates new behaviors), the bear case produces an overly pessimistic picture.",
   modelRationale:"T3 (Perplexity Sonar Pro) for building an evidence-based counter-analysis to the bull TAM argument."},

  {id:"BB3",phase:"bullbear",label:"Competitive Moat Mapper (Bull)",feeds:["CV3","CV5"],
   objective:"Build the strongest, most evidence-backed case for the company's competitive moat being real and durable.",
   input:"Moat classification (D6), competitive analysis (C4), product data",
   output:'JSON: { bull_moat_case: [{ moat_type, evidence, durability_score: 1-10 }] }',
   why:"The bull moat case is the foundation of the investment thesis. It must be the strongest version of the defensibility argument — tested against the adversarial challenge from BB4.",
   inPractice:"A bull moat case. 'Primary moat: Data network effect. Bull evidence: Each additional manufacturing customer's defect data improves the AI model — demonstrated by 23% improvement in detection accuracy between 50 and 200 customers. At 1,000 customers, the model's performance advantage over a new entrant becomes replicable only with 12-18 months of data collection. Durability score: 8/10 at scale.'",
   limitations:"Moat durability claims at early stage are inherently speculative — the moat hasn't been tested against a well-funded competitor yet.",
   failureModes:"Building the bull moat case around assumptions that haven't been empirically validated creates a confident-sounding argument built on a weak foundation.",
   modelRationale:"T4 (Claude Opus) for sophisticated moat analysis requiring strategic reasoning about competitive dynamics."},

  {id:"BB4",phase:"bullbear",label:"Unfair Advantage Myth (Bear)",feeds:["K6","CV2"],
   objective:"Systematically challenge every claimed competitive moat and argue that each is weaker than stated.",
   input:"Same moat data as BB3 — deliberately adversarial interpretation",
   output:'JSON: { moat_destruction_analysis: [{ claimed_moat, attack_argument, verdict }] }',
   why:"The adversarial moat challenge is essential to a rigorous IC process. Without it, the moat analysis is one-sided advocacy rather than balanced analysis.",
   inPractice:"A bear moat challenge. 'Data network effect challenged: At current 50 customer scale, the model improvement from additional data is marginal — a new entrant with a modern foundation model approach could achieve comparable performance without training data. The moat is real at 1,000 customers but the company has not yet proven it can get there. Verdict: POTENTIAL moat, not current moat.'",
   limitations:"The bear moat challenge is deliberately adversarial. Its purpose is to stress-test claims, not to provide balanced analysis.",
   failureModes:"An adversarial moat challenge that successfully attacks every moat for every company renders itself useless — it must be calibrated to identify genuine weakness rather than universal skepticism.",
   modelRationale:"T3 (Perplexity Sonar Pro) for competitive capability research to back the adversarial moat challenge."},

  {id:"BB5",phase:"bullbear",label:"Founder Strength (Bull)",feeds:["CV3","CV5"],
   objective:"Build the strongest, most evidence-backed case for why this founding team is exceptional for this specific opportunity.",
   input:"All founder crew outputs (B1-B12)",
   output:'JSON: { founder_bull_case: [{ strength, evidence, uniqueness_score: 1-10 }] }',
   why:"A great team is the most important factor in a venture investment. The bull case for the team must be as strong as it can be — the adversarial challenge from BB6 will test it.",
   inPractice:"A founder bull case. 'Bull case: (1) CEO has 14 years in drone avionics — one of fewer than 200 people in India with this specific experience. (2) CTO holds 3 patents in the exact domain the product is building — genuine IP creator, not just a user. (3) Prior company achieved a $4M exit — small but demonstrates full cycle capability. Team is in the top 1% of founders for this specific domain.'",
   limitations:"The bull case for the team is advocacy, not analysis. It should be read alongside the Murder Board's founder assessments for a complete picture.",
   failureModes:"Constructing a compelling founder bull case that focuses on irrelevant credentials (prestigious university, famous previous employer) rather than relevant experience creates false conviction.",
   modelRationale:"T4 (Claude Opus) for nuanced assessment of founder quality requiring synthesis of multiple evidence sources."},

  {id:"BB6",phase:"bullbear",label:"Founder Weakness (Bear)",feeds:["K6","CV2"],
   objective:"Build the strongest possible case for why this founding team is the wrong team for this specific opportunity.",
   input:"Same founder data as BB5 — adversarial interpretation",
   output:'JSON: { founder_bear_case: [{ weakness, evidence, severity: 1-10 }] }',
   why:"The adversarial founder challenge prevents the fund from falling in love with a charismatic team at the expense of rigorous assessment. The bear case asks: what makes this team likely to fail?",
   inPractice:"A founder bear case. 'Bear case: (1) CEO's 14 years in avionics is at government contractors — no experience building commercial products or navigating private market sales cycles (critical gap). (2) CTO patents are defensive rather than commercial — may struggle with product-market fit decisions. (3) No commercial/GTM founder on the team — both founders are technical. Gap: The company's hardest problem is selling, not building.'",
   limitations:"The adversarial founder challenge is one-sided by design. It should always be read alongside BB5's bull case to understand the complete picture.",
   failureModes:"An adversarial founder challenge that finds weakness in every team for every deal loses its signal value. It must identify genuine, material gaps, not theoretical concerns.",
   modelRationale:"T3 (Perplexity Sonar Pro) for founder background research to support the adversarial assessment."},

  {id:"BB7",phase:"bullbear",label:"PMF Assessor (Bull)",feeds:["CV3","CV5"],
   objective:"Build the strongest, most evidence-backed case for genuine product-market fit.",
   input:"Traction data (E1-E11), cohort data (F7), social listening (E4)",
   output:'JSON: { pmf_bull_case: { pmf_score: 1-10, strongest_signals[] } }',
   why:"Product-market fit is the most important question in a seed investment. The bull case must present the strongest possible evidence that customers genuinely need and love this product.",
   inPractice:"A PMF bull case. 'PMF score: 7.8/10. Strongest signals: (1) 91% of users who complete onboarding use the product daily (strong engagement). (2) 3 customers have referred 2+ additional customers without any referral incentive (organic advocacy). (3) When the product had a 6-hour outage, the company received 47 direct messages from customers asking when it would be back (dependency signal). (4) Average payback period for customers: 3 weeks (strong ROI delivery).'",
   limitations:"PMF evidence is strongest when it comes from customer behavior, not customer words. Case studies and testimonials are the weakest PMF signals.",
   failureModes:"Presenting testimonials and NPS scores as PMF evidence without behavioral data (retention, usage frequency, willingness to pay) overstates the quality of the PMF signal.",
   modelRationale:"T4 (Claude Opus) for nuanced PMF assessment requiring synthesis of behavioral and sentiment signals."},

  {id:"BB8",phase:"bullbear",label:"Solution-Problem (Bear)",feeds:["K6","CV2"],
   objective:"Build the strongest case that the company is a solution in search of a problem — that the customer pain is not strong enough to drive sustainable demand.",
   input:"Same traction data as BB7 — adversarial interpretation",
   output:'JSON: { problem_solution_mismatch: [{ evidence, severity }], lack_of_pull_signals[] }',
   why:"The adversarial PMF challenge is the most important quality check on the investment thesis. Without it, the fund risks backing a technically impressive product that customers don't urgently need.",
   inPractice:"A solution-problem mismatch case. 'Mismatch signals: (1) Average sales cycle 4.5 months — if the pain were urgent, customers would buy faster. (2) 40% of 'pilots' have not converted to paid after 6 months — customers are exploring, not urgently solving. (3) The most common customer quote: 'Nice to have' rather than 'can't live without.' (4) No evidence of customers switching away from existing solutions — they are adding this product, not replacing anything.'",
   limitations:"A 4.5 month enterprise sales cycle is normal for complex B2B products — it does not indicate weak pain. The bear case must be calibrated against category norms.",
   failureModes:"Applying consumer product PMF standards to enterprise B2B products will consistently produce false 'weak PMF' signals for companies following a legitimate enterprise sales motion.",
   modelRationale:"T3 (Perplexity Sonar Pro) for gathering behavioral evidence to support the adversarial PMF challenge."},

  {id:"BB9",phase:"bullbear",label:"Financial Projections (Bull)",feeds:["CV3","CV5"],
   objective:"Build the strongest credible case for the financial projections being achievable, with historical analogues and supporting evidence.",
   input:"Financial projections from A2, comparable company growth data (F3)",
   output:'JSON: { achievable_scenario: { required_conditions[], analogous_companies_that_achieved_this[] } }',
   why:"Financial projections deserve a fair hearing before the forensic accountant attacks them. The bull case establishes the historical precedent and the specific conditions under which the projections are achievable.",
   inPractice:"A projection bull case. 'Achievable scenario: The deck's 3x growth projection is aggressive but not unprecedented. Analogues: Zoho Books achieved comparable growth at this stage in 2011-2012. Freshworks India grew 3.5x in Year 2. Required conditions: (1) Conversion of current pipeline at historical rate. (2) Enterprise sales hire by Q2. (3) No major competitive entry. All three conditions are plausible.'",
   limitations:"The bull projection case presents the favorable interpretation of the numbers. It should always be read alongside BB10's forensic challenge.",
   failureModes:"Selecting an analogue company that is not genuinely comparable (different scale, different market, different era) creates a false sense of historical precedent.",
   modelRationale:"T3 (Perplexity Sonar Pro) for researching analogous company growth trajectories."},

  {id:"BB10",phase:"bullbear",label:"Fantasy Math Detector (Bear)",feeds:["K6","CV2"],
   objective:"Attack every assumption in the financial projections using a forensic accountant's adversarial lens.",
   input:"Same financial data as BB9 — forensic adversarial analysis",
   output:'JSON: { attacked_assumptions: [{ assumption, deck_value, realistic_value, verdict }], fantasy_math_score: 1-10 }',
   why:"Financial projections are almost universally optimistic. The forensic challenge ensures that the specific assumptions driving the hockey stick are identified and their realism explicitly assessed.",
   inPractice:"A forensic projection challenge. 'Fantasy math score: 6.2/10. Key attacks: (1) NRR assumption of 130% requires expansion that has not happened in any current cohort. (2) CAC improvement from ₹52K to ₹18K assumes a PLG motion that hasn't been validated. (3) Year 3 headcount of 85 people with the same leadership team managing 8.5x more revenue — no operational plan for this transition.'",
   limitations:"All financial projections have assumptions that look aggressive in a forensic challenge. The question is not whether assumptions are optimistic but whether they are plausible with specific evidence.",
   failureModes:"A forensic challenge that attacks every assumption equally — including ones that are genuinely reasonable — creates an analysis that finds problems everywhere and is therefore useful nowhere.",
   modelRationale:"T2 (Claude Sonnet) for structured assumption deconstruction — well-defined analytical task."},

  {id:"BB11",phase:"bullbear",label:"Growth Trajectory (Bull)",feeds:["CV3","CV5"],
   objective:"Build the strongest case for the growth trajectory being real, sustainable, and indicative of a breakout company.",
   input:"Growth data from A2, web traffic trends (E2), hiring velocity (E5)",
   output:'JSON: { growth_bull_case: { trajectory_score: 1-10, strongest_growth_signals[], projected_trajectory } }',
   why:"Growth trajectory is the most important leading indicator of a company's trajectory. The bull case must present the strongest evidence that the growth is real and sustainable.",
   inPractice:"A growth bull case. 'Trajectory score: 8.1/10. Strongest signals: (1) Web traffic growing 28% MoM consistently for 5 months — no single spike, consistent compounding. (2) LinkedIn hiring has scaled from 8 to 24 people — 3x team with maintained culture (Glassdoor score improved from 3.8 to 4.3). (3) Organic search visibility growing faster than paid — suggesting genuine brand building, not just performance marketing.'",
   limitations:"Growth signals from the last 6 months may not be representative of the business's long-term trajectory — especially if growth was artificially accelerated by a viral event or a single large deal.",
   failureModes:"Treating any consistent metric growth as 'genuine compounding' without checking whether the growth is driven by one-time events or structural momentum.",
   modelRationale:"T3 (Perplexity Sonar Pro) for sourcing current growth metric data."},

  {id:"BB12",phase:"bullbear",label:"Unsustainable Growth (Bear)",feeds:["K6","CV2"],
   objective:"Model what happens when current growth rates inevitably slow and assess whether the business is structurally sound in the deceleration scenario.",
   input:"Same growth data as BB11 — adversarial modeling",
   output:'JSON: { slowdown_scenario: { trigger, financial_impact, cohort_degradation_model } }',
   why:"Every growth curve eventually flattens. The question is not whether growth will slow but whether the business is structurally sound when it does. The bear growth case models the deceleration scenario explicitly.",
   inPractice:"A growth deceleration scenario. 'Deceleration trigger: LinkedIn SDR-driven growth is finite — the target market has ~8,000 addressable companies. At current conversion rate, the SDR channel saturates in 18-24 months. Deceleration model: Growth drops from 15% MoM to 4-6% MoM at month 20. Financial impact: At current burn multiple, the company needs a new acquisition channel to be profitable before channel saturation — no PLG alternative currently exists.'",
   limitations:"Growth deceleration models assume current acquisition channels will saturate without replacement — many companies successfully transition to new channels before hitting saturation.",
   failureModes:"Modeling growth deceleration without considering the company's ability to develop alternative acquisition channels creates an overly pessimistic scenario that ignores management's ability to adapt.",
   modelRationale:"T2 (Claude Sonnet) for growth sustainability modeling and scenario construction."},

  {id:"CV1",phase:"conviction",label:"Historical Pattern Matcher",feeds:["CV4"],
   objective:"Compare this deal to the fund's own historical database of past investments — both successes and failures — to assess whether it looks more like a winner or a loser.",
   input:"Internal database of all past deals with original diligence reports and outcomes, Kill Gate output (K6)",
   output:'JSON: { similarity_to_winners_score: 1-10, similarity_to_losers_score: 1-10, matching_patterns[] }',
   why:"Pattern matching against the fund's own historical decisions is the highest-quality signal available. The fund's track record — including its mistakes — is the most calibrated dataset it has about what works in its specific context.",
   inPractice:"A pattern match report. 'Similarity to past winners: 7.2/10. Closest winner analog: Investment X (2019 seed) — similar domain expertise founder profile, similar market timing. Outcome: 4.8x return at acquisition. Similarity to past losers: 5.8/10. Closest loser analog: Investment Y (2020 seed) — similar customer concentration pattern. Outcome: Write-off. Mixed signal — strong founder pattern but risky concentration profile.'",
   limitations:"The fund's historical database is only as good as the documentation and outcome tracking disciplines of its team. Funds with fewer than 20 investments have a statistical sample too small to draw reliable patterns.",
   failureModes:"Pattern matching to a small historical sample produces false statistical confidence. Two similar companies producing opposite outcomes with a sample of 10 is not a pattern — it's noise.",
   modelRationale:"T4 (Claude Opus) for sophisticated pattern matching across complex, multi-dimensional historical data."},

  {id:"CV2",phase:"conviction",label:"Red Team Devil's Advocate",feeds:["CV5","CV6"],
   objective:"Generate the most compelling, data-backed argument against doing this deal — the adversarial peer review of the entire investment thesis.",
   input:"All diligence outputs, Kill Gate output (K6), Graveyard patterns (GY3)",
   output:"Multi-point Bear Case memo attacking the 3 most vulnerable assumptions in the investment thesis",
   why:"The Red Team is the last line of defense before conviction becomes capital commitment. It surfaces the strongest version of the bear case — so the IC can explicitly decide whether to accept that risk, rather than discovering it after investment.",
   inPractice:"A bear case memo. 'The bull case rests on three assumptions that we believe are materially vulnerable: First, the claimed 3x growth assumes a CAC that is 60% lower than any comparable company in the category has achieved — we see no evidence this is possible without a PLG motion that doesn't yet exist. Second, the data moat requires 1,000+ customers; the company has 50. Third, the exit scenario requires Zoho as an acquirer — Zoho's last 6 acquisitions were all sub-$5M tech acqui-hires. Together, these challenges reduce our base case from 5x to 2-2.5x.'",
   limitations:"The Red Team is deliberately one-sided and adversarial. Its output should be read in conjunction with the bull case and the conviction score — not in isolation.",
   failureModes:"A Red Team that is too aggressive — finding fatal flaws in every deal — will cause the fund to pass on excellent investments by manufacturing certainty about inherently uncertain outcomes.",
   modelRationale:"T4 (Claude Opus) for the highest-quality adversarial reasoning in the system — this requires frontier capability to be genuinely challenging."},

  {id:"CV3",phase:"conviction",label:"Belief Builder",feeds:["CV5"],
   objective:"Identify and articulate the single most important non-obvious belief that must be true for this investment to succeed — the core of the investment thesis.",
   input:"All diligence outputs, Bull agent outputs (BB1-BB12)",
   output:'JSON: { core_belief: "one sentence", supporting_evidence[], counter_evidence[], belief_strength: 1-10 }',
   why:"Every great investment is built on a non-obvious insight that most investors haven't yet seen. This agent forces the articulation of that insight — making the implicit thesis explicit and testable.",
   inPractice:"A belief statement. 'Core belief: Indian manufacturing SMEs will pay for AI-powered quality control software before they adopt ERP systems — because quality failures are visible and immediate, while ERP benefits are diffuse and long-term. This belief is non-obvious (most investors think ERP comes first), supported by the company's sales data (3 customers who explicitly declined ERP conversations but bought quality control software), and counter-evidenced by longer sales cycles than expected (suggesting some friction in the buying journey).'",
   limitations:"A well-articulated core belief can be wrong. The belief builder creates conviction, not truth — the belief must be actively tested and updated as the company develops.",
   failureModes:"Articulating a core belief that is widely held (not non-obvious) produces a thesis that sounds specific but is actually just conventional wisdom — and conventional wisdom doesn't generate outsized returns.",
   modelRationale:"T4 (Claude Opus) for synthesising multiple evidence sources into a single coherent, non-obvious investment thesis."},

  {id:"CV4",phase:"conviction",label:"Conviction Score Calibrator",feeds:["CV5","CV9"],
   objective:"Synthesise all conviction-building outputs into a single numerical conviction score that reflects the strength of the investment case.",
   input:"Historical pattern match (CV1), counter thesis (CV2), core belief (CV3)",
   output:'JSON: { conviction_score: 1-10, breakdown: { team, market, product, traction, financials, timing, moat }, key_drivers[], key_blockers[] }',
   why:"A conviction score forces explicit quantification of what the GP actually believes — rather than leaving conviction implicit and unexamined. It also enables comparison across deals in the portfolio pipeline.",
   inPractice:"A conviction scorecard. 'Overall conviction: 6.8/10. Breakdown: Team (8/10 — exceptional domain expertise), Market (7/10 — right trend, some TAM uncertainty), Product (7/10 — strong but not yet differentiated), Traction (5/10 — early, concentration risk), Financials (5/10 — burn multiple concern), Timing (8/10 — strong why now). Key drivers: Founder quality, market timing. Key blockers: Customer concentration, unproven unit economics.'",
   limitations:"Conviction scores aggregate qualitative judgments into a number that appears more precise than the underlying data warrants. A 6.8 vs 7.2 conviction score is not a meaningful distinction.",
   failureModes:"Using conviction scores to rank deals without acknowledging that scores are calibrated differently across different analysts creates a false impression of comparability.",
   modelRationale:"T3 (Perplexity Sonar Pro) for grounding the score in benchmark data + T4 for overall calibration."},

  {id:"CV5",phase:"conviction",label:"IC Memo Drafter",feeds:["CV6","L1"],
   objective:"Synthesise all diligence, analysis, and conviction-building outputs into a comprehensive, persuasive investment committee memo.",
   input:"All preceding agent outputs — complete synthesis",
   output:"Full IC memo: Thesis · Team · Market · Product · Financials · Risks · Bear Case · Bull Case · Conviction Score · Recommendation",
   why:"The IC memo is the most important document in the investment process. It must present the complete case — bull and bear — in a format that enables a high-quality IC decision without the IC members having to read 30 separate reports.",
   inPractice:"A complete investment memo. Structured document covering: executive summary with recommendation, company overview, team assessment (with specific evidence), market analysis (with competing TAM views), product assessment, traction analysis, financial analysis (with stress tests), risk matrix, bear case, bull case, conviction score, deal terms recommendation, and recommended action.",
   limitations:"An AI-drafted IC memo is a synthesis of the analysis pipeline. It reflects the quality of every upstream agent — excellent synthesis of poor inputs still produces poor output.",
   failureModes:"A beautifully written IC memo that buries the critical risks in section 6 rather than leading with them gives the IC a false sense of the investment's risk profile — format matters as much as content.",
   modelRationale:"T4 (Claude Opus) for frontier-quality synthesis and long-form generation — the IC memo is the most demanding writing task in the system."},

  {id:"CV6",phase:"conviction",label:"IC Debate Simulator",feeds:["CV7","CV8"],
   objective:"Simulate the IC debate by generating questions and arguments from different partner archetypes — the optimist, the skeptic, and the financial modeler.",
   input:"IC Memo (CV5)",
   output:"Transcript of simulated IC debate highlighting: key contentions, unresolved questions, consensus areas",
   why:"IC meetings are often dominated by the most vocal partner. This agent gives every archetype a voice before the meeting — surfacing the full range of perspectives and questions so the IC can be structured rather than reactive.",
   inPractice:"A simulated debate. 'Optimist Partner: The founder's 14-year domain expertise is genuinely rare — I've met 200 founders in this space and only 3 have this level of technical depth. Skeptic Partner: Domain expertise doesn't close enterprise deals. Where's the sales motion? They have no enterprise sales leader. Financial Partner: The burn multiple of 3.8x at this stage is above our threshold. What's the path to 2x in 18 months? [Continued with resolution pathways for each contention point]'",
   limitations:"The IC debate simulation is constructed from the written record — it cannot capture the interpersonal dynamics, body language, and relationship context that make real IC discussions nuanced.",
   failureModes:"A simulated debate that is too conciliatory — where every objection gets neatly resolved — fails in its purpose. The simulation should surface genuine tensions, not resolve them prematurely.",
   modelRationale:"T4 (Claude Opus) for sophisticated multi-persona debate simulation requiring distinct voice and perspective for each archetype."},

  {id:"CV7",phase:"conviction",label:"Key Unknowns & Gaps",feeds:["CV8"],
   objective:"After all analysis is complete, identify the top 5 things the fund still doesn't know that would materially change the conviction score.",
   input:"All preceding agent outputs, IC debate transcript (CV6)",
   output:'JSON: { key_unknowns: [{ question, materiality: "deal_breaker/significant/minor", how_to_resolve, priority }] }',
   why:"No amount of AI analysis replaces asking the founders directly. This agent identifies exactly which questions are most important to resolve before committing capital — focusing the final founder conversations on what matters most.",
   inPractice:"A gap analysis. 'Top 3 key unknowns: (1) DEAL BREAKER: Actual revenue concentration breakdown by customer. We estimate 65-70% from top 3 — if correct, this alone may prevent investment. Resolve: Ask directly and request verification from CFO. (2) SIGNIFICANT: Reference check on CTO's departure and return — circumstance unclear. Resolve: Backdoor reference from mutual connection. (3) SIGNIFICANT: Actual customer ACV data vs stated. Resolve: Request 3 customer invoices during legal diligence.'",
   limitations:"The key unknowns are limited to what the analysis identified as important. Information asymmetries the fund doesn't know it's missing won't appear in this list.",
   failureModes:"A key unknowns list that contains 15 items of equal priority is as useless as no list at all — the prioritisation between 'deal breaker' and 'nice to know' is critical.",
   modelRationale:"T3 (Perplexity Sonar Pro) for grounding unknowns in what is and isn't publicly available + T4 for priority judgment."},

  {id:"CV8",phase:"conviction",label:"Founder Meeting Questions",feeds:[],
   objective:"Generate the 10 most important questions to ask the founder in the final partner meeting — specific, targeted, and sequenced for maximum information extraction.",
   input:"Diligence gaps (CV7), IC debate (CV6)",
   output:'JSON: { questions: [{ question, strategic_intent, follow_up_if_yes, follow_up_if_no, priority }] }',
   why:"A GP who walks into a final founder meeting with a generic question list wastes the most valuable diligence interaction available. Precise, context-specific questions produce the data that resolves conviction-level uncertainties.",
   inPractice:"A targeted question set. 'Critical (ask first): 'Can you walk us through your top 10 customers by revenue and what percentage each represents?' — Strategic intent: Confirm or deny concentration risk. Follow-up if concentration >50%: 'What's your 12-month plan to reduce that below 40%?' Important: 'Tell us what happened with [specific previous company] — what did you learn from that experience?' — Strategic intent: Assess adversity response and self-awareness.'",
   limitations:"Prepared questions can make a founder feel interrogated rather than engaged. The best questioners use these as guides, not scripts — adapting in response to the conversation.",
   failureModes:"Sharing the question list with the founder in advance — as some funds do as a 'transparency' gesture — eliminates the informational advantage of asking questions the founder hasn't prepared for.",
   modelRationale:"T2 (Claude Sonnet) for targeted question generation based on structured gap analysis — well-defined task."},

  {id:"CV9",phase:"conviction",label:"Final Go/No-Go Recommender",feeds:["L1"],
   objective:"Make the final definitive recommendation — Go or No-Go — based on the sum total of all analysis. One paragraph. No hedging.",
   input:"All preceding agent outputs, conviction score (CV4)",
   output:'JSON: { recommendation: "GO/NO-GO", confidence: "high/medium/low", core_reasoning: "one paragraph", contingencies[] }',
   why:"The most important output in the system. Every analysis ultimately serves this moment. The recommendation must be decisive — 'it depends' is not a recommendation, it's the absence of one.",
   inPractice:"A final recommendation. 'Recommendation: CONDITIONAL GO. Confidence: MEDIUM. Core reasoning: The founder's domain expertise and market timing are genuinely exceptional — the 'Why Now?' case is among the strongest we've seen. However, the customer concentration risk (estimated 65-70% from top 3 clients) is a deal-level concern that requires direct verification before committing. Contingency: Recommend proceeding to term sheet contingent on satisfactory resolution of concentration data during diligence. If concentration exceeds 70%, recommend revisiting in 6 months.'",
   limitations:"A conditional recommendation requires follow-up conditions to be actually enforced during diligence. A Go with conditions that are never verified is worse than a No.",
   failureModes:"A recommendation that is too hedged — with so many contingencies that it conveys no actual conviction — is the output of a system that is more afraid of being wrong than of being useful.",
   modelRationale:"T4 (Claude Opus) for the highest-stakes single output in the system — the final investment recommendation."},

  {id:"CV10",phase:"conviction",label:"Reputation Risk Assessor",feeds:["CV5"],
   objective:"Assess whether investing in this company, sector, or alongside specific co-investors could create reputational risk for the fund.",
   input:"News archives, social media, risk matrix (G4), co-investor list",
   output:'JSON: { reputation_risk: "low/medium/high", risk_factors[], mitigation_options[] }',
   why:"LP relationships are built on trust, and trust is partly reputational. An investment that creates negative press coverage, associate the fund with a controversial sector, or force it to appear alongside problematic co-investors has hidden costs.",
   inPractice:"A reputation risk assessment. 'Reputation risk: MEDIUM. Factors: (1) The drone sector is under increased media scrutiny following recent regulatory incidents — investment may attract press attention. (2) One co-investor has been publicly associated with a previous controversial investment (unrelated sector). Mitigation: Proactive LP communication strategy if investment proceeds. Consult with PR advisor on positioning.'",
   limitations:"Reputational risk is highly context-dependent and changes rapidly. A sector that attracts scrutiny today may be rehabilitated by a regulatory framework change tomorrow.",
   failureModes:"Over-weighting reputational risk at the expense of investment quality causes funds to miss excellent companies in momentarily unfashionable sectors — the very sectors where contrarian investors generate the best returns.",
   modelRationale:"T3 (Perplexity Sonar Pro) for current news monitoring and reputational risk identification."},

  {id:"EX1",phase:"execution",label:"Valuation Negotiation Strategy",feeds:["EX2"],
   objective:"Build the optimal negotiation playbook — anchor, target, walk-away, and key talking points — for the valuation conversation.",
   input:"Comparable transactions (G2), public comps (C11), conviction score (CV4), competitive deal intel (EX5)",
   output:"Negotiation playbook: { anchor_price, target_price, walk_away_price, key_talking_points[], concession_hierarchy[] }",
   why:"Negotiating without a strategy is the fastest way to either overpay or destroy the relationship. This agent creates an evidence-backed negotiation framework before the first conversation.",
   inPractice:"A negotiation playbook. 'Anchor: $10M pre-money (below median comparable but creates anchoring room). Target: $12-13M pre-money (within comparable range, represents fair value for conviction level). Walk-away: $16M pre-money (above at which the return multiple is insufficient at base case). Key talking points: Reference the 3 comparable transactions at 5.8-7.2x ARR. Concession hierarchy: Valuation > Pro-rata rights > Board seat > Liquidation preference.'",
   limitations:"Negotiation strategies are built on comparable data that may not reflect the specific competitive dynamics of this deal. A more competitive deal may require a more aggressive anchor.",
   failureModes:"Publishing internal negotiation strategy to any party outside the IC — including through poorly secured communications — destroys the information advantage the strategy is built to create.",
   modelRationale:"T3 (Perplexity Sonar Pro) for comparable transaction data + T4 for negotiation strategy construction."},

  {id:"EX2",phase:"execution",label:"Term Sheet Generator",feeds:["EX3"],
   objective:"Generate a complete, clean term sheet for the investment based on agreed deal parameters.",
   input:"Standard legal templates (pre-configured), valuation and terms from EX1",
   output:"Complete term sheet in .md format covering all standard provisions",
   why:"Generating a clean first term sheet quickly signals seriousness and professionalism to founders. A delayed or poorly structured term sheet often costs the fund the deal — especially in competitive situations.",
   inPractice:"A complete term sheet document. Covering: company and investor details, investment amount, pre-money valuation, security type (CCPS/CCD), board composition, protective provisions, information rights, pro-rata rights, drag-along and tag-along, anti-dilution, ROFR, and ESOP requirements. Formatted for direct use in legal review.",
   limitations:"The generated term sheet is a first draft for legal review — it should not be sent to founders without review by legal counsel familiar with Indian company law and the specific transaction requirements.",
   failureModes:"Sending an AI-generated term sheet without legal review that contains provisions inappropriate for the specific deal structure (CCPS vs equity, SEBI compliance) creates legal exposure.",
   modelRationale:"T2 (Claude Sonnet) for legal document generation from a structured template — well-defined drafting task."},

  {id:"EX3",phase:"execution",label:"Legal Term Optimizer",feeds:["EX4"],
   objective:"Recommend protective provisions and non-standard terms that are justified by the specific risk profile identified in diligence.",
   input:"Risk matrix (G4), Devil's Advocate memo (CV2), term sheet (EX2)",
   output:"List of recommended protective provisions with justifications and negotiability ratings",
   why:"Standard term sheets protect against standard risks. This company has specific, identified risks that warrant specific protective provisions — this agent connects the risk analysis to the deal structure.",
   inPractice:"A term optimization recommendation. 'Recommended additions: (1) Enhanced information rights (monthly financial reporting) — justified by customer concentration risk requiring ongoing monitoring. (2) Drag-along at 60% (not standard 51%) — justified by fragmented angel cap table where coordination may be difficult in an exit situation. (3) Milestone-linked tranche release (50% at close, 50% after verified concentration ratio below 50%) — justified by customer concentration risk flagged at Critical level.'",
   limitations:"Non-standard provisions can signal distrust and damage the investor-founder relationship before it begins. The benefit of each provision must be weighed against the relational cost of asking for it.",
   failureModes:"Including too many protective provisions creates a term sheet that is either not signed or signed under duress — neither outcome serves the fund's long-term interests.",
   modelRationale:"T3 (Perplexity Sonar Pro) for market-standard provision research + T4 for risk-to-provision mapping reasoning."},

  {id:"EX4",phase:"execution",label:"Closing Checklist",feeds:[],
   objective:"Generate a complete, sequenced checklist of all steps required from signed term sheet to wired transfer.",
   input:"Standard legal closing processes, deal-specific parameters from EX2",
   output:"Detailed closing checklist: { step, owner, deadline, dependencies, status }",
   why:"Deal closings fail most often due to coordination failures, not legal issues. A comprehensive checklist with clear ownership prevents the kind of 'I thought you were handling that' moments that delay or kill closings.",
   inPractice:"A closing checklist. '1. Legal diligence: Engage transaction counsel (Khaitan/AZB) — Fund (Day 1). 2. Dataroom access: Request from company — Fund (Day 1). 3. Cap table verification: Request from company's CS — Company (Day 3). 4. IP due diligence: Patent search by IP counsel — Fund (Day 5). 5. FEMA compliance review: RBI/FEMA filings for FDI compliance — Legal counsel (Day 7)...' [Full 20+ step checklist with owners and deadlines]",
   limitations:"Closing checklists must be customised to the specific transaction structure and jurisdiction. An India-specific closing process for a CCPS investment has different requirements than a SAFE.",
   failureModes:"A generic closing checklist that misses India-specific requirements (FEMA filings, valuation certificate under Income Tax rules, board resolution requirements) creates compliance gaps that delay closings.",
   modelRationale:"T2 (Claude Sonnet) for structured process documentation — well-defined checklist generation task."},

  {id:"EX5",phase:"execution",label:"Competitive Deal Intel",feeds:["EX1"],
   objective:"Assess whether other investors are competing for this deal and estimate their likely terms and timeline.",
   input:"News APIs, social media monitoring, backchannel research",
   output:'JSON: { competing_vcs: [{ name, likelihood, known_terms }], deal_competitiveness, recommended_timeline }',
   why:"Competitive deal dynamics change the negotiation strategy entirely. A deal with one other interested party requires a different approach than a deal with four competing term sheets — this agent identifies which situation the fund is in.",
   inPractice:"A competitive intel report. 'Competitive assessment: MODERATE. Signals: (1) Founder mentioned 'other conversations are progressing' without specifics — likely one other serious party. (2) LinkedIn: 2 VCs from Accel visited the company's office in last 2 weeks (location tagged). (3) Company is presenting at Nasscom Product Conclave next week — likely meeting more investors. Recommended timeline: Move to term sheet within 5 business days to establish priority.'",
   limitations:"Competitive deal intelligence from public signals is inherently incomplete. Founders may exaggerate competitive interest as a negotiating tactic.",
   failureModes:"Acting on false competitive urgency — manufactured by the founder to accelerate decision-making — causes the fund to skip diligence steps it would otherwise conduct, creating investment risk.",
   modelRationale:"T2 (Claude Sonnet with web search) for competitive deal signal detection and timeline recommendation."},

  {id:"MC1",phase:"meeting",label:"Dataroom Reader",feeds:["MC2","MC3","MC4"],
   objective:"Index and parse all documents in the deal dataroom before the meeting begins, creating a searchable knowledge base for real-time fact-checking.",
   input:"All documents in the deal dataroom: decks, financials, contracts, legal docs, product specs",
   output:'JSON: { dataroom_index: [{ document_name, document_type, key_claims[], entities[] }], total_documents_indexed }',
   why:"The GP in the meeting needs instant access to any number or claim in the dataroom. This agent pre-processes everything so that 'Can you confirm what your Q2 revenue was?' can be answered in seconds, not minutes.",
   inPractice:"A pre-meeting index. 'Indexed 34 documents: 1 pitch deck, 3 financial models, 12 customer contracts, 8 legal documents, 10 product documents. Key numerical claims extracted: 847 data points across all documents. Fastest access queries: Revenue figures (Q1-Q3 2023), customer contract values, employee headcount by quarter.'",
   limitations:"Dataroom quality varies enormously. A dataroom with scanned PDFs rather than text documents, missing key financial data, or password-protected files will produce an incomplete index.",
   failureModes:"An incomplete index that misses a key financial document can cause the fact-checker to report 'not found in dataroom' when the document exists but wasn't indexed — creating a false inconsistency alert.",
   modelRationale:"T1 (Claude Haiku) for high-volume document parsing and indexing — speed and throughput are the priority for this pre-meeting task."},

  {id:"MC2",phase:"meeting",label:"Real-Time Fact Checker",feeds:["MC3","MC4","MC5"],
   objective:"Listen to the meeting transcript in real time, identify factual claims, and cross-reference them against the dataroom and prior analysis within 5 seconds.",
   input:"Live meeting transcript stream, dataroom index (MC1), all previous deal analysis, live web search capability",
   output:'Per claim: { claim_text, verification_status: "confirmed/inconsistent/unverifiable/new_claim", dataroom_match{}, web_search_result{} }',
   why:"Founders sometimes say things in meetings that contradict their documents or previous statements. Catching these in real time — while the conversation is live — changes the information dynamic fundamentally.",
   inPractice:"A live fact-check alert. 'Claim detected: Founder said Q3 revenue was ₹1.4Cr. Dataroom check: Q3 revenue in financial model is ₹1.1Cr (discrepancy of ₹30L). Status: INCONSISTENT. Flagging to MC3 for inconsistency alert. Note: The difference could be a definition issue (recognised vs collected revenue) — flag for clarification.'",
   limitations:"Sub-5 second response time requires streaming transcript access. This is a real-time infrastructure challenge that requires specific integration with the meeting platform.",
   failureModes:"False inconsistency flags — where a discrepancy is actually a definitional difference rather than a factual error — interrupt the meeting flow unnecessarily and can make the investor appear confrontational.",
   modelRationale:"T2 (Claude Sonnet) for fast, accurate claim extraction and cross-referencing — speed is critical for real-time application."},

  {id:"MC3",phase:"meeting",label:"Inconsistency Flagger",feeds:["MC4"],
   objective:"Detect inconsistencies between what the founder is saying live and what the deck, data, or earlier meeting statements show — and flag them for follow-up.",
   input:"Real-time fact check outputs (MC2), meeting transcript history, deck claims (A2)",
   output:'Per inconsistency: { inconsistency_type, founder_claim_now, previous_claim_or_data, severity, recommended_follow_up_question }',
   why:"Inconsistencies surfaced live — during the meeting — give the investor the opportunity to address them naturally in conversation rather than through a post-meeting email that gives the founder time to prepare an explanation.",
   inPractice:"A live inconsistency alert. 'Inconsistency detected: Founder just stated customer count is '150+'. Deck states 200. Previous podcast interview: '80-90 active customers.' Three different numbers across three sources. Severity: High. Recommended follow-up: 'Can you clarify — are you measuring total registered, active, or paying customers? The different figures we've seen suggest different definitions are in use.'",
   limitations:"Some apparent inconsistencies are definitional differences that the founder can legitimately explain. The system must flag for investigation, not accusation.",
   failureModes:"Surfacing an inconsistency at exactly the wrong moment in the meeting — during an emotionally sensitive discussion about team background, for example — can derail a productive conversation.",
   modelRationale:"T2 (Claude Sonnet) for real-time inconsistency detection and recommended question generation — needs to be fast and precise."},

  {id:"MC4",phase:"meeting",label:"Question Prompter",feeds:[],
   objective:"Surface the right question at the right moment during the meeting — triggered by inconsistencies, pre-planned questions not yet asked, or interesting new claims.",
   input:"Inconsistency flags (MC3), pre-generated key questions (G6), founder meeting questions (CV8), live transcript",
   output:'Per prompt: { question_text, trigger, urgency: "ask_now/ask_when_appropriate/optional", context }',
   why:"The best investors ask the best questions. This agent is the research-backed question coach — surfacing exactly what should be asked at exactly the right moment, based on everything the system knows about this deal.",
   inPractice:"A live question prompt. 'ASK NOW: You mentioned Q3 revenue was ₹1.4Cr — our documents show ₹1.1Cr. Can you help us reconcile that? [Triggered by inconsistency alert]. ASK WHEN APPROPRIATE: Walk us through your top 5 customers by revenue contribution. [Pre-planned critical question not yet asked, 22 minutes into meeting].'",
   limitations:"Question timing is context-dependent in ways that a transcript-reading system cannot fully capture. A question that is technically appropriate may be socially poorly timed.",
   failureModes:"Prompting a question at the wrong conversational moment — interrupting a positive rapport-building exchange to surface a confrontational inconsistency — can damage the meeting dynamic.",
   modelRationale:"T4 (Claude Opus) for context-aware question prioritisation requiring judgment about meeting dynamics and question sequencing."},

  {id:"MC5",phase:"meeting",label:"Live Web Search Agent",feeds:["MC2","MC3"],
   objective:"When a founder makes a claim that cannot be verified from the dataroom or prior analysis, perform a live web search within seconds to find corroboration or contradiction.",
   input:"Unverifiable claims from MC2, live web search capability",
   output:'Per search: { claim, search_query, result: { found: bool, supporting: bool, source_url, key_finding } }',
   why:"Some claims founders make in meetings are spontaneous and unscripted — about market size, competitors, or regulatory developments. This agent fact-checks them live, preventing the investor from nodding along to something that is incorrect.",
   inPractice:"A live search result. 'Claim: Founder stated the defence ministry announced a new drone procurement policy last week. Live search result: No such announcement found in defence ministry press releases or major defence media in the last 30 days. Note: Founder may be referencing a draft policy that hasn't been officially announced — flag for post-meeting verification.'",
   limitations:"Live web search latency must be under 10 seconds to be useful in a meeting context. Slower searches produce results after the conversation has moved on.",
   failureModes:"Surfacing a web search result that contradicts the founder based on an outdated article — when the founder's claim reflects a more recent development — creates a false inconsistency that damages the investor's credibility.",
   modelRationale:"T2 (Claude Sonnet with web search) optimised for speed — this is a real-time task where response time matters more than depth."},

  {id:"L1",phase:"output",label:"Analysis Package Compiler",feeds:["L2","L3"],
   objective:"Compile all structured agent outputs into a single comprehensive analysis package — the complete research artifact a GP uses as the source of truth for their investment decision.",
   input:"ALL previous agent outputs — every JSON, every assessment, every flag, every score",
   output:"Complete structured analysis organised by: Intake → Team → Market → Product → Traction → Financials → Strategic → Risks → Deal Health Score → Conviction Score → Recommendation",
   why:"208 agents produce 208 outputs. Without a compiler, the analysis is a pile of data. This agent transforms that pile into a coherent, navigable document that a GP can actually use to make a decision.",
   inPractice:"A structured analysis document covering every dimension. Each section includes the key finding, the supporting evidence, the confidence level, and the specific agents that produced it. A GP can read the executive summary in 5 minutes or drill into any section for full depth.",
   limitations:"The compiled output is only as good as the upstream agents. If key agents failed or produced low-quality outputs, the compiled package will reflect those gaps — there is no quality fabrication at the compilation stage.",
   failureModes:"A compilation that gives equal weight to high-confidence and low-confidence findings creates a misleading picture. The compiler must surface confidence levels prominently, not bury them.",
   modelRationale:"T4 (Claude Opus) for frontier-quality synthesis and long-form structured document generation."},

  {id:"L2",phase:"output",label:"Deal Scorecard Generator",feeds:["L3"],
   objective:"Distil the full analysis into a single-page numerical scorecard across all dimensions — enabling rapid comparison across deals in the pipeline.",
   input:"Analysis package from L1",
   output:'JSON: { dimension_scores: { team, market, product, traction, financials, moat, risk, timing }, overall_score: 0-100, deal_health_score, conviction_score, recommendation_tier }',
   why:"A fund reviewing 200 deals per year needs a way to compare them consistently. The scorecard makes the relative positioning of every deal explicit and comparable — preventing the most recent exciting pitch from crowding out an earlier excellent one.",
   inPractice:"A scorecard. 'Overall: 68/100. Team: 82, Market: 74, Product: 71, Traction: 54, Financials: 58, Moat: 62, Risk: 51, Timing: 79. Deal Health Score: 62/100. Conviction Score: 6.8/10. Recommendation: Conditional Go — proceed to term sheet subject to concentration verification.'",
   limitations:"Aggregating multi-dimensional analysis into a single number loses information. A company with extraordinary team (95) and weak traction (30) scores the same as a company with average team (63) and average traction (62) — but they are very different investment propositions.",
   failureModes:"Using the overall score as the primary decision criterion without reading the dimension breakdown causes the fund to miss important signal in the distribution of scores across dimensions.",
   modelRationale:"T2 (Claude Sonnet) for structured score aggregation and formatting — well-defined computational task."},

  {id:"L3",phase:"output",label:"Confidence Calibrator",feeds:[],
   objective:"Assess the overall confidence level of the entire analysis — how much was based on hard data versus inference, and how many critical claims remain unverified.",
   input:"All agent outputs, verification results (E1), open questions (G6), scorecard (L2)",
   output:'JSON: { overall_confidence: "high/medium/low", data_quality_score: 1-10, verified_claims_pct, unresolved_questions_count, confidence_breakdown{} }',
   why:"A high-conviction analysis built on unverified data is more dangerous than a low-conviction analysis that knows its own limits. This agent tells the GP how much to trust the entire output — which is the most honest thing the system can say.",
   inPractice:"A confidence report. 'Overall confidence: MEDIUM. Data quality score: 6.1/10. Verified claims: 34% (of 47 quantifiable claims, 16 confirmed, 31 unverifiable). Unresolved critical questions: 3. Lowest confidence dimensions: Financials (heavy reliance on deck-stated figures), Customer concentration (estimated not confirmed). Recommendation: Do not proceed to term sheet without resolving the 3 critical unknowns identified in CV7.'",
   limitations:"Confidence calibration is itself a judgment call — the system's assessment of its own confidence is inherently limited by the same information gaps it is trying to quantify.",
   failureModes:"A confidence calibrator that consistently reports 'medium' confidence regardless of data quality — because medium feels safe — provides no useful signal about when the analysis is genuinely reliable versus genuinely speculative.",
   modelRationale:"T2 (Claude Sonnet) for meta-analysis of the overall analysis quality — well-defined assessment task."},

  {id:"PI1",phase:"post",label:"Onboarding & 100-Day Plan",feeds:["PI2"],
   objective:"Build a joint 100-day plan post-investment that makes the fund's value-add concrete and measurable from day one.",
   input:"Diligence reports, IC memo (CV5), founder conversations, deal terms",
   output:"100-day plan: { priorities: [{ goal, owner, kpi, deadline }], fund_commitments[], founder_commitments[] }",
   why:"The first 100 days set the tone for the entire investor-founder relationship. A structured joint plan makes the fund's value-add explicit and creates mutual accountability — preventing the relationship from becoming passive capital.",
   inPractice:"A 100-day plan. 'Fund commitments: (1) Introduce 3 qualified enterprise sales candidates by Day 30. (2) Connect with 2 potential design partner accounts from portfolio by Day 45. (3) Facilitate Series A investor introductions by Day 90. Founder commitments: (1) Reduce customer concentration to below 60% by Day 60. (2) Complete Series A data room by Day 75.'",
   limitations:"100-day plans are only as valuable as the follow-through. A plan that isn't reviewed at Day 30 and Day 60 becomes a document rather than a commitment.",
   failureModes:"A 100-day plan that over-promises fund value-add and under-delivers creates the single most damaging investor-founder dynamic — unmet expectations in the first 100 days.",
   modelRationale:"T3 (Perplexity Sonar Pro) for researching best-practice post-investment support frameworks and tailoring to this company's specific needs."},

  {id:"PI2",phase:"post",label:"Board Meeting Prep",feeds:[],
   objective:"Generate a comprehensive board pack for upcoming board meetings including KPI dashboard, plan review, and strategic agenda.",
   input:"Company internal data (via API), previous board minutes, KPI data (PI9)",
   output:"Complete board pack: KPI dashboard, 100-day plan review, strategic agenda, risks, decisions required",
   why:"Board meetings are the most valuable governance touchpoint in the investor-company relationship. A well-prepared board pack makes the meeting substantive rather than ceremonial.",
   inPractice:"A board pack. 'KPI dashboard showing revenue vs target (94% attainment), burn rate, headcount, pipeline. Agenda: (1) Q3 review — 15 mins. (2) Customer concentration update — 20 mins (critical issue from diligence). (3) Series A preparation — 25 mins. (4) Enterprise sales hire update — 10 mins. Decisions required: Approval for new office lease.'",
   limitations:"Board pack quality depends entirely on the quality and timeliness of the company's internal data. A company with poor financial reporting produces a board pack that obscures rather than illuminates.",
   failureModes:"A board pack that focuses on positive metrics and buries concerning ones in appendices gives the board a false sense of security — the most important items should lead, not lag.",
   modelRationale:"T2 (Claude Sonnet) for structured board pack generation from company data."},

  {id:"PI3",phase:"post",label:"Strategic Sounding Board",feeds:[],
   objective:"Provide structured analysis when the portfolio company is considering a major strategic decision — pricing change, pivot, expansion, key hire.",
   input:"Company proposal, market data, historical case studies of similar pivots",
   output:"Strategy memo: { proposal_summary, pros[], cons[], key_risks[], historical_analogues[], recommendation }",
   why:"The fund's most valuable post-investment contribution is often not introductions or follow-on capital — it is high-quality strategic thinking when the company faces a consequential decision.",
   inPractice:"A strategy memo. 'Proposed: Move upmarket from SMB to mid-market. Historical analogues: Freshdesk (successful), Instamojo (unsuccessful). Key risk: SMB product is not feature-complete for mid-market procurement requirements. Recommendation: Pilot with 3 mid-market customers before committing GTM resources. Estimated timeline to answer: 6 months.'",
   limitations:"External strategic analysis without deep operational context can miss company-specific factors that make a generic recommendation inappropriate.",
   failureModes:"Recommending against a strategic move that the founder correctly intuited — based on incomplete external data — damages the founder's trust in the fund's strategic judgment.",
   modelRationale:"T4 (Claude Opus) for sophisticated strategic reasoning across historical analogues and company-specific context."},

  {id:"PI4",phase:"post",label:"Talent Network Matching",feeds:[],
   objective:"Match open senior roles at portfolio companies with specific candidates from the fund's network.",
   input:"Company hiring plan, fund's CRM network, LinkedIn connections of fund team",
   output:"Prioritised candidate list per open role: { name, current_role, fit_rationale, introduction_path, urgency }",
   why:"A warm introduction to a strong candidate for the enterprise sales role the company has been searching for 4 months is worth more than any introductory meeting the fund could arrange.",
   inPractice:"A talent match report. 'Open role: VP Enterprise Sales. Top match: Vikram Nair (currently Head of Enterprise at Freshworks, 8 years enterprise SaaS sales, domain expertise match, connected via portfolio CEO Meera). Introduction path: Ask Meera to make the intro over WhatsApp — strong relationship. Urgency: High — role has been open 4 months.'",
   limitations:"Candidate quality assessment from CRM data and LinkedIn is superficial. The fund must rely on personal knowledge of the candidate's actual performance rather than profile signals.",
   failureModes:"Introducing a candidate who is a poor cultural fit — even if technically qualified — damages both the portfolio company relationship and the candidate relationship simultaneously.",
   modelRationale:"T2 (Claude Sonnet) for candidate-role matching and introduction path identification."},

  {id:"PI5",phase:"post",label:"Customer Introduction Matching",feeds:[],
   objective:"Identify which portfolio companies or network contacts would be ideal first customers for a portfolio company's product.",
   input:"Company's ideal customer profile (D1), fund's full portfolio data, CRM network",
   output:"Prioritised customer introduction list: { company, decision_maker, icp_fit_score: 1-10, introduction_path, estimated_deal_size }",
   why:"One warm introduction to a qualified enterprise customer — from the fund's network — can change a company's trajectory more than any advisory conversation. Revenue-generating introductions are the highest-value fund contribution.",
   inPractice:"A customer introduction list. 'Top match: Nykaa (portfolio company) — CFO is actively looking for compliance automation tools (confirmed in last board meeting). ICP fit score: 9.2. Introduction: Direct email from fund partner to Nykaa CFO. Estimated deal size: ₹18-24L/year. Note: Avoid conflict — confirm Nykaa is not a direct competitor first.'",
   limitations:"Portfolio company introductions require careful conflict screening. A fund introducing two portfolio companies that are in adjacent markets can create awkward competitive dynamics.",
   failureModes:"Introducing a portfolio company to a customer contact without the contact's prior consent turns a warm introduction into an unwanted sales call — damaging both relationships.",
   modelRationale:"T2 (Claude Sonnet) for ICP matching and introduction path optimisation."},

  {id:"PI6",phase:"post",label:"Next Round Fundraising Prep",feeds:[],
   objective:"When the portfolio company is preparing for its next raise, build the full fundraising package — investor list, narrative, and data room checklist.",
   input:"Company metrics, market trends, database of investors by stage/sector",
   output:"Fundraising package: { target_investor_list[], narrative_draft, data_room_checklist }",
   why:"The fund's most operationally valuable post-investment contribution is often preparing the company for its next raise. A well-prepared Series A process closes faster and at better terms.",
   inPractice:"A fundraising preparation package. 'Target investor list: 24 Series A funds ranked by thesis fit and portfolio overlap. Top 5: Lightspeed (3 investments in adjacent B2B SaaS), Matrix (strong B2B manufacturing thesis), Elevation (India enterprise focus). Narrative: 'From 50 to 500 enterprise customers in 18 months — the AI quality control platform that Indian manufacturing can't ignore.' Data room checklist: 47 items required.'",
   limitations:"Investor targeting based on public portfolio data may miss investors who have recently developed relevant thesis areas but haven't yet made public investments in the space.",
   failureModes:"An investor list that targets funds whose portfolio already includes a direct competitor wastes relationship capital and creates awkward competitive disclosure situations during diligence.",
   modelRationale:"T3 (Perplexity Sonar Pro) for investor research and portfolio analysis."},

  {id:"PI7",phase:"post",label:"Crisis Management Simulator",feeds:[],
   objective:"When a portfolio company faces a major crisis, generate an immediate structured response plan covering communications and operations.",
   input:"Crisis scenario description, company context, best practice playbooks",
   output:"Crisis response plan: { immediate_actions_24h[], communications_plan{}, operational_steps[], stakeholder_management[] }",
   why:"Crises move faster than response plans. A portfolio company that receives a structured response framework within 2 hours of a crisis — rather than improvising under pressure — makes materially better decisions.",
   inPractice:"A crisis response plan for a data breach scenario. '24-hour actions: (1) Engage cybersecurity incident response firm. (2) Notify affected customers within 72 hours per DPDP Act requirements. (3) Brief board. (4) Hold all public communications pending legal review. Communications plan: Customer notification template, press holding statement, employee briefing. Legal: Engage privacy counsel immediately.'",
   limitations:"Crisis response plans are only useful if they are implemented correctly under pressure. The fund must be available to support execution, not just deliver the document.",
   failureModes:"A crisis response plan that prioritises reputation management over customer welfare creates a second crisis — the perception of cover-up — that is worse than the original incident.",
   modelRationale:"T4 (Claude Opus) for crisis scenario reasoning and structured response generation."},

  {id:"PI8",phase:"post",label:"Portfolio Synergy Mapper",feeds:[],
   objective:"Identify non-obvious collaboration, integration, or commercial opportunities between portfolio companies.",
   input:"Full portfolio company data — products, customers, technology stacks, team backgrounds",
   output:"Synergy map: { opportunities: [{ company_a, company_b, synergy_type, potential_value, recommended_intro_approach }] }",
   why:"The best portfolio networks create compounding value — each company benefits from the others. A fund that actively identifies and facilitates synergies earns the right to call itself a value-add investor.",
   inPractice:"A synergy map. 'High-value opportunity: Company A (logistics SaaS) × Company B (AI document processing). Company A's logistics coordinators process 200+ documents daily — Company B's core capability. Estimated value: ₹15-20L/year contract for Company B. Introduction: CEO to CEO email facilitated by fund. Note: Not competitive — complementary capabilities.'",
   limitations:"Portfolio synergy analysis from documents misses the interpersonal and cultural compatibility between founding teams that ultimately determines whether a collaboration succeeds.",
   failureModes:"Facilitating a customer-supplier relationship between two portfolio companies that later have a commercial dispute puts the fund in an impossible mediation position.",
   modelRationale:"T3 (Perplexity Sonar Pro) for portfolio company capability research and synergy identification."},

  {id:"PI9",phase:"post",label:"KPI & Benchmark Analyzer",feeds:["PI2"],
   objective:"Track portfolio company KPIs against top-quartile benchmarks for their sector and stage, surfacing early warning signals before they become crises.",
   input:"Company monthly data (via API), industry benchmark reports",
   output:"KPI dashboard: { kpi, company_value, benchmark_25th, benchmark_median, benchmark_75th, trend, status }",
   why:"Early warning signals are only useful if they are spotted early. A company whose NRR is declining from 114% to 108% to 101% over three quarters is signalling a serious customer retention problem — a GP who waits until it hits 90% has missed the intervention window.",
   inPractice:"A KPI dashboard. 'Revenue growth: 18% MoM (benchmark 75th: 22%) — WATCH. NRR: 101% (benchmark 75th: 115%) — CONCERN, declining trend (was 114% 6 months ago). Burn multiple: 3.8x (benchmark 75th: 2.0x) — CONCERN. Gross margin: 68% (benchmark median: 71%) — WATCH. CAC payback: 18 months (benchmark 75th: 12 months) — CONCERN.'",
   limitations:"KPI benchmarks must be sourced from comparable companies at the same stage and sector. Generic SaaS benchmarks applied to a deeptech hardware company produce meaningless comparisons.",
   failureModes:"Presenting declining KPIs to the board without a root cause analysis creates alarm without direction — the dashboard must be accompanied by an explanation of what is driving each variance.",
   modelRationale:"T2 (Claude Sonnet) for KPI calculation and benchmark comparison."},

  {id:"PI10",phase:"post",label:"Founder Wellbeing Detector",feeds:[],
   objective:"Detect early warning signs of founder burnout from communication patterns and meeting cadence — enabling proactive support before it becomes a crisis.",
   input:"Email/Slack metadata (with permission), sentiment analysis of communications, meeting attendance patterns",
   output:"Confidential wellbeing flag: { status: 'green/yellow/red', contributing_factors[], recommended_fund_action }",
   why:"Founder burnout is one of the most underappreciated risks in early-stage portfolios. A burned-out CEO makes bad decisions, loses key team members, and becomes unable to close the next round. Early detection changes the outcome.",
   inPractice:"A confidential wellbeing report. 'Status: YELLOW. Contributing factors: (1) Response time to fund emails has increased from 2 hours to 48+ hours over 6 weeks. (2) Last 3 board meetings — founder appeared disengaged in first 30 minutes. (3) LinkedIn activity has dropped to zero (was active daily). Recommended action: Schedule informal 1:1 — not about business, about the founder. Do not reference this analysis.'",
   limitations:"Communication pattern analysis with limited data produces high false-positive rates. An unusually busy week can look identical to early burnout in the metrics.",
   failureModes:"Raising burnout concerns with the founder based on weak signals — and being wrong — can damage the relationship significantly. This agent's output must be actioned with extreme care.",
   modelRationale:"T2 (Claude Sonnet) for pattern recognition across communication metadata."},

  {id:"PM1",phase:"portfolio",label:"Portfolio Construction Optimizer",feeds:[],
   objective:"Analyse how a new investment affects the fund's overall portfolio construction across sector, stage, and geographic dimensions.",
   input:"Full portfolio data, fund thesis and target construction model (S1), new deal data",
   output:'JSON: { construction_impact: { sector_concentration_change, stage_diversification_change }, recommendation: "improves/neutral/worsens" }',
   why:"Individual investment decisions compound into portfolio construction outcomes that affect fund returns, LP reporting, and the fund's ability to raise a successor vehicle. Tracking construction in real time prevents drift.",
   inPractice:"A construction analysis. 'Impact of adding this investment: Sector concentration in defence increases from 28% to 34% (approaching the 35% single-sector limit). Stage allocation: Pre-Series A allocation increases to 62% — within target. Geographic: India concentration increases to 88% — above target of 80%. Assessment: WORSENS construction slightly — consider this context in final decision.'",
   limitations:"Portfolio construction targets are guidelines, not hard constraints. A sufficiently high-quality investment that violates construction targets may still be the right decision.",
   failureModes:"Refusing an excellent investment solely because it worsens construction by 2% is a mechanical application of rules at the expense of judgment — construction is a guide, not a veto.",
   modelRationale:"T3 (Perplexity Sonar Pro) for portfolio analytics and construction modelling."},

  {id:"PM2",phase:"portfolio",label:"Power Law & Returns Analyzer",feeds:["PM4"],
   objective:"Identify which portfolio companies are showing early signs of becoming fund-returning power-law outcomes.",
   input:"Portfolio company KPI data (PI9), valuation markups, growth trajectory data",
   output:"Ranked list of portfolio companies by fund-returner potential with power law signals",
   why:"In venture, 2-3 companies from every fund generate most of the returns. Identifying which companies are on that trajectory early — and concentrating attention and follow-on capital there — is the most important portfolio management decision.",
   inPractice:"A power law analysis. 'Tier 1 (fund returner potential): Company A — 34% MoM growth sustained for 8 months, 118% NRR, clear path to $10M ARR. Tier 2 (strong performer): Company B — solid metrics, 2-3x return potential. Tier 3 (uncertain): Companies C-F — need 90-day reassessment. Recommend: Double follow-on allocation to Company A in next round.'",
   limitations:"Power law identification at early stage is highly speculative. The company showing 34% MoM growth in month 8 may be one bad quarter from reverting to the mean.",
   failureModes:"Concentrating attention on perceived power law companies while neglecting others creates a self-fulfilling prophecy — the supported companies outperform partly because of the support, not just because of intrinsic quality.",
   modelRationale:"T4 (Claude Opus) for sophisticated pattern recognition across portfolio company trajectories."},

  {id:"PM3",phase:"portfolio",label:"Reserve Allocation & Pacing",feeds:["PM4","PM8"],
   objective:"Build the optimal reserve allocation plan for follow-on investments and ensure deployment pacing aligns with the fund lifecycle.",
   input:"Fund model (AUM, reserve pool), portfolio company fundraising plans, PM2 power law analysis",
   output:"Reserve allocation plan: { total_reserves, allocated_by_company[], pacing_vs_plan, capital_call_forecast[] }",
   why:"Reserve allocation is one of the most consequential fund management decisions. Too little reserve and the fund gets diluted in its best companies' later rounds. Too much reserve and capital sits idle.",
   inPractice:"A reserve plan. 'Total reserves: ₹18Cr (30% of fund). Allocated: Company A (₹6Cr — 3 tranches), Company B (₹3Cr — 1 tranche), Unallocated (₹9Cr — held for unexpected opportunities). Pacing: On track — 45% of reserves deployed at fund year 3 of 10. Capital call forecast: ₹4Cr needed in months 4-6 based on Company A fundraising timeline.'",
   limitations:"Reserve plans are disrupted by company-specific developments that are impossible to forecast — a company that raises a large round from a new investor may not need the fund's pro-rata capital.",
   failureModes:"Over-allocating reserves to companies with uncertain trajectories leaves insufficient capital for the power law outcomes — the worst possible reserve allocation outcome.",
   modelRationale:"T3 (Perplexity Sonar Pro) for fund benchmark data + T4 for allocation optimisation reasoning."},

  {id:"PM4",phase:"portfolio",label:"Follow-on Decision Framework",feeds:[],
   objective:"For a portfolio company raising a new round, determine the optimal follow-on strategy — lead, pro-rata, pass, or increase.",
   input:"Company performance (PI9), power law analysis (PM2), original IC memo (CV5)",
   output:'JSON: { recommendation: "lead/pro_rata/pass/reduce", rationale, proposed_amount, valuation_view }',
   why:"The follow-on decision is the most capital-consequential decision in post-investment management. Getting it right requires combining the original investment thesis with current company performance and portfolio construction considerations.",
   inPractice:"A follow-on recommendation. 'Recommendation: INCREASE ABOVE PRO-RATA. Rationale: Company has exceeded every metric from the original IC memo — NRR at 118% vs 92% projected, CAC payback 12 months vs 18 months projected. This is a power law trajectory. Proposed amount: ₹4Cr (2x pro-rata). Valuation view: Current ask of 8x ARR is within comparable range — not expensive given trajectory.'",
   limitations:"Follow-on decisions based on past performance extrapolation can miss inflection points where the growth trajectory is about to slow for identifiable structural reasons.",
   failureModes:"Automatically exercising pro-rata in every company — regardless of trajectory — depletes follow-on reserves that should be concentrated in the best performers.",
   modelRationale:"T4 (Claude Opus) for integration of current performance, original thesis, and portfolio construction into a follow-on recommendation."},

  {id:"PM5",phase:"portfolio",label:"Portfolio Risk Concentration",feeds:["PM1"],
   objective:"Identify whether the portfolio is overly exposed to a single macro risk that could affect multiple companies simultaneously.",
   input:"Full portfolio data, macro trend analysis (C10), regulatory landscape data",
   output:"Risk concentration report: { concentrated_risks: [{ risk, affected_companies[], severity, mitigation_options[] }] }",
   why:"Individual company risk assessments miss correlated portfolio risk. If 6 of 12 portfolio companies depend on the same regulatory framework and that framework changes, the fund has a portfolio-level crisis, not a company-level one.",
   inPractice:"A portfolio risk report. 'Concentrated risk identified: REGULATORY. 7 of 12 portfolio companies operate under or adjacent to RBI digital lending guidelines. A tightening of these guidelines would affect 58% of the portfolio simultaneously. Mitigation: Engage regulatory counsel to monitor, brief all affected portfolio CEOs on risk, adjust reserve allocation to ensure affected companies have 24+ months runway.'",
   limitations:"Correlated risk identification is only as good as the risk tagging applied to each portfolio company. Risks that span categories — like a general economic slowdown — are particularly hard to identify in advance.",
   failureModes:"Identifying a correlated risk without a credible mitigation strategy creates alarm without direction — the LP report that says 'we have a concentration risk' without a plan is worse than saying nothing.",
   modelRationale:"T3 (Perplexity Sonar Pro) for regulatory and macro risk research across portfolio dimensions."},

  {id:"PM6",phase:"portfolio",label:"LP Reporting & Update Generator",feeds:[],
   objective:"Generate the quarterly LP update covering new investments, portfolio performance, and fund-level metrics.",
   input:"Full portfolio data, fund financial model, recent company updates",
   output:"Complete LP update: cover letter, new investments, portfolio highlights, financial performance (TVPI, DPI, IRR)",
   why:"LP reporting is a legal obligation and a relationship investment. A well-crafted quarterly update — honest about challenges, clear about progress — builds the LP trust that makes fund II a conversation rather than a cold outreach.",
   inPractice:"A quarterly LP update. 'Q3 2024 highlights: 2 new investments (Company X and Y), both on-thesis. Portfolio highlights: Company A raised Series A at 3.2x our entry valuation. Company C signed its first enterprise contract. Concern: Company F extending runway — bridge being arranged. Fund metrics: TVPI 1.3x (quarter 8 of 10-year fund), DPI 0.1x (first exit proceeds from Company B acquisition).'",
   limitations:"LP updates are based on management accounts and interim valuations rather than audited financials. The TVPI figure carries significant estimation uncertainty at early stage.",
   failureModes:"LP updates that consistently highlight only positive news and bury bad news destroy trust when the bad news eventually surfaces — which it always does. Transparency early is always the right policy.",
   modelRationale:"T2 (Claude Sonnet) for structured LP update generation from portfolio data."},

  {id:"PM7",phase:"portfolio",label:"Fund Performance Benchmarker",feeds:["PM6"],
   objective:"Compare the fund's performance against top-quartile benchmarks for its vintage year and sector focus.",
   input:"Fund performance data (IRR, TVPI, DPI), Cambridge Associates/PitchBook benchmark data",
   output:"Performance benchmark report: { fund_irr_vs_benchmark, fund_tvpi_vs_benchmark, percentile_ranking, trend_direction }",
   why:"Understanding whether a fund is performing above or below the benchmark for its vintage year is the most important piece of information for both GP self-assessment and LP retention.",
   inPractice:"A benchmark report. 'Fund Vintage 2022, India early-stage tech focus. Fund TVPI: 1.3x. Benchmark top quartile: 1.4x. Benchmark median: 1.15x. Percentile: ~65th. IRR: 18% (benchmark top quartile: 24%). Assessment: Above median, below top quartile. Primary drag: 2 write-offs in first 3 deployments reduced overall multiple. Core portfolio ex-write-offs: 1.8x TVPI — top quartile.'",
   limitations:"Vintage year benchmarks for India early-stage funds have limited data points — the benchmark itself may not be statistically robust for comparison purposes.",
   failureModes:"Selecting benchmark comparisons that make the fund look better than it is — by choosing a favourable vintage year or a weaker peer group — creates LP expectations that will eventually be disappointed.",
   modelRationale:"T2 (Claude Sonnet) for benchmark data analysis and performance comparison."},

  {id:"PM8",phase:"portfolio",label:"Cash Flow & Capital Call Modeler",feeds:["PM6"],
   objective:"Forecast when capital calls to LPs will be needed based on investment pacing and follow-on commitments.",
   input:"Fund financial model, reserve allocation plan (PM3), portfolio company fundraising timelines",
   output:"Capital call schedule: { projected_calls: [{ date, amount, trigger, LP_notice_required }], deployment_runway_months }",
   why:"Surprise capital calls damage LP relationships. A fund that gives 90 days notice of a capital call — with a clear reason and timeline — is a fund that LPs trust. A fund that calls capital on 30 days notice consistently will struggle to raise Fund II.",
   inPractice:"A capital call forecast. 'Projected calls: (1) Month 4: ₹3Cr (Company A Series A follow-on, 90 days notice required). (2) Month 7: ₹1.5Cr (new investment from pipeline, 60 days notice). (3) Month 11: ₹2Cr (estimated Company B bridge, 30 days notice — urgent). Deployment runway: 18 months at current pace. Recommendation: Send LP communication for Month 4 call immediately.'",
   limitations:"Capital call timing is highly dependent on company fundraising timelines that are inherently uncertain — the Month 7 call could move to Month 4 or Month 10 based on market conditions.",
   failureModes:"Forecasting capital calls with false precision — stating a specific date rather than a range — creates expectation mismatch when the timing inevitably shifts.",
   modelRationale:"T2 (Claude Sonnet) for financial modelling and capital call schedule generation."},

  {id:"PM9",phase:"portfolio",label:"Portfolio Company Valuation",feeds:["PM6","PM7"],
   objective:"Determine the appropriate quarterly 409A-equivalent valuation for each private portfolio company for LP reporting purposes.",
   input:"Company KPIs (PI9), comparable transactions (G2), public comps (C11)",
   output:"Quarterly valuation recommendation per company: { company, current_carrying_value, recommended_value, methodology, comparable_evidence[] }",
   why:"Fair value reporting is a legal and fiduciary obligation. Consistent, defensible valuation methodology across the portfolio protects the fund from LP disputes and regulatory scrutiny.",
   inPractice:"A valuation recommendation. 'Company A: Current carrying value ₹12Cr (seed round post-money). Recommended updated value: ₹18-22Cr (based on 2 comparable transactions at 5.8-7.2x ARR and company's current ARR of ₹3.2Cr). Methodology: Revenue multiple approach, discounted 20% for private company illiquidity. Recommended carrying value: ₹19Cr.'",
   limitations:"Private company valuation is inherently subjective and judgement-dependent. Two reasonable methodologies can produce valuations that differ by 30-40% — the methodology choice matters as much as the inputs.",
   failureModes:"Systematically marking up portfolio valuations without comparable evidence creates an inflated TVPI that misleads LPs about actual fund performance — and will ultimately be corrected at exit.",
   modelRationale:"T3 (Perplexity Sonar Pro) for comparable transaction research + T4 for valuation methodology reasoning."},

  {id:"PM10",phase:"portfolio",label:"Fund Lifecycle Planner",feeds:["PM6"],
   objective:"As the fund approaches the end of its life, recommend the optimal strategy for each remaining portfolio company.",
   input:"Fund legal documents, portfolio company maturity and exit readiness data",
   output:"End-of-life strategy memo: { recommended_actions: [{ company, action, rationale, timeline }], expected_distributions }",
   why:"Fund lifecycle management is the most underplanned aspect of venture. A fund that reaches year 9 without a clear strategy for its remaining companies is forced into suboptimal exits — under time pressure.",
   inPractice:"An end-of-life plan. 'Company A (year 7, on track): Pursue strategic sale in 18-24 months — IPO window uncertain. Company B (year 7, struggling): Explore acqui-hire options proactively — do not wait for distress sale. Company C (year 4, early): Consider rolling into Fund II — strong trajectory warrants continued support. Expected distributions: 2.1-2.8x DPI by fund year 10.'",
   limitations:"Fund lifecycle planning 3 years out is highly uncertain — market conditions, company trajectories, and acquirer appetite can all change dramatically in that timeframe.",
   failureModes:"Forcing exits on timeline rather than on value maximisation — because the fund must wind down — is the most common end-of-lifecycle value destruction pattern.",
   modelRationale:"T4 (Claude Opus) for complex multi-company lifecycle planning requiring long-horizon strategic reasoning."},

  {id:"XT1",phase:"exit",label:"Strategic Acquirer & Buyer List",feeds:["XT4"],
   objective:"Identify the 5-10 most likely strategic acquirers for a portfolio company and map the fund's relationship path to their corporate development teams.",
   input:"Company positioning, market map, LinkedIn (corp dev contacts)",
   output:"Prioritised acquirer list: { acquirer, strategic_rationale, likely_deal_value, contact_path, relationship_status }",
   why:"Strategic M&A is relationship-driven. A fund that has cultivated relationships with corporate development teams at 20 potential acquirers has a fundamental exit advantage over one that cold-outreaches when the company is ready to sell.",
   inPractice:"An acquirer map. 'Top acquirer: Tata Technologies — strategic fit with defence manufacturing software thesis, corp dev team known (contact: Rohit Agarwal via portfolio CEO), estimated deal range ₹80-150Cr. Second: Infosys BPM — distribution play, M&A active in adjacent space, cold relationship but reachable via common board member.'",
   limitations:"Acquirer prioritisation is based on strategic logic that may not match actual M&A appetite — a strategically obvious acquirer may have a no-acquisition policy or a pipeline of competing deals.",
   failureModes:"Signalling to potential acquirers that a portfolio company is for sale before the company is ready — or before the founder wants to sell — can undermine the founder's negotiating position and damage the fund relationship.",
   modelRationale:"T3 (Perplexity Sonar Pro) for M&A history research and corporate development contact mapping."},

  {id:"XT2",phase:"exit",label:"IPO Readiness Assessor",feeds:["XT4"],
   objective:"Assess whether a portfolio company has the financial scale, governance, and reporting maturity to be a viable IPO candidate.",
   input:"Company financials and metrics (PI9), public company benchmarks, governance documentation",
   output:"IPO readiness score (1-10) + gap analysis: { current_state, required_state, gaps[] }",
   why:"IPO readiness is not binary — it is a checklist of financial, governance, and reporting requirements that take 18-24 months to close. Starting the readiness assessment early creates the time to close the gaps.",
   inPractice:"An IPO readiness assessment. 'Score: 4.2/10. Critical gaps: Revenue (current ₹24Cr ARR, NSE SME minimum ~₹15Cr — marginal but potentially viable on mainboard in 2-3 years), Governance (no independent directors — required for listing), Financial reporting (2 years audited financials available, 3 required for mainboard). Action plan: Appoint independent directors by Q2, begin mainboard application preparation in 18 months.'",
   limitations:"IPO market conditions at the time of readiness matter as much as the company's readiness itself. A company that is ready to IPO in a closed market window should pursue a strategic sale instead.",
   failureModes:"Preparing a company for IPO when a strategic sale is available at a better valuation — because the founders want to be public — prioritises founder preference over LP returns.",
   modelRationale:"T3 (Perplexity Sonar Pro) for listing requirements research and governance benchmark comparison."},

  {id:"XT3",phase:"exit",label:"Secondary Market Scanner",feeds:["XT4"],
   objective:"Identify opportunities for partial liquidity for founders, early employees, or the fund through secondary market transactions.",
   input:"Secondary market platforms (Forge, EquityZen), investor network, company cap table",
   output:'JSON: { secondary_opportunity: bool, buyer_interest_level: "high/medium/low", estimated_price_vs_last_round }',
   why:"Secondary transactions allow founder liquidity — which reduces churn risk — and fund partial DPI — which improves LP metrics — without requiring a full exit. They are underutilised in the Indian ecosystem.",
   inPractice:"A secondary opportunity assessment. 'Secondary opportunity: POSSIBLE. Signals: (1) 2 growth funds have reached out to the fund in the last quarter asking about secondary availability. (2) Company valuation markup at last round creates attractive secondary pricing. Estimated secondary price: 0.85x last round valuation. Recommendation: Facilitate founder secondary of 5-10% stake — reduces founder financial pressure and aligns incentives.'",
   limitations:"Secondary transactions in Indian private companies require specific structuring around FEMA regulations and shareholder agreement restrictions that significantly complicate execution.",
   failureModes:"Facilitating a secondary transaction that other existing investors interpret as the fund losing confidence in the company — even if it's purely a liquidity management decision — can damage the company's ability to raise its next primary round.",
   modelRationale:"T2 (Claude Sonnet) for secondary market signal detection and opportunity assessment."},

  {id:"XT4",phase:"exit",label:"Exit Timing & Market Window",feeds:[],
   objective:"Recommend whether to accelerate, hold, or delay exit plans based on current M&A market conditions and company-specific readiness.",
   input:"Public market data, M&A transaction data, company-specific readiness (XT2)",
   output:'JSON: { market_window: "open/narrowing/closed", recommended_timing: "accelerate/hold/delay", key_factors[], window_duration_estimate }',
   why:"Exit timing is the most consequential single decision in a fund's lifecycle. The difference between exiting at the right moment versus 18 months late can be the difference between a 5x and a 2x return.",
   inPractice:"An exit timing analysis. 'Market window: NARROWING. Evidence: Strategic acquirer M&A activity in the sector is down 40% in the last 2 quarters (rising interest rates). Current company EBITDA trajectory is improving — but acquirer appetite may not wait. Recommendation: ACCELERATE exit process. Begin formal M&A discussions with top 3 acquirers immediately. Window duration estimate: 6-9 months before market conditions deteriorate further.'",
   limitations:"Market window timing prediction is inherently uncertain. The analysis provides a directional recommendation, not a forecast — conditions can reverse rapidly.",
   failureModes:"Accelerating an exit at a suboptimal valuation because of perceived market window narrowing — when the window would actually have stayed open — destroys significant LP value.",
   modelRationale:"T3 (Perplexity Sonar Pro) for current M&A market conditions research."},

  {id:"XT5",phase:"exit",label:"Comparable Exit Analysis",feeds:["XT4","PM6"],
   objective:"Find valuation multiples and deal structures for recent comparable exits to set realistic expectations and inform negotiation floors.",
   input:"M&A databases via Perplexity, S-1 filings for recent IPOs, sector-specific deal data",
   output:"Comparable exit report: { recent_exits: [{ company, date, type, valuation, revenue_multiple }], median_multiples{}, implied_valuation_for_target }",
   why:"Exit negotiation without comparable data is pure guesswork. Acquirers know what similar companies have sold for — the fund must know too to negotiate effectively.",
   inPractice:"A comparable exit analysis. '5 relevant exits in the last 18 months: Median acquisition multiple 5.8x ARR. Range: 4.2-8.7x. At current ARR of ₹24Cr, implied valuation range: ₹99-209Cr. Median: ₹139Cr. Note: The 8.7x outlier was a strategic acquisition by a US buyer at a strategic premium — may not be achievable with an Indian acquirer.'",
   limitations:"Comparable exit data for Indian B2B SaaS is sparse — sample sizes are small and the data is often undisclosed. Multiples should be treated as directional ranges, not precise benchmarks.",
   failureModes:"Anchoring the exit negotiation at the top of the comparable range — based on a single outlier transaction — creates a valuation expectation that a buyer cannot meet, causing the deal to fail.",
   modelRationale:"T3 (Perplexity Deep Research) for comprehensive exit comparable research across M&A databases and news archives."},

  {id:"ML1",phase:"meta",label:"Historical Deal Outcome Analyzer",feeds:["ML9","S1"],
   objective:"Analyse all past investments that have reached a final outcome to identify which early signals were most predictive of success and failure.",
   input:"Complete internal database of past deals: original diligence reports, IC memos, and actual company outcomes",
   output:"Predictive signal report: { most_predictive_green_flags[], most_predictive_red_flags[], model_accuracy_score }",
   why:"The fund's track record is the highest-quality dataset available for improving the investment process. Systematically mining it for predictive signals is the most rigorous form of self-improvement available.",
   inPractice:"A predictive signal report. 'Most predictive green flags (of 3x+ returns): Prior founder exit (accuracy 71%), Domain expertise >10 years (accuracy 64%), Market timing score >7.5 (accuracy 68%). Most predictive red flags (of write-offs): Customer concentration >60% at investment (accuracy 78%), Burn multiple >3.5x at seed (accuracy 72%). These findings have been incorporated into the scoring model.'",
   limitations:"The fund's historical sample is always too small for statistically robust conclusions. 20 investments with 5 final outcomes is not enough data to identify reliable patterns.",
   failureModes:"Overfitting to historical patterns — filtering for the exact characteristics of past successes — causes the fund to miss genuinely different opportunities that don't fit the historical template.",
   modelRationale:"T4 (Claude Opus) for sophisticated pattern recognition across complex historical multi-dimensional data."},

  {id:"ML2",phase:"meta",label:"Anti-Portfolio Analyzer",feeds:["ML4","ML9"],
   objective:"Analyse companies the fund passed on that went on to achieve significant outcomes — to understand what was wrong with the pass reasoning.",
   input:"Internal database of rejected deals, external market data on their outcomes",
   output:"Anti-portfolio report: { top_misses: [{ company, pass_reason, actual_outcome, flawed_reasoning_analysis }] }",
   why:"The anti-portfolio analysis is the most humbling and most valuable learning exercise available to a VC. Every missed unicorn had a reason the fund passed — understanding that reason systematically improves future decision-making.",
   inPractice:"An anti-portfolio analysis. 'Top 3 misses: (1) Company X (passed — 'market too small'): Raised Series C at $200M valuation 18 months later. Flawed reasoning: We used current TAM without modelling category expansion. (2) Company Y (passed — 'founder not domain expert'): Grew to ₹50Cr ARR in 24 months. Flawed reasoning: Underweighted founder's customer obsession relative to domain expertise.'",
   limitations:"Anti-portfolio analysis suffers from hindsight bias — it is easy to find the right reasoning for a decision after you know the outcome. The analysis must focus on the quality of the reasoning at the time of decision.",
   failureModes:"Using anti-portfolio analysis to lower standards — reasoning that 'we should have invested in everything we passed on' — misses the point. Some passes were correct even if the company succeeded.",
   modelRationale:"T4 (Claude Opus) for nuanced analysis of decision quality across complex historical contexts."},

  {id:"ML3",phase:"meta",label:"Investment Thesis Drift Detector",feeds:["ML9"],
   objective:"Analyse how the fund's actual investments have deviated from the stated investment thesis over time.",
   input:"Stated thesis (S1), full portfolio of all investments",
   output:'JSON: { drift_score: 1-10, drift_areas[], verdict: "adaptive_evolution/discipline_breakdown/on_thesis" }',
   why:"Thesis drift is the most common sign of a fund that has lost its investment identity — chasing deals rather than leading them. Identifying drift early allows course correction before it affects LP trust.",
   inPractice:"A thesis drift analysis. 'Drift score: 4.2/10 (moderate). Drift areas: (1) Stage — 3 of 12 investments are pre-seed (thesis: seed to pre-Series A). (2) Sector — 2 investments in consumer tech (thesis: B2B deeptech). Verdict: ADAPTIVE EVOLUTION — the pre-seed investments were exceptional teams in thesis sectors. The consumer tech investments require justification to LPs.'",
   limitations:"Some thesis drift is healthy adaptation to market opportunities — the system must distinguish between opportunistic deviation and disciplined evolution.",
   failureModes:"Labelling all thesis drift as 'discipline breakdown' penalises the kind of flexibility that allows funds to capture exceptional opportunities that were not anticipated in the original thesis document.",
   modelRationale:"T3 (Perplexity Sonar Pro) for portfolio analysis and thesis comparison."},

  {id:"ML4",phase:"meta",label:"Bias in Sourcing & Selection",feeds:["ML9","S1"],
   objective:"Identify systematic biases in the fund's sourcing and selection process — demographic, geographic, institutional, or network-based.",
   input:"Full pipeline of all deals sourced and invested in, demographic and geographic data",
   output:"Bias report: { identified_biases: [{ type, evidence, statistical_significance }], blind_spots[], recommended_process_changes[] }",
   why:"Every fund has systematic blind spots created by the networks and backgrounds of its GPs. Identifying these explicitly — and correcting for them — produces better investment outcomes and better LP optics.",
   inPractice:"A bias analysis. 'Identified biases: (1) Geographic: 78% of investments from Mumbai/Bangalore (IIT/IIM network effect). Only 8% from Tier 2 cities despite significant startup activity. (2) Educational: 68% of founders from IIT/IIM background (GP network bias). Recommended correction: Add 2 sourcing channels specifically targeting Tier 2 city founders. Note: Bias does not mean the investments are wrong — it means the pipeline is incomplete.'",
   limitations:"Bias analysis requires data that many funds don't systematically collect — founder demographic data, source tracking, and rejection reasons. Without this data, the analysis is qualitative rather than quantitative.",
   failureModes:"Using bias analysis to create quotas rather than to expand the sourcing funnel produces worse investment outcomes — the goal is to access more of the opportunity set, not to impose artificial selection criteria.",
   modelRationale:"T3 (Perplexity Sonar Pro) for pipeline analytics and demographic pattern identification."},

  {id:"ML5",phase:"meta",label:"Sector & Cycle Timing Analyzer",feeds:["ML9","S1"],
   objective:"Map where the fund's key investment sectors sit on the technology and investment hype cycle.",
   input:"Google Trends data, news sentiment analysis, funding volume data over time",
   output:"Hype cycle positioning: { sectors: [{ name, hype_cycle_position, investment_timing_grade, rationale }] }",
   why:"The best venture returns come from investing in the trough of disillusionment — when the technology is real but the hype has faded and valuations are reasonable. Understanding where each sector sits on the cycle informs both new investment decisions and portfolio company positioning.",
   inPractice:"A hype cycle analysis. 'Defence tech: Early mainstream adoption (good timing — past peak hype but before institutional capital flood). Quantum computing: Peak of inflated expectations (caution — valuations will correct). AI/ML SaaS: Sliding into trough of disillusionment (opportunity — real companies at reasonable valuations as hype fades). Drone logistics: Slope of enlightenment (excellent timing — proven use cases, rational capital).'",
   limitations:"Hype cycle positioning is inherently retrospective — it is much easier to identify peak hype after it has passed than to call it in real time.",
   failureModes:"Waiting for the trough before investing — missing companies that compound from peak through trough to plateau — is the classic error of being too clever about cycle timing.",
   modelRationale:"T3 (Perplexity Sonar Pro) for real-time sentiment and funding volume data across sectors."},

  {id:"ML6",phase:"meta",label:"LP Sentiment & Interest Tracker",feeds:["ML9"],
   objective:"Analyse LP communications to identify thematic interests and sector preferences that should inform the next fund's thesis.",
   input:"LP meeting notes, email communications, conference conversations",
   output:"LP sentiment report: { hot_themes: [{ theme, interest_level: 1-10, lp_count }], cold_themes[], next_fund_thesis_signals[] }",
   why:"Fund II is raised from Fund I's LPs. Understanding what those LPs want to see in the next fund — based on their own portfolio gaps and mandate evolution — gives the GP a significant fundraising advantage.",
   inPractice:"A LP sentiment report. 'Hot themes across LP base: Defence indigenisation (7/12 LPs mentioned unprompted), Climate tech (5/12), AI infrastructure (4/12). Cold: Consumer internet (9/12 LPs explicitly de-emphasised). Signal for Fund II: Defence + AI infrastructure thesis likely to resonate with existing LP base. Consider dedicated defence allocation of 40%+ vs current 28%.'",
   limitations:"LP sentiment tracking requires careful record-keeping of informal conversations — most of the most valuable signals come from offhand comments, not formal survey responses.",
   failureModes:"Building a Fund II thesis entirely around LP preferences rather than market opportunity produces a fund optimised for fundraising rather than for returns — the two are not always aligned.",
   modelRationale:"T2 (Claude Sonnet) for sentiment analysis across communication records."},

  {id:"ML7",phase:"meta",label:"Diligence Accuracy Reviewer",feeds:["ML10"],
   objective:"Compare original diligence reports against actual company outcomes to identify where the analysis was systematically wrong.",
   input:"Original IC memos (CV5), all agent outputs, actual company performance data",
   output:"Diligence accuracy report: { accurate_predictions[], missed_risks: [{ risk, agent_responsible, why_missed }], overestimated_strengths[] }",
   why:"The only way to improve the diligence system is to measure it against outcomes. An agent that consistently misses a specific type of risk should be redesigned. An assumption that is consistently wrong should be corrected.",
   inPractice:"A diligence accuracy report. 'Accurate: Founder quality assessment was predictive in 8 of 10 cases. Revenue trajectory model was within 20% of actual in 7 of 10 cases. Systematic misses: Customer concentration risk was identified but underweighted in 4 cases where it proved to be the primary failure mode — threshold should be lower. Overestimated: TAM size was overstated in 70% of cases — model requires a systematic 40% haircut.'",
   limitations:"Diligence accuracy analysis requires a minimum of 5-7 companies with final outcomes before any patterns are statistically meaningful. Early-stage funds will have limited data for several years.",
   failureModes:"Using diligence accuracy analysis to over-correct — tightening standards based on failures while ignoring what worked — produces a system that is better at avoiding bad deals and worse at identifying great ones.",
   modelRationale:"T4 (Claude Opus) for nuanced analysis of prediction accuracy across complex multi-dimensional historical data."},

  {id:"ML8",phase:"meta",label:"Value-Add Effectiveness Assessor",feeds:["ML9"],
   objective:"Measure the actual ROI of the fund's post-investment value-add activities by correlating them with company performance outcomes.",
   input:"Post-investment activity logs (PI1-PI10), company KPI data before and after fund interventions",
   output:'JSON: { value_add_roi_score: 1-10, most_impactful_activities[], least_impactful_activities[], recommended_focus_areas[] }',
   why:"Most funds claim to be value-add investors. Almost none measure whether their value-add actually improves outcomes. This agent creates the accountability mechanism that distinguishes value-add claims from value-add reality.",
   inPractice:"A value-add ROI analysis. 'Highest impact activities: Customer introductions (companies receiving 3+ customer intros grew 40% faster than those receiving 0-2). Talent introductions (companies filling critical roles via fund network showed 28% better NRR). Lowest impact: Strategic advisory (no statistically significant correlation with outcome). Recommendation: Concentrate post-investment resources on customer and talent introductions, reduce strategic advisory involvement.'",
   limitations:"Correlation between fund activities and company outcomes is not causation — companies that are growing faster naturally attract more fund attention, creating selection bias in the data.",
   failureModes:"Concluding that strategic advisory has no impact and cutting it entirely ignores the cases where it prevented a crisis — the value of avoided bad decisions is invisible in an outcome-based analysis.",
   modelRationale:"T3 (Perplexity Sonar Pro) for activity-outcome correlation analysis."},

  {id:"ML9",phase:"meta",label:"Next Fund Thesis Generator",feeds:["S1"],
   objective:"Based on all meta-learning outputs, synthesise a draft investment thesis for the next fund.",
   input:"All other meta-learning agent outputs (ML1-ML8)",
   output:"Draft next fund thesis: { core_hypotheses[], target_sectors[], stage_focus, geographic_focus, differentiation_strategy, rationale_from_learnings }",
   why:"The next fund thesis is the most consequential document the GP produces after their track record. Getting it right — grounded in evidence from Fund I rather than intuition — gives Fund II the best possible foundation.",
   inPractice:"A draft Fund II thesis. 'Core thesis: India defence and dual-use deeptech is entering a structural 10-year expansion driven by Atmanirbhar Bharat, DAP 2020, and iDEX. Fund I learnings support this: 3 of 4 best-performing companies are defence-adjacent. Market timing: trough of disillusionment for civilian deeptech, early mainstream for defence tech. Differentiation: Sector depth (domain expert GP), government procurement expertise, defence ministry relationships.'",
   limitations:"A thesis generated from Fund I outcomes is necessarily backward-looking. The best Fund II thesis requires integrating historical learnings with forward-looking market vision — the agent provides the former, the GP must supply the latter.",
   failureModes:"A Fund II thesis that is too similar to Fund I's — just a refined version of what worked — misses the opportunity to make the structural evolution in strategy that changing market conditions require.",
   modelRationale:"T4 (Claude Opus) for thesis synthesis requiring integration of historical learnings with forward-looking strategic reasoning."},

  {id:"ML10",phase:"meta",label:"System Improvement Recommender",feeds:[],
   objective:"Analyse which agents in the Vetrn system are providing the most signal, which are providing noise, and recommend specific system improvements.",
   input:"All agent outputs and their correlation with investment outcomes (ML7), cost data per agent",
   output:'JSON: { highest_signal_agents[], lowest_signal_agents[], recommended_deprecations[], recommended_enhancements[], estimated_quality_gain }',
   why:"Vetrn is not a static system — it should improve with every deal it processes. This agent is the system's immune response: identifying what is working, what is not, and what should change.",
   inPractice:"A system improvement report. 'Highest signal agents: B3 Track Record Investigator (74% predictive accuracy for outcomes), E11 Customer Concentration (78% predictive accuracy). Lowest signal: D7 OSS Community Analyzer (only applicable to 12% of deals, low predictive power when applicable). Recommendations: (1) Deprecate D7 — redirect compute to B3 for deeper investigation. (2) Add a new agent for government contract history in defence deals — currently missing from the system. (3) Lower K6 concentration threshold from Critical to Major — it is the most frequently missed risk.'",
   limitations:"System improvement recommendations based on a small deal sample may optimise for idiosyncratic fund characteristics rather than universal principles. Improvements should be validated across multiple deal cohorts before becoming permanent.",
   failureModes:"Deprecating agents that are rarely triggered but critical when triggered — like the fraud detector — based on low activation frequency misunderstands the purpose of safety agents.",
   modelRationale:"T4 (Claude Opus) for meta-level system analysis requiring reasoning about the entire analytical pipeline."},
];


const agentMap = {};
ALL_AGENTS.forEach(a => { agentMap[a.id] = a; });

function getUpstream(id, visited = new Set()) {
  if (visited.has(id)) return visited;
  visited.add(id);
  ALL_AGENTS.forEach(a => { if (a.feeds.includes(id)) getUpstream(a.id, visited); });
  return visited;
}
function getDownstream(id, visited = new Set()) {
  if (visited.has(id)) return visited;
  visited.add(id);
  (agentMap[id]?.feeds || []).forEach(fid => getDownstream(fid, visited));
  return visited;
}

const NODE_W = 148, NODE_H = 40, H_GAP = 70, V_GAP = 10, PAD = 30;

function layoutAgents(agents) {
  const phases = [...new Set(agents.map(a => a.phase))];
  const phaseOrder = PHASE_ORDER.filter(p => phases.includes(p));
  const positions = {};
  let x = PAD;
  phaseOrder.forEach(ph => {
    const phAgents = agents.filter(a => a.phase === ph);
    phAgents.forEach((a, i) => { positions[a.id] = { x, y: PAD + i * (NODE_H + V_GAP) }; });
    x += NODE_W + H_GAP;
  });
  const maxY = Math.max(...Object.values(positions).map(p => p.y)) + NODE_H + PAD;
  const maxX = x - H_GAP + PAD;
  return { positions, w: maxX, h: maxY, phaseOrder };
}

function Edge({ from, to, positions, highlighted, dimmed, color }) {
  const f = positions[from]; const t = positions[to];
  if (!f || !t) return null;
  const fx = f.x + NODE_W, fy = f.y + NODE_H / 2;
  const tx = t.x, ty = t.y + NODE_H / 2;
  const mx = (fx + tx) / 2;
  const isSameCol = Math.abs(f.x - t.x) < 10;
  const d = isSameCol
    ? `M ${fx} ${fy} C ${fx+30} ${fy}, ${tx+30} ${ty}, ${tx} ${ty}`
    : `M ${fx} ${fy} C ${mx} ${fy}, ${mx} ${ty}, ${tx} ${ty}`;
  const op = dimmed ? 0.04 : highlighted ? 0.9 : 0.18;
  const sw = highlighted ? 2 : 1;
  const sc = highlighted ? color : "#2a2a50";
  return <path d={d} fill="none" stroke={sc} strokeWidth={sw} opacity={op}
    strokeDasharray={highlighted ? "none" : "3 3"}
    markerEnd={highlighted ? `url(#ah-${color.replace("#","")})` : undefined} />;
}

function searchAgents(query) {
  if (!query || query.length < 2) return null;
  const q = query.toLowerCase();
  return ALL_AGENTS.filter(a =>
    a.id.toLowerCase().includes(q) ||
    a.label.toLowerCase().includes(q) ||
    a.objective.toLowerCase().includes(q) ||
    (a.why && a.why.toLowerCase().includes(q)) ||
    (PHASE_LABELS[a.phase] || "").toLowerCase().includes(q)
  );
}

// ── SPEC MODAL ──────────────────────────────────────────────────────────────
function AgentModal({ agent, onClose }) {
  if (!agent) return null;
  const color = PHASE_COLORS[agent.phase] || "#888";
  const [activeTab, setActiveTab] = useState("spec");

  const tabs = [
    { id: "spec", label: "SPEC" },
    { id: "context", label: "CONTEXT" },
    { id: "edges", label: "EDGES" },
  ];

  return (
    <div style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)",zIndex:1000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:20
    }} onClick={onClose}>
      <div style={{
        background:"#0a0a18",border:`1px solid ${color}33`,borderTop:`3px solid ${color}`,
        borderRadius:12,maxWidth:680,width:"100%",maxHeight:"88vh",
        display:"flex",flexDirection:"column",
        boxShadow:`0 24px 80px rgba(0,0,0,0.6), 0 0 40px ${color}08`
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{padding:"18px 22px 0",flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span style={{
                  fontSize:10,color:"#fff",fontWeight:700,letterSpacing:0.5,
                  background:color+"33",border:`1px solid ${color}55`,
                  padding:"2px 8px",borderRadius:4
                }}>{agent.id}</span>
                <span style={{fontSize:10,color:color,fontWeight:600,letterSpacing:0.5,opacity:0.7}}>
                  {PHASE_LABELS[agent.phase] || agent.phase}
                </span>
              </div>
              <div style={{fontSize:19,fontWeight:800,color:"#fff",lineHeight:1.25,letterSpacing:-0.3}}>
                {agent.label}
              </div>
            </div>
            <button onClick={onClose} style={{
              background:"#13132a",border:"1px solid #1e1e3a",color:"#555",
              width:30,height:30,borderRadius:6,cursor:"pointer",fontSize:14,
              display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
              transition:"all 0.15s"
            }} onMouseEnter={e=>e.target.style.color="#999"} onMouseLeave={e=>e.target.style.color="#555"}>✕</button>
          </div>

          {agent.why && (
            <div style={{
              marginTop:12,fontSize:12,color:"#c8c8e0",lineHeight:1.7,
              borderLeft:`3px solid ${color}`,paddingLeft:12,
              fontStyle:"italic",opacity:0.9
            }}>
              {agent.why}
            </div>
          )}

          <div style={{display:"flex",gap:2,marginTop:16,borderBottom:`1px solid #1a1a30`}}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                padding:"7px 16px",fontSize:9,fontWeight:700,letterSpacing:1,cursor:"pointer",
                background:"transparent",border:"none",borderBottom: activeTab===t.id ? `2px solid ${color}` : "2px solid transparent",
                color: activeTab===t.id ? color : "#444",
                transition:"all 0.15s"
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{flex:1,overflowY:"auto",padding:"14px 22px 20px"}}>

          {activeTab === "spec" && (
            <>
              {[
                {label:"OBJECTIVE", value:agent.objective, mono:false},
                {label:"INPUT", value:agent.input, mono:false},
                {label:"OUTPUT", value:agent.output, mono:true},
              ].map(f => (
                <div key={f.label} style={{marginBottom:12}}>
                  <div style={{fontSize:8,fontWeight:800,letterSpacing:1.5,color:color,marginBottom:4,opacity:0.7}}>{f.label}</div>
                  <div style={{
                    background:"#07070f",border:`1px solid ${color}15`,borderLeft:`3px solid ${color}33`,
                    borderRadius:5,padding:"9px 11px",fontSize:11,color:"#aaa",lineHeight:1.65,
                    fontFamily:f.mono?"'JetBrains Mono','Fira Code',monospace":"inherit"
                  }}>
                    {f.value}
                  </div>
                </div>
              ))}

              {agent.inPractice && (
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:8,fontWeight:800,letterSpacing:1.5,color:"#10b981",marginBottom:4,opacity:0.7}}>WHAT YOU'LL SEE</div>
                  <div style={{
                    background:"#07100d",border:"1px solid #10b98118",borderLeft:"3px solid #10b98133",
                    borderRadius:5,padding:"9px 11px",fontSize:11,color:"#8dc8b0",lineHeight:1.7,
                  }}>
                    {agent.inPractice}
                  </div>
                </div>
              )}

              {agent.modelRationale && (
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:8,fontWeight:800,letterSpacing:1.5,color:"#6366f1",marginBottom:4,opacity:0.7}}>MODEL TIER</div>
                  <div style={{
                    background:"#0a0a1a",border:"1px solid #6366f118",borderLeft:"3px solid #6366f133",
                    borderRadius:5,padding:"9px 11px",fontSize:11,color:"#9598d0",lineHeight:1.65,
                  }}>
                    {agent.modelRationale}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "context" && (
            <>
              {agent.limitations && (
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:8,fontWeight:800,letterSpacing:1.5,color:"#f59e0b",marginBottom:4,opacity:0.7}}>LIMITATIONS</div>
                  <div style={{
                    background:"#100e07",border:"1px solid #f59e0b18",borderLeft:"3px solid #f59e0b33",
                    borderRadius:5,padding:"9px 11px",fontSize:11,color:"#c8b070",lineHeight:1.7,
                  }}>
                    {agent.limitations}
                  </div>
                </div>
              )}

              {agent.failureModes && (
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:8,fontWeight:800,letterSpacing:1.5,color:"#ef4444",marginBottom:4,opacity:0.7}}>FAILURE MODES</div>
                  <div style={{
                    background:"#100707",border:"1px solid #ef444418",borderLeft:"3px solid #ef444433",
                    borderRadius:5,padding:"9px 11px",fontSize:11,color:"#c87070",lineHeight:1.7,
                  }}>
                    {agent.failureModes}
                  </div>
                </div>
              )}

              {!agent.limitations && !agent.failureModes && (
                <div style={{fontSize:11,color:"#333",padding:"20px 0",textAlign:"center"}}>
                  No limitations or failure modes documented for this agent.
                </div>
              )}
            </>
          )}

          {activeTab === "edges" && (
            <div style={{display:"flex",gap:16}}>
              <div style={{flex:1}}>
                <div style={{fontSize:8,fontWeight:800,letterSpacing:1.5,color:"#6366f1",marginBottom:8}}>FED BY (UPSTREAM)</div>
                {ALL_AGENTS.filter(a => a.feeds.includes(agent.id)).length === 0
                  ? <div style={{fontSize:10,color:"#333",fontStyle:"italic"}}>Entry point — no upstream dependencies</div>
                  : ALL_AGENTS.filter(a => a.feeds.includes(agent.id)).map(a => (
                    <div key={a.id} style={{
                      fontSize:10,color:"#8888cc",marginBottom:4,padding:"4px 8px",
                      background:"#0c0c1e",borderRadius:4,border:"1px solid #1a1a30",
                      display:"flex",alignItems:"center",gap:6
                    }}>
                      <span style={{color:"#6366f1",fontWeight:700,fontSize:9,flexShrink:0}}>{a.id}</span>
                      <span style={{color:"#666"}}>{a.label}</span>
                    </div>
                  ))}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:8,fontWeight:800,letterSpacing:1.5,color:"#10b981",marginBottom:8}}>FEEDS INTO (DOWNSTREAM)</div>
                {agent.feeds.length === 0
                  ? <div style={{fontSize:10,color:"#333",fontStyle:"italic"}}>Terminal agent — no downstream consumers</div>
                  : agent.feeds.map(fid => {
                    const fa = agentMap[fid];
                    return fa ? (
                      <div key={fid} style={{
                        fontSize:10,color:"#88ccaa",marginBottom:4,padding:"4px 8px",
                        background:"#0c1e14",borderRadius:4,border:"1px solid #1a3020",
                        display:"flex",alignItems:"center",gap:6
                      }}>
                        <span style={{color:"#10b981",fontWeight:700,fontSize:9,flexShrink:0}}>{fid}</span>
                        <span style={{color:"#668"}}>{fa.label}</span>
                      </div>
                    ) : null;
                  })}
              </div>
            </div>
          )}
        </div>

        <div style={{
          padding:"10px 22px",borderTop:"1px solid #1a1a30",flexShrink:0,
          display:"flex",justifyContent:"space-between",alignItems:"center"
        }}>
          <span style={{fontSize:8,color:"#2a2a40",letterSpacing:0.5}}>
            {ALL_AGENTS.filter(a => a.feeds.includes(agent.id)).length} upstream · {agent.feeds.length} downstream
          </span>
          <span style={{fontSize:8,color:"#2a2a40"}}>ESC or click outside to close</span>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ────────────────────────────────────────────────────────────────────
export default function AgentFlowExplorer() {
  const [mode, setMode] = useState("phase");
  const [selectedPhase, setSelectedPhase] = useState("intake");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [modalAgent, setModalAgent] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const dragging = useRef(false);
  const dragMoved = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const svgRef = useRef(null);
  const searchInputRef = useRef(null);
  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const shortcutLabel = isMac ? "⌘K" : "Ctrl+K";

  const chain = selectedAgent ? { upstream: getUpstream(selectedAgent), downstream: getDownstream(selectedAgent) } : null;

  const searchResults = mode === "search" ? searchAgents(searchQuery) : null;
  const searchMatchIds = searchResults ? new Set(searchResults.map(a => a.id)) : null;

  let renderAgents = [];
  if (mode === "phase") renderAgents = ALL_AGENTS.filter(a => a.phase === selectedPhase);
  else renderAgents = ALL_AGENTS; // both search and trace show all agents

  const { positions, phaseOrder } = layoutAgents(renderAgents);

  const edges = [];
  renderAgents.forEach(a => {
    a.feeds.forEach(fid => {
      if (positions[a.id] && positions[fid]) edges.push({ from: a.id, to: fid });
    });
  });

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        if (modalAgent) setModalAgent(null);
        else if (selectedAgent) setSelectedAgent(null);
      }
      // Cmd/Ctrl+K to jump to search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setMode("search");
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modalAgent, selectedAgent]);

  const handleWheel = useCallback(e => {
    e.preventDefault();
    setZoom(z => Math.min(3, Math.max(0.3, z - e.deltaY * 0.001)));
  }, []);
  useEffect(() => {
    const el = svgRef.current;
    if (el) el.addEventListener("wheel", handleWheel, { passive: false });
    return () => { if (el) el.removeEventListener("wheel", handleWheel); };
  }, [handleWheel]);

  const onMD = useCallback(e => {
    dragging.current = true;
    dragMoved.current = false;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMM = useCallback(e => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved.current = true;
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMU = useCallback(() => { dragging.current = false; }, []);

  const usedColors = [...new Set(renderAgents.map(a => PHASE_COLORS[a.phase]))];

  return (
    <div style={{ background:"#08080f", height:"100vh", display:"flex", flexDirection:"column", fontFamily:"'Inter',sans-serif", color:"#fff", overflow:"hidden" }}>

      <AgentModal agent={modalAgent} onClose={() => setModalAgent(null)} />

      {/* Header */}
      <div style={{ padding:"10px 16px 8px", borderBottom:"1px solid #12122a", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ color:"#e94560", fontSize:16, fontWeight:800, letterSpacing:-1 }}>VETRN</span>
            <span style={{ color:"#222" }}>|</span>
            <span style={{ color:"#444", fontSize:9, letterSpacing:1 }}>AGENT FLOW · {ALL_AGENTS.length} AGENTS</span>
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {[
              {id:"phase",label:"Phase View"},
              {id:"search",label:"Search"},
              {id:"trace",label:"Chain Trace"},
            ].map(m => (
              <button key={m.id} onClick={() => {
                setMode(m.id);
                setSelectedAgent(null);
                if (m.id === "search") setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
                style={{ padding:"5px 12px", borderRadius:6, border:"1px solid", fontSize:10, fontWeight:600, cursor:"pointer",
                  background: mode===m.id?"#e94560":"#0f0f24",
                  borderColor: mode===m.id?"#e94560":"#1e1e3a",
                  color: mode===m.id?"#fff":"#666" }}>
                {m.label}{m.id==="search" ? ` ${shortcutLabel}` : ""}
              </button>
            ))}
          </div>
        </div>

        {/* Mode-specific controls */}
        <div style={{ marginTop:8, display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          {mode==="phase" && PHASE_ORDER.map(ph => (
            <button key={ph} onClick={() => setSelectedPhase(ph)}
              style={{ padding:"3px 9px", borderRadius:4, border:"1px solid", fontSize:9, cursor:"pointer", fontWeight:600,
                background: selectedPhase===ph?(PHASE_COLORS[ph]+"33"):"transparent",
                borderColor: selectedPhase===ph?PHASE_COLORS[ph]:"#1a1a30",
                color: selectedPhase===ph?PHASE_COLORS[ph]:"#444" }}>
              {PHASE_LABELS[ph]}
            </button>
          ))}

          {mode==="search" && (
            <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
              <div style={{position:"relative",flex:1,maxWidth:400}}>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search agents by name, ID, objective, phase…"
                  autoFocus
                  style={{
                    width:"100%",padding:"6px 12px 6px 28px",borderRadius:6,
                    background:"#0c0c1e",border:"1px solid #1e1e3a",
                    color:"#ccc",fontSize:11,outline:"none",
                    fontFamily:"inherit"
                  }}
                  onFocus={e => e.target.style.borderColor = "#e94560"}
                  onBlur={e => e.target.style.borderColor = "#1e1e3a"}
                />
                <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#333",pointerEvents:"none"}}>⌕</span>
              </div>
              <span style={{fontSize:9,color:"#444",flexShrink:0}}>
                {searchQuery.length < 2
                  ? "Type 2+ characters"
                  : searchResults
                    ? `${searchResults.length} match${searchResults.length!==1?"es":""}`
                    : ""}
              </span>
              {/* Search result list panel */}
              {searchResults && searchResults.length > 0 && (
                <div style={{display:"flex",gap:4,flexWrap:"wrap",flex:1}}>
                  {searchResults.slice(0,12).map(a => (
                    <button key={a.id} onClick={() => setModalAgent(a)}
                      style={{
                        padding:"2px 8px",borderRadius:4,fontSize:9,cursor:"pointer",fontWeight:600,
                        background:PHASE_COLORS[a.phase]+"22",border:`1px solid ${PHASE_COLORS[a.phase]}44`,
                        color:PHASE_COLORS[a.phase],whiteSpace:"nowrap"
                      }}>
                      {a.id} {a.label.length > 16 ? a.label.slice(0,15)+"…" : a.label}
                    </button>
                  ))}
                  {searchResults.length > 12 && (
                    <span style={{fontSize:9,color:"#444",alignSelf:"center"}}>+{searchResults.length-12} more</span>
                  )}
                </div>
              )}
            </div>
          )}

          {mode==="trace" && (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:9, color:"#444" }}>
                {selectedAgent ? `Tracing: ${agentMap[selectedAgent]?.label} (${selectedAgent}) · Click for spec` : "Click any agent to trace · Click again for spec"}
              </span>
              {selectedAgent && (
                <button onClick={() => setSelectedAgent(null)}
                  style={{ fontSize:9, color:"#888", background:"none", border:"1px solid #1a1a30", borderRadius:4, padding:"2px 8px", cursor:"pointer" }}>
                  clear
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex:1, position:"relative", overflow:"hidden" }}>
        <svg ref={svgRef} width="100%" height="100%"
          onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
          style={{ cursor:"grab" }}>
          <defs>
            {usedColors.map(c => (
              <marker key={c} id={`ah-${c.replace("#","")}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill={c} />
              </marker>
            ))}
          </defs>
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {/* Phase headers */}
            {phaseOrder.map(ph => {
              const phAgents = renderAgents.filter(a => a.phase === ph);
              if (!phAgents.length) return null;
              const x = positions[phAgents[0].id]?.x;
              if (x === undefined) return null;
              const color = PHASE_COLORS[ph];
              return (
                <g key={ph}>
                  <rect x={x} y={PAD-28} width={NODE_W} height={20} rx={4} fill={color+"22"} />
                  <text x={x+NODE_W/2} y={PAD-13} textAnchor="middle" style={{fontSize:9,fill:color,fontWeight:700,letterSpacing:0.5}}>
                    {PHASE_LABELS[ph]}
                  </text>
                </g>
              );
            })}
            {/* Edges */}
            {edges.map((e,i) => {
              const toAgent = agentMap[e.to];
              const color = PHASE_COLORS[toAgent?.phase] || "#fff";
              let highlighted = false, dimmed = false;
              if (mode==="trace" && selectedAgent) {
                const inChain = chain.upstream.has(e.from) && (e.to===selectedAgent||chain.upstream.has(e.to))
                  || (e.from===selectedAgent)
                  || (chain.downstream.has(e.to) && (e.from===selectedAgent||chain.downstream.has(e.from)));
                highlighted = !!inChain;
                dimmed = !highlighted;
              }
              if (mode==="search" && searchMatchIds && searchMatchIds.size > 0) {
                highlighted = searchMatchIds.has(e.from) && searchMatchIds.has(e.to);
                dimmed = !highlighted;
              }
              return <Edge key={i} from={e.from} to={e.to} positions={positions} highlighted={highlighted} dimmed={dimmed} color={color} />;
            })}
            {/* Nodes */}
            {renderAgents.map(a => {
              const pos = positions[a.id];
              if (!pos) return null;
              const color = PHASE_COLORS[a.phase];

              // Trace mode styling
              const isSel = mode==="trace" && selectedAgent===a.id;
              const isUp = mode==="trace" && selectedAgent && chain.upstream.has(a.id) && a.id!==selectedAgent;
              const isDown = mode==="trace" && selectedAgent && chain.downstream.has(a.id) && a.id!==selectedAgent;
              const isTraceDim = mode==="trace" && selectedAgent && !isSel && !isUp && !isDown;

              // Search mode styling
              const isSearchMatch = mode==="search" && searchMatchIds && searchMatchIds.has(a.id);
              const isSearchDim = mode==="search" && searchMatchIds && searchMatchIds.size > 0 && !isSearchMatch;

              const isDim = isTraceDim || isSearchDim;
              const isHighlighted = isSel || isUp || isDown || isSearchMatch;

              const opacity = isDim ? 0.08 : 1;
              const stroke = isSel ? color
                : isUp ? "#6366f1"
                : isDown ? "#10b981"
                : isSearchMatch ? color
                : color+"55";
              const strokeW = isHighlighted ? 2 : 1;
              const bg = isSel ? (color+"30")
                : isUp ? "#6366f112"
                : isDown ? "#10b98112"
                : isSearchMatch ? (color+"20")
                : "#0c0c1e";

              return (
                <g key={a.id}
                  transform={`translate(${pos.x},${pos.y})`}
                  style={{ opacity, cursor:"pointer" }}
                  onClick={e => {
                    if (dragMoved.current) return;
                    if (mode==="trace") {
                      if (selectedAgent===a.id) setModalAgent(a);
                      else setSelectedAgent(a.id);
                    } else {
                      setModalAgent(a);
                    }
                  }}
                  onMouseDown={e => {
                    dragging.current = true;
                    dragMoved.current = false;
                    lastPos.current = { x: e.clientX, y: e.clientY };
                  }}>
                  <rect width={NODE_W} height={NODE_H} rx={5} fill={bg} stroke={stroke} strokeWidth={strokeW} />
                  <rect width={3} height={NODE_H} rx={2} fill={color} />
                  <text x={10} y={15} style={{fontSize:8,fill:color,fontWeight:700}}>{a.id}</text>
                  <text x={10} y={28} style={{fontSize:9.5,fill:"#ccc",fontWeight:600}}>
                    {a.label.length>18?a.label.slice(0,17)+"…":a.label}
                  </text>
                  {isUp && <text x={NODE_W-6} y={14} textAnchor="end" style={{fontSize:7,fill:"#6366f1",fontWeight:700}}>↑</text>}
                  {isDown && <text x={NODE_W-6} y={14} textAnchor="end" style={{fontSize:7,fill:"#10b981",fontWeight:700}}>↓</text>}
                  {isSel && <text x={NODE_W-6} y={14} textAnchor="end" style={{fontSize:7,fill:color,fontWeight:700}}>●</text>}
                  {isSearchMatch && !isSel && <text x={NODE_W-6} y={14} textAnchor="end" style={{fontSize:7,fill:color,fontWeight:700}}>◉</text>}
                </g>
              );
            })}
          </g>
        </svg>

        <div style={{position:"absolute",inset:0,zIndex:-1}} onClick={()=>setSelectedAgent(null)} />

        {/* Zoom controls */}
        <div style={{position:"absolute",bottom:16,right:16,display:"flex",flexDirection:"column",gap:4}}>
          {[["＋",0.15],["－",-0.15],["⟳","r"]].map(([l,v])=>(
            <button key={l} onClick={()=>{if(v==="r"){setZoom(1);setPan({x:0,y:0});}else setZoom(z=>Math.min(3,Math.max(0.3,z+v)));}}
              style={{background:"#0f0f24",border:"1px solid #1e1e3a",color:"#888",width:28,height:28,borderRadius:5,cursor:"pointer",fontSize:12}}>
              {l}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div style={{position:"absolute",bottom:16,left:16,background:"#0a0a18",border:"1px solid #1a1a30",borderRadius:7,padding:"8px 12px"}}>
          <div style={{fontSize:8,color:"#333",marginBottom:5,letterSpacing:1}}>INTERACTION</div>
          {mode==="trace"
            ? [["1st click","Select + trace chain"],["2nd click","Open spec popup"],["Drag","Pan"],["Scroll","Zoom"],["ESC","Clear selection"]].map(([k,v])=>(
                <div key={k} style={{display:"flex",gap:6,marginBottom:2}}>
                  <span style={{fontSize:8,color:"#555",fontWeight:700,width:54}}>{k}</span>
                  <span style={{fontSize:8,color:"#444"}}>{v}</span>
                </div>
              ))
            : mode==="search"
            ? [["Type","Filter agents on graph"],["Click chip","Open spec popup"],["Click node","Open spec popup"],[shortcutLabel,"Focus search"],["Drag","Pan"]].map(([k,v])=>(
                <div key={k} style={{display:"flex",gap:6,marginBottom:2}}>
                  <span style={{fontSize:8,color:"#555",fontWeight:700,width:54}}>{k}</span>
                  <span style={{fontSize:8,color:"#444"}}>{v}</span>
                </div>
              ))
            : [["Click","Open spec popup"],["Drag","Pan"],["Scroll","Zoom"],[shortcutLabel,"Jump to search"]].map(([k,v])=>(
                <div key={k} style={{display:"flex",gap:6,marginBottom:2}}>
                  <span style={{fontSize:8,color:"#555",fontWeight:700,width:54}}>{k}</span>
                  <span style={{fontSize:8,color:"#444"}}>{v}</span>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  );
}
