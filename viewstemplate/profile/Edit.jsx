import React, {useState} from 'react';
import AppLayout from '../components/layouts/AppLayout';
import UpdateProfileInformationForm from './partials/UpdateProfileInformationForm';
import UpdatePasswordForm from './partials/UpdatePasswordForm';
import DeleteUserForm from './partials/DeleteUserForm';

export default function ProfileEdit() {
  return (
    <AppLayout title="Edit Profile">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded p-4 shadow">
          <UpdateProfileInformationForm />
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded p-4 shadow"><UpdatePasswordForm /></div>
          <div className="bg-white rounded p-4 shadow"><DeleteUserForm /></div>
        </div>
      </div>
    </AppLayout>
  );
}
