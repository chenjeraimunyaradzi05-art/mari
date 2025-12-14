import Image from 'next/image';
import { SponsorAd } from '@/lib/feed-config';

type Props = {
  ads: SponsorAd[];
  position?: string;
};

export function AdSlot({ ads, position }: Props) {
  if (!ads || ads.length === 0) return null;

  return (
    <div className="ad-slot" aria-label={`Sponsor placement ${position ?? ''}`}>
      {ads.map((ad, index) => (
        <article key={`${ad.title}-${index}`} className="ad-card">
          {ad.badge ? <span className="ad-pill">{ad.badge}</span> : null}
          <div className="ad-card__body">
            <div className="ad-card__copy">
              <h3>{ad.title}</h3>
              {ad.description ? <p>{ad.description}</p> : null}
              {ad.ctaUrl && ad.ctaText ? (
                <a
                  className="ad-cta"
                  href={ad.ctaUrl}
                  target={ad.external ? '_blank' : undefined}
                  rel={ad.external ? 'noreferrer' : undefined}
                >
                  {ad.ctaText}
                </a>
              ) : null}
            </div>
            {ad.mediaUrl ? (
              <div className="ad-card__media" aria-hidden="true">
                <Image src={ad.mediaUrl} alt="Sponsor" width={420} height={260} />
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
