import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import ContentEditor from "@/components/content-editor/content-editor";
import { type ContentBlock } from "@/lib/content/block-editor";

export const metadata: Metadata = {
  title: "Content Editor | LMS Platform",
  description: "Build rich lesson content with the block editor",
};

interface PageProps {
  params: Promise<{ slug: string; lessonId: string }>;
}

export default async function ContentEditorPage({ params }: PageProps) {
  const { slug, lessonId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();

  // Verify user role
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser || !["admin", "instructor"].includes(dbUser.role)) {
    redirect("/dashboard");
  }

  // Fetch lesson with its module and course info
  const { data: lesson } = await service
    .from("lessons")
    .select("id, title, module_id")
    .eq("id", lessonId)
    .single();

  if (!lesson) {
    redirect(`/admin/courses`);
  }

  // Fetch course by slug
  const { data: course } = await service
    .from("courses")
    .select("id, title, slug")
    .eq("slug", slug)
    .single();

  if (!course) {
    redirect(`/admin/courses`);
  }

  // Fetch existing content blocks
  const { data: blocksData } = await service
    .from("content_blocks")
    .select("*")
    .eq("lesson_id", lessonId)
    .order("sequence_order", { ascending: true });

  // Transform DB blocks to ContentBlock format
  const blocks: ContentBlock[] = (blocksData || []).map((dbBlock: {
    id: string;
    block_type: string;
    content: Record<string, unknown>;
    sequence_order: number;
  }) => {
    const { settings, ...content } = dbBlock.content as Record<string, unknown> & { settings?: Record<string, unknown> };
    return {
      id: dbBlock.id,
      type: dbBlock.block_type as ContentBlock["type"],
      content,
      settings: (settings as ContentBlock["settings"]) || {
        alignment: "left",
        width: "normal",
        padding: "medium",
      },
    } as ContentBlock;
  });

  // Enable content blocks on the lesson if not already
  await service
    .from("lessons")
    .update({ content_blocks_enabled: true })
    .eq("id", lessonId);

  return (
    <ContentEditor
      lessonId={lessonId}
      initialBlocks={blocks}
      lessonTitle={lesson.title}
      courseTitle={course.title}
      courseSlug={course.slug}
    />
  );
}
