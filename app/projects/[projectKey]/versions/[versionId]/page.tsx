import React from 'react';
import VersionPageClient from './VersionPageClient';

// This is now a Server Component.
// Notice there is NO 'use client';
// It's 'async' so we can 'await' the params.

export default async function VersionPage({ params: paramsPromise }: {
  // The error was right: params is a Promise here.
  params: Promise<{ projectKey: string; versionId: string }>
}) {
  
  // 1. We 'await' the params promise, as the error message demanded.
  const { projectKey, versionId } = await paramsPromise;

  // 2. We now pass the *resolved, plain string* params to our
  //    Client Component, which will do all the data fetching.
  return (
    <VersionPageClient 
      projectKey={projectKey} 
      versionId={versionId} 
    />
  );
}