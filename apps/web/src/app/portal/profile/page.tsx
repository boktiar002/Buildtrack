'use client';

import { ProfileForms } from '@/components/profile';
import { PageHeader } from '@/components/ui';

export default function Profile() {
  return (
    <div>
      <PageHeader title="Profile" />
      <ProfileForms />
    </div>
  );
}
