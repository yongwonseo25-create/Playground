import type { HttpClient } from "./http";
import type { SolapiAuthSigner } from "./solapi-auth";
import type {
  SolapiFallbackMessagePayload,
  SolapiPrimaryMessagePayload,
} from "./solapi-kakao";

export interface CreateGroupInput {
  allowDuplicates?: boolean;
  appId?: string;
  strict?: boolean;
  customFields?: Record<string, string>;
}

export interface SolapiGroupCreateResponse {
  groupId: string;
  status?: string;
}

export interface SolapiGroupResponse {
  groupId: string;
  status: string;
  scheduledDate?: string;
}

export interface SolapiAddMessagesResultItem {
  to: string;
  messageId: string;
  statusCode: string;
  statusMessage: string;
}

export interface SolapiAddMessagesResponse {
  errorCount: string | number;
  resultList: SolapiAddMessagesResultItem[];
}

export interface CreateScheduledKakaoGroupInput extends CreateGroupInput {
  messages: SolapiPrimaryMessagePayload[] | SolapiFallbackMessagePayload[];
  scheduledDateUtcIso: string;
}

export class SolapiAdapter {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly authSigner: SolapiAuthSigner,
  ) {}

  private headers() {
    return this.authSigner.sign();
  }

  async createGroup(
    input: CreateGroupInput = {},
  ): Promise<SolapiGroupCreateResponse> {
    const response = await this.httpClient.request<SolapiGroupCreateResponse>({
      method: "POST",
      path: "/messages/v4/groups",
      headers: this.headers(),
      body: {
        allowDuplicates: input.allowDuplicates ?? false,
        appId: input.appId,
        strict: input.strict ?? true,
        customFields: input.customFields,
      },
    });

    return response.data;
  }

  async addMessages(
    groupId: string,
    messages: SolapiPrimaryMessagePayload[] | SolapiFallbackMessagePayload[],
  ): Promise<SolapiAddMessagesResponse> {
    const response = await this.httpClient.request<SolapiAddMessagesResponse>({
      method: "PUT",
      path: `/messages/v4/groups/${groupId}/messages`,
      headers: this.headers(),
      body: { messages },
    });

    return response.data;
  }

  async scheduleGroup(
    groupId: string,
    scheduledDateUtcIso: string,
  ): Promise<SolapiGroupResponse> {
    const response = await this.httpClient.request<SolapiGroupResponse>({
      method: "POST",
      path: `/messages/v4/groups/${groupId}/schedule`,
      headers: this.headers(),
      body: { scheduledDate: scheduledDateUtcIso },
    });

    return response.data;
  }

  async cancelScheduledGroup(groupId: string): Promise<SolapiGroupResponse> {
    const response = await this.httpClient.request<SolapiGroupResponse>({
      method: "DELETE",
      path: `/messages/v4/groups/${groupId}/schedule`,
      headers: this.headers(),
    });

    return response.data;
  }

  async createScheduledKakaoGroup(
    input: CreateScheduledKakaoGroupInput,
  ): Promise<{
    group: SolapiGroupCreateResponse;
    addedMessages: SolapiAddMessagesResponse;
    scheduledGroup: SolapiGroupResponse;
  }> {
    const group = await this.createGroup(input);
    const addedMessages = await this.addMessages(group.groupId, input.messages);
    const scheduledGroup = await this.scheduleGroup(
      group.groupId,
      input.scheduledDateUtcIso,
    );

    return {
      group,
      addedMessages,
      scheduledGroup,
    };
  }
}
