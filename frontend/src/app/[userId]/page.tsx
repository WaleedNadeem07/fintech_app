import { Dashboard } from '@/components/Dashboard';

export default async function UserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return (
    <main className="min-h-screen">
      <Dashboard userId={userId} />
    </main>
  );
}
