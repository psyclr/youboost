import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { getPost } from '@/lib/blog/api';
import { articleJsonLd } from '@/lib/structured-data';

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://youboost.io';

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: 'Post not found' };

  const url = `${SITE_URL}/blog/${post.slug}`;
  return {
    // Bare title — the root layout applies the `%s — YouBoost` template.
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      type: 'article',
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      ...(post.coverImageUrl ? { images: [{ url: post.coverImageUrl }] } : {}),
    },
    twitter: {
      card: post.coverImageUrl ? 'summary_large_image' : 'summary',
      title: post.title,
      description: post.description,
      ...(post.coverImageUrl ? { images: [post.coverImageUrl] } : {}),
    },
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const jsonLd = articleJsonLd({
    title: post.title,
    description: post.description,
    slug: post.slug,
    publishedAt: post.publishedAt ?? post.createdAt,
    updatedAt: post.updatedAt,
    author: post.author,
    siteUrl: SITE_URL,
    ...(post.coverImageUrl ? { coverImageUrl: post.coverImageUrl } : {}),
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link href="/blog" className="text-[13px] text-[#a2a2a2] hover:underline">
        ← Back to blog
      </Link>

      <article className="mt-6">
        <h1 className="text-3xl font-bold text-white">{post.title}</h1>
        <div className="mt-3 flex items-center gap-2 text-[12px] text-[#676767]">
          <span>{post.author}</span>
          <span>·</span>
          <time dateTime={post.publishedAt ?? undefined}>{formatDate(post.publishedAt)}</time>
          {post.readingTimeMin ? <span>· {post.readingTimeMin} min read</span> : null}
        </div>

        {post.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImageUrl}
            alt={post.coverImageAlt ?? post.title}
            className="mt-6 w-full rounded-lg object-cover"
          />
        ) : null}

        <div className="mt-8 max-w-none text-[15px] leading-7 text-[#d4d4d4]">
          <ReactMarkdown
            components={{
              h2: ({ children }) => (
                <h2 className="mt-8 mb-3 text-xl font-semibold text-white">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="mt-6 mb-2 text-lg font-semibold text-white">{children}</h3>
              ),
              p: ({ children }) => <p className="mb-4">{children}</p>,
              ul: ({ children }) => <ul className="mb-4 list-disc pl-6">{children}</ul>,
              ol: ({ children }) => <ol className="mb-4 list-decimal pl-6">{children}</ol>,
              li: ({ children }) => <li className="mb-1">{children}</li>,
              a: ({ href, children }) => (
                <a href={href} className="text-[#FE2721] underline">
                  {children}
                </a>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-white">{children}</strong>
              ),
            }}
          >
            {post.content}
          </ReactMarkdown>
        </div>
      </article>
    </main>
  );
}
