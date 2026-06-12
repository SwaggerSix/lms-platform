import ManageStoreClient from "./manage-client";

export const metadata = { title: "Manage Store" };

export default async function ManageStorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ManageStoreClient storeId={id} />;
}
