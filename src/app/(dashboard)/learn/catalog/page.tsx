import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import CatalogClient, { type CatalogCourse } from "./catalog-client";

export const metadata: Metadata = {
  title: "Course Catalog | LMS Platform",
  description: "Browse and enroll in courses across all categories and skill levels",
};

const GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-amber-500 to-orange-600",
  "from-red-500 to-rose-600",
  "from-green-500 to-emerald-600",
  "from-purple-500 to-violet-600",
  "from-cyan-500 to-blue-600",
  "from-slate-600 to-gray-800",
  "from-pink-500 to-rose-600",
  "from-emerald-500 to-teal-600",
  "from-indigo-500 to-purple-600",
  "from-yellow-500 to-amber-600",
  "from-sky-500 to-blue-600",
];

function mapDifficulty(level: string): "Beginner" | "Intermediate" | "Advanced" {
  const map: Record<string, "Beginner" | "Intermediate" | "Advanced"> = {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  };
  return map[level?.toLowerCase()] ?? "Beginner";
}

function mapCourseType(type: string): "Video" | "Interactive" | "Document" | "Blended" {
  const map: Record<string, "Video" | "Interactive" | "Document" | "Blended"> = {
    self_paced: "Video",
    instructor_led: "Interactive",
    blended: "Blended",
    scorm: "Document",
    external: "Document",
  };
  return map[type] ?? "Video";
}

function mapCategory(categoryName: string | null): string {
  if (!categoryName) return "Technology";
  const lower = categoryName.toLowerCase();
  if (lower.includes("tech") || lower.includes("data") || lower.includes("cloud") || lower.includes("cyber")) return "Technology";
  if (lower.includes("leader") || lower.includes("manage")) return "Leadership";
  if (lower.includes("business") || lower.includes("finance") || lower.includes("project")) return "Business";
  if (lower.includes("compliance") || lower.includes("safety") || lower.includes("regulation")) return "Compliance";
  if (lower.includes("soft") || lower.includes("communication")) return "Soft Skills";
  return "Technology";
}

export default async function CourseCatalogPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser) redirect("/login");

  const { data: dbCourses } = await service
    .from("courses")
    .select("*, category:categories(name)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(50);

  const courses: CatalogCourse[] = (dbCourses ?? []).map((c, i) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    description: c.description || c.short_description || "",
    instructor: "Instructor",
    difficulty: mapDifficulty(c.difficulty_level),
    type: mapCourseType(c.course_type),
    duration: c.estimated_duration || 60,
    rating: 4.5 + (((i * 7) % 5) / 10),
    reviewCount: 100 + ((i * 37) % 400),
    enrolledCount: 500 + ((i * 137) % 5000),
    category: mapCategory(c.category?.name ?? null),
    gradient: GRADIENTS[i % GRADIENTS.length],
    createdAt: c.created_at,
  }));

  return <CatalogClient courses={courses} />;
}
