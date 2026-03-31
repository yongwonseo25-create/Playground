import type { FallbackChannel } from './solapi-fallback';
import { chooseFallback } from './solapi-fallback';

export interface AtaPayloadInput {
  to: string;
  from: string;
  pfId: string;
  templateId: string;
  variables: Record<string, string>;
}

export interface BmsFreePayloadInput {
  to: string;
  from: string;
  pfId: string;
  text: string;
}

export interface FallbackPayloadInput {
  to: string;
  from: string;
  text: string;
  preferred: FallbackChannel;
  subject?: string;
}

export type PrimaryPayload =
  | {
      to: string;
      from: string;
      type: 'ATA';
      kakaoOptions: {
        pfId: string;
        templateId: string;
        variables: Record<string, string>;
        disableSms: true;
      };
    }
  | {
      to: string;
      from: string;
      text: string;
      type: 'BMS_FREE';
      kakaoOptions: {
        pfId: string;
        disableSms: true;
        bms: {
          targeting: 'I';
          chatBubbleType: 'TEXT';
        };
      };
    };

export type FallbackPayload =
  | {
      to: string;
      from: string;
      text: string;
      type: 'SMS';
    }
  | {
      to: string;
      from: string;
      text: string;
      type: 'LMS';
      subject?: string;
    };

export function renderAtaPayload(input: AtaPayloadInput): PrimaryPayload {
  return {
    to: input.to,
    from: input.from,
    type: 'ATA',
    kakaoOptions: {
      pfId: input.pfId,
      templateId: input.templateId,
      variables: input.variables,
      disableSms: true,
    },
  };
}

export function renderBmsFreePayload(input: BmsFreePayloadInput): PrimaryPayload {
  return {
    to: input.to,
    from: input.from,
    text: input.text,
    type: 'BMS_FREE',
    kakaoOptions: {
      pfId: input.pfId,
      disableSms: true,
      bms: {
        targeting: 'I',
        chatBubbleType: 'TEXT',
      },
    },
  };
}

export function renderFallbackPayload(input: FallbackPayloadInput): FallbackPayload {
  const route = chooseFallback(input.text, input.preferred);

  if (route === 'SMS') {
    return {
      to: input.to,
      from: input.from,
      text: input.text,
      type: 'SMS',
    };
  }

  return {
    to: input.to,
    from: input.from,
    text: input.text,
    type: 'LMS',
    subject: input.subject,
  };
}
