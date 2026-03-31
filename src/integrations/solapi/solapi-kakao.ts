import {
  chooseFallback,
  type FallbackType,
  type PreferredFallbackChannel,
} from "./fallback-policy";

export type SolapiPrimaryChannel = "ATA" | "BMS_FREE";
export type SolapiFallbackChannel = "SMS" | "LMS";

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
  preferred: PreferredFallbackChannel;
  subject?: string;
}

export interface AtaMessagePayload {
  to: string;
  from: string;
  type: "ATA";
  kakaoOptions: {
    pfId: string;
    templateId: string;
    variables: Record<string, string>;
    disableSms: true;
  };
}

export interface BmsFreeMessagePayload {
  to: string;
  from: string;
  text: string;
  type: "BMS_FREE";
  kakaoOptions: {
    pfId: string;
    disableSms: true;
    bms: {
      targeting: "I";
      chatBubbleType: "TEXT";
    };
  };
}

export interface SmsMessagePayload {
  to: string;
  from: string;
  text: string;
  type: "SMS";
}

export interface LmsMessagePayload {
  to: string;
  from: string;
  text: string;
  type: "LMS";
  subject?: string;
}

export type SolapiPrimaryMessagePayload =
  | AtaMessagePayload
  | BmsFreeMessagePayload;

export type SolapiFallbackMessagePayload =
  | SmsMessagePayload
  | LmsMessagePayload;

export function renderAtaPayload(input: AtaPayloadInput): AtaMessagePayload {
  return {
    to: input.to,
    from: input.from,
    type: "ATA",
    kakaoOptions: {
      pfId: input.pfId,
      templateId: input.templateId,
      variables: input.variables,
      disableSms: true,
    },
  };
}

export function renderBmsFreePayload(
  input: BmsFreePayloadInput,
): BmsFreeMessagePayload {
  return {
    to: input.to,
    from: input.from,
    text: input.text,
    type: "BMS_FREE",
    kakaoOptions: {
      pfId: input.pfId,
      disableSms: true,
      bms: {
        targeting: "I",
        chatBubbleType: "TEXT",
      },
    },
  };
}

export function renderFallbackPayload(
  input: FallbackPayloadInput,
): SolapiFallbackMessagePayload {
  const fallbackType = chooseFallback(input.text, input.preferred);

  if (fallbackType === "LMS") {
    return {
      to: input.to,
      from: input.from,
      text: input.text,
      type: "LMS",
      subject: input.subject,
    };
  }

  return {
    to: input.to,
    from: input.from,
    text: input.text,
    type: "SMS",
  };
}

export function resolveFallbackType(
  text: string,
  preferred: PreferredFallbackChannel,
): Exclude<FallbackType, "NONE"> {
  return chooseFallback(text, preferred) === "LMS" ? "LMS" : "SMS";
}
