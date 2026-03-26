import { RESEARCH_PROMPT, ANSWER_PROMPT } from './systemPrompt';

export async function fetchHealthResearch(query) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Groq API Key is missing. Please add VITE_GROQ_API_KEY to your .env file.');
  }

  // ==========================================
  // STEP 1: RESEARCH AGENT (Pulls Papers)
  // ==========================================
  const researchResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: RESEARCH_PROMPT },
        { role: 'user', content: query }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    }),
  });

  if (!researchResponse.ok) {
    throw new Error('Phase 1 (Research) failed to fetch papers. Please try again.');
  }

  const researchData = await researchResponse.json();
  const researchContent = JSON.parse(researchData.choices[0].message.content);

  // Instant Refusal on Guardrails during Phase 1
  if (researchContent.refused) {
    return {
      answer: `I must respectfully decline to answer this query due to strict safety guardrails (${researchContent.reason}). I cannot provide explicit medical directives, assist with dangerous synthesis, or fulfill non-health-related requests.`,
      papers: []
    };
  }

  // ==========================================
  // STEP 2: ANSWER AGENT (Synthesizes Data)
  // ==========================================
  const contextForAnswer = `
USER QUERY: ${query}

RETRIEVED SCIENTIFIC RESEARCH PAPERS:
${JSON.stringify(researchContent.papers, null, 2)}
`;

  const answerResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: ANSWER_PROMPT },
        { role: 'user', content: contextForAnswer }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    }),
  });

  if (!answerResponse.ok) {
    throw new Error('Phase 2 (Analysis) failed to generate a response from the papers.');
  }

  const answerData = await answerResponse.json();
  
  try {
    return JSON.parse(answerData.choices[0].message.content);
  } catch (e) {
    console.error("Failed to parse Final JSON:", answerData.choices[0].message.content);
    throw new Error("Invalid output format from Final LLM Analysis.");
  }
}
