import React from 'react';
import StatusAlert from './StatusAlert';
import ProfileHeader from './ProfileHeader';
import ProfileStats from './ProfileStats';
import ProfileBio from './ProfileBio';
import ProfileContact from './ProfileContact';
import ProfileListings from './ProfileListings';
import ProfileReviews from './ProfileReviews';
import ProfileSidebar from './ProfileSidebar';

// Mock data for demonstration
const agent = {
  name: 'Jane Doe',
  title: 'Licensed Real Estate Agent',
  location: 'New York, NY',
  avatarUrl: '/default-avatar.png',
  email: 'jane.doe@example.com',
};
const stats = {
  listings: 12,
  sold: 34,
  yearsExperience: 7,
  reviews: 18,
};
const bio =
  'Jane Doe is a top-performing real estate agent with over 7 years of experience helping clients buy and sell homes in New York. She is known for her dedication, market knowledge, and client-first approach.';
const contact = {
  email: 'jane.doe@example.com',
  phone: '(555) 123-4567',
  website: 'https://janedoerealestate.com',
};
const listings = [
  {
    id: 1,
    title: 'Modern Apartment in Manhattan',
    location: 'Manhattan, NY',
    price: 1200000,
    imageUrl: '/listing1.jpg',
  },
  {
    id: 2,
    title: 'Cozy Condo in Brooklyn',
    location: 'Brooklyn, NY',
    price: 850000,
    imageUrl: '/listing2.jpg',
  },
];
const reviews = [
  {
    client: 'Alice Smith',
    rating: 5,
    comment: 'Jane was amazing! She made the process so easy and stress-free.'
  },
  {
    client: 'Bob Johnson',
    rating: 4,
    comment: 'Very professional and knowledgeable. Highly recommend!'
  },
];
const status = 'Your profile has been updated successfully.';

export default function ProfilePage() {
  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <div className="flex-1">
        <StatusAlert status={status} />
        <ProfileHeader agent={agent} />
        <ProfileStats stats={stats} />
        <ProfileBio bio={bio} />
        <ProfileContact contact={contact} />
        <ProfileListings listings={listings} />
        <ProfileReviews reviews={reviews} />
      </div>
      <ProfileSidebar agent={agent} />
    </div>
  );
}
