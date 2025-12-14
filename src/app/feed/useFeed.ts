"use client";

import { useCallback } from 'react';
import useSWRInfinite from 'swr/infinite';

const PAGE_SIZE = 10;

export type FeedOrganization = {
  id?: string;
  name?: string;
  logo?: string | null;
  type?: string | null;
  verified?: boolean | null;
};

export type FeedItem = {
  id: string;
  title?: string | null;
  content: string;
  mediaUrl?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  visibility?: string | null;
  createdAt?: string;
  viewsCount?: number;
  organization?: FeedOrganization | null;
  ranking?: {
    score: number;
    reasons: string[];
  };
  author?: {
    firstName?: string | null;
    lastName?: string | null;
    profileImage?: string | null;
  };
};

type FeedResponse = {
  data: FeedItem[];
  pagination: {
    limit: number;
    offset: number;
    count: number;
  };
};

const fetcher = async (url: string): Promise<FeedResponse> => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Feed request failed: ${res.status}`);
  }
  return res.json();
};

export function useFeed(activeFilter: string, pageSize = PAGE_SIZE) {
  const getKey = (pageIndex: number, previousPageData?: FeedResponse) => {
    if (previousPageData && previousPageData.data.length < pageSize) return null;
    const offset = pageIndex * pageSize;
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(offset),
      filter: activeFilter,
    });
    return `/api/feed?${params.toString()}`;
  };

  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite<FeedResponse>(getKey, fetcher, {
    revalidateFirstPage: true,
  });

  const items = data?.flatMap((page) => page.data) ?? [];
  const isLoadingInitial = !data && !error;
  const isLoadingMore = isLoadingInitial || (size > 0 && data && typeof data[size - 1] === 'undefined');
  const isReachingEnd = Boolean(data && data[data.length - 1]?.data.length < pageSize);
  const isRefreshing = Boolean(isValidating && data);

  const refresh = useCallback(() => mutate(), [mutate]);

  return {
    items,
    error,
    isLoadingInitial,
    isLoadingMore,
    isReachingEnd,
    isRefreshing,
    setSize,
    refresh,
  };
}
