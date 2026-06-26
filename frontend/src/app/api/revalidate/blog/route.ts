import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

// ISR webhook — blog-engine calls this when a post is published/updated so the
// statically-generated /blog and /blog/[slug] pages refresh immediately instead
// of waiting for the 1h revalidate window.
//
// Auth: a shared secret in the X-Revalidate-Secret header (BLOG_REVALIDATE_SECRET).

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.BLOG_REVALIDATE_SECRET;
  if (!secret || request.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json({ revalidated: false, error: 'unauthorized' }, { status: 401 });
  }

  let slug: string | undefined;
  try {
    const body = (await request.json()) as { slug?: string };
    slug = body.slug;
  } catch {
    // body optional — revalidate the index regardless
  }

  revalidatePath('/blog');
  if (slug) revalidatePath(`/blog/${slug}`);

  return NextResponse.json({ revalidated: true, slug: slug ?? null });
}
