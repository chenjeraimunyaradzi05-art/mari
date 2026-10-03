/**
 * Where else to turn, once a report is in.
 *
 * Reporting to ATHENA is not the only door, and for two kinds of report it is
 * not the most powerful one. An intimate image shared without consent is
 * something the eSafety Commissioner can order taken down wherever it has
 * spread, and has powers against the person who shared it; a threat to hurt
 * someone is, past a point, a matter for the police. A confirmation that said
 * only "thanks, our team will look" left a woman who had just done the hardest
 * part to find the rest out for herself. These are the pointers shown on the
 * confirmation screens, for the reasons that have them.
 *
 * Nothing here is something ATHENA does for her: they are other people's
 * services, said to be so. The Australian ones, because ATHENA is an Australian
 * company and the first place its members are.
 *
 * BEFORE LAUNCH, and after any change of number or address: check these against
 * the services' own pages (esafety.gov.au, police.qld.gov.au, triplezero.gov.au).
 * A number or a link that has moved is worse than none, and nothing in this
 * repository will notice on its own. The eSafety address is the one the server
 * publishes for the same purpose (AU_ONLINE_SAFETY_CONFIG.complaintUrl).
 */

export const ESAFETY_REPORT_URL = 'https://www.esafety.gov.au/report';
/** Queensland Police's line for crime that is not happening right now. */
export const POLICELINK_PHONE = '131 444';
export const EMERGENCY_PHONE = '000';

export interface NextStepLink {
  label: string;
  href: string;
  /** A phone number, dialled rather than opened in a new tab. */
  phone?: boolean;
}

export interface NextSteps {
  heading: string;
  paragraphs: string[];
  links: NextStepLink[];
}

const POLICELINK: NextStepLink = { label: `Policelink ${POLICELINK_PHONE}`, href: `tel:${POLICELINK_PHONE.replace(/\D/g, '')}`, phone: true };
const EMERGENCY: NextStepLink = { label: `Call ${EMERGENCY_PHONE} if you are in danger now`, href: `tel:${EMERGENCY_PHONE}`, phone: true };
const ESAFETY: NextStepLink = { label: 'Report to the eSafety Commissioner', href: ESAFETY_REPORT_URL };

const INTIMATE_IMAGE: NextSteps = {
  heading: 'If a picture of you was shared without your consent',
  paragraphs: [
    'Our safety team looks at a report like this one first. You can also report it to the eSafety Commissioner, an Australian government office that can require the websites and apps an image is on to take it down, not only ATHENA, and can act against the person who shared it. Reporting to them costs nothing.',
    'Sharing, or threatening to share, an intimate image without consent is a crime in Australia. You can tell the police: Policelink in Queensland, or your local police elsewhere, and 000 if you are in danger now. It helps to keep screenshots and the links.',
  ],
  links: [ESAFETY, POLICELINK, EMERGENCY],
};

const THREAT: NextSteps = {
  heading: 'If someone has threatened to hurt you or someone else',
  paragraphs: [
    'Our safety team looks at a report like this one first. If anyone is in danger right now, call 000 and do not wait for us.',
    'For a threat that is not happening right now, you can tell the police: Policelink in Queensland, or your local police elsewhere. The eSafety Commissioner can also help with serious abuse made online. It helps to keep screenshots and the links.',
  ],
  links: [EMERGENCY, POLICELINK, ESAFETY],
};

/**
 * The pointers for a report, or null for a reason that has none. "violence" is
 * the dialog's older "Violence or threats", read the same as a threat, because
 * somebody who picked it may have meant one.
 */
export function nextStepsFor(reason: string | null | undefined): NextSteps | null {
  switch ((reason ?? '').trim().toLowerCase()) {
    case 'intimate_image':
      return INTIMATE_IMAGE;
    case 'threat':
    case 'violence':
      return THREAT;
    default:
      return null;
  }
}
