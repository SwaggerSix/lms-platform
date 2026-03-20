import { getAI } from "./openai";

// ---- Types ----

export interface CourseOutline {
  title: string;
  description: string;
  short_description: string;
  modules: ModuleOutline[];
  tags: string[];
  suggested_category: string;
}

export interface ModuleOutline {
  title: string;
  description: string;
  lessons: LessonOutline[];
}

export interface LessonOutline {
  title: string;
  content_type: "video" | "document" | "audio" | "quiz" | "interactive";
  duration: number;
  description: string;
}

export interface LessonContent {
  content: string;
  key_points: string[];
  estimated_duration: number;
}

export interface QuizQuestion {
  question: string;
  question_type: "multiple-choice" | "true-false" | "fill-in-blank";
  options?: string[];
  correct_answer: string | number;
  explanation: string;
  points: number;
}

export interface ImprovedDescription {
  description: string;
  short_description: string;
}

export interface GenerateCourseOptions {
  difficulty?: string;
  duration?: string;
  targetAudience?: string;
  courseType?: string;
}

export interface GenerateFromMaterialsOptions {
  title?: string;
  difficulty?: string;
  format?: string;
}

// ---- Helper ----

async function askClaude(system: string, user: string, model: string = "claude-sonnet-4-20250514"): Promise<string> {
  const client = getAI();
  const response = await client.messages.create({
    model,
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: 4096,
    temperature: 0.7,
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : null;
  if (!text) throw new Error("No response from AI");
  return text;
}

function extractJSON(text: string): string {
  // Strip markdown code fences if present
  return text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
}

// ---- Functions ----

export async function generateCourseOutline(
  topic: string,
  options: GenerateCourseOptions = {}
): Promise<CourseOutline> {
  const { difficulty = "intermediate", duration = "2-4 hours", targetAudience = "professionals", courseType = "self-paced" } = options;

  const content = await askClaude(
    `You are an expert instructional designer and curriculum developer. You create pedagogically sound course structures with logical progression from foundational concepts to advanced topics. Each module should build on previous knowledge. Include a mix of content types (video, document, quiz, interactive) for diverse learning styles.

Always respond with valid JSON matching this exact schema:
{
  "title": "string",
  "description": "string (2-3 paragraphs, engaging and informative)",
  "short_description": "string (max 160 chars)",
  "modules": [
    {
      "title": "string",
      "description": "string (1-2 sentences)",
      "lessons": [
        {
          "title": "string",
          "content_type": "video" | "document" | "audio" | "quiz" | "interactive",
          "duration": number (in minutes),
          "description": "string (1 sentence)"
        }
      ]
    }
  ],
  "tags": ["string"],
  "suggested_category": "string (one of: Compliance, Management, Technical, Sales, Soft Skills, Business)"
}`,
    `Create a comprehensive course outline for the following topic:

Topic: ${topic}
Difficulty Level: ${difficulty}
Target Duration: ${duration}
Target Audience: ${targetAudience}
Course Type: ${courseType}

Requirements:
- Create 3-6 modules depending on the topic complexity
- Each module should have 3-5 lessons
- Start with an introductory module and end with a summary/assessment module
- Include at least one quiz per module
- Vary content types across lessons
- Ensure lesson durations are realistic (5-30 minutes each)
- Include practical exercises and real-world applications
- Tags should be relevant keywords (5-8 tags)`
  );

  return JSON.parse(extractJSON(content)) as CourseOutline;
}

export async function generateLessonContent(
  lessonTitle: string,
  courseContext: string,
  contentType: string
): Promise<LessonContent> {
  const contentInstructions: Record<string, string> = {
    video: "Generate a detailed script/talking points for a video lesson. Include an introduction, main content sections with clear transitions, and a summary. Format with timestamps and speaker notes.",
    document: "Generate comprehensive written lesson content in HTML format. Use headings (h2, h3), paragraphs, bullet points, code blocks if relevant, and callout boxes for key information. Make it engaging and educational.",
    audio: "Generate a podcast-style script for an audio lesson. Include an engaging introduction, clearly structured talking points, examples, and a conclusion with key takeaways.",
    quiz: "Generate a set of review questions that test understanding of the lesson material. Include a mix of question types with explanations for correct answers.",
    interactive: "Generate content for an interactive lesson including step-by-step exercises, hands-on activities, and practice scenarios. Format as structured instructions with expected outcomes.",
  };

  const instruction = contentInstructions[contentType] || contentInstructions.document;

  const content = await askClaude(
    `You are an expert course content creator. Create detailed, engaging, and educational lesson content.

Always respond with valid JSON matching this schema:
{
  "content": "string (the full lesson content, HTML formatted for document/interactive types, plain text for video/audio scripts)",
  "key_points": ["string (3-5 key takeaways from this lesson)"],
  "estimated_duration": number (realistic duration in minutes to consume this content)
}`,
    `Create lesson content for:

Lesson Title: ${lessonTitle}
Course Context: ${courseContext}
Content Type: ${contentType}

${instruction}

Make the content thorough, practical, and engaging. Include real-world examples where appropriate.`
  );

  return JSON.parse(extractJSON(content)) as LessonContent;
}

export async function generateQuizQuestions(
  topic: string,
  context: string = "",
  count: number = 5,
  difficulty: string = "intermediate"
): Promise<QuizQuestion[]> {
  const content = await askClaude(
    `You are an expert assessment creator. Generate high-quality quiz questions that effectively test understanding at the specified difficulty level.

Always respond with valid JSON matching this schema:
{
  "questions": [
    {
      "question": "string",
      "question_type": "multiple-choice" | "true-false" | "fill-in-blank",
      "options": ["string"] (required for multiple-choice, 4 options; for true-false use ["True", "False"]; omit for fill-in-blank),
      "correct_answer": string | number (for multiple-choice: 0-based index of correct option; for true-false: "True" or "False"; for fill-in-blank: the correct text),
      "explanation": "string (explain why this is the correct answer)",
      "points": number (1-5 based on difficulty)
    }
  ]
}`,
    `Generate ${count} quiz questions about:

Topic: ${topic}
${context ? `Context: ${context}` : ""}
Difficulty: ${difficulty}

Requirements:
- Mix question types: aim for ~60% multiple-choice, ~20% true-false, ~20% fill-in-blank
- Questions should test comprehension, not just recall
- Include practical application questions
- Explanations should be educational and help reinforce learning
- Points: 1 for easy, 2-3 for medium, 4-5 for hard questions
- Ensure questions are clear and unambiguous`
  );

  const parsed = JSON.parse(extractJSON(content));
  return parsed.questions as QuizQuestion[];
}

export async function generateCourseFromMaterials(
  text: string,
  options: GenerateFromMaterialsOptions = {}
): Promise<CourseOutline> {
  const { title, difficulty = "intermediate", format = "self-paced" } = options;
  const truncatedText = text.slice(0, 12000);

  const content = await askClaude(
    `You are an expert instructional designer. You analyze existing content/materials and restructure them into a well-organized course with logical progression and pedagogically sound structure.

Always respond with valid JSON matching this exact schema:
{
  "title": "string",
  "description": "string (2-3 paragraphs, engaging and informative)",
  "short_description": "string (max 160 chars)",
  "modules": [
    {
      "title": "string",
      "description": "string (1-2 sentences)",
      "lessons": [
        {
          "title": "string",
          "content_type": "video" | "document" | "audio" | "quiz" | "interactive",
          "duration": number (in minutes),
          "description": "string (1 sentence)"
        }
      ]
    }
  ],
  "tags": ["string"],
  "suggested_category": "string (one of: Compliance, Management, Technical, Sales, Soft Skills, Business)"
}`,
    `Analyze the following content and create a structured course from it:

${title ? `Suggested Title: ${title}` : ""}
Difficulty Level: ${difficulty}
Format: ${format}

--- SOURCE MATERIAL ---
${truncatedText}
--- END SOURCE MATERIAL ---

Requirements:
- Extract the main topics and concepts from the material
- Organize into logical modules with progressive difficulty
- Create lessons that cover all key points from the source material
- Add assessment/quiz modules to reinforce learning
- Include introductory and summary sections
- Vary content types for engagement
- Generate relevant tags based on the content`
  );

  return JSON.parse(extractJSON(content)) as CourseOutline;
}

export async function improveCourseDescription(
  currentDescription: string,
  courseTitle: string
): Promise<ImprovedDescription> {
  const content = await askClaude(
    `You are an expert copywriter specializing in educational content marketing. Improve course descriptions to be more engaging, clear, and compelling while maintaining accuracy.

Always respond with valid JSON matching this schema:
{
  "description": "string (2-3 paragraphs, engaging, highlights learning outcomes and value)",
  "short_description": "string (max 160 characters, compelling summary)"
}`,
    `Improve the following course description:

Course Title: ${courseTitle}
Current Description: ${currentDescription}

Make it:
- More engaging and compelling
- Clearly state what learners will gain
- Include learning outcomes
- Use active, motivating language
- Maintain professional tone
- Keep the core message intact`
  );

  return JSON.parse(extractJSON(content)) as ImprovedDescription;
}
