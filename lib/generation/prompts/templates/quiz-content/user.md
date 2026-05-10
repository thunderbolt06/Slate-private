Title: {{title}}
Description: {{description}}
Test Points: {{keyPoints}}
Question Count: {{questionCount}}, Difficulty: {{difficulty}}, Question Types: {{questionTypes}}

Generate **exactly {{questionCount}} questions** that thoroughly cover the test points above. **Vary the question types** across the set so the learner is exercised on recall, comprehension, and application — do not return all questions of the same type. Distribute difficulty across the questions (mix easier warm-ups with harder application questions). Each question should be standalone, unambiguous, and have a clearly correct answer.

**Language Requirement**: Questions and options must be in the same language as the title and description above.

Output JSON array directly (no explanation, no code blocks, no LaTeX):
[{"id":"q1","type":"single","question":"Question text","options":["Option A","Option B","Option C","Option D"],"correctAnswer":"Option A"}]
