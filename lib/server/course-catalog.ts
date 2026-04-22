import { createClient } from '@supabase/supabase-js';
import { generateObject } from 'ai';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import type { SceneOutline } from '@/lib/types/generation';
import type { Stage } from '@/lib/types/stage';
import { resolveModel } from '@/lib/server/resolve-model';

const log = createLogger('CourseCatalog');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export interface CourseCatalogMetadata {
  /** Crisp, catalog-ready title (3–7 words) */
  catalog_title: string;
  /** A cohesive, engaging short description (1-3 sentences) */
  headline: string;
  subject: string;
  age_range: string;
  topic: string;
  sub_topic: string;
}

/** @deprecated Use CourseCatalogMetadata */
export type CourseTags = CourseCatalogMetadata;

const CourseCatalogMetadataSchema = z.object({
  catalog_title: z.string().describe('Crisp 3-7 word title for a course catalog listing'),
  headline: z.string().describe('A cohesive, engaging short description (1-3 sentences)'),
  subject: z.enum(['Mathematics', 'Science', 'History', 'Language Arts', 'Technology', 'Art', 'Music', 'Business']),
  age_range: z.enum(['5-10', '11-14', '15-18', '18+', '0-100']).describe('Use 0-100 for general audiences'),
  topic: z.string().describe('Specific topic, e.g. Algebra, Biology, Ancient Rome'),
  sub_topic: z.string().describe('Narrow sub-topic, e.g. Quadratic Equations, Photosynthesis, Julius Caesar'),
});

/**
 * Inserts a course into the public catalog and generates AI metadata
 * (title + tags) in the background.
 */
export async function insertCourseAndGenerateTags(
  stage: Stage,
  outlines: SceneOutline[],
  requirement: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
) {
  try {
    log.info(`Inserting course into catalog: ${stage.id}`);

    const { error: courseError } = await supabase.from('courses').upsert({
      id: stage.id,
      stage_id: stage.id,
      name: stage.name,
      title: stage.name,
      description: outlines[0]?.description || requirement.slice(0, 200),
      slide_count: outlines.length,
      language: stage.language || 'en-US',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (courseError) {
      log.error('Failed to insert course into Supabase:', courseError);
      return;
    }

    log.info(`Generating AI catalog metadata for course: ${stage.id}`);
    const outlineContext = outlines.map((o, i) => `${i + 1}. ${o.title}: ${o.description}`).join('\n');
    const metadata = await generateCourseMetadata({
      name: stage.name,
      language: stage.language || 'en-US',
      requirement,
      outlineContext,
      model,
    });

    if (metadata) {
      const { error: titleError } = await supabase
        .from('courses')
        .update({
          name: metadata.catalog_title,
          title: metadata.catalog_title,
          headline: metadata.headline,
        })
        .eq('id', stage.id);

      if (titleError) {
        log.error('Failed to update catalog title:', titleError);
      } else {
        log.info(`Catalog title updated for ${stage.id}: "${metadata.catalog_title}"`);
      }

      const tagEntries = [
        { course_id: stage.id, tag_type: 'subject', tag_value: metadata.subject },
        { course_id: stage.id, tag_type: 'age_range', tag_value: metadata.age_range },
        { course_id: stage.id, tag_type: 'topic', tag_value: metadata.topic },
        { course_id: stage.id, tag_type: 'sub_topic', tag_value: metadata.sub_topic },
      ];

      const { error: tagError } = await supabase.from('course_tags').upsert(tagEntries, {
        onConflict: 'course_id,tag_type,tag_value',
      });

      if (tagError) {
        log.error('Failed to insert course tags:', tagError);
      } else {
        log.info(`Catalog metadata stored for course: ${stage.id}`);
      }
    }
  } catch (error) {
    log.error('Error in catalog background task:', error);
  }
}

/**
 * Generate catalog metadata for a course that was uploaded from the client
 * (generation-preview flow). Uses the default server model.
 *
 * Fired as a background task from POST /api/courses.
 */
export async function generateCatalogMetadataForCourse(params: {
  courseId: string;
  courseName: string;
  language: string;
  sceneTitles: string[];
}): Promise<void> {
  const { courseId, courseName, language, sceneTitles } = params;

  try {
    log.info(`Generating catalog metadata for client course: ${courseId}`);

    const { model } = resolveModel({});
    const outlineContext = sceneTitles.map((title, i) => `${i + 1}. ${title}`).join('\n');

    const metadata = await generateCourseMetadata({
      name: courseName,
      language,
      requirement: courseName,
      outlineContext,
      model,
    });

    if (!metadata) return;

    const { error: titleError } = await supabase
      .from('courses')
      .update({
        name: metadata.catalog_title,
        title: metadata.catalog_title,
        headline: metadata.headline,
      })
      .eq('id', courseId);

    if (titleError) {
      log.error('Failed to update catalog title for client course:', titleError);
    } else {
      log.info(`Catalog title updated for client course ${courseId}: "${metadata.catalog_title}"`);
    }

    const tagEntries = [
      { course_id: courseId, tag_type: 'subject', tag_value: metadata.subject },
      { course_id: courseId, tag_type: 'age_range', tag_value: metadata.age_range },
      { course_id: courseId, tag_type: 'topic', tag_value: metadata.topic },
      { course_id: courseId, tag_type: 'sub_topic', tag_value: metadata.sub_topic },
    ];

    const { error: tagError } = await supabase.from('course_tags').upsert(tagEntries, {
      onConflict: 'course_id,tag_type,tag_value',
    });

    if (tagError) {
      log.error('Failed to insert tags for client course:', tagError);
    } else {
      log.info(`Catalog metadata stored for client course: ${courseId}`);
    }
  } catch (error) {
    log.error('Error generating catalog metadata for client course:', error);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface GenerateMetadataParams {
  name: string;
  language: string;
  requirement: string;
  outlineContext: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any;
}

async function generateCourseMetadata(
  params: GenerateMetadataParams,
): Promise<CourseCatalogMetadata | null> {
  const { name, language, requirement, outlineContext, model } = params;
  const lang = language === 'zh-CN' ? 'Chinese' : 'English';

  const systemPrompt = `You are an expert curriculum cataloger. Analyze course content and return structured catalog metadata. All output fields must be in ${lang}.`;

  const userPrompt = `Course Name: ${name}
User Requirement: ${requirement}
Scene Outlines:
${outlineContext}`;

  try {
    const { object } = await generateObject({
      model,
      schema: CourseCatalogMetadataSchema,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxOutputTokens: 1024,
    });

    return object;
  } catch (error) {
    log.error('Failed to generate course catalog metadata:', error);
    return null;
  }
}
