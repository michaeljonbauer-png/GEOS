import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface DraftOutreachParams {
  type: "EMAIL" | "LINKEDIN_MESSAGE";
  companyName: string;
  companyDescription?: string;
  sector?: string;
  arrEstimate?: number;
  arrGrowth?: number;
  contactName?: string;
  contactTitle?: string;
  investorName?: string;
  firmName?: string;
  customContext?: string;
}

export async function draftOutreach(params: DraftOutreachParams): Promise<{
  subject?: string;
  body: string;
}> {
  const {
    type,
    companyName,
    companyDescription,
    sector,
    arrEstimate,
    arrGrowth,
    contactName,
    contactTitle,
    investorName = "the investor",
    firmName = "our firm",
    customContext,
  } = params;

  const companyContext = [
    companyDescription && `Company: ${companyDescription}`,
    sector && `Sector: ${sector}`,
    arrEstimate && `ARR: ~$${arrEstimate}M`,
    arrGrowth && `Growth: ${arrGrowth > 0 ? "+" : ""}${arrGrowth}% YoY`,
  ]
    .filter(Boolean)
    .join("\n");

  const isEmail = type === "EMAIL";
  const charLimit = isEmail ? "300-400 words" : "200-250 characters (LinkedIn limit)";
  const recipientAddress = contactName
    ? `${contactName}${contactTitle ? `, ${contactTitle}` : ""} at ${companyName}`
    : `the founder/CEO at ${companyName}`;

  const systemPrompt = `You are an expert growth equity investor writing outreach messages. Your messages are:
- Personalized and specific to the company
- Concise and respectful of the recipient's time
- Clear about who you are and why you're reaching out
- Not overly salesy — you lead with genuine interest and insight
- Action-oriented with a clear, low-friction ask`;

  const userPrompt = `Draft a ${isEmail ? "cold email" : "LinkedIn message"} to ${recipientAddress}.

Sender: ${investorName} from ${firmName} (growth equity investor focused on B2B software)

Company context:
${companyContext || `${companyName} is a B2B software company`}
${customContext ? `\nAdditional context: ${customContext}` : ""}

Requirements:
- Length: ${charLimit}
- Tone: Professional but warm, genuine curiosity${isEmail ? "\n- Include a compelling subject line" : ""}
- Lead with a specific observation about their business or market
- Briefly mention why they fit your investment thesis
- Clear CTA: 15-minute call to learn more
${isEmail ? "\nFormat your response as:\nSUBJECT: [subject line]\n\n[email body]" : "Format as a single LinkedIn message with no labels."}`;

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  if (isEmail) {
    const subjectMatch = text.match(/^SUBJECT:\s*(.+)$/m);
    const subject = subjectMatch ? subjectMatch[1].trim() : undefined;
    const body = text
      .replace(/^SUBJECT:\s*.+\n+/m, "")
      .trim();
    return { subject, body };
  }

  return { body: text.trim() };
}

interface ScoreSuggestionsParams {
  companyName: string;
  companyDescription?: string;
  sector?: string;
  arrEstimate?: number;
  arrGrowth?: number;
  nrrEstimate?: number;
  employees?: number;
  founded?: number;
  criteria: { id: string; name: string; description?: string }[];
}

export async function suggestScores(
  params: ScoreSuggestionsParams
): Promise<{ criterionId: string; score: number; rationale: string }[]> {
  const { companyName, criteria, ...companyData } = params;

  const companyContext = Object.entries(companyData)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const criteriaList = criteria
    .map((c, i) => `${i + 1}. ${c.name}${c.description ? ` — ${c.description}` : ""}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are a growth equity investment analyst. Score ${companyName} on each criterion below using available data. Return ONLY valid JSON.

Company data:
${companyContext || "Limited data available"}

Criteria to score (0-10 scale):
${criteriaList}

Return JSON array:
[{"criterionId": "...", "score": 7.5, "rationale": "one sentence"}]

Use the criterion index (1-based) as criterionId placeholder — I will map them. Be calibrated: 7+ means genuinely strong, 5 is average, <4 is a concern.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "[]";

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : "[]") as {
      criterionId: string;
      score: number;
      rationale: string;
    }[];

    return parsed.map((item, i) => ({
      ...item,
      criterionId: criteria[i]?.id ?? item.criterionId,
    }));
  } catch {
    return [];
  }
}
