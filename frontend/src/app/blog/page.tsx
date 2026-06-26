import type { Metadata } from 'next';
import Link from 'next/link';
import { getPosts } from '@/lib/blog/api';

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://youboost.io';

export const metadata: Metadata = {
  // Bare title — the root layout applies the `%s — YouBoost` template.
  title: 'Blog',
  description: 'Guides and insights on YouTube growth, SMM, and content marketing.',
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: 'Blog — YouBoost',
    description: 'Guides and insights on YouTube growth, SMM, and content marketing.',
    url: `${SITE_URL}/blog`,
    type: 'website',
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function BlogIndexPage() {
  const { data: posts } = await getPosts(1, 24);

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-white">Blog</h1>
        <p className="mt-2 text-[#a2a2a2]">
          Guides and insights on YouTube growth, SMM, and content marketing.
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="text-[#676767]">No posts yet — check back soon.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group flex flex-col overflow-hidden rounded-lg border transition-colors hover:border-[#555]"
              style={{ borderColor: '#363636', background: '#0a0a0a' }}
            >
              {post.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.coverImageUrl}
                  alt={post.title}
                  className="h-40 w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-40 w-full" style={{ background: '#141414' }} />
              )}
              <div className="flex flex-1 flex-col p-4">
                <h2 className="text-[16px] font-semibold text-white group-hover:underline">
                  {post.title}
                </h2>
                <p className="mt-2 line-clamp-3 flex-1 text-[13px] text-[#a2a2a2]">
                  {post.description}
                </p>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-[#676767]">
                  <time dateTime={post.publishedAt ?? undefined}>
                    {formatDate(post.publishedAt)}
                  </time>
                  {post.readingTimeMin ? <span>· {post.readingTimeMin} min read</span> : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
