export function organizationJsonLd(siteUrl: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'YouBoost',
    url: siteUrl,
    logo: `${siteUrl}/brand/logo-mark-square-red.svg`,
    sameAs: [],
  };
}

export function websiteJsonLd(siteUrl: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'YouBoost',
    url: siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/blog?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export interface ArticleJsonLdProps {
  title: string;
  description: string;
  slug: string;
  publishedAt: string;
  updatedAt?: string;
  author: string;
  coverImageUrl?: string;
  siteUrl: string;
}

export function articleJsonLd(props: ArticleJsonLdProps): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: props.title,
    description: props.description,
    url: `${props.siteUrl}/blog/${props.slug}`,
    datePublished: props.publishedAt,
    dateModified: props.updatedAt ?? props.publishedAt,
    author: {
      '@type': 'Person',
      name: props.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'YouBoost',
      logo: {
        '@type': 'ImageObject',
        url: `${props.siteUrl}/brand/logo-mark-square-red.svg`,
      },
    },
    ...(props.coverImageUrl
      ? { image: { '@type': 'ImageObject', url: props.coverImageUrl } }
      : {}),
  };
}
