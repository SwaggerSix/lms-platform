import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import OrganizationsClient from "./organizations-client";
import type { OrgNode } from "./organizations-client";

export const metadata: Metadata = {
  title: "Organizations | LMS Platform",
  description: "Manage organizational hierarchy, departments, and team structures",
};

export default async function OrganizationsPage() {
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Verify user exists in users table
  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  // Fetch all organizations
  const { data: orgsRaw } = await service
    .from("organizations")
    .select("id, name, parent_id, type, metadata, created_at, updated_at")
    .order("name", { ascending: true });

  // Fetch user counts per organization
  const { data: userCountsRaw } = await service
    .from("users")
    .select("organization_id");

  // Build a map of organization_id -> user count
  const userCountMap: Record<string, number> = {};
  if (userCountsRaw) {
    for (const u of userCountsRaw as any[]) {
      if (u.organization_id) {
        userCountMap[u.organization_id] = (userCountMap[u.organization_id] || 0) + 1;
      }
    }
  }

  // Build org tree from flat list
  const orgs = (orgsRaw || []) as any[];
  const orgMap: Record<string, OrgNode & { parent_id: string | null }> = {};

  // First pass: create all nodes
  for (const org of orgs) {
    orgMap[org.id] = {
      id: org.id,
      name: org.name,
      type: org.type || "company",
      memberCount: userCountMap[org.id] || 0,
      manager: org.metadata?.manager || "Unassigned",
      parent_id: org.parent_id,
      children: [],
    };
  }

  // Second pass: build hierarchy
  const roots: OrgNode[] = [];
  for (const org of Object.values(orgMap)) {
    if (org.parent_id && orgMap[org.parent_id]) {
      orgMap[org.parent_id].children!.push(org);
    } else {
      roots.push(org);
    }
  }

  // Recursively sum member counts from children
  function sumMembers(node: OrgNode): number {
    let total = node.memberCount;
    if (node.children) {
      for (const child of node.children) {
        total += sumMembers(child);
      }
    }
    node.memberCount = total;
    return total;
  }

  for (const root of roots) {
    sumMembers(root);
  }

  // Build a single root node if there are multiple roots, or use the single root
  const orgTree: OrgNode = roots.length === 1
    ? roots[0]
    : {
        id: "root",
        name: "All Organizations",
        type: "company",
        memberCount: roots.reduce((sum, r) => sum + r.memberCount, 0),
        manager: "Unassigned",
        children: roots,
      };

  return <OrganizationsClient orgTree={orgTree} />;
}
