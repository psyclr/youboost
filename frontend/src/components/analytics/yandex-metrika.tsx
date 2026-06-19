import Script from 'next/script';

const COUNTER_ID = 109942271;

/**
 * Yandex.Metrika counter (id 109942271). Rendered only in production so dev/e2e
 * page views never pollute the real counter.
 *
 * `ecommerce: "dataLayer"` is enabled — to populate e-commerce reports, push
 * events to `window.dataLayer` at the money steps (add-to-cart, purchase). That
 * wiring is a follow-up; the base counter (pageviews, webvisor, clickmap) works
 * on its own.
 */
export function YandexMetrika() {
  if (process.env.NODE_ENV !== 'production') return null;
  return (
    <>
      <Script id="yandex-metrika" strategy="afterInteractive">
        {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
        (window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=${COUNTER_ID}', 'ym');
        ym(${COUNTER_ID}, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", accurateTrackBounce:true, trackLinks:true});`}
      </Script>
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://mc.yandex.ru/watch/${COUNTER_ID}`}
            style={{ position: 'absolute', left: '-9999px' }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}
