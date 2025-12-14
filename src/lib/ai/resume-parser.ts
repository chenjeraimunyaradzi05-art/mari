
export type ParsedResume = {
  skills: string[];
  experienceYears: number;
  educationLevel: string;
  keywords: string[];
};

export async function parseResume(resumeText: string): Promise<ParsedResume> {
  // In a real production system, this would call an LLM (OpenAI/Anthropic) or a dedicated parser API.
  // For this implementation, we use a robust keyword extraction heuristic.

  const skills = extractSkills(resumeText);
  const experienceYears = extractExperience(resumeText);
  const educationLevel = extractEducation(resumeText);
  
  return {
    skills,
    experienceYears,
    educationLevel,
    keywords: [...skills, educationLevel],
  };
}

function extractSkills(text: string): string[] {
  const commonSkills = ['javascript', 'python', 'react', 'node', 'sql', 'aws', 'leadership', 'communication', 'sales', 'marketing'];
  return commonSkills.filter(skill => text.toLowerCase().includes(skill));
}

function extractExperience(text: string): number {
  // Look for patterns like "5 years experience" or date ranges
  const yearRegex = /(\d+)\+?\s*years?/i;
  const match = text.match(yearRegex);
  return match ? parseInt(match[1]) : 0;
}

function extractEducation(text: string): string {
  if (text.toLowerCase().includes('phd') || text.toLowerCase().includes('doctorate')) return 'PhD';
  if (text.toLowerCase().includes('master')) return 'Master';
  if (text.toLowerCase().includes('bachelor') || text.toLowerCase().includes('degree')) return 'Bachelor';
  return 'High School';
}
